require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
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

// Serve static files from uploads directory with proper headers and range support
app.get('/uploads/:file(*)', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.mp3') contentType = 'audio/mpeg';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  // add more if needed
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

const PORT = process.env.PORT || 5000;

// Initialize WebSocket service
initializeWebSocket(server);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));