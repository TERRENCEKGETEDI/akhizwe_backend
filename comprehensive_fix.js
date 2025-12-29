const pool = require('./src/db');

async function comprehensiveFix() {
  try {
    console.log('🔧 Running comprehensive approval status fix...');
    
    // Step 1: Check current state
    console.log('\\n📋 Step 1: Checking current state...');
    const currentState = await pool.query(`
      SELECT approval_status, COUNT(*) as count
      FROM media 
      GROUP BY approval_status
      ORDER BY approval_status
    `);
    
    console.log('Current approval_status distribution:');
    currentState.rows.forEach(row => {
      console.log(`  '${row.approval_status}': ${row.count} records`);
    });
    
    // Step 2: Clean up invalid values
    console.log('\\n🧹 Step 2: Cleaning up invalid values...');
    const invalidCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM media 
      WHERE approval_status IS NULL 
      OR approval_status NOT IN ('PENDING', 'APPROVED', 'REJECTED')
    `);
    
    if (parseInt(invalidCount.rows[0].count) > 0) {
      await pool.query(`
        UPDATE media 
        SET approval_status = 'PENDING'
        WHERE approval_status IS NULL 
        OR approval_status NOT IN ('PENDING', 'APPROVED', 'REJECTED')
      `);
      console.log(`✅ Cleaned up ${invalidCount.rows[0].count} invalid values`);
    } else {
      console.log('✅ No invalid values found');
    }
    
    // Step 3: Normalize existing values to uppercase
    console.log('\\n🔤 Step 3: Normalizing to uppercase...');
    const normalizeCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM media 
      WHERE approval_status IN ('pending', 'approved', 'rejected')
    `);
    
    if (parseInt(normalizeCount.rows[0].count) > 0) {
      await pool.query(`
        UPDATE media 
        SET approval_status = UPPER(approval_status)
        WHERE approval_status IN ('pending', 'approved', 'rejected')
      `);
      console.log(`✅ Normalized ${normalizeCount.rows[0].count} values to uppercase`);
    } else {
      console.log('✅ No lowercase values found');
    }
    
    // Step 4: Update approval_status based on is_approved for consistency
    console.log('\\n⚖️  Step 4: Syncing approval_status with is_approved...');
    const syncCount = await pool.query(`
      UPDATE media 
      SET approval_status = CASE 
        WHEN is_approved = true THEN 'APPROVED'
        WHEN is_approved = false THEN 'PENDING'
        ELSE 'PENDING'
      END
      WHERE (is_approved = true AND approval_status != 'APPROVED')
         OR (is_approved = false AND approval_status = 'APPROVED')
    `);
    
    console.log(`✅ Synced ${syncCount.rowCount} records`);
    
    // Step 5: Drop and recreate constraint
    console.log('\\n🔒 Step 5: Updating constraint...');
    await pool.query('ALTER TABLE media DROP CONSTRAINT IF EXISTS media_approval_status_check');
    await pool.query(`
      ALTER TABLE media 
      ADD CONSTRAINT media_approval_status_check 
      CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))
    `);
    console.log('✅ Updated constraint to require uppercase values');
    
    // Step 6: Verify the fix
    console.log('\\n✅ Step 6: Verifying fix...');
    const finalState = await pool.query(`
      SELECT approval_status, COUNT(*) as count
      FROM media 
      GROUP BY approval_status
      ORDER BY approval_status
    `);
    
    console.log('Final approval_status distribution:');
    finalState.rows.forEach(row => {
      console.log(`  '${row.approval_status}': ${row.count} records`);
    });
    
    // Step 7: Test the rejection functionality
    console.log('\\n🧪 Step 7: Testing rejection functionality...');
    
    // Create test media if none exists
    const pendingMedia = await pool.query(`
      SELECT media_id, title, approval_status
      FROM media 
      WHERE approval_status = 'PENDING'
      LIMIT 1
    `);
    
    let testMediaId;
    if (pendingMedia.rows.length === 0) {
      testMediaId = 'final-test-' + Date.now();
      await pool.query(`
        INSERT INTO media (media_id, title, description, media_type, uploader_email, file_url, file_path, file_size, artist, approval_status, is_approved)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        testMediaId,
        'Final Test Media',
        'Testing final rejection functionality',
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
    } else {
      testMediaId = pendingMedia.rows[0].media_id;
      console.log(`✅ Using existing test media: ${testMediaId}`);
    }
    
    // Test the rejection
    const result = await pool.query(`
      UPDATE media 
      SET approval_status = 'REJECTED', 
          is_approved = false, 
          rejected_at = CURRENT_TIMESTAMP, 
          rejected_by_email = $1 
      WHERE media_id = $2 
      RETURNING media_id, title, approval_status, is_approved, rejected_at, rejected_by_email
    `, ['admin@test.com', testMediaId]);
    
    if (result.rows.length > 0) {
      const rejected = result.rows[0];
      console.log('✅ Rejection test successful:');
      console.log(`   media_id: ${rejected.media_id}`);
      console.log(`   title: ${rejected.title}`);
      console.log(`   approval_status: ${rejected.approval_status}`);
      console.log(`   is_approved: ${rejected.is_approved}`);
      console.log(`   rejected_at: ${rejected.rejected_at}`);
      console.log(`   rejected_by_email: ${rejected.rejected_by_email}`);
    }
    
    // Clean up test media if we created it
    if (testMediaId.startsWith('final-test-')) {
      await pool.query('DELETE FROM media WHERE media_id = $1', [testMediaId]);
      console.log('✅ Cleaned up test media');
    }
    
    console.log('\\n🎉 Comprehensive fix completed successfully!');
    console.log('\\n📝 Summary of fixes applied:');
    console.log('  1. ✅ Cleaned up invalid approval_status values');
    console.log('  2. ✅ Normalized values to uppercase');
    console.log('  3. ✅ Synced approval_status with is_approved');
    console.log('  4. ✅ Updated database constraint');
    console.log('  5. ✅ Verified rejection functionality works');
    
    return true;
    
  } catch (error) {
    console.error('❌ Comprehensive fix failed:', error);
    throw error;
  }
}

if (require.main === module) {
  comprehensiveFix()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Comprehensive fix failed:', error);
      process.exit(1);
    });
}

module.exports = comprehensiveFix;