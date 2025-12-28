require('dotenv').config();
const express = require('express');
const { authMiddleware } = require('./src/middleware/auth');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAYWtoaXp3ZS50ZWNobm9sb2dpZXMiLCJyb2xlIjoiVVNFUiIsInBob25lIjoiMDcxMTExMTExMSIsImlhdCI6MTc2NjkzOTY0OCwiZXhwIjoxNzY3MDI2MDQ4fQ.lM_x5bgdgVO1AA-VJIaZ-krVmc798ACisodkNPnRY9c';

console.log('🔍 Testing JWT verification...');

// Test the JWT verification manually
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ JWT verification successful!');
  console.log('Decoded payload:', decoded);
} catch (error) {
  console.log('❌ JWT verification failed:', error.message);
}

// Test express auth middleware
const app = express();

// Simple test endpoint without auth
app.get('/debug/simple', (req, res) => {
  console.log('📝 Simple endpoint called');
  res.json({ message: 'Simple endpoint works' });
});

// Test endpoint with auth middleware
app.get('/debug/auth', authMiddleware, (req, res) => {
  console.log('📝 Auth endpoint called');
  console.log('User from middleware:', req.user);
  res.json({ message: 'Auth endpoint works', user: req.user });
});

// Test the specific bundles endpoint logic
app.get('/debug/bundles-test', authMiddleware, (req, res) => {
  console.log('📝 Bundles test endpoint called');
  console.log('User from middleware:', req.user);
  
  // Test the logic from the bundles endpoint
  const network = 'Vodacom';
  console.log(`Looking for bundles for network: ${network}`);
  
  res.json({ 
    message: 'Debug bundles endpoint works', 
    user: req.user,
    network: network 
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
  console.log('');
  console.log('🧪 Test endpoints:');
  console.log(`curl http://localhost:${PORT}/debug/simple`);
  console.log(`curl http://localhost:${PORT}/debug/auth -H "authorization: Bearer ${token}"`);
  console.log(`curl http://localhost:${PORT}/debug/bundles-test -H "authorization: Bearer ${token}"`);
});