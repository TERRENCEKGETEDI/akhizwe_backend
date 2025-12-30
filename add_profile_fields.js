require('dotenv').config();
const pool = require('./src/db');

async function addProfileFields() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_picture TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT
    `);
    console.log('Profile fields added successfully to users table');
  } catch (error) {
    console.error('Error adding profile fields:', error);
  } finally {
    pool.end();
  }
}

addProfileFields();