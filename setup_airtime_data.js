require('dotenv').config();
const pool = require('./src/db');
const fs = require('fs');
const path = require('path');

async function setupAirtimeData() {
  try {
    console.log('Setting up airtime and data tables...');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'airtime_data_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute the entire SQL as one query
    await pool.query(sql);

    console.log('✅ Airtime and data tables setup completed successfully');
  } catch (error) {
    console.error('❌ Error setting up airtime data tables:', error);
  } finally {
    pool.end();
  }
}

setupAirtimeData();