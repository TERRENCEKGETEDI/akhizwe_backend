require('dotenv').config();
const pool = require('./src/db');

async function alterTicketsTable() {
  try {
    await pool.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS performers JSONB,
      ADD COLUMN IF NOT EXISTS teams JSONB,
      ADD COLUMN IF NOT EXISTS start_time TIME,
      ADD COLUMN IF NOT EXISTS end_time TIME
    `);
    console.log('Tickets table altered successfully');
  } catch (error) {
    console.error('Error altering tickets table:', error);
  } finally {
    pool.end();
  }
}

alterTicketsTable();