const { app, BrowserWindow, dialog, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const ModbusRTU = require("modbus-serial");

// Enable hot-reloading in development mode
if (process.env.NODE_ENV === "development") {
  require("electron-reload")(path.join(__dirname), {
    electron: require.resolve("electron"),
  });
}

let mainWindow;

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

  setTimeout(() => {
    // checkForUpdates(); // Optional if updates needed
    connectModbusRTU();
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

// Modbus RTU communication on COM3
function connectModbusRTU() {
  const client = new ModbusRTU();

  client.connectRTUBuffered("COM3", {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "odd",
  })
    .then(() => {
      console.log("✅ Modbus connection established on COM3");
      client.setID(1); // Default device ID
      client.setTimeout(1000);

      setInterval(() => {
        client.readInputRegisters(0, 16)
          .then((data) => {
            console.log("📡 Modbus Input Registers:", data.data);
            if (mainWindow) {
              mainWindow.webContents.send("serial-data", data.data);
            }
          })
          .catch((err) => {
            console.error("❌ Error reading input registers:", err.message);
          });
      }, 2000);
    })
    .catch((err) => {
      console.error("❌ Failed to connect to COM3:", err.message);
    });
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
