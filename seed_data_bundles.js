const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'akhizwe_bd_user',
  host: process.env.DB_HOST || 'dpg-d55j2cchg0os73a598t0-a.oregon-postgres.render.com',
  database: process.env.DB_NAME || 'akhizwe_bd',
  password: process.env.DB_PASSWORD || 'bHRmeKVKKW7PLdgXf39LFK6DffUm6xwd',
  port: process.env.DB_PORT || 5432,
});

async function seedDataBundles() {
  try {
    console.log('Starting data bundles seeding...');
    
    // First check networks
    const networksResult = await pool.query('SELECT * FROM networks ORDER BY network_id');
    console.log('Networks found:', networksResult.rows);
    
    if (networksResult.rows.length === 0) {
      console.log('❌ No networks found. Cannot seed data bundles without network_id references.');
      return;
    }
    
    // Clear existing data bundles
    await pool.query('DELETE FROM data_bundles');
    console.log('🧹 Cleared existing data bundles');
    
    // Create seed data for data bundles based on available networks
    const dataBundles = [];
    
    // Add bundles for each network
    networksResult.rows.forEach((network, index) => {
      console.log(`Adding bundles for ${network.name} (ID: ${network.network_id})`);
      
      // Different pricing strategy for each network
      const basePrice = 40 + (index * 10); // MTN: 40, Vodacom: 50, Cell C: 60, etc.
      
      dataBundles.push(
        {
          network_id: network.network_id,
          name: `${network.name} 500MB Data Bundle`,
          data_size: '500MB',
          price: basePrice
        },
        {
          network_id: network.network_id,
          name: `${network.name} 1GB Data Bundle`,
          data_size: '1GB',
          price: basePrice + 15
        },
        {
          network_id: network.network_id,
          name: `${network.name} 2GB Data Bundle`,
          data_size: '2GB',
          price: basePrice + 40
        },
        {
          network_id: network.network_id,
          name: `${network.name} 5GB Data Bundle`,
          data_size: '5GB',
          price: basePrice + 120
        },
        {
          network_id: network.network_id,
          name: `${network.name} 10GB Data Bundle`,
          data_size: '10GB',
          price: basePrice + 200
        },
        {
          network_id: network.network_id,
          name: `${network.name} 20GB Data Bundle`,
          data_size: '20GB',
          price: basePrice + 350
        }
      );
    });
    
    console.log('📦 Prepared', dataBundles.length, 'data bundle entries');
    
    // Insert data bundles
    for (const bundle of dataBundles) {
      const insertQuery = `
        INSERT INTO data_bundles (network_id, name, data_size, price, enabled)
        VALUES ($1, $2, $3, $4, true)
        RETURNING bundle_id, name, data_size, price
      `;
      
      const result = await pool.query(insertQuery, [
        bundle.network_id,
        bundle.name,
        bundle.data_size,
        bundle.price
      ]);
      
      console.log('✅ Created bundle:', result.rows[0]);
    }
    
    // Verify insertion
    const verifyResult = await pool.query(`
      SELECT db.*, n.name as network_name 
      FROM data_bundles db 
      JOIN networks n ON db.network_id = n.network_id 
      ORDER BY db.network_id, db.price
    `);
    
    console.log('\\n📊 VERIFICATION - Total data bundles created:', verifyResult.rows.length);
    console.log('All data bundles:');
    verifyResult.rows.forEach(bundle => {
      console.log(`  ${bundle.bundle_id}: ${bundle.name} (${bundle.data_size}) - R${bundle.price} [${bundle.network_name}]`);
    });
    
    console.log('\\n🎉 Data bundles seeding completed successfully!');
    
  } catch (err) {
    console.error('❌ Error seeding data bundles:', err);
  } finally {
    await pool.end();
  }
}

// Run the seeding
seedDataBundles();