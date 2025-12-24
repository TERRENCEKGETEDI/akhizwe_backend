require('dotenv').config();
const pool = require('./src/db');

async function addDataBalanceToUsers() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS data_balance DECIMAL(10,2) DEFAULT 0
    `);
    console.log('Data balance column added to users table successfully');
  } catch (error) {
    console.error('Error adding data balance column:', error);
  } finally {
    pool.end();
  }
}

addDataBalanceToUsers();