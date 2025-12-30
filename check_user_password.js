require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function checkUserPassword() {
  try {
    console.log('🔍 Checking user 0710000000...');
    
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', ['0710000000']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = result.rows[0];
    console.log('👤 User found:', {
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      password_hash_exists: !!user.password_hash
    });
    
    if (user.password_hash) {
      console.log('🔒 Testing common passwords...');
      
      const testPasswords = ['password123', 'test123', '123456', 'admin123', 'user123'];
      
      for (const testPass of testPasswords) {
        const isMatch = await bcrypt.compare(testPass, user.password_hash);
        console.log(`  ${testPass}: ${isMatch ? '✅ MATCH' : '❌ No match'}`);
        if (isMatch) {
          console.log('🎉 Found correct password!');
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkUserPassword();