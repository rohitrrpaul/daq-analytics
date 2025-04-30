const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.send("minimize-window"),
  maximize: () => ipcRenderer.send("maximize-window"),
  close: () => ipcRenderer.send("close-window"),

  onSerialData: (callback) => ipcRenderer.on("serial-data", (event, data) => callback(data)),
  onDeviceInfo: (callback) => ipcRenderer.on("device-info", (event, data) => callback(data)),
  onActiveSensors: (callback) => ipcRenderer.on("active-sensors", (event, data) => callback(data)),
});
