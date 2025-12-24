require('dotenv').config();
const pool = require('./src/db');

async function checkDataBalance() {
  try {
    const result = await pool.query("SELECT data_balance FROM users WHERE email = 'admin@bathinibona.co.za'");
    console.log('Admin data_balance:', result.rows[0].data_balance);
  } catch (error) {
    console.error('Error checking data balance:', error);
  } finally {
    pool.end();
  }
}

checkDataBalance();