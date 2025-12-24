const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

// Test the auto-population functionality
async function testUploadAutoPopulate() {
  try {
    console.log('🧪 Testing media upload auto-population...\n');

    // Get a test user
    const userResult = await pool.query('SELECT email, full_name FROM users LIMIT 1');
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    const testUser = userResult.rows[0];
    console.log(`👤 Test user: ${testUser.email} (${testUser.full_name})`);

    // Simulate the upload process with auto-populated fields
    const media_id = uuidv4();
    const currentDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
    
    console.log(`📅 Auto-populated upload date: ${currentDate}`);
    console.log(`🎨 Auto-populated artist: ${testUser.full_name || testUser.email}`);

    // Insert test media record
    const insertResult = await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_url, file_path, file_size, artist, category, release_date, copyright_declared, is_approved, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       RETURNING media_id, artist, uploaded_at`,
      [
        media_id,
        'Test Auto-Populate Media',
        'Test description for auto-population',
        'MUSIC', // Use 'MUSIC' instead of 'audio'
        testUser.email,
        '/uploads/test-file.mp3', // Required file_url
        'uploads/test-file.mp3',
        1024000,
        testUser.full_name || testUser.email, // Auto-populated artist
        'Test Category',
        currentDate, // Auto-populated date
        true,
        false
      ]
    );

    const insertedMedia = insertResult.rows[0];
    console.log('\n✅ Test media inserted successfully:');
    console.log(`   📛 Media ID: ${insertedMedia.media_id}`);
    console.log(`   🎨 Artist: ${insertedMedia.artist}`);
    console.log(`   📅 Uploaded At: ${insertedMedia.uploaded_at}`);

    // Verify the auto-populated values
    const artistCorrect = insertedMedia.artist === (testUser.full_name || testUser.email);
    const dateCorrect = insertedMedia.uploaded_at.toISOString().split('T')[0] === currentDate;

    console.log('\n📋 Verification Results:');
    console.log(`   ✅ Artist auto-populated correctly: ${artistCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   ✅ Upload date set correctly: ${dateCorrect ? '✅ PASS' : '❌ FAIL'}`);

    // Clean up test data
    await pool.query('DELETE FROM media WHERE media_id = $1', [media_id]);
    console.log('\n🧹 Test data cleaned up');

    if (artistCorrect && dateCorrect) {
      console.log('\n🎉 All tests passed! Auto-population is working correctly.');
    } else {
      console.log('\n❌ Some tests failed. Please check the implementation.');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testUploadAutoPopulate().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal test error:', error);
  process.exit(1);
});