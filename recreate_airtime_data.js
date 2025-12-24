require('dotenv').config();
const pool = require('./src/db');

async function recreateAirtimeData() {
  try {
    await pool.query('DROP TABLE IF EXISTS airtime_data');
    await pool.query(`
      CREATE TABLE airtime_data (
        id SERIAL PRIMARY KEY,
        transaction_ref VARCHAR(50) REFERENCES transactions(transaction_ref),
        network VARCHAR(50) NOT NULL,
        bundle_type VARCHAR(20) CHECK (bundle_type IN ('AIRTIME', 'DATA')),
        phone_number VARCHAR(15) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        bundle_id INTEGER REFERENCES data_bundles(bundle_id),
        recipient_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Airtime data table recreated');
  } catch (error) {
    console.error('Error recreating airtime_data:', error);
  } finally {
    pool.end();
  }
}

recreateAirtimeData();