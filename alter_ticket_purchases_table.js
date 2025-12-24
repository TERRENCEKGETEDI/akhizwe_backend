require('dotenv').config();
const pool = require('./src/db');

async function alterTicketPurchasesTable() {
  try {
    await pool.query(`
      ALTER TABLE ticket_purchases
      ADD COLUMN IF NOT EXISTS qr_code TEXT,
      ADD COLUMN IF NOT EXISTS qr_image TEXT,
      ADD COLUMN IF NOT EXISTS seat VARCHAR(50),
      DROP CONSTRAINT IF EXISTS ticket_purchases_status_check,
      ADD CONSTRAINT ticket_purchases_status_check CHECK (status IN ('ACTIVE', 'CANCELLED', 'PENDING', 'USED'))
    `);
    console.log('Ticket purchases table altered successfully');
  } catch (error) {
    console.error('Error altering ticket purchases table:', error);
  } finally {
    pool.end();
  }
}

alterTicketPurchasesTable();