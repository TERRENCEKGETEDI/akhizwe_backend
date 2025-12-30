require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const http = require('http');
const routes = require('./routes/index');
const pool = require('./db');
const { initialize: initializeWebSocket } = require('./services/websocketService');

const app = express();
const server = http.createServer(app);

// Security: Remove Express fingerprinting header
app.disable('x-powered-by');

// Security: Apply Helmet for comprehensive protection
app.use(helmet());

// Trust proxy for Cloudflare and other reverse proxies
app.set("trust proxy", 1);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000', // Development frontend
      // 'http://localhost:5173', // Vite dev server
      'https://akhizwe-app.web.app' // Production frontend
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
app.use(bodyParser.json());
app.use('/api', routes);

// Serve files by redirecting to Supabase
app.get('/:file(*)', async (req, res) => {
  const fileName = req.params.file;
  try {
    const result = await pool.query('SELECT media_type FROM media WHERE file_path = $1', [fileName]);
    if (result.rows.length === 0) {
      return res.status(404).send('File not found');
    }
    const mediaType = result.rows[0].media_type;
    const bucket = mediaType === 'VIDEO' ? 'videos' : mediaType === 'MUSIC' ? 'audio' : 'images';
    const supabaseUrl = `https://rkuzqajmxnatyulwoxzy.supabase.co/storage/v1/object/public/${bucket}/${fileName}`;
    res.redirect(supabaseUrl);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).send('Internal server error');
  }
});

const PORT = process.env.PORT || 5000;

// Initialize WebSocket service
initializeWebSocket(server);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));