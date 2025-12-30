require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function resetUserPasswords() {
  try {
    console.log('🔧 Resetting passwords for main users...');
    
    const usersToUpdate = [
      { phone: '0710000000', password: 'admin123' },  // System Admin
      { phone: '0711111111', password: 'user123' },   // Regular User  
      { phone: '0712222222', password: 'test123' },   // Test User
      { phone: '0768641645', password: 'password123' } // Sfiso
    ];
    
    for (const user of usersToUpdate) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const result = await pool.query(
        'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING email, full_name',
        [hashedPassword, user.phone]
      );
      
      if (result.rows.length > 0) {
        const updatedUser = result.rows[0];
        console.log(`✅ Updated: ${updatedUser.full_name} (${user.phone})`);
        console.log(`   Password: ${user.password}`);
      } else {
        console.log(`❌ User not found: ${user.phone}`);
      }
    }
    
    console.log('\n🎯 Login Credentials Summary:');
    console.log('System Admin: 0710000000 / admin123');
    console.log('Regular User: 0711111111 / user123');
    console.log('Test User:   0712222222 / test123');
    console.log('Sfiso:       0768641645 / password123');
    
    console.log('\n🧪 Testing one login...');
    const testResult = await pool.query('SELECT * FROM users WHERE phone = $1', ['0711111111']);
    const testUser = testResult.rows[0];
    const isValid = await bcrypt.compare('user123', testUser.password_hash);
    console.log(`Test login ${isValid ? '✅ WORKS' : '❌ FAILED'}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

resetUserPasswords();