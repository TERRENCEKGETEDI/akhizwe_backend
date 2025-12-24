require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const routes = require('./routes/index');
const pool = require('./db');
const { initialize: initializeWebSocket } = require('./services/websocketService');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000', // Development frontend
      'http://localhost:5173', // Vite dev server
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

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 5000;

// Initialize WebSocket service
initializeWebSocket(server);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));