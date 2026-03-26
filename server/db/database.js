const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function getDatabase() {
  return pool;
}

async function initializeSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id SERIAL PRIMARY KEY,
        itemCode TEXT UNIQUE NOT NULL,
        itemName TEXT NOT NULL,
        supplier TEXT DEFAULT '',
        location TEXT DEFAULT '',
        colorHex TEXT DEFAULT '#cccccc',
        imageURL TEXT DEFAULT '',
        quantity INTEGER DEFAULT 0 CHECK(quantity >= 0),
        description TEXT DEFAULT '',
        palletSlot INTEGER UNIQUE CHECK(palletSlot >= 1 AND palletSlot <= 100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        materialId INTEGER,
        itemName TEXT NOT NULL,
        type TEXT NOT NULL,
        quantityChange INTEGER DEFAULT 0,
        newQuantity INTEGER DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

module.exports = { getDatabase, initializeSchema };
