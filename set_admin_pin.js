require('dotenv').config();
const pool = require('./src/db');

async function setAdminPin() {
  try {
    await pool.query(
      "UPDATE users SET pin = '1234' WHERE email = 'admin@bathinibona.co.za'"
    );
    console.log('Admin PIN set to 1234');
  } catch (error) {
    console.error('Error setting admin PIN:', error);
  } finally {
    pool.end();
  }
}

setAdminPin();