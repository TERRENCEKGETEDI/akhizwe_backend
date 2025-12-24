require('dotenv').config();
const pool = require('./src/db');

async function checkPhoneDataBalance() {
  try {
    const result = await pool.query("SELECT data_balance FROM users WHERE phone = '0721111111'");
    if (result.rows.length > 0) {
      console.log('Data balance for 0721111111:', result.rows[0].data_balance);
    } else {
      console.log('User with phone 0721111111 not found');
    }
  } catch (error) {
    console.error('Error checking data balance:', error);
  } finally {
    pool.end();
  }
}

checkPhoneDataBalance();