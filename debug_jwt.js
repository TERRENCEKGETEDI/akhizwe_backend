const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_super_secret_jwt_key_here';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAYWtoaXp3ZS50ZWNobm9sb2dpZXMiLCJyb2xlIjoiVVNFUiIsInBob25lIjoiMDcxMTExMTExMSIsImlhdCI6MTc2NjkzODgyMiwiZXhwIjoxNzY2OTQyNDIyfQ._OTugX1Fw88h0FSwBxQtLSx-zOQsovI_JcXDKDk9Kog';

console.log('🔍 Decoding JWT token...');
console.log('Token:', token);
console.log('');

// Try to decode without verification to see the payload
try {
  const decoded = jwt.decode(token);
  console.log('📋 Token Payload (decoded):');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('');
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000);
  console.log('🕐 Current timestamp:', now);
  console.log('Token expires at:', decoded.exp);
  
  if (decoded.exp < now) {
    console.log('❌ Token is EXPIRED');
  } else {
    console.log('✅ Token is still valid');
    console.log('Time remaining:', decoded.exp - now, 'seconds');
  }
} catch (error) {
  console.log('❌ Error decoding token:', error.message);
}

console.log('');
console.log('🔐 Attempting verification with current JWT_SECRET...');

// Try to verify with current secret
try {
  const verified = jwt.verify(token, JWT_SECRET);
  console.log('✅ Token verified successfully!');
  console.log('Verified payload:', JSON.stringify(verified, null, 2));
} catch (error) {
  console.log('❌ Verification failed:', error.message);
  
  if (error.name === 'JsonWebTokenError') {
    console.log('🔑 This suggests the token was signed with a different secret');
  } else if (error.name === 'TokenExpiredError') {
    console.log('⏰ The token has expired');
  }
}

console.log('');
console.log('🆕 Generating a new token with the correct secret...');

// Generate a new token for testing
const newPayload = {
  email: 'user@akhizwe.technologies',
  role: 'USER',
  phone: '0711111111',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

try {
  const newToken = jwt.sign(newPayload, JWT_SECRET, { algorithm: 'HS256' });
  console.log('✅ New token generated successfully!');
  console.log('');
  console.log('🧪 New token for testing:');
  console.log(newToken);
  console.log('');
  console.log('📝 Curl command with new token:');
  console.log(`curl "https://akhizwe-backend.onrender.com/api/airtime-data/bundles/Vodacom" \\`);
  console.log(`  -H "accept: */*" \\`);
  console.log(`  -H "authorization: Bearer ${newToken}" \\`);
  console.log(`  -H "cache-control: no-cache" \\`);
  console.log(`  -H "origin: http://localhost:5173" \\`);
  console.log(`  -H "referer: http://localhost:5173/"`);
} catch (error) {
  console.log('❌ Error generating new token:', error.message);
}