// Fix database schema - add missing columns and ensure proper structure
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function fixDatabaseSchema() {
  console.log('🔧 Fixing database schema...\n');

  try {
    // Check current table structure
    console.log('Checking current media table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'media' 
      ORDER BY ordinal_position
    `);
    
    console.log('Current columns:');
    tableInfo.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log();

    // Add missing columns if they don't exist
    const columnsToAdd = [
      { name: 'artist', type: 'VARCHAR(255)' },
      { name: 'category', type: 'VARCHAR(100)' },
      { name: 'release_date', type: 'DATE' },
      { name: 'copyright_declared', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'view_count', type: 'INT DEFAULT 0' },
      { name: 'download_count', type: 'INT DEFAULT 0' },
      { name: 'monetization_enabled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
    ];

    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const exists = tableInfo.rows.find(row => row.column_name === column.name);
        if (!exists) {
          await pool.query(`ALTER TABLE media ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ Added column: ${column.name}`);
        } else {
          console.log(`✅ Column already exists: ${column.name}`);
        }
      } catch (error) {
        console.log(`❌ Error adding column ${column.name}: ${error.message}`);
      }
    }

    // Ensure media_type constraint is correct
    try {
      await pool.query(`
        ALTER TABLE media 
        DROP CONSTRAINT IF EXISTS media_media_type_check
      `);
      await pool.query(`
        ALTER TABLE media 
        ADD CONSTRAINT media_media_type_check 
        CHECK (media_type IN ('audio', 'video'))
      `);
      console.log('✅ Updated media_type constraint');
    } catch (error) {
      console.log(`❌ Error updating media_type constraint: ${error.message}`);
    }

    // Update is_approved default if needed
    try {
      await pool.query(`
        ALTER TABLE media 
        ALTER COLUMN is_approved SET DEFAULT FALSE
      `);
      console.log('✅ Updated is_approved default');
    } catch (error) {
      console.log(`❌ Error updating is_approved default: ${error.message}`);
    }

    // Verify final table structure
    console.log('\n📋 Final media table structure:');
    const finalTableInfo = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'media' 
      ORDER BY ordinal_position
    `);
    
    finalTableInfo.rows.forEach(col => {
      const defaultValue = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  - ${col.column_name} (${col.data_type})${defaultValue}`);
    });

    console.log('\n🎉 Database schema fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing database schema:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabaseSchema();