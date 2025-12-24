require('dotenv').config();
const pool = require('./src/db');

async function checkNetworks() {
  try {
    const result = await pool.query('SELECT * FROM networks');
    console.log('Networks in table:', result.rows);
  } catch (error) {
    console.error('Error checking networks:', error);
  } finally {
    pool.end();
  }
}

checkNetworks();