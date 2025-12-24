require('dotenv').config();
const pool = require('./src/db');

async function setDataBalanceDefault() {
  try {
    await pool.query(
      'UPDATE users SET data_balance = 0 WHERE data_balance IS NULL'
    );
    console.log('Data balance set to 0 for existing users');
  } catch (error) {
    console.error('Error setting data balance:', error);
  } finally {
    pool.end();
  }
}

setDataBalanceDefault();