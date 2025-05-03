const { app, BrowserWindow, dialog, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const ModbusRTU = require("modbus-serial");
const { initializeDatabase } = require("./database/db"); 
const db = initializeDatabase();
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const axios = require("axios");

let mainWindow;
let modbusClient = null;
let pollingInterval = null;
const dayjs = require("dayjs");

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
      preload: path.join(__dirname, "preload.js"),
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

  function checkPassword(password, djangoHash) {
    const [algo, iter, salt, hash] = djangoHash.split("$");
    const derived = crypto.pbkdf2Sync(password, salt, parseInt(iter), 32, "sha256").toString("base64");
    return derived === hash;
  }
  
  // ipcMain.handle("login-check", async (_, username, password) => {
  //   const db = new sqlite3.Database("./database/daqanalytics.db");
  
  //   return new Promise((resolve) => {
  //     db.get("SELECT * FROM credentials WHERE username = ?", [username], async (err, row) => {
  //       if (row) {
  //         const valid = checkPassword(password, row.hashed_password);
  //         return resolve(valid ? { from: "local", row } : false);
  //       }
  
  //       try {
  //         const res = await axios.post("http://127.0.0.1:8000/api/login/", { username, password });
  //         const data = res.data;
  
  //         resolve({
  //           from: "api",
  //           record: {
  //             username,
  //             hashed_password: data.hashed_password,
  //             serial_key: data.serial_key,
  //             valid_from: data.valid_from,
  //             valid_till: data.valid_till,
  //           }
  //         });
  //       } catch (e) {
  //         resolve(false);
  //       }
  //     });
  //   });
  // });

  ipcMain.handle("login-check", async (_, username, password) => {
    const db = new sqlite3.Database("./database/daqanalytics.db");
  
    return new Promise((resolve) => {
      db.get("SELECT * FROM credentials WHERE username = ?", [username], async (err, row) => {
        if (row) {
          const valid = checkPassword(password, row.hashed_password);
  
          if (!valid) return resolve(false);
  
          const now = dayjs();
          const start = dayjs(row.valid_from);
          const end = dayjs(row.valid_till);
          console.log(now.format("YYYY-MM-DD")+' '+start.format("YYYY-MM-DD"))
  
          if (now.isBefore(start) || now.isAfter(end)){
            return resolve({ expired: true, from: "local", row });
          }
  
          return resolve({ from: "local", row });
        }
  
        // If not found locally, call the API
        try {
          const res = await axios.post("http://127.0.0.1:8000/api/login/", { username, password });
          const data = res.data;
  
          const now = dayjs();
          const start = dayjs(data.valid_from);
          const end = dayjs(data.valid_till);
  
          if (now.isBefore(start) || now.isAfter(end)) {
            return resolve({ expired: true, from: "api", record: data });
          }
  
          resolve({
            from: "api",
            record: {
              username,
              hashed_password: data.hashed_password,
              serial_key: data.serial_key,
              valid_from: data.valid_from,
              valid_till: data.valid_till,
            }
          });
        } catch (e) {
          resolve(false);
        }
      });
    });
  });
  
  ipcMain.handle("save-credentials", async (_, record) => {
    const db = new sqlite3.Database("./database/daqanalytics.db");
  
    return new Promise((resolve) => {
      db.run(
        `INSERT INTO credentials (username, hashed_password, serial_key, valid_from, valid_till)
         VALUES (?, ?, ?, ?, ?)`,
        [record.username, record.hashed_password, record.serial_key, record.valid_from, record.valid_till],
        (err) => resolve(!err)
      );
    });
  });  
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
