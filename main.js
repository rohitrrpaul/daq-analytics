const { app, BrowserWindow } = require("electron");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL("http://localhost:3000");
  
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Start checking for updates
  checkForUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  
    autoUpdater.on("update-available", () => {
      dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: "A new version is available. Downloading now...",
      });
    });
  
    autoUpdater.on("update-downloaded", () => {
      dialog.showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "Update downloaded. The app will restart to install the update.",
      }).then(() => {
        autoUpdater.quitAndInstall();
      });
    });
  
    autoUpdater.on("error", (error) => {
      console.error("Update error:", error);
    });
  }