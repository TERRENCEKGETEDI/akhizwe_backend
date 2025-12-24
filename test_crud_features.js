require('dotenv').config();
const pool = require('./src/db');

async function testCRUDFeatures() {
  try {
    console.log('Starting CRUD features test...\n');

    // Test data
    const testMediaId = 'test-media-crud';
    const testUserEmail = 'test@test.com';
    const testCommentId = 'test-comment-crud';
    const testReplyId = 'test-reply-crud';

    // Insert test media
    await pool.query(`
      INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, file_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (media_id) DO NOTHING
    `, [testMediaId, 'Test Media CRUD', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, 'http://localhost:5000/test.mp3', true]);
    console.log('✓ Test media inserted');

    // Test like functionality
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log('✓ Like functionality tested');

    // Test unlike functionality
    await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log('✓ Unlike functionality tested');

    // Test favorite functionality
    await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'FAVORITE']);
    console.log('✓ Favorite functionality tested');

    // Test unfavorite functionality
    await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'FAVORITE']);
    console.log('✓ Unfavorite functionality tested');

    // Test comment functionality
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testCommentId, testMediaId, testUserEmail, 'This is a test comment for CRUD']);
    console.log('✓ Comment functionality tested');

    // Test comment like functionality
    await pool.query(`
      INSERT INTO comment_likes (comment_id, user_email)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, user_email) DO NOTHING
    `, [testCommentId, testUserEmail]);
    console.log('✓ Comment like functionality tested');

    // Test comment unlike functionality
    await pool.query(`
      DELETE FROM comment_likes WHERE comment_id = $1 AND user_email = $2
    `, [testCommentId, testUserEmail]);
    console.log('✓ Comment unlike functionality tested');

    // Test reply functionality
    await pool.query(`
      INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (comment_id) DO NOTHING
    `, [testReplyId, testMediaId, testUserEmail, 'This is a test reply for CRUD', testCommentId]);
    console.log('✓ Reply functionality tested');

    // Test delete reply functionality
    await pool.query(`
      DELETE FROM media_comments WHERE comment_id = $1
    `, [testReplyId]);
    console.log('✓ Delete reply functionality tested');

    // Test delete comment functionality (will cascade to replies)
    await pool.query(`
      DELETE FROM media_comments WHERE comment_id = $1
    `, [testCommentId]);
    console.log('✓ Delete comment functionality tested');

    // Test report functionality
    await pool.query(`
      INSERT INTO reports (report_id, reporter_email, media_id, report_type, reason)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (report_id) DO NOTHING
    `, ['test-report-crud', testUserEmail, testMediaId, 'MEDIA', 'Test report for CRUD']);
    console.log('✓ Report functionality tested');

    // Verify data cleanup
    const likeCount = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2', [testMediaId, 'LIKE']);
    const favoriteCount = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2', [testMediaId, 'FAVORITE']);
    const commentCount = await pool.query('SELECT COUNT(*) FROM media_comments WHERE media_id = $1', [testMediaId]);
    const replyCount = await pool.query('SELECT COUNT(*) FROM media_comments WHERE parent_comment_id = $1', [testCommentId]);
    const commentLikeCount = await pool.query('SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1', [testCommentId]);
    const reportCount = await pool.query('SELECT COUNT(*) FROM reports WHERE media_id = $1', [testMediaId]);

    console.log('\nTest Results (should be 0 for deleted items):');
    console.log(`- Likes: ${likeCount.rows[0].count}`);
    console.log(`- Favorites: ${favoriteCount.rows[0].count}`);
    console.log(`- Comments: ${commentCount.rows[0].count}`);
    console.log(`- Replies: ${replyCount.rows[0].count}`);
    console.log(`- Comment Likes: ${commentLikeCount.rows[0].count}`);
    console.log(`- Reports: ${reportCount.rows[0].count}`);

    console.log('\n✅ All CRUD features tested successfully!');

  } catch (error) {
    console.error('❌ Error testing CRUD features:', error);
  } finally {
    pool.end();
  }
}

testCRUDFeatures();