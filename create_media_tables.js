require('dotenv').config();
const pool = require('./src/db');
const fs = require('fs');

async function createTables() {
  try {
    const sql = fs.readFileSync('media_tables.sql', 'utf8');
    await pool.query(sql);
    console.log('Media tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    pool.end();
  }
}

createTables();