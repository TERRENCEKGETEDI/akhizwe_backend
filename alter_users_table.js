require('dotenv').config();
const pool = require('./src/db');

async function alterUsersTable() {
  try {
    await pool.query(`
      ALTER TABLE users
      RENAME COLUMN password TO password_hash
    `);
    console.log('Users table altered successfully - password renamed to password_hash');
  } catch (error) {
    console.error('Error altering users table:', error);
  } finally {
    pool.end();
  }
}

alterUsersTable();