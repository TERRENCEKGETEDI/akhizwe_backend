require('dotenv').config();
const pool = require('./src/db');

async function setTestPin() {
  try {
    await pool.query(
      "UPDATE users SET pin = '5678' WHERE email = 'test@test.com'"
    );
    console.log('Test user PIN set to 5678');
  } catch (error) {
    console.error('Error setting test PIN:', error);
  } finally {
    pool.end();
  }
}

setTestPin();