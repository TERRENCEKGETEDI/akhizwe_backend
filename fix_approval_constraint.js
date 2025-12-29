const pool = require('./src/db');

async function fixApprovalStatusConstraint() {
  try {
    console.log('🔧 Fixing approval_status constraint...');
    
    // Drop the existing constraint
    await pool.query('ALTER TABLE media DROP CONSTRAINT IF EXISTS media_approval_status_check');
    
    console.log('✅ Dropped existing constraint');
    
    // Add the correct constraint with uppercase values
    await pool.query(`
      ALTER TABLE media 
      ADD CONSTRAINT media_approval_status_check 
      CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))
    `);
    
    console.log('✅ Added correct constraint with uppercase values');
    
    // Update any existing records with lowercase values
    await pool.query(`
      UPDATE media 
      SET approval_status = UPPER(approval_status)
      WHERE approval_status IN ('pending', 'approved', 'rejected')
    `);
    
    console.log('✅ Updated existing records to use uppercase');
    
    // Verify the constraint works by testing a simple query
    const testResult = await pool.query(`
      SELECT COUNT(*) as total,
      COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) as pending,
      COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved,
      COUNT(CASE WHEN approval_status = 'REJECTED' THEN 1 END) as rejected
      FROM media
    `);
    
    const stats = testResult.rows[0];
    console.log('\\n📊 Current approval status distribution:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   PENDING: ${stats.pending}`);
    console.log(`   APPROVED: ${stats.approved}`);
    console.log(`   REJECTED: ${stats.rejected}`);
    
    // Test inserting a new record with PENDING status
    const testInsertId = 'constraint-test-' + Date.now();
    await pool.query(`
      INSERT INTO media (media_id, title, description, media_type, uploader_email, file_url, file_path, file_size, artist, approval_status, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      testInsertId,
      'Constraint Test Media',
      'Testing constraint fix',
      'VIDEO',
      'test@example.com',
      'test-url',
      'test-path',
      1000000,
      'Test Artist',
      'PENDING',
      false
    ]);
    
    console.log(`✅ Successfully inserted test media with PENDING status: ${testInsertId}`);
    
    // Clean up test media
    await pool.query('DELETE FROM media WHERE media_id = $1', [testInsertId]);
    console.log('✅ Cleaned up test media');
    
    console.log('\\n🎉 Constraint fix completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to fix constraint:', error);
    throw error;
  }
}

if (require.main === module) {
  fixApprovalStatusConstraint()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Constraint fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixApprovalStatusConstraint;