const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// In development, store next to main.js. In production, use app.getPath('userData')
const dbPath = path.join(__dirname, "daqanalytics.db");

function initializeDatabase() {
  const exists = fs.existsSync(dbPath);
  const db = new sqlite3.Database(dbPath);

  if (!exists) {
    console.log("🆕 Creating new SQLite database: daqanalytics.db");

    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            hashed_password TEXT,
            serial_key TEXT,
            valid_from TEXT,
            valid_till TEXT
        )`);

      db.run(`CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at TEXT
        )`);

        db.run(`
          CREATE TABLE IF NOT EXISTS configuration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            client_name TEXT,
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
        
    });
  } else {
    console.log("📁 Database already exists. Skipping creation.");
  }

  return db;
}

module.exports = { initializeDatabase };
