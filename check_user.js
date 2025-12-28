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

async function checkUser() {
  try {
    console.log('🔍 Checking if user exists in database...');
    
    const result = await pool.query('SELECT email, role, phone FROM users WHERE email = $1', ['user@akhizwe.technologies']);
    
    if (result.rows.length === 0) {
      console.log('❌ User NOT FOUND in database!');
      console.log('📝 This explains why the API returns "Unauthorized"');
      console.log('');
      console.log('🛠️  Solutions:');
      console.log('1. Create the user in the database');
      console.log('2. Use an existing user email from the database');
      console.log('3. Check if the JWT token email matches a database user');
      console.log('');
      
      // Show all users in database
      console.log('👥 Available users in database:');
      const allUsers = await pool.query('SELECT email, role, phone FROM users LIMIT 10');
      allUsers.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.role}) - ${user.phone}`);
      });
      
    } else {
      console.log('✅ User FOUND in database!');
      console.log('User details:', result.rows[0]);
    }
    
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();