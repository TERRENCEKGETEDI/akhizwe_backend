const { Pool } = require('pg');
require('dotenv').config();

console.log('=== COMMENTS 500 ERROR DIAGNOSTIC ===');
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'undefined');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function diagnoseCommentsIssue() {
  try {
    console.log('\n=== 1. Testing Database Connection ===');
    const connectionTest = await pool.query('SELECT 1 as test');
    console.log('✓ Database connection successful');
    
    console.log('\n=== 2. Checking Required Tables ===');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tablesResult = await pool.query(tablesQuery);
    console.log('Available tables:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    const requiredTables = ['media_comments', 'users', 'comment_likes'];
    const missingTables = [];
    
    for (const table of requiredTables) {
      const exists = tablesResult.rows.find(r => r.table_name === table);
      if (!exists) {
        missingTables.push(table);
      }
    }
    
    if (missingTables.length > 0) {
      console.log('\n❌ Missing required tables:', missingTables.join(', '));
      console.log('This is likely the cause of the 500 error.');
    } else {
      console.log('\n✓ All required tables exist');
    }
    
    console.log('\n=== 3. Testing Comments Table Structure ===');
    try {
      const commentsStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'media_comments'
        ORDER BY ordinal_position
      `);
      console.log('media_comments table structure:');
      commentsStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking media_comments structure:', error.message);
    }
    
    console.log('\n=== 4. Testing Users Table Structure ===');
    try {
      const usersStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      console.log('users table structure:');
      usersStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking users structure:', error.message);
    }
    
    console.log('\n=== 5. Testing Comment Likes Table Structure ===');
    try {
      const commentLikesStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'comment_likes'
        ORDER BY ordinal_position
      `);
      console.log('comment_likes table structure:');
      commentLikesStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking comment_likes structure:', error.message);
    }
    
    console.log('\n=== 6. Testing Sample Data ===');
    try {
      const mediaCount = await pool.query('SELECT COUNT(*) FROM media');
      console.log(`Total media records: ${mediaCount.rows[0].count}`);
      
      const commentsCount = await pool.query('SELECT COUNT(*) FROM media_comments');
      console.log(`Total comments records: ${commentsCount.rows[0].count}`);
      
      const usersCount = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`Total users records: ${usersCount.rows[0].count}`);
      
      if (parseInt(mediaCount.rows[0].count) > 0) {
        const sampleMedia = await pool.query('SELECT media_id FROM media LIMIT 1');
        const mediaId = sampleMedia.rows[0].media_id;
        console.log(`Sample media ID for testing: ${mediaId}`);
        
        // Test the exact query that fails
        console.log('\n=== 7. Testing Exact Comments Query ===');
        try {
          const testResult = await pool.query(
            `SELECT mc.comment_id, mc.media_id, mc.user_email, mc.comment_text as comment_text, mc.parent_comment_id, mc.created_at, mc.updated_at, u.full_name as commenter_name,
                    COALESCE(cl.like_count, 0) as likes,
                    COALESCE(reply_count.reply_count, 0) as reply_count
             FROM media_comments mc
             JOIN users u ON mc.user_email = u.email
             LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM comment_likes GROUP BY comment_id) cl ON mc.comment_id = cl.comment_id
             LEFT JOIN (SELECT parent_comment_id, COUNT(*) as reply_count FROM media_comments WHERE parent_comment_id IS NOT NULL GROUP BY parent_comment_id) reply_count ON mc.comment_id = reply_count.parent_comment_id
             WHERE mc.media_id = $1 AND mc.parent_comment_id IS NULL
             ORDER BY mc.created_at DESC
             LIMIT $2 OFFSET $3`,
            [mediaId, 20, 0]
          );
          console.log('✓ Comments query executed successfully');
          console.log(`Found ${testResult.rows.length} comments`);
        } catch (queryError) {
          console.log('❌ Comments query failed:', queryError.message);
          console.log('Error details:', queryError);
        }
      }
    } catch (dataError) {
      console.log('❌ Error testing sample data:', dataError.message);
    }
    
  } catch (error) {
    console.log('\n❌ CRITICAL ERROR:', error.message);
    console.log('Error details:', error);
  } finally {
    await pool.end();
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
  }
}

diagnoseCommentsIssue();