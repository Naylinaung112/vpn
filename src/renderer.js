const { ipcRenderer, ipcMain } = require("electron");

const addModel = document.getElementById("addModel");
const serverListModel = document.getElementById("slistModel");
const powerBtn = document.getElementById("powerBtn");
const vpnBtn = document.getElementById("vpnBtn");
const vpnBtnAni = document.getElementById("vpnBtnAni");
const serverNameText = document.getElementById("serverName");

let isConnected = false;
let currentServerId = "";

vpnBtn.addEventListener("click", async (event) => {
  if (!isConnected) {
    ipcRenderer.invoke("connect");
  } else {
    ipcRenderer.invoke("disconnect");
  }
});

document.getElementById("addBtn").addEventListener("click", () => {
  addModel.style.display = "inline";
});

addModel.addEventListener("click", (event) => {
  event.currentTarget.style.display = "none";
});

serverListModel.addEventListener("click", (event) => {
  event.currentTarget.style.display = "none";
});

document.getElementById("clipboard").addEventListener("click", () => {
  ipcRenderer.invoke("add-clipboard");
});

document.getElementById("serverName").addEventListener("click", () => {
  serverListModel.style.display = "inline";
  ipcRenderer
    .invoke("get-configs")
    .then((configs) => {
      if (!configs) return;
      const configList = document.getElementById("configList");
      configList.innerHTML = "";
      configs.forEach((config,index, array) => {
        const listItem = document.createElement("div");
        const listItemName = document.createElement("div");
        const listItemDeleteBtn = document.createElement("div");
        const listItemDelete = document.createElement("div");
        listItem.classList.add("list");
        listItemName.textContent = config.remarks;
        listItemDelete.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M170.5 51.6L151.5 80h145l-19-28.4c-1.5-2.2-4-3.6-6.7-3.6H177.1c-2.7 0-5.2 1.3-6.7 3.6zm147-26.6L354.2 80H368h48 8c13.3 0 24 10.7 24 24s-10.7 24-24 24h-8V432c0 44.2-35.8 80-80 80H112c-44.2 0-80-35.8-80-80V128H24c-13.3 0-24-10.7-24-24S10.7 80 24 80h8H80 93.8l36.7-55.1C140.9 9.4 158.4 0 177.1 0h93.7c18.7 0 36.2 9.4 46.6 24.9zM80 128V432c0 17.7 14.3 32 32 32H336c17.7 0 32-14.3 32-32V128H80zm80 64V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16zm80 0V400c0 8.8-7.2 16-16 16s-16-7.2-16-16V192c0-8.8 7.2-16 16-16s16 7.2 16 16z"/></svg>`;
        listItemName.classList.add("list-name");
        listItemDelete.classList.add("delete-icon");
        listItemDeleteBtn.classList.add("delete-btn");
        listItemDeleteBtn.append(listItemDelete);
        listItem.append(listItemName, listItemDeleteBtn);
        configList.appendChild(listItem);
        listItemDelete.addEventListener("click", () => {
          if (currentServerId !== config.id) {
            ipcRenderer.send("delete-server", config.id);
          } else if (!isConnected || array.length == 0) {
            ipcRenderer.send("select-server", {
              id: "",
              remarks: "",
            });
            ipcRenderer.send("delete-server", config.id);
          }
        });
        listItemName.addEventListener("click", () => {
          console.log("select");
          ipcRenderer.send("select-server", {
            id: config.id,
            remarks: config.remarks,
          });
        });
        if (currentServerId === config.id) {
          listItem.classList.add("selected-list");
          listItemDelete.style.fill = "white";
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching configs:", error);
    });
});

ipcRenderer.on("change-server-name", (event, data) => {
  if (data.serverName) {
    serverNameText.textContent = data.serverName;
  } else {
    serverNameText.textContent = "Burmese Shield";
  }
  currentServerId = data.serverId;
});

ipcRenderer.on("status-checking", (event, data) => {
  document.getElementById("status").textContent = data;
});

ipcRenderer.on("connecting-status", (event, data) => {
  isConnected = data;
  if (isConnected) {
    vpnBtn.style.backgroundColor = "purple";
    powerBtn.style.fill = "white";
    vpnBtnAni.style.display = "inline";

    return;
  }
  vpnBtn.style.backgroundColor = "#f8f8f8";
  powerBtn.style.fill = "purple";
  vpnBtnAni.style.display = "none";
});

document.getElementById("locally").addEventListener('click', () => {
  ipcRenderer.invoke('pick-file')
})
