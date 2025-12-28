const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d55j2cchg0os73a598t0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'akhizwe_bd',
  user: 'akhizwe_bd_user',
  password: 'bHRmeKVKKW7PLdgXf39LFK6DffUm6xwd',
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check data_bundles table structure
    const bundlesResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'data_bundles' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 data_bundles table structure:');
    bundlesResult.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
    });
    
    console.log('');
    
    // Check networks table structure
    const networksResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'networks' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 networks table structure:');
    networksResult.rows.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
    });
    
    console.log('');
    
    // Check if there's any data in data_bundles
    const dataCheck = await pool.query('SELECT COUNT(*) as count FROM data_bundles');
    console.log('📊 data_bundles row count:', dataCheck.rows[0].count);
    
    // Check if there's any data in networks
    const networkData = await pool.query('SELECT * FROM networks');
    console.log('📊 networks data:', networkData.rows);
    
    // Try the original query from airtimeData.js with actual columns
    console.log('');
    console.log('🧪 Testing query with actual columns...');
    try {
      const testQuery = await pool.query('SELECT * FROM data_bundles LIMIT 1');
      if (testQuery.rows.length > 0) {
        console.log('Sample data_bundles row:', testQuery.rows[0]);
      } else {
        console.log('No data in data_bundles table');
      }
    } catch (error) {
      console.log('❌ Error querying data_bundles:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();