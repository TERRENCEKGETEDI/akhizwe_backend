require('dotenv').config();
const pool = require('./src/db');

async function debugUnlikeDelete() {
  try {
    console.log('Starting debug of unlike/delete/remove functionality...\n');

    // Test data
    const testMediaId = 'debug-media-123';
    const testUserEmail = 'test@test.com';
    const testCommentId = 'debug-comment-123';
    const testReplyId = 'debug-reply-123';

    // Setup: Insert test media
    await pool.query(`
      INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, file_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (media_id) DO NOTHING
    `, [testMediaId, 'Debug Media', 'Debug Description', 'MUSIC', testUserEmail, 'debug.mp3', 1000, 'http://localhost:5000/debug.mp3', true]);
    console.log('✓ Test media inserted');

    // Setup: Add test like
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log('✓ Test like added');

    // Setup: Add test favorite
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'FAVORITE']);
    console.log('✓ Test favorite added');

    // Setup: Add test comment
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testCommentId, testMediaId, testUserEmail, 'Debug comment']);
    console.log('✓ Test comment added');

    // Setup: Add test reply
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testReplyId, testMediaId, testUserEmail, 'Debug reply', testCommentId]);
    console.log('✓ Test reply added');

    // Setup: Add test comment like
    await pool.query(`
      INSERT INTO comment_likes (comment_id, user_email)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_email) DO NOTHING
    `, [testCommentId, testUserEmail]);
    console.log('✓ Test comment like added');

    console.log('\n--- Testing Database Operations Directly ---');

    // Test 1: Unlike media (direct database operation)
    console.log('Testing unlike media...');
    const unlikeResult = await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Unlike result: ${unlikeResult.rowCount} rows deleted`);
    
    const likeCheck = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Likes remaining: ${likeCheck.rows[0].count}`);

    // Test 2: Unfavorite media (direct database operation)
    console.log('\nTesting unfavorite media...');
    const unfavoriteResult = await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'FAVORITE']);
    console.log(`Unfavorite result: ${unfavoriteResult.rowCount} rows deleted`);
    
    const favoriteCheck = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [testMediaId, testUserEmail, 'FAVORITE']);
    console.log(`Favorites remaining: ${favoriteCheck.rows[0].count}`);

    // Test 3: Delete comment (direct database operation)
    console.log('\nTesting delete comment...');
    const deleteCommentResult = await pool.query(`
      DELETE FROM media_comments WHERE comment_id = $1 AND user_email = $2
    `, [testCommentId, testUserEmail]);
    console.log(`Delete comment result: ${deleteCommentResult.rowCount} rows deleted`);
    
    const commentCheck = await pool.query('SELECT COUNT(*) FROM media_comments WHERE comment_id = $1', [testCommentId]);
    console.log(`Comments remaining: ${commentCheck.rows[0].count}`);

    // Test 4: Unlike comment (direct database operation)
    console.log('\nTesting unlike comment...');
    const unlikeCommentResult = await pool.query(`
      DELETE FROM comment_likes WHERE comment_id = $1 AND user_email = $2
    `, [testCommentId, testUserEmail]);
    console.log(`Unlike comment result: ${unlikeCommentResult.rowCount} rows deleted`);
    
    const commentLikeCheck = await pool.query('SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1 AND user_email = $2',
      [testCommentId, testUserEmail]);
    console.log(`Comment likes remaining: ${commentLikeCheck.rows[0].count}`);

    // Test 5: Delete reply (direct database operation)
    console.log('\nTesting delete reply...');
    const deleteReplyResult = await pool.query(`
      DELETE FROM media_comments WHERE comment_id = $1 AND user_email = $2 AND parent_comment_id IS NOT NULL
    `, [testReplyId, testUserEmail]);
    console.log(`Delete reply result: ${deleteReplyResult.rowCount} rows deleted`);
    
    const replyCheck = await pool.query('SELECT COUNT(*) FROM media_comments WHERE comment_id = $1', [testReplyId]);
    console.log(`Replies remaining: ${replyCheck.rows[0].count}`);

    console.log('\n✅ Database operations debug completed');

  } catch (error) {
    console.error('❌ Error in debug test:', error);
  } finally {
    pool.end();
  }
}

debugUnlikeDelete();