const fs = require("fs");
const path = require("path");
const { v4 } = require("uuid");
const { Base64 } = require("js-base64");

const baseConfig = {
  dns: {
    hosts: {
      "domain:googleapis.cn": "googleapis.com",
    },
    servers: [
      "1.1.1.1",
      {
        address: "223.5.5.5",
        domains: ["geosite:cn", "geosite:geolocation-cn"],
        expectIPs: ["geoip:cn"],
        port: 53,
      },
    ],
  },
  inbounds: [
    {
      listen: "127.0.0.1",
      port: 10808,
      protocol: "socks",
      settings: {
        auth: "noauth",
        udp: true,
        userLevel: 8,
      },
      sniffing: {
        destOverride: ["http", "tls"],
        enabled: true,
        routeOnly: false,
      },
      tag: "socks",
    },
    {
      listen: "127.0.0.1",
      port: 10809,
      protocol: "http",
      settings: {
        userLevel: 8,
      },
      tag: "http",
    },
  ],
  log: {
    loglevel: "warning",
  },
  outbounds: [
    {
      protocol: "freedom",
      settings: {},
      tag: "direct",
    },
    {
      protocol: "blackhole",
      settings: {
        response: {
          type: "http",
        },
      },
      tag: "block",
    },
  ],
  routing: {
    domainStrategy: "IPIfNonMatch",
    rules: [
      {
        type: "field",
        ip: ["1.1.1.1"],
        outboundTag: "proxy",
        port: "53",
      },
      {
        type: "field",
        ip: ["223.5.5.5"],
        outboundTag: "direct",
        port: "53",
      },
      {
        type: "field",
        domain: ["domain:googleapis.cn"],
        outboundTag: "proxy",
      },
      {
        type: "field",
        ip: ["geoip:private"],
        outboundTag: "direct",
      },
      {
        type: "field",
        ip: ["geoip:cn"],
        outboundTag: "direct",
      },
      {
        type: "field",
        domain: ["geosite:cn"],
        outboundTag: "direct",
      },
      {
        type: "field",
        domain: ["geosite:geolocation-cn"],
        outboundTag: "direct",
      },
      {
        type: "field",
        outboundTag: "proxy",
        port: "0-65535",
      },
    ],
  },
};

// Function to decode vmess:// URL
function decodeVmessUrl(vmessUrl) {
  // Remove the vmess:// prefix
  const base64Data = vmessUrl.replace("vmess://", "");

  // Decode base64 data
  try {
    const decodedData = Base64.decode(base64Data);
    const config = JSON.parse(decodedData);
    return config;
  } catch (error) {
    console.error("Error decoding Vmess URL:", error);
    return null;
  }
}

// Function to decode vless:// URL
function decodeVlessUrl(vlessUrl) {
  try {
    const url = new URL(vlessUrl);
    const fragment = vlessUrl.split("#")[1];
    const params = Object.fromEntries(url.searchParams.entries());
    let remarks = "";
    console.log("params", params);

    if (fragment) {
      // Decode the fragment to handle URL encoding
      remarks = decodeURIComponent(fragment);
    }
    return {
      v: "2",
      ps: params.ps || "",
      add: url.hostname,
      port: url.port,
      id: url.username,
      aid: params.aid || "0",
      net: params.net || "tcp",
      type: params.type || "none",
      host: params.host || "",
      path: params.path || "/",
      tls: params.tls || "",
      sni: params.sni || "",
      alpn: params.alpn || "",
      fp: params.fp || "",
      ps: remarks,
    };
  } catch (error) {
    console.error("Error decoding Vless URL:", error);
    return null;
  }
}

// Function to read base64 data from the clipboard and decode it
function readUrl(url) {
  let config;
  if (url.startsWith("vmess://")) {
    config = decodeVmessUrl(url);
    config.protocol = "vmess";
  } else if (url.startsWith("vless://")) {
    config = decodeVlessUrl(url);
    config.protocol = "vless";
    config.encryption = "none";
  } else {
    console.error("Invalid URL scheme");
    return "Fail";
  }

  if (config) {
    config.pathId = v4();
    const v2rayConfig = generateV2RayConfig(config);

    // Save the config to a file
    const filePath = path.join(__dirname, "config", `${config.pathId}.json`);
    fs.writeFileSync(filePath, v2rayConfig, "utf-8");
    console.log("Config file saved to", filePath);
    return "Success";
  } else {
    console.log("Invalid URL");
    return "Fail";
  }
}

function generateV2RayConfig(config, protocol) {
  const outboundConfig = {
    mux: {
      concurrency: -1,
      enabled: false,
      xudpConcurrency: 8,
      xudpProxyUDP443: "",
    },
    protocol: config.protocol,
    settings: {
      vnext: [
        {
          address: config.add,
          port: parseInt(config.port),
          users: [
            {
              id: config.id,
              alterId: parseInt(config.aid),
              security: "auto",
              encryption: config.encryption || "",
            },
          ],
        },
      ],
    },
    streamSettings: {
      network: config.net,
      security: config.tls,
      tlsSettings: {
        serverName: config.sni,
        allowInsecure: false,
        fingerprint: "chrome",
      },
      wsSettings: {
        path: config.path,
        headers: {
          Host: config.host,
        },
      },
    },
    tag: "proxy",
  };

  const fullConfig = {
    ...baseConfig,
    id: config.pathId,
    outbounds: [outboundConfig, ...baseConfig.outbounds],
    remarks: config.ps,
  };

  return JSON.stringify(fullConfig, null, 2);
}

module.exports = { readUrl };
