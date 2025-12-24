require('dotenv').config();
const pool = require('./src/db');

async function addCommentFeatures() {
  try {
    // Add parent_comment_id column to media_comments table
    await pool.query(`
      ALTER TABLE media_comments
      ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE
    `);
    console.log('Added parent_comment_id column to media_comments table');

    // Create comment_likes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        like_id SERIAL PRIMARY KEY,
        comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
        user_email VARCHAR(255) REFERENCES users(email),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_email)
      )
    `);
    console.log('Created comment_likes table');

    console.log('Comment features added successfully');
  } catch (error) {
    console.error('Error adding comment features:', error);
  } finally {
    pool.end();
  }
}

addCommentFeatures();