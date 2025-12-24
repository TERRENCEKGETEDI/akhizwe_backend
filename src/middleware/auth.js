const jwt = require('jsonwebtoken');
const pool = require('../db');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      const result = await pool.query('SELECT role, is_blocked FROM users WHERE email = $1', [user.email]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (result.rows[0].is_blocked) {
        return res.status(403).json({ error: 'Account is blocked' });
      }
      req.user = { ...user, role: result.rows[0].role };
      next();
    } catch (error) {
      console.error('Error fetching user role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };