const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function testFavoritePersistence() {
  console.log('=== Testing Favorite Persistence ===');
  
  try {
    // Use existing admin user to avoid phone conflicts
    const testUserEmail = 'admin@bathinibona.co.za';
    
    // Create test media
    const mediaId = uuidv4();
    await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, is_approved, file_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [mediaId, 'Persistence Test Media', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, true, 'http://localhost:5000/test.mp3']
    );
    
    console.log(`Created test media with ID: ${mediaId}`);
    
    // Test 1: Add favorite
    console.log('\n--- Test 1: Adding favorite ---');
    await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type) 
       VALUES ($1, $2, 'FAVORITE') 
       ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING`,
      [mediaId, testUserEmail]
    );
    
    // Test 2: Check if favorite persists by querying directly
    console.log('\n--- Test 2: Checking database persistence ---');
    const checkResult = await pool.query(
      `SELECT * FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    console.log('Favorite found in database:', checkResult.rows.length > 0);
    if (checkResult.rows.length > 0) {
      console.log('Favorite record:', checkResult.rows[0]);
    }
    
    // Test 3: Simulate what the frontend should fetch - get all favorited media for user
    console.log('\n--- Test 3: Fetching all favorited media for user ---');
    const userFavorites = await pool.query(
      `SELECT mi.media_id, m.title 
       FROM media_interactions mi 
       JOIN media m ON mi.media_id = m.media_id 
       WHERE mi.user_email = $1 AND mi.interaction_type = 'FAVORITE'`,
      [testUserEmail]
    );
    console.log('User favorites:', userFavorites.rows);
    
    // Test 4: Remove favorite
    console.log('\n--- Test 4: Removing favorite ---');
    await pool.query(
      `DELETE FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    
    // Test 5: Verify removal persists
    console.log('\n--- Test 5: Verifying removal persistence ---');
    const finalCheck = await pool.query(
      `SELECT * FROM media_interactions 
       WHERE media_id = $1 AND user_email = $2 AND interaction_type = 'FAVORITE'`,
      [mediaId, testUserEmail]
    );
    console.log('Favorite still exists after removal:', finalCheck.rows.length > 0);
    
    console.log('\n=== Persistence tests completed ===');
    
    // Cleanup
    await pool.query('DELETE FROM media_interactions WHERE media_id = $1', [mediaId]);
    await pool.query('DELETE FROM media WHERE media_id = $1', [mediaId]);
    
  } catch (error) {
    console.error('Error during persistence testing:', error);
  } finally {
    await pool.end();
  }
}

testFavoritePersistence();