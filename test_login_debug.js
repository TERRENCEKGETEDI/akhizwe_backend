require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('./src/routes/index');
const pool = require('./src/db');

const app = express();

// Enable CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', 
      'https://akhizwe-app.web.app'
    ];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb', type: 'application/json' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Test simple endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Server is running' });
});

// Test login endpoint directly 
app.post('/api/login', async (req, res) => {
  console.log('=== LOGIN DEBUG ===');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('Database connected at:', dbTest.rows[0].now);
    
    // Call the actual login route logic
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      console.log('❌ Missing phone or password');
      return res.status(400).json({ message: 'Phone and password are required' });
    }
    
    console.log('🔍 Querying database for phone:', phone);
    const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    console.log('📊 Query result rows:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('👤 User found:', user.email);
    
    res.json({ 
      message: 'Login endpoint works', 
      user_found: true,
      user_email: user.email
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

app.use('/api', routes);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Debug server running on port ${PORT}`));