require('dotenv').config();
const pool = require('./src/db');

async function alterMediaInteractionsTable() {
  try {
    await pool.query(`
      ALTER TABLE media_interactions
      ADD COLUMN IF NOT EXISTS interaction_type VARCHAR(20) CHECK (interaction_type IN ('LIKE', 'FAVORITE'))
    `);
    console.log('Media interactions table altered successfully');
  } catch (error) {
    console.error('Error altering media interactions table:', error);
  } finally {
    pool.end();
  }
}

alterMediaInteractionsTable();