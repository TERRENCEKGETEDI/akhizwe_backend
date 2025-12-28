require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const jwt = require('jsonwebtoken');

const app = express();

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.sendStatus(401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.sendStatus(401);
  }
};

// Database connection
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

// Fixed bundles endpoint
app.get('/api/airtime-data/bundles/:network', authMiddleware, async (req, res) => {
  try {
    const { network } = req.params;
    console.log(`📡 Request for bundles from network: ${network}`);
    
    // Check if network exists
    const networkResult = await pool.query('SELECT network_id FROM networks WHERE name = $1 AND enabled = TRUE', [network]);
    if (networkResult.rows.length === 0) {
      console.log(`❌ Network not found: ${network}`);
      return res.status(404).json({ error: 'Network not found' });
    }
    
    const networkId = networkResult.rows[0].network_id;
    console.log(`✅ Network found with ID: ${networkId}`);
    
    // Fixed query - only select columns that actually exist
    const bundlesResult = await pool.query(
      'SELECT bundle_id, name, data_size, price, enabled FROM data_bundles WHERE network_id = $1 AND enabled = TRUE', 
      [networkId]
    );
    
    console.log(`📊 Found ${bundlesResult.rows.length} bundles`);
    
    // Add default values for missing columns
    const bundles = bundlesResult.rows.map(bundle => ({
      ...bundle,
      validity_days: 30, // Default value
      regional_availability: 'National' // Default value
    }));
    
    res.json({ bundles });
  } catch (error) {
    console.error('❌ Get bundles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint
app.get('/test-fixed', (req, res) => {
  res.json({ message: 'Fixed bundles API is working!' });
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`🔧 Fixed bundles server running on port ${PORT}`);
  console.log('');
  console.log('🧪 Test the fixed API:');
  console.log(`curl http://localhost:${PORT}/test-fixed`);
  console.log(`curl http://localhost:${PORT}/api/airtime-data/bundles/Vodacom -H "authorization: Bearer YOUR_TOKEN"`);
  console.log('');
  console.log('✅ This fixed version:');
  console.log('  - Works with actual database schema');
  console.log('  - Uses only existing columns');
  console.log('  - Provides default values for missing fields');
});