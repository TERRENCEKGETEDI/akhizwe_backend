require('dotenv').config();
const express = require('express');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const jwt = require('jsonwebtoken');

const app = express();

// Custom auth middleware with detailed logging
const debugAuthMiddleware = (req, res, next) => {
  console.log('🔍 Auth middleware called');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('❌ No Bearer token found');
    return res.sendStatus(401);
  }

  const token = authHeader.split(" ")[1];
  console.log('Extracted token:', token);

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET,
      { algorithms: ["HS256"] }
    );
    
    console.log('✅ Token verified successfully');
    console.log('Decoded payload:', decoded);
    
    req.user = decoded;
    next();
  } catch (err) {
    console.log('❌ Token verification failed');
    console.log('Error:', err.message);
    console.log('Error name:', err.name);
    return res.sendStatus(401);
  }
};

app.get('/debug/detailed-auth', debugAuthMiddleware, (req, res) => {
  console.log('📝 Authenticated endpoint called');
  res.json({ 
    message: 'Authentication successful', 
    user: req.user 
  });
});

// Test the bundles endpoint logic
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

app.get('/debug/bundles-db', debugAuthMiddleware, async (req, res) => {
  try {
    console.log('📝 Bundles endpoint called');
    console.log('User:', req.user);
    
    const network = 'Vodacom';
    console.log(`Looking for network: ${network}`);
    
    // Check if network exists
    const networkResult = await pool.query('SELECT network_id FROM networks WHERE name = $1 AND enabled = TRUE', [network]);
    console.log('Network query result:', networkResult.rows);
    
    if (networkResult.rows.length === 0) {
      console.log('❌ Network not found');
      return res.status(404).json({ error: 'Network not found' });
    }
    
    const networkId = networkResult.rows[0].network_id;
    console.log('Network ID:', networkId);
    
    // Get bundles
    const bundlesResult = await pool.query('SELECT bundle_id, name, data_size, price, validity_days, regional_availability FROM data_bundles WHERE network_id = $1 AND enabled = TRUE', [networkId]);
    console.log('Bundles query result:', bundlesResult.rows);
    
    res.json({ bundles: bundlesResult.rows });
  } catch (error) {
    console.log('❌ Database error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
  console.log('JWT_SECRET being used:', JWT_SECRET);
  console.log('');
  console.log('🧪 Test endpoints:');
  console.log(`curl http://localhost:${PORT}/debug/detailed-auth -H "authorization: Bearer YOUR_TOKEN"`);
  console.log(`curl http://localhost:${PORT}/debug/bundles-db -H "authorization: Bearer YOUR_TOKEN"`);
});