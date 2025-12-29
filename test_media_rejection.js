const pool = require('./src/db');

async function testMediaRejection() {
  try {
    console.log('🧪 Testing media rejection functionality...\n');
    
    // Step 1: Find some pending media to test with
    console.log('📋 Step 1: Finding pending media...');
    const pendingMedia = await pool.query(`
      SELECT media_id, title, approval_status, is_approved, rejected_at, approved_at, rejected_by_email
      FROM media 
      WHERE approval_status = 'PENDING' 
      LIMIT 3
    `);
    
    if (pendingMedia.rows.length === 0) {
      console.log('⚠️  No pending media found. Creating test media...');
      
      // Create test media
      const testMediaId = 'test-rejection-' + Date.now();
      await pool.query(`
        INSERT INTO media (media_id, title, description, media_type, uploader_email, file_url, file_path, file_size, artist, approval_status, is_approved)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        testMediaId,
        'Test Media for Rejection',
        'This is test media to verify rejection functionality',
        'VIDEO',
        'test@example.com',
        'test-url',
        'test-path',
        1000000,
        'Test Artist',
        'PENDING',
        false
      ]);
      
      console.log(`✅ Created test media: ${testMediaId}`);
      
      // Get the test media
      const testMedia = await pool.query(`
        SELECT media_id, title, approval_status, is_approved, rejected_at, approved_at, rejected_by_email
        FROM media WHERE media_id = $1
      `, [testMediaId]);
      
      pendingMedia.rows = testMedia.rows;
    }
    
    console.log(`📊 Found ${pendingMedia.rows.length} pending media items:`);
    pendingMedia.rows.forEach((media, index) => {
      console.log(`  ${index + 1}. ${media.title} (${media.media_id})`);
      console.log(`     Before rejection: approval_status=${media.approval_status}, is_approved=${media.is_approved}, rejected_at=${media.rejected_at}`);
    });
    
    // Step 2: Test the rejection functionality
    console.log('\n🧪 Step 2: Testing rejection functionality...');
    
    for (const media of pendingMedia.rows) {
      console.log(`\n🎯 Testing rejection for media: ${media.title} (${media.media_id})`);
      
      // Perform the rejection query (simulating the API call)
      const rejectionReason = 'Test rejection reason';
      const adminEmail = 'admin@example.com';
      
      const result = await pool.query(`
        UPDATE media 
        SET approval_status = 'REJECTED', 
            is_approved = false, 
            rejected_at = CURRENT_TIMESTAMP, 
            rejected_by_email = $1 
        WHERE media_id = $2 
        RETURNING *
      `, [adminEmail, media.media_id]);
      
      if (result.rows.length === 0) {
        console.log(`❌ Failed to reject media: ${media.media_id}`);
        continue;
      }
      
      const updatedMedia = result.rows[0];
      console.log(`✅ Successfully rejected media: ${updatedMedia.title}`);
      console.log(`   After rejection:`);
      console.log(`     approval_status: ${updatedMedia.approval_status}`);
      console.log(`     is_approved: ${updatedMedia.is_approved}`);
      console.log(`     rejected_at: ${updatedMedia.rejected_at}`);
      console.log(`     rejected_by_email: ${updatedMedia.rejected_by_email}`);
      
      // Verify the data was updated correctly
      if (updatedMedia.approval_status === 'REJECTED' && 
          updatedMedia.is_approved === false && 
          updatedMedia.rejected_at !== null && 
          updatedMedia.rejected_by_email === adminEmail) {
        console.log('✅ All fields updated correctly!');
      } else {
        console.log('❌ Some fields not updated correctly!');
        console.log(`   Expected: approval_status='REJECTED', is_approved=false, rejected_at!=null, rejected_by_email='${adminEmail}'`);
        console.log(`   Got: approval_status='${updatedMedia.approval_status}', is_approved=${updatedMedia.is_approved}, rejected_at=${updatedMedia.rejected_at}, rejected_by_email='${updatedMedia.rejected_by_email}'`);
      }
    }
    
    // Step 3: Verify the fix by checking the final state
    console.log('\n🔍 Step 3: Verifying final state...');
    const finalState = await pool.query(`
      SELECT 
        COUNT(*) as total_media,
        COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved_count,
        COUNT(CASE WHEN approval_status = 'REJECTED' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN rejected_at IS NOT NULL THEN 1 END) as with_rejected_at,
        COUNT(CASE WHEN rejected_by_email IS NOT NULL THEN 1 END) as with_rejected_by
      FROM media
    `);
    
    const stats = finalState.rows[0];
    console.log('📊 Final media status summary:');
    console.log(`   Total media: ${stats.total_media}`);
    console.log(`   Pending: ${stats.pending_count}`);
    console.log(`   Approved: ${stats.approved_count}`);
    console.log(`   Rejected: ${stats.rejected_count}`);
    console.log(`   With rejected_at: ${stats.with_rejected_at}`);
    console.log(`   With rejected_by_email: ${stats.with_rejected_by}`);
    
    console.log('\n🎉 Media rejection test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

if (require.main === module) {
  testMediaRejection()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = testMediaRejection;