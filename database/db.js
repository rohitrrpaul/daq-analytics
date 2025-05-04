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
    });
  } else {
    console.log("📁 Database already exists. Skipping creation.");
  }

  return db;
}

module.exports = { initializeDatabase };
