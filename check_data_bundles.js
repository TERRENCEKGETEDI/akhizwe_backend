require('dotenv').config();
const pool = require('./src/db');

async function checkDataBundles() {
  try {
    const result = await pool.query('SELECT * FROM data_bundles');
    console.log('Data bundles in table:', result.rows);
  } catch (error) {
    console.error('Error checking data bundles:', error);
  } finally {
    pool.end();
  }
}

checkDataBundles();