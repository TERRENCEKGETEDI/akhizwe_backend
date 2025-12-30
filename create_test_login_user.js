require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    console.log('🔧 Creating test user for login testing...');
    
    const phone = '0711111111'; // Use existing user
    const password = 'testpass123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update existing user with known password
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING email, full_name',
      [hashedPassword, phone]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Updated user password:');
      console.log(`   Phone: ${phone}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.full_name}`);
      console.log(`   Password: ${password}`);
      
      // Test the login
      console.log('\n🧪 Testing login...');
      const loginTest = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
      const testUser = loginTest.rows[0];
      const isValidPassword = await bcrypt.compare(password, testUser.password_hash);
      
      if (isValidPassword) {
        console.log('✅ Password verification successful!');
        console.log('\n🎯 You can now test login with:');
        console.log(`   Phone: ${phone}`);
        console.log(`   Password: ${password}`);
      } else {
        console.log('❌ Password verification failed!');
      }
      
    } else {
      console.log('❌ User not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

createTestUser();