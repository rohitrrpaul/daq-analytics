const { app, BrowserWindow, dialog, screen, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const ModbusRTU = require("modbus-serial");
const { initializeDatabase, getDatabase, closeDatabase } = require("./database/db");
const db = initializeDatabase();
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs");

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
      webSecurity: false,
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

  ipcMain.handle("login-check", async (_, username, password) => {
    const db = getDatabase();

    return new Promise((resolve) => {
      db.get("SELECT * FROM credentials WHERE username = ?", [username], async (err, row) => {
        if (row) {
          const valid = checkPassword(password, row.hashed_password);

          if (!valid) return resolve(false);

          const now = dayjs();
          const start = dayjs(row.valid_from);
          const end = dayjs(row.valid_till);
          console.log(now.format("YYYY-MM-DD") + ' ' + start.format("YYYY-MM-DD"))

          if (now.isBefore(start) || now.isAfter(end)) {
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
    const db = getDatabase();

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

ipcMain.handle("check-project-exists", async (_, name) => {
  return new Promise((resolve) => {
    db.get("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)", [name], (err, row) => {
      resolve(!!row);
    });
  });
});

ipcMain.handle("create-project", async (_, name) => {
  return new Promise((resolve) => {
    const createdAt = dayjs().format();
    db.run("INSERT INTO projects (name, created_at) VALUES (?, ?)", [name, createdAt], function (err) {
      if (err) return resolve(false);
      resolve({ id: this.lastID, name });
    });
  });
});

ipcMain.handle("get-projects", async () => {
  const startTime = Date.now();
  console.log("Starting get-projects query...");
  
  return new Promise((resolve) => {
    const db = getDatabase();
    console.log("Using database instance:", db);
    
    // First, let's check if we can get the total count
    db.get("SELECT COUNT(*) as count FROM projects", (err, countResult) => {
      if (err) {
        console.error("Error getting project count:", err);
      } else {
        console.log("Total projects in database:", countResult.count);
      }
    });

    // Then get the actual projects
    db.all("SELECT id, name FROM projects ORDER BY id DESC", (err, rows) => {
      const endTime = Date.now();
      console.log(`Query execution time: ${endTime - startTime}ms`);
      
      if (err) {
        console.error("Error fetching projects:", err);
        return resolve([]);
      }
      console.log(`Projects fetched: ${rows.length} records`);
      console.log("Projects data:", JSON.stringify(rows, null, 2));
      resolve(rows);
    });
  });
});

ipcMain.handle("save-well-config", async (event, data) => {
  
  const { projectId, inputs = {}, files = {} } = data;
  const folderPath = path.join(__dirname, "uploads", `${projectId}`);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const saveFile = (fileObj, fieldName) => {
    if (!fileObj?.content?.length) {
      console.log(`No file data for ${fieldName}`);
      return null;
    }
    const buffer = Buffer.from(fileObj.content);
    const dest = path.join(folderPath, `${fieldName}_${Date.now()}_${fileObj.name}`);
    fs.writeFileSync(dest, buffer);
    return dest;
  };  

  const clientLogo = saveFile(files.clientLogo, "client_logo");
  const completionPicture = saveFile(files.completionPicture, "completion_picture");
  const wellProgram = saveFile(files.wellProgram, "well_program");
  const designService = saveFile(files.designService, "design_service");

  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO configuration (
        project_id, client_name, client_logo, field_name, well_number, well_history,
        drilled_on, completed_on, completion_date, formation_type,
        last_operation, well_history_details, surface_location, rig_elevation,
        casing_details, critical_depth, tubing_details, max_deviation,
        reservoir_pressure, reservoir_temperature, last_hud,
        perforation_interval, pay_zone, minimum_id, well_status,
        completion_picture_path, well_program_path, design_service_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId, inputs.clientName, clientLogo, inputs.fieldName, inputs.wellNumber, inputs.wellHistory,
      inputs.drilledOn, inputs.completedOn, inputs.completionDate, inputs.formationType,
      inputs.lastOperation, inputs.wellHistoryDetails, inputs.surfaceLocation, inputs.rigElevation,
      inputs.casingDetails, inputs.criticalDepth, inputs.tubingDetails, inputs.maxDeviation,
      inputs.reservoirPressure, inputs.reservoirTemperature, inputs.lastHud,
      inputs.perforationInterval, inputs.payZone, inputs.minimumId, inputs.wellStatus, completionPicture, wellProgram, designService
    ], function (err) {
      if (err) return reject(err);
      resolve({ success: true });
    });    
  });
});

ipcMain.handle("get-configuration", async (event, projectId) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();

    db.get("SELECT * FROM configuration WHERE project_id = ?", [projectId], (err, row) => {
      if (err) {
        console.error("DB error:", err);
        reject(err);
      } else {
        console.log("Fetched row:", row);
        resolve(row || null);
      }
    });
  });
});

ipcMain.handle("save-file", async (event, { fileObj, fieldName, projectId }) => {
  try {
    const folderPath = path.join(__dirname, "uploads", `${projectId}`);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const buffer = Buffer.from(fileObj.content);
    const fileName = `${fieldName}_${Date.now()}_${fileObj.name}`;
    const dest = path.join(folderPath, fileName);

    fs.writeFileSync(dest, buffer);
    return fileName;
  } catch (err) {
    console.error("File save failed:", err);
    throw err;
  }
});

// Handle update
ipcMain.handle("update-configuration", async (event, config) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      UPDATE configuration
      SET 
        client_name = ?, client_logo = ?, field_name = ?, well_number = ?, well_history = ?,
        drilled_on = ?, completed_on = ?, completion_date = ?, formation_type = ?,
        last_operation = ?, well_history_details = ?, surface_location = ?, rig_elevation = ?,
        casing_details = ?, critical_depth = ?, tubing_details = ?, max_deviation = ?,
        reservoir_pressure = ?, reservoir_temperature = ?, last_hud = ?,
        perforation_interval = ?, pay_zone = ?, minimum_id = ?, well_status = ?,
        completion_picture_path = ?, well_program_path = ?, design_service_path = ?
      WHERE project_id = ?
    `);

    stmt.run([
      config.clientName, config.clientLogo, config.fieldName, config.wellNumber, config.wellHistory,
      config.drilledOn, config.completedOn, config.completionDate, config.formationType,
      config.lastOperation, config.wellHistoryDetails, config.surfaceLocation, config.rigElevation,
      config.casingDetails, config.criticalDepth, config.tubingDetails, config.maxDeviation,
      config.reservoirPressure, config.reservoirTemperature, config.lastHud,
      config.perforationInterval, config.payZone, config.minimumId, config.wellStatus,
      config.completionPicture, config.wellProgram, config.designService, config.projectId
    ], function (err) {
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
});

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
          mainWindow.webContents.send("modbus-connection-error", err.message);
        });
    }, 2000);

  } catch (err) {
    isModbusConnected = false;
    mainWindow.webContents.send("modbus-connected", false);
    mainWindow.webContents.send("modbus-connection-error", err.message);
  }
}

// App lifecycle
app.on("window-all-closed", () => {
  closeDatabase();
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

ipcMain.handle("save-sensor-mappings", async (event, { projectId, sensorData, checkedSensors }) => {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    // First, delete existing mappings for this project
    db.run("DELETE FROM sensor_mapping WHERE project_id = ?", [projectId], (err) => {
      if (err) {
        console.error("Error deleting existing mappings:", err);
        return reject(err);
      }

      // Prepare the insert statement
      const stmt = db.prepare(`
        INSERT INTO sensor_mapping (project_id, unit, long, annotation, value)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Insert only checked sensors
      const insertPromises = Object.entries(checkedSensors)
        .filter(([_, isChecked]) => isChecked) // Only process checked sensors
        .map(([sensorId, _]) => {
          return new Promise((resolve, reject) => {
            if (sensorData[sensorId]) {
              const sensor = sensorData[sensorId];
              stmt.run(
                [projectId, sensor.unit, sensor.long, sensor.annotation, parseInt(sensor.value)],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            }
          });
        });

      Promise.all(insertPromises)
        .then(() => {
          stmt.finalize();
          resolve({ success: true });
        })
        .catch((err) => {
          stmt.finalize();
          reject(err);
        });
    });
  });
});

ipcMain.handle("get-sensor-mappings", async (event, projectId) => {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM sensor_mapping WHERE project_id = ?", [projectId], (err, rows) => {
      if (err) {
        console.error("Error fetching sensor mappings:", err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});