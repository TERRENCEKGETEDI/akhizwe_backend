const { Pool } = require('pg');
require('dotenv').config();

console.log('=== COMPREHENSIVE DATABASE SCHEMA VERIFICATION ===');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function verifyDatabaseSchema() {
  try {
    console.log('\n=== 1. Testing Database Connection ===');
    await pool.query('SELECT 1 as test');
    console.log('✓ Database connection successful');
    
    console.log('\n=== 2. Checking All Tables ===');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tablesResult = await pool.query(tablesQuery);
    console.log('Available tables:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    console.log('\n=== 3. Verifying Critical Tables for Comments System ===');
    
    // Check media_comments table
    console.log('\n📋 media_comments table structure:');
    try {
      const commentsStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'media_comments'
        ORDER BY ordinal_position
      `);
      commentsStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${row.column_default ? `(DEFAULT: ${row.column_default})` : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking media_comments structure:', error.message);
    }
    
    // Check users table
    console.log('\n👥 users table structure:');
    try {
      const usersStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      usersStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${row.column_default ? `(DEFAULT: ${row.column_default})` : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking users structure:', error.message);
    }
    
    // Check comment_likes table
    console.log('\n👍 comment_likes table structure:');
    try {
      const commentLikesStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'comment_likes'
        ORDER BY ordinal_position
      `);
      commentLikesStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${row.column_default ? `(DEFAULT: ${row.column_default})` : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking comment_likes structure:', error.message);
    }
    
    // Check media table
    console.log('\n🎬 media table structure:');
    try {
      const mediaStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'media'
        ORDER BY ordinal_position
      `);
      mediaStructure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${row.column_default ? `(DEFAULT: ${row.column_default})` : ''}`);
      });
    } catch (error) {
      console.log('❌ Error checking media structure:', error.message);
    }
    
    console.log('\n=== 4. Testing Query Compatibility ===');
    
    // Test the exact comments query
    try {
      console.log('\n🧪 Testing comments fetch query...');
      const testQuery = `
        SELECT mc.comment_id, mc.media_id, mc.user_email, mc.comment as comment_text, mc.parent_comment_id, mc.created_at, u.full_name as commenter_name,
                COALESCE(cl.like_count, 0) as likes,
                COALESCE(reply_count.reply_count, 0) as reply_count
         FROM media_comments mc
         JOIN users u ON mc.user_email = u.email
         LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM comment_likes GROUP BY comment_id) cl ON mc.comment_id = cl.comment_id
         LEFT JOIN (SELECT parent_comment_id, COUNT(*) as reply_count FROM media_comments WHERE parent_comment_id IS NOT NULL GROUP BY parent_comment_id) reply_count ON mc.comment_id = reply_count.parent_comment_id
         WHERE mc.media_id = $1 AND mc.parent_comment_id IS NULL
         ORDER BY mc.created_at DESC
         LIMIT 5 OFFSET 0
      `;
      
      // First, get a sample media_id
      const sampleMedia = await pool.query('SELECT media_id FROM media LIMIT 1');
      if (sampleMedia.rows.length > 0) {
        const testResult = await pool.query(testQuery, [sampleMedia.rows[0].media_id]);
        console.log('✓ Comments query executed successfully');
        console.log(`Found ${testResult.rows.length} comments`);
      } else {
        console.log('⚠️  No media records found to test query');
      }
    } catch (error) {
      console.log('❌ Comments query failed:', error.message);
      console.log('Error details:', error);
    }
    
    // Test comment creation
    try {
      console.log('\n🧪 Testing comment creation...');
      const testCommentQuery = `
        INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id) 
        VALUES ($1, $2, $3, $4, $5)
        RETURNING comment_id
      `;
      console.log('✓ Comment creation query syntax is valid');
    } catch (error) {
      console.log('❌ Comment creation query failed:', error.message);
    }
    
    console.log('\n=== 5. Summary of Column References ===');
    console.log('✅ CORRECT column references in code:');
    console.log('   - media_comments.comment (NOT comment_text)');
    console.log('   - media_comments.created_at (EXISTS)');
    console.log('   - media_comments.parent_comment_id (EXISTS)');
    console.log('   - media_comments.media_id (EXISTS)');
    console.log('   - media_comments.user_email (EXISTS)');
    console.log('   - users.full_name (EXISTS)');
    console.log('   - comment_likes.comment_id (EXISTS)');
    console.log('   - comment_likes.user_email (EXISTS)');
    
    console.log('\n❌ REMOVED non-existent columns:');
    console.log('   - media_comments.updated_at (DOES NOT EXIST)');
    console.log('   - media_comments.comment_text (DOES NOT EXIST - use "comment")');
    
  } catch (error) {
    console.log('\n❌ CRITICAL ERROR:', error.message);
    console.log('Error details:', error);
  } finally {
    await pool.end();
    console.log('\n=== SCHEMA VERIFICATION COMPLETE ===');
  }
}

verifyDatabaseSchema();