const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  screen,
  Tray,
  clipboard,
  dialog,
} = require("electron");
const { spawn, exec } = require("child_process");
const path = require("node:path");
const { readUrl } = require("./addFromClipboard.js");
const fs = require("node:fs");
const { upsertItem, readItem } = require("./dataStore.js");
const { v4 } = require("uuid");

const configsDir = path.join(__dirname, "config");

let v2rayProcess;
let tray = null;
let mainWindow = null;
let isConnected = false;

if (!fs.existsSync(configsDir)) {
  fs.mkdirSync(configsDir);
}

const connectedIcon = path.join(__dirname, "tray_connected.ico"); // Icon for connected status
const disconnectedIcon = path.join(__dirname, "tray_disconnected.ico"); // Icon for disconnected status

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: 350,
    height: 450,
    x: workArea.width - 430,
    y: workArea.height - 450,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      plugins: path.join(__dirname, "renderer.js")
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("blur", () => {
    mainWindow.hide();
  });
}

function createTray() {
  tray = new Tray(disconnectedIcon); // Add your tray icon here
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Quit",
      click: () => {
        stopV2Ray();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Burmese Shield");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// Function to start V2Ray process
function startV2Ray() {
  const v2rayPath = path.join(__dirname, "v2ray", "v2ray.exe"); // Path to v2ray.exe
  let configPath;

  mainWindow.webContents.send("status-checking", "V2ray server starting...");

  if (readItem("currentServerId") != "") {
    configPath = path.join(
      __dirname,
      "config",
      `${readItem("currentServerId")}.json`
    ); // Path to config.json
  } else {
    configPath = path.join(__dirname, "config.json"); // Path to config.json
  }

  v2rayProcess = spawn(v2rayPath, ["run", "-config", configPath]);

  v2rayProcess.stdout.on("data", (data) => {
    if (data.includes("started")) {
      mainWindow.webContents.send("status-checking", "V2ray server started.");
      mainWindow.webContents.send("status-checking", "");
      isConnected = true;
      mainWindow.webContents.send("connecting-status", isConnected);
      tray.setImage(connectedIcon);
    }
    console.log(`V2Ray stdout: ${data}`);
  });

  v2rayProcess.stderr.on("data", (data) => {
    console.error(`V2Ray stderr: ${data}`);
    clearSystemProxy();
  });

  v2rayProcess.on("close", (code) => {
    console.log(`V2Ray process exited with code ${code}`);
    if (mainWindow) {
      mainWindow.webContents.send("status-checking", "V2ray server exited.");
      mainWindow.webContents.send("status-checking", "");
      isConnected = false;
      mainWindow.webContents.send("connecting-status", isConnected);
    }
  });
}

// Function to stop V2Ray process
function stopV2Ray() {
  if (v2rayProcess) {
    v2rayProcess.kill();
  }
  tray.setImage(disconnectedIcon);
}

//Function to set system proxy setting

function setSystemProxy() {
  const proxyUrl = `socks=localhost:10808`;

  const command = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d ${proxyUrl} /f`;

  mainWindow.webContents.send("status-checking", "System proxy setting...");

  exec(command, (error, stdout, stderr) => {
    console.log(proxyUrl, stdout);
    if (error) {
      console.error(`Error setting system proxy: ${error}`);
      mainWindow.webContents.send(
        "status-checking",
        "System proxy server error."
      );
      return;
    }
    console.log("System proxy set:", proxyUrl);

    const enableProxyCommand = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`;
    exec(enableProxyCommand, (err, out, errOut) => {
      if (err) {
        console.error(`Error enabling system proxy: ${err}`);
        mainWindow.webContents.send(
          "status-checking",
          "System proxy server error."
        );
        return;
      }
      mainWindow.webContents.send(
        "status-checking",
        "System proxy server started."
      );
      console.log("System proxy enabled");
    });
  });
}

function clearSystemProxy() {
  // Disable the system proxy
  const disableProxyCommand = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`;
  exec(disableProxyCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error disabling system proxy: ${error}`);
      return;
    }
    console.log("System proxy disabled");
    if (mainWindow) {
      mainWindow.webContents.send(
        "status-checking",
        "System proxy server stoping..."
      );
    }

    // Remove the proxy server setting
    const removeProxyCommand = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /f`;
    exec(removeProxyCommand, (err, out, errOut) => {
      if (err) {
        console.error(`Error removing proxy server setting: ${err}`);
        return;
      }
      console.log("Proxy server setting removed");
      if (mainWindow) {
        mainWindow.webContents.send(
          "status-checking",
          "System proxy server stopped."
        );
        mainWindow.webContents.send("status-checking", "");
      }
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  mainWindow.webContents.send("change-server-name", {
    serverName: readItem("currentServerName"),
  });

  ipcMain.handle("connect", () => {
    startV2Ray();
    setSystemProxy();
    mainWindow.webContents.send("status-checking", "");
  });

  ipcMain.handle("disconnect", () => {
    clearSystemProxy();
    stopV2Ray();
    mainWindow.webContents.send("status-checking", "");
  });

  ipcMain.handle("add-clipboard", () => {
    try {
      mainWindow.webContents.send(
        "status-checking",
        readUrl(clipboard.readText())
      );
      setTimeout(() => {
        mainWindow.webContents.send("status-checking", "");
      }, 500);
    } catch (error) {
      console.log("error adding config", error);
    }
  });

  ipcMain.handle("get-configs", async () => {
    const files = fs.readdirSync(configsDir);
    const configs = files.map((file) => {
      const filePath = path.join(configsDir, file);
      const data = fs.readFileSync(filePath, "utf-8");
      const config = JSON.parse(data);
      const stats = fs.statSync(filePath);
      return {
        remarks: config.remarks,
        id: config.id,
        mtime: stats.mtime,
      };
    });
    configs.sort((a, b) => b.mtime - a.mtime);
    return configs;
  });
  ipcMain.handle("pick-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "json", extensions: ["json"] }],
    });

    // Check if the user canceled the file picker
    if (result.canceled) {
      console.log("File picking was canceled.");
      return;
    }
    const data = fs.readFileSync(result.filePaths[0], "utf-8");
    const config = JSON.parse(data);
    config.id = v4();
    if (!config.remarks) {
      config.remarks = "";
    }
    const filePath = path.join(__dirname, "config", `${config.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  });

  ipcMain.on("delete-server", (event, data) => {
    const filePath = path.join(__dirname, "config", `${data}.json`);
    try {
      fs.unlinkSync(filePath);
      console.log("File deleted successfully");
    } catch (err) {
      console.error("Error deleting the file:", err);
    }
  });

  ipcMain.on("select-server", (event, data) => {
    upsertItem("currentServerId", data.id);
    upsertItem("currentServerName", data.remarks);
    mainWindow.webContents.send("change-server-name", {
      serverName: readItem("currentServerName"),
      serverId: readItem("currentServerId"),
    });
    if (isConnected) {
      clearSystemProxy();
      stopV2Ray();
      startV2Ray();
      setSystemProxy();
    }
  });

  app.on("will-quit", () => {
    stopV2Ray();
    clearSystemProxy();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    clearSystemProxy();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
