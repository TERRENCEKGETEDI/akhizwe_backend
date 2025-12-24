require('dotenv').config();
const pool = require('./src/db');

async function testUnlikeIssue() {
  try {
    console.log('Testing unlike issue...\n');

    // Test data
    const testMediaId = 'test-media-123';
    const testUserEmail = 'user1@mail.com';

    // Setup: Insert test media
    await pool.query(`
      INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, file_url, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (media_id) DO NOTHING
    `, [testMediaId, 'Test Media', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, 'http://localhost:5000/test.mp3', true]);
    console.log('✓ Test media inserted');

    // Test 1: Add like
    console.log('\n--- Test 1: Adding like ---');
    const likeResult = await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Like result: ${likeResult.rowCount} rows affected`);

    // Check if like exists
    const likeCheck = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Likes count: ${likeCheck.rows[0].count}`);

    // Test 2: Try to add like again (should do nothing due to ON CONFLICT)
    console.log('\n--- Test 2: Adding like again (should do nothing) ---');
    const likeAgainResult = await pool.query(`
      INSERT INTO media_interactions (media_id, user_email, interaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Like again result: ${likeAgainResult.rowCount} rows affected`);

    // Test 3: Unlike
    console.log('\n--- Test 3: Unliking ---');
    const unlikeResult = await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Unlike result: ${unlikeResult.rowCount} rows affected`);

    // Check if like still exists
    const likeCheckAfterUnlike = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Likes count after unlike: ${likeCheckAfterUnlike.rows[0].count}`);

    // Test 4: Try to unlike again (should return 0 rows affected)
    console.log('\n--- Test 4: Unliking again (should return 0 rows) ---');
    const unlikeAgainResult = await pool.query(`
      DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3
    `, [testMediaId, testUserEmail, 'LIKE']);
    console.log(`Unlike again result: ${unlikeAgainResult.rowCount} rows affected`);

    console.log('\n✅ Unlike issue test completed');

  } catch (error) {
    console.error('❌ Error in unlike test:', error);
  } finally {
    pool.end();
  }
}

testUnlikeIssue();