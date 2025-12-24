require('dotenv').config();
const pool = require('./src/db');

async function fixAdminLogs() {
  try {
    await pool.query('ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_email_fkey');
    console.log('Admin logs constraint dropped');
  } catch (error) {
    console.error('Error fixing admin logs:', error);
  } finally {
    pool.end();
  }
}

fixAdminLogs();