const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// In development, store next to main.js. In production, use app.getPath('userData')
const dbPath = path.join(__dirname, "daqanalytics.db");

let dbInstance = null;

function initializeDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const exists = fs.existsSync(dbPath);
  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error connecting to database:", err);
      return null;
    }
    console.log("Connected to SQLite database");
  });

  if (!exists) {
    console.log("🆕 Creating new SQLite database: daqanalytics.db");

    dbInstance.serialize(() => {
      dbInstance.run(`CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            hashed_password TEXT,
            serial_key TEXT,
            valid_from TEXT,
            valid_till TEXT
        )`);

      dbInstance.run(`CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at TEXT
        )`);

      dbInstance.run(`
          CREATE TABLE IF NOT EXISTS configuration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            client_name TEXT,
            client_logo TEXT,
            field_name TEXT,
            well_number TEXT,
            well_history TEXT,
            drilled_on TEXT,
            completed_on TEXT,
            completion_date TEXT,
            formation_type TEXT,
            last_operation TEXT,
            well_history_details TEXT,
            surface_location TEXT,
            rig_elevation TEXT,
            casing_details TEXT,
            critical_depth TEXT,
            tubing_details TEXT,
            max_deviation TEXT,
            reservoir_pressure TEXT,
            reservoir_temperature TEXT,
            last_hud TEXT,
            perforation_interval TEXT,
            pay_zone TEXT,
            minimum_id TEXT,
            well_status TEXT,
            completion_picture_path TEXT,
            well_program_path TEXT,
            design_service_path TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

      dbInstance.run(`
          CREATE TABLE IF NOT EXISTS sensor_mapping (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            unit TEXT,
            long TEXT,
            annotation TEXT,
            value INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
          )
      `);
    });
  } else {
    console.log("📁 Database already exists. Skipping creation.");
  }

  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
      } else {
        console.log("Database connection closed");
        dbInstance = null;
      }
    });
  }
}

module.exports = { 
  initializeDatabase,
  getDatabase,
  closeDatabase
};
