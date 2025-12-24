sconst { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false }
});

const createTableSQL = `
-- Reports Table for reported users/content
CREATE TABLE reports (
    report_id VARCHAR(50) PRIMARY KEY,
    reporter_email VARCHAR(255) REFERENCES users(email),
    reported_email VARCHAR(255) REFERENCES users(email),
    media_id VARCHAR(50) REFERENCES media(media_id),
    comment_id VARCHAR(50) REFERENCES media_comments(comment_id),
    report_type VARCHAR(20) CHECK (report_type IN ('USER', 'MEDIA', 'COMMENT')),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function createTable() {
    try {
        await pool.query(createTableSQL);
        console.log('Reports table created successfully');
    } catch (error) {
        console.error('Error creating reports table:', error);
    } finally {
        await pool.end();
    }
}

createTable();