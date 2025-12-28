const { Pool } = require('pg');
require('dotenv').config();

// Ensure environment variables are loaded
if (!process.env.DB_HOST || !process.env.DB_PASSWORD) {
  console.error('Database environment variables not loaded properly');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_NAME:', process.env.DB_NAME);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2s to 10s for remote connections
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  // Add connection retry logic
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000, // 30 second query timeout
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;