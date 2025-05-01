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
      // Create a sample temporary table
      db.run(`
        CREATE TABLE IF NOT EXISTS temp_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error("❌ Failed to create table:", err.message);
        } else {
          console.log("✅ Temporary table 'temp_data' created successfully.");
        }
      });
    });
  } else {
    console.log("📁 Database already exists. Skipping creation.");
  }

  return db;
}

module.exports = { initializeDatabase };
