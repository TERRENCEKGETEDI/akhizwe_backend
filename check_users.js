const pool = require('./src/db');

// Check existing users in database
async function checkUsers() {
  try {
    console.log('👥 Checking existing users in database...\n');
    
    const result = await pool.query('SELECT email, full_name, phone FROM users LIMIT 10');
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`📊 Found ${result.rows.length} users:`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.full_name} (${user.email}) - Phone: ${user.phone}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  }
}

checkUsers().then(() => {
  console.log('\n🏁 User check completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});