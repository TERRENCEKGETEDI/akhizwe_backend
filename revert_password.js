require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function revertPassword() {
  try {
    console.log('🔄 Reverting password for phone: 0711111111');
    
    const originalPassword = 'password';
    const hashedPassword = await bcrypt.hash(originalPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING email, full_name',
      [hashedPassword, '0711111111']
    );
    
    if (result.rows.length > 0) {
      const updatedUser = result.rows[0];
      console.log(`✅ Reverted: ${updatedUser.full_name} (0711111111)`);
      console.log(`   Password: ${originalPassword}`);
      
      // Test the login
      const testResult = await pool.query('SELECT * FROM users WHERE phone = $1', ['0711111111']);
      const testUser = testResult.rows[0];
      const isValid = await bcrypt.compare(originalPassword, testUser.password_hash);
      console.log(`Test login ${isValid ? '✅ WORKS' : '❌ FAILED'}`);
      
    } else {
      console.log(`❌ User not found: 0711111111`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

revertPassword();