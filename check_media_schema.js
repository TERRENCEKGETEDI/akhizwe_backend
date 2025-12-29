const pool = require('./src/db');

async function checkMediaSchema() {
  try {
    console.log('🔍 Checking media table schema...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'media' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Current Media Table Schema:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Check if approval_status field exists
    const hasApprovalStatus = result.rows.some(col => col.column_name === 'approval_status');
    console.log(`\n✅ approval_status field exists: ${hasApprovalStatus}`);
    
    // Check if is_approved field exists
    const hasIsApproved = result.rows.some(col => col.column_name === 'is_approved');
    console.log(`✅ is_approved field exists: ${hasIsApproved}`);
    
    // Check if rejected_at field exists
    const hasRejectedAt = result.rows.some(col => col.column_name === 'rejected_at');
    console.log(`✅ rejected_at field exists: ${hasRejectedAt}`);
    
    // Check if approved_at field exists
    const hasApprovedAt = result.rows.some(col => col.column_name === 'approved_at');
    console.log(`✅ approved_at field exists: ${hasApprovedAt}`);
    
    // Check if rejected_by_email field exists
    const hasRejectedByEmail = result.rows.some(col => col.column_name === 'rejected_by_email');
    console.log(`✅ rejected_by_email field exists: ${hasRejectedByEmail}`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    throw error;
  }
}

if (require.main === module) {
  checkMediaSchema()
    .then(() => {
      console.log('\n🎉 Schema check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema check failed:', error);
      process.exit(1);
    });
}

module.exports = checkMediaSchema;