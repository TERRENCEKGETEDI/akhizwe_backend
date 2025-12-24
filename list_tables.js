const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

async function listTables() {
  try {
    const result = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('Tables in public schema:');
    result.rows.forEach(row => console.log(row.tablename));
  } catch (error) {
    console.error('Error listing tables:', error);
  } finally {
    await pool.end();
  }
}

listTables();