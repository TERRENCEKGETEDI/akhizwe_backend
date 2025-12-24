require('dotenv').config();
const pool = require('./src/db');

async function alterUsersTable() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS pin VARCHAR(4),
      ADD COLUMN IF NOT EXISTS daily_airtime_limit DECIMAL DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS monthly_airtime_limit DECIMAL DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS last_purchase_date DATE
    `);
    console.log('Users table altered successfully');
  } catch (error) {
    console.error('Error altering users table:', error);
  } finally {
    pool.end();
  }
}

alterUsersTable();