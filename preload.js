const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.send("minimize-window"),
  maximize: () => ipcRenderer.send("maximize-window"),
  close: () => ipcRenderer.send("close-window"),

  onSerialData: (callback) => ipcRenderer.on("serial-data", (event, data) => callback(data)),
  sendModbusConfig: (config) => ipcRenderer.send("modbus-config", config),
  onModbusConnection: (callback) => ipcRenderer.on("modbus-connected", (_, status) => callback(status)),
  onModbusConnectionError: (callback) => ipcRenderer.on("modbus-connection-error", (_, message) => callback(message)),

  loginCheck: (username, password) => ipcRenderer.invoke("login-check", username, password),
  saveCredentials: (record) => ipcRenderer.invoke("save-credentials", record),
  getProjects: () => ipcRenderer.invoke("get-projects"),

  getConfiguration: (projectId) => ipcRenderer.invoke("get-configuration", projectId),
  updateConfiguration: (config) => ipcRenderer.invoke("update-configuration", config),

  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Sensor mapping functions
  saveSensorMappings: (projectId, sensorData, checkedSensors) => 
    ipcRenderer.invoke("save-sensor-mappings", { projectId, sensorData, checkedSensors }),
  
  getSensorMappings: (projectId) => 
    ipcRenderer.invoke("get-sensor-mappings", projectId),
});