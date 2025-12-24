const pool = require('./src/db');

async function checkConstraints() {
  try {
    console.log('Checking media table constraints...\n');
    
    // Check media type constraint
    const constraintResult = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'media'::regclass AND conname LIKE '%media_type%'
    `);
    
    console.log('Media type constraints:');
    constraintResult.rows.forEach(row => {
      console.log(`  ${row.conname}: ${row.definition}`);
    });
    
    // Check existing media types
    const existingTypes = await pool.query(`
      SELECT DISTINCT media_type, COUNT(*) as count 
      FROM media 
      GROUP BY media_type
    `);
    
    console.log('\nExisting media types:');
    existingTypes.rows.forEach(row => {
      console.log(`  ${row.media_type}: ${row.count} items`);
    });
    
  } catch (error) {
    console.error('Error checking constraints:', error);
  } finally {
    await pool.end();
  }
}

checkConstraints();