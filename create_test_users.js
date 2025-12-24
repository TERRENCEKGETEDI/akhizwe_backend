require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUsers() {
  try {
    const testUsers = [
      { phone: '0710000000', password: 'password', email: 'test1@example.com', fullName: 'Test User 1' },
      { phone: '0711111111', password: 'password', email: 'test2@example.com', fullName: 'Test User 2' }
    ];

    for (const user of testUsers) {
      // Check if user exists
      const existing = await pool.query('SELECT phone FROM users WHERE phone = $1', [user.phone]);
      if (existing.rows.length > 0) {
        console.log(`User with phone ${user.phone} already exists`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);
      const userId = uuidv4();

      await pool.query(
        'INSERT INTO users (user_id, email, full_name, phone, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, user.email, user.fullName, user.phone, hashedPassword, 'USER', 100]
      );

      console.log(`Created test user: ${user.phone}`);
    }

    console.log('Test users creation completed');
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    pool.end();
  }
}

createTestUsers();