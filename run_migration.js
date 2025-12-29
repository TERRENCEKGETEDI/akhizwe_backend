const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/media_platform'
});

async function runMigration() {
  try {
    console.log('Running media approval status migration...');
    
    // Add approval_status column if it doesn't exist
    await pool.query(`
      ALTER TABLE media ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING' 
      CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))
    `);
    
    // Add timestamp columns if they don't exist
    await pool.query(`
      ALTER TABLE media 
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS rejected_by_email VARCHAR(255) NULL
    `);
    
    // Update existing media records
    await pool.query(`
      UPDATE media 
      SET approval_status = 'APPROVED', 
          approved_at = COALESCE(updated_at, uploaded_at)
      WHERE is_approved = true AND approval_status = 'PENDING'
    `);
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_media_approval_status ON media(approval_status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_media_approval_status_uploader ON media(approval_status, uploader_email)`);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Added approval_status field with proper constraints');
    console.log('✅ Added timestamp tracking for approved_at and rejected_at');
    console.log('✅ Added rejected_by_email tracking');
    console.log('✅ Created performance indexes');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();