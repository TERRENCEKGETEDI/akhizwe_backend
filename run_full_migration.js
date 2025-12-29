const pool = require('./src/db');

async function runFullMigration() {
  try {
    console.log('🔧 Running full approval status migration...');
    
    // Add missing columns
    await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL');
    await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP NULL');
    await pool.query('ALTER TABLE media ADD COLUMN IF NOT EXISTS rejected_by_email VARCHAR(255) NULL');
    
    console.log('✅ Added missing columns');
    
    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_media_approval_status ON media(approval_status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_media_approval_status_uploader ON media(approval_status, uploader_email)');
    
    console.log('✅ Created indexes');
    
    // Update existing approved media
    await pool.query(`
      UPDATE media 
      SET approval_status = 'APPROVED', 
          approved_at = COALESCE(uploaded_at, CURRENT_TIMESTAMP)
      WHERE is_approved = true AND approval_status = 'PENDING'
    `);
    
    console.log('✅ Updated existing approved media');
    
    // Verify the changes
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'media' 
      AND column_name IN ('approved_at', 'rejected_at', 'rejected_by_email', 'approval_status')
      ORDER BY column_name
    `);
    
    console.log('\n📋 Current approval-related columns:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name}`);
    });
    
    console.log('\n🎉 Full migration completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runFullMigration()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = runFullMigration;