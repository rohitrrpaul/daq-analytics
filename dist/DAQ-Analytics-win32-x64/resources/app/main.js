const { app, BrowserWindow, dialog, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

// Enable hot-reloading in development mode
if (process.env.NODE_ENV === "development") {
  require("electron-reload")(path.join(__dirname), {
    electron: require.resolve("electron"),
  });
}

let mainWindow;

// Create main application window
function createMainWindow() {
  const { bounds } = screen.getPrimaryDisplay(); // Get full screen bounds

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false, // Standard window frame
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false, // Keep secure
      contextIsolation: true,
      preload: path.join(__dirname, "public", "preload.js"), // Secure preload script
    },
  });

  mainWindow.webContents.session.clearCache();
  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setTimeout(() => checkForUpdates(), 5000); // Delay update check
}

// Window Control Handlers (Placed Outside `createMainWindow`)
ipcMain.on("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("maximize-window", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize(); // Restore to normal size
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

// Quit the app when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle app activation on macOS
app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Wait for Electron to be ready before creating the window
app.whenReady().then(createMainWindow);
