require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// Use raw body parser to debug the incoming data
app.use('/api/login', express.raw({ type: 'application/json' }));

// Test simple endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ message: 'Server is running' });
});

// Test login endpoint with raw body
app.post('/api/login', (req, res) => {
  console.log('=== RAW LOGIN DEBUG ===');
  console.log('Raw body type:', typeof req.body);
  console.log('Raw body length:', req.body.length);
  console.log('Raw body content:', req.body.toString());
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    // Parse the raw JSON
    const jsonData = JSON.parse(req.body.toString());
    console.log('✅ Successfully parsed JSON:', jsonData);
    
    const { phone, password } = jsonData;
    
    if (!phone || !password) {
      console.log('❌ Missing phone or password');
      return res.status(400).json({ message: 'Phone and password are required' });
    }
    
    console.log('🔍 Received phone:', phone);
    console.log('🔍 Received password length:', password.length);
    
    res.json({ 
      message: 'Raw body parsing works', 
      received_data: { phone, password: '***' },
      success: true
    });
    
  } catch (error) {
    console.error('❌ JSON parsing error:', error.message);
    res.status(400).json({ 
      message: 'Invalid JSON', 
      error: error.message,
      raw_body: req.body.toString()
    });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Raw debug server running on port ${PORT}`));