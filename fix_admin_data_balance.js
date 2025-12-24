require('dotenv').config();
const pool = require('./src/db');

async function fixAdminDataBalance() {
  try {
    await pool.query(
      "UPDATE users SET data_balance = 1024 WHERE email = 'admin@bathinibona.co.za'"
    );
    console.log('Admin data balance set to 1024');
  } catch (error) {
    console.error('Error setting admin data balance:', error);
  } finally {
    pool.end();
  }
}

fixAdminDataBalance();