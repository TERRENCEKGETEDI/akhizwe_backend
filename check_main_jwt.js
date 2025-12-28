require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('🔍 Checking JWT_SECRET in main backend context...');
console.log('JWT_SECRET from process.env:', process.env.JWT_SECRET);
console.log('');

// Test the token that should work
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAYWtoaXp3ZS50ZWNobm9sb2dpZXMiLCJyb2xlIjoiVVNFUiIsInBob25lIjoiMDcxMTExMTExMSIsImlhdCI6MTc2NjkzOTY0OCwiZXhwIjoxNzY3MDI2MDQ4fQ.lM_x5bgdgVO1AA-VJIaZ-krVmc798ACisodkNPnRY9c';

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('✅ JWT verification successful with main backend JWT_SECRET');
  console.log('Decoded payload:', decoded);
} catch (error) {
  console.log('❌ JWT verification failed with main backend JWT_SECRET');
  console.log('Error:', error.message);
  
  // Try with the hardcoded secret
  console.log('');
  console.log('🧪 Trying with hardcoded secret...');
  try {
    const decoded2 = jwt.verify(token, 'your_super_secret_jwt_key_here');
    console.log('✅ JWT verification successful with hardcoded secret');
    console.log('Decoded payload:', decoded2);
  } catch (error2) {
    console.log('❌ JWT verification failed with hardcoded secret');
    console.log('Error:', error2.message);
  }
}