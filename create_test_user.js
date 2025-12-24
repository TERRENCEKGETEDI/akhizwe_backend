require('dotenv').config();
const pool = require('./src/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  try {
    const phone = '0719998889';
    const email = 'testuser@example.com';
    const password = 'ijuihyg';
    const fullName = 'Test User';

    // Check if user already exists
    const existing = await pool.query('SELECT email FROM users WHERE email = $1 OR phone_number = $2', [email, phone]);
    if (existing.rows.length > 0) {
      console.log('User already exists:', existing.rows[0]);
      // Update password if user exists
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE phone_number = $2',
        [hashedPassword, phone]
      );
      console.log('Password updated for user:', phone);
      return;
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (user_id, email, full_name, phone_number, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, email, fullName, phone, hashedPassword, 'USER', 100]
    );

    console.log('Test user created successfully!');
    console.log('Phone:', phone);
   :', email);
    console.log('Email:', password);
  console.log('Password } catch (error) {
    console test user:', error.error('Error creating);
  } finally {
    pool.end();
  }
}

createTestUser();
