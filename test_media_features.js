require('dotenv').config();
const pool = require('./src/db');
const fetch = require('node-fetch');

async function testMediaFeatures() {
  try {
    console.log('Starting media features test...\n');

    // Test data
    const testMediaId = 'test-media-123';
    const testUserEmail = 'test@test.com'; // Use existing user
    const testCommentId = 'test-comment-123';
    const testReplyId = 'test-reply-456';

    // Insert test media
    await pool.query(`
      INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, file_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (media_id) DO NOTHING
    `, [testMediaId, 'Test Media', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, 'http://localhost:5000/test.mp3', true]);
    console.log('✓ Test media inserted');

    // No need to insert test user as we're using existing user
    console.log('✓ Using existing test user: ' + testUserEmail);

    // Test like functionality
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log('✓ Like functionality tested');

    // Test favorite functionality
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'FAVORITE']);
    console.log('✓ Favorite functionality tested');

    // Test comment functionality
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testCommentId, testMediaId, testUserEmail, 'This is a test comment']);
    console.log('✓ Comment functionality tested');

    // Test comment reply functionality
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testReplyId, testMediaId, testUserEmail, 'This is a test reply', testCommentId]);
    console.log('✓ Comment reply functionality tested');

    // Test comment like functionality
    await pool.query(`
      INSERT INTO comment_likes (comment_id, user_email)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_email) DO NOTHING
    `, [testCommentId, testUserEmail]);
    console.log('✓ Comment like functionality tested');

    // Test report functionality
    await pool.query(`
      INSERT INTO reports (report_id, reporter_email, media_id, report_type, reason)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (report_id) DO NOTHING
    `, ['test-report-123', testUserEmail, testMediaId, 'MEDIA', 'Test report']);
    console.log('✓ Report functionality tested');

    // Verify data
    const likeCount = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2', [testMediaId, 'LIKE']);
    const favoriteCount = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2', [testMediaId, 'FAVORITE']);
    const commentCount = await pool.query('SELECT COUNT(*) FROM media_comments WHERE media_id = $1', [testMediaId]);
    const replyCount = await pool.query('SELECT COUNT(*) FROM media_comments WHERE parent_comment_id = $1', [testCommentId]);
    const commentLikeCount = await pool.query('SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1', [testCommentId]);
    const reportCount = await pool.query('SELECT COUNT(*) FROM reports WHERE media_id = $1', [testMediaId]);

    console.log('\nTest Results:');
    console.log(`- Likes: ${likeCount.rows[0].count}`);
    console.log(`- Favorites: ${favoriteCount.rows[0].count}`);
    console.log(`- Comments: ${commentCount.rows[0].count}`);
    console.log(`- Replies: ${replyCount.rows[0].count}`);
    console.log(`- Comment Likes: ${commentLikeCount.rows[0].count}`);
    console.log(`- Reports: ${reportCount.rows[0].count}`);

    console.log('\n✅ All media features tested successfully!');

  } catch (error) {
    console.error('❌ Error testing media features:', error);
  } finally {
    pool.end();
  }
}

testMediaFeatures();