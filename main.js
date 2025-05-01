const { app, BrowserWindow, dialog, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const ModbusRTU = require("modbus-serial");
const { initializeDatabase } = require("./database/db"); 
const db = initializeDatabase();

let mainWindow;
let modbusClient = null;
let pollingInterval = null;


// Enable hot-reloading in development mode
if (process.env.NODE_ENV === "development") {
  require("electron-reload")(path.join(__dirname), {
    electron: require.resolve("electron"),
  });
}

// Create main application window
function createMainWindow() {
  const { bounds } = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "public", "preload.js"),
    },
  });

  mainWindow.webContents.session.clearCache();
  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  ipcMain.on("modbus-config", (event, config) => {
    // console.log("⚙️ Received dynamic Modbus config:", config);
    connectModbusRTU(config);
  });

  setTimeout(() => {
    // checkForUpdates(); // Optional if updates needed
    // connectModbusRTU();
  }, 5000);
}

// Window Control Handlers
ipcMain.on("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("maximize-window", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("close-window", () => {
  if (mainWindow) mainWindow.close();
});

// Check for updates
function checkForUpdates() {
  autoUpdater.on("update-available", () => {
    dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: "A new version is available. Downloading now...",
    });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "Update downloaded. The app will restart to install the update.",
      })
      .then(() => {
        autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("Update error:", error.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

async function connectModbusRTU(config) {
  if (modbusClient) {
    try {
      await modbusClient.close(); // Wait until fully closed
      console.log("🔌 Previous Modbus connection closed.");
    } catch (e) {
      console.warn("⚠️ Failed to close previous Modbus client:", e.message);
    }
  }

  modbusClient = new ModbusRTU();

  try {
    await modbusClient.connectRTUBuffered(config.port, {
      baudRate: config.baudrate,
      dataBits: config.dataBits,
      stopBits: config.stopBits,
      parity: config.parity || "none",
    });

    // console.log(`✅ Modbus connection established on ${config.port}`);
    modbusClient.setID(1);
    modbusClient.setTimeout(config.timeout || 1000);
    mainWindow.webContents.send("modbus-connected", true);

    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }

    pollingInterval = setInterval(() => {
      modbusClient.readInputRegisters(0, config.length || 16)
        .then((data) => {
          // console.log("📡 Modbus Input Registers:", data.data);
          mainWindow.webContents.send("serial-data", data.data);
        })
        .catch((err) => {
          isModbusConnected = false;
          mainWindow.webContents.send("modbus-connected", false);
          mainWindow.webContents.send("modbus-connection-error", err.message); // ✅ this line
          // console.error("❌ Error reading input registers:", err.message);
        });
    }, 2000);

  } catch (err) {
    isModbusConnected = false;
    mainWindow.webContents.send("modbus-connected", false);
    mainWindow.webContents.send("modbus-connection-error", err.message); // ✅ this line
    // console.error(`❌ Failed to connect to ${config.port}:`, err.message);
  }
}

// App lifecycle
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

app.whenReady().then(createMainWindow);
