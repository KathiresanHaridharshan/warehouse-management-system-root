const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'warehouse.db');

let db;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemCode TEXT UNIQUE NOT NULL,
      itemName TEXT NOT NULL,
      supplier TEXT DEFAULT '',
      location TEXT DEFAULT '',
      colorHex TEXT DEFAULT '#cccccc',
      imageURL TEXT DEFAULT '',
      quantity INTEGER DEFAULT 0 CHECK(quantity >= 0),
      description TEXT DEFAULT '',
      palletSlot INTEGER UNIQUE CHECK(palletSlot >= 1 AND palletSlot <= 100),
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materialId INTEGER,
      itemName TEXT NOT NULL,
      type TEXT NOT NULL, -- 'ADD', 'INCREASE', 'DECREASE', 'UPDATE', 'DELETE'
      quantityChange INTEGER DEFAULT 0,
      newQuantity INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, closeDatabase };
