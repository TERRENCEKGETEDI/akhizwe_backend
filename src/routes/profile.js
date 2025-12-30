const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const pool = require('../db');

// Get user profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { email } = req.user;
    
    const result = await pool.query(
      'SELECT email, full_name, phone, role, profile_picture, bio, wallet_balance FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profile_picture,
        bio: user.bio,
        walletBalance: user.wallet_balance
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { email } = req.user;
    const { fullName, bio, profilePicture } = req.body;
    
    // Validate input
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ message: 'Full name is required' });
    }
    
    if (bio && bio.length > 500) {
      return res.status(400).json({ message: 'Bio must be 500 characters or less' });
    }
    
    // Update user profile
    const result = await pool.query(
      'UPDATE users SET full_name = $1, bio = $2, profile_picture = $3 WHERE email = $4 RETURNING email, full_name, phone, role, profile_picture, bio, wallet_balance',
      [fullName.trim(), bio || null, profilePicture || null, email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profile_picture,
        bio: user.bio,
        walletBalance: user.wallet_balance
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Upload profile picture (base64)
router.post('/picture', authMiddleware, async (req, res) => {
  try {
    const { email } = req.user;
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: 'Image data is required' });
    }
    
    // Validate base64 image size (max 5MB)
    const base64Size = (imageData.length * 3) / 4;
    if (base64Size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image size must be less than 5MB' });
    }
    
    const result = await pool.query(
      'UPDATE users SET profile_picture = $1 WHERE email = $2 RETURNING profile_picture',
      [imageData, email]
    );
    
    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: result.rows[0].profile_picture
      }
    });
  } catch (error) {
    console.error('Error updating profile picture:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;