const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function testFavoriteFunctionality() {
  console.log('=== Testing Favorite Functionality ===');
  
  try {
    // Create a test user
    const testUserEmail = 'test@example.com';
    await pool.query(
      `INSERT INTO users (email, full_name, phone, password_hash, role, wallet_balance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (email) DO NOTHING`,
      [testUserEmail, 'Test User', '0719999999', 'hashedpassword', 'USER', 100]
    );
    
    // Create test media
    const mediaId = uuidv4();
    await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, is_approved, file_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [mediaId, 'Test Media', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, true, 'http://localhost:5000/test.mp3']
    );
    
    console.log(`Created test media with ID: ${mediaId}`);
    
    // Test 1: Add favorite
    console.log('\n--- Test 1: Adding favorite ---');
    const addResult = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type) 
       VALUES ($1, $2, 'FAVORITE') 
       ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING 
       RETURNING *`,
      [mediaId, testUserEmail]
    );
    console.log('Add favorite result:', addResult.rowCount, 'rows affected');
    
    // Test 2: Check if favorite exists
    console.log('\n--- Test 2: Checking if favorite exists ---');
    const checkResult = await pool.query(
      `SELECT * FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    console.log('Favorite found:', checkResult.rows.length > 0);
    if (checkResult.rows.length > 0) {
      console.log('Favorite record:', checkResult.rows[0]);
    }
    
    // Test 3: Remove favorite
    console.log('\n--- Test 3: Removing favorite ---');
    const removeResult = await pool.query(
      `DELETE FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    console.log('Remove favorite result:', removeResult.rowCount, 'rows affected');
    
    // Test 4: Verify favorite is removed
    console.log('\n--- Test 4: Verifying favorite is removed ---');
    const verifyResult = await pool.query(
      `SELECT * FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    console.log('Favorite still exists:', verifyResult.rows.length > 0);
    
    // Test 5: Try to add favorite again (should work)
    console.log('\n--- Test 5: Adding favorite again ---');
    const addAgainResult = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type) 
       VALUES ($1, $2, 'FAVORITE') 
       ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING 
       RETURNING *`,
      [mediaId, testUserEmail]
    );
    console.log('Add favorite again result:', addAgainResult.rowCount, 'rows affected');
    
    console.log('\n=== All tests completed ===');
    
    // Cleanup
    await pool.query('DELETE FROM media_interactions WHERE media_id = $1', [mediaId]);
    await pool.query('DELETE FROM media WHERE media_id = $1', [mediaId]);
    await pool.query('DELETE FROM users WHERE email = $1', [testUserEmail]);
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await pool.end();
  }
}

testFavoriteFunctionality();