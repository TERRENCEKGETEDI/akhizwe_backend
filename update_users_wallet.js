require('dotenv').config();
const pool = require('./src/db');

async function updateUsersWallet() {
  try {
    await pool.query('UPDATE users SET wallet_balance = 1000 WHERE wallet_balance IS NULL');
    await pool.query('UPDATE users SET pin = \'1234\' WHERE pin IS NULL');
    console.log('Users wallet updated');
  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    pool.end();
  }
}

updateUsersWallet();