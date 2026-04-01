"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentCityDesktop", {
  getAppStatus: () => ipcRenderer.invoke("agentCity:getAppStatus"),
  openPath: (targetPath) => ipcRenderer.invoke("agentCity:openPath", targetPath),
  openReportsDirectory: () => ipcRenderer.invoke("agentCity:openReportsDirectory"),
  saveTextReport: (payload) => ipcRenderer.invoke("agentCity:saveTextReport", payload),
});
