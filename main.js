import { app, BrowserWindow, screen, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import("electron-updater").then(({ default: updater }) => {
  const autoUpdater = updater.autoUpdater;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  import("electron-reload").then(({ default: reload }) => {
    reload(__dirname, {
      electron: path.join(__dirname, "node_modules", ".bin", "electron"),
    });
  });

  let mainWindow;

  app.whenReady().then(() => {

    const { bounds } = screen.getPrimaryDisplay(); // Get full screen bounds

    mainWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.webContents.session.clearCache();
    mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    setTimeout(() => checkForUpdates(autoUpdater), 5000); // Delay update check for stability
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  function checkForUpdates(autoUpdater) {
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
      console.error("Update error:", error);
    });

    // ✅ Check for updates
    autoUpdater.checkForUpdatesAndNotify();
  }
});
