const pool = require('./src/db');
const fs = require('fs');

async function updateOnlineDB() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('recreate_schema_online.sql', 'utf8');
    await client.query(sql);
    console.log('Online database updated successfully.');
  } catch (err) {
    console.error('Error updating online database:', err);
  } finally {
    client.release();
  }
}

updateOnlineDB();