const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, surname, phone, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const phoneRegex = /^07[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT email FROM users WHERE email = $1 OR phone_number = $2', [email, phone]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${name} ${surname}`;
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO users (user_id, email, full_name, phone_number, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, email, fullName, phone, hashedPassword, 'USER', 0]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if password_hash exists
    if (!user.password_hash) {
      console.error('Login error: password_hash is null for user:', phone);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ message: 'Account is blocked' });
    }

    const token = jwt.sign({ email: user.email, role: user.role, phone: user.phone_number, wallet_balance: user.wallet_balance, daily_airtime_limit: user.daily_airtime_limit, airtime_balance: user.airtime_balance, data_balance: user.data_balance }, JWT_SECRET, { expiresIn: '1h' });
    res.json({
      token,
      user: {
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        wallet_balance: user.wallet_balance,
        daily_airtime_limit: user.daily_airtime_limit,
        phone: user.phone_number,
        data_balance: user.data_balance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const adminRoutes = require('./admin');
const airtimeDataRoutes = require('./airtimeData');
const ticketRoutes = require('./tickets');
const mediaRoutes = require('./media');
const notificationsRoutes = require('./notifications');

// Mount admin routes
router.use('/admin', adminRoutes);

// Mount airtime-data routes
router.use('/airtime-data', airtimeDataRoutes);

// Mount ticket routes
router.use('/tickets', ticketRoutes);

// Mount media routes
router.use('/media', mediaRoutes);

// Mount notifications routes
router.use('/notifications', notificationsRoutes);

module.exports = router;
