const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function testFavoritesEndpoint() {
  console.log('=== Testing Favorites Endpoint ===');
  
  try {
    // Use existing admin user
    const testUserEmail = 'admin@bathinibona.co.za';
    
    // Create test media
    const mediaId = uuidv4();
    await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, is_approved, file_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [mediaId, 'Endpoint Test Media', 'Test Description', 'MUSIC', testUserEmail, 'test.mp3', 1000, true, 'http://localhost:5000/test.mp3']
    );
    
    console.log(`Created test media with ID: ${mediaId}`);
    
    // Add favorite
    await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type) 
       VALUES ($1, $2, 'FAVORITE') 
       ON CONFLICT (media_id, user_email, interaction_type) DO NOTHING`,
      [mediaId, testUserEmail]
    );
    
    // Test the new endpoint query
    console.log('\n--- Testing favorites endpoint query ---');
    const result = await pool.query(
      `SELECT mi.media_id
       FROM media_interactions mi
       WHERE mi.user_email = $1 AND mi.interaction_type = 'FAVORITE'`,
      [testUserEmail]
    );
    
    console.log('Favorited media IDs:', result.rows.map(row => row.media_id));
    
    // Cleanup
    await pool.query('DELETE FROM media_interactions WHERE media_id = $1', [mediaId]);
    await pool.query('DELETE FROM media WHERE media_id = $1', [mediaId]);
    
    console.log('\n=== Favorites endpoint test completed ===');
    
  } catch (error) {
    console.error('Error during favorites endpoint testing:', error);
  } finally {
    await pool.end();
  }
}

testFavoritesEndpoint();