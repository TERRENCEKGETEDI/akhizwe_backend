require('dotenv').config();
const pool = require('./src/db');

async function alterMediaTable() {
  try {
    await pool.query(`
      ALTER TABLE media
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS download_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS file_size INT,
      ADD COLUMN IF NOT EXISTS copyright_declared BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS monetization_enabled BOOLEAN DEFAULT FALSE
    `);
    console.log('Media table altered successfully');
  } catch (error) {
    console.error('Error altering media table:', error);
  } finally {
    pool.end();
  }
}

alterMediaTable();