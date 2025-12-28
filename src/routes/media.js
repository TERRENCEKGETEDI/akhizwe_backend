const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NotificationService = require('../services/notificationService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rkuzqajmxnatyulwoxzy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdXpxYWpteG5hdHl1bHdveHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3ODQ3NjcsImV4cCI6MjA4MjM2MDc2N30.vGNaNmfhVd8YvLIhHyr0vCeaM-qshoJnKqEsKv0gsjM'
);

// Helper function to generate signed URL
async function generateSignedUrl(bucket, filePath) {
  // For now, use public URL since buckets might be public for upload
  // TODO: Use signed URLs for private buckets
  return `https://rkuzqajmxnatyulwoxzy.supabase.co/storage/v1/object/public/${bucket}/${encodeURIComponent(filePath)}`;
}

// Helper function to get bucket from media_type
function getBucketFromMediaType(mediaType) {
  if (mediaType === 'VIDEO') return 'videos';
  if (mediaType === 'MUSIC') return 'audio';
  if (mediaType === 'IMAGE') return 'images';
  return null;
}

// Helper function to add signed_url to media objects
async function addSignedUrls(mediaArray) {
  for (const media of mediaArray) {
    const bucket = getBucketFromMediaType(media.media_type);
    if (bucket && media.file_path) {
      media.signed_url = await generateSignedUrl(bucket, media.file_path);
    }
  }
  return mediaArray;
}

// Helper function to execute query with retry logic
async function executeQueryWithRetry(query, params, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`DEBUG: Query attempt ${attempt}/${maxRetries}`);
      const result = await pool.query(query, params);
      console.log(`DEBUG: Query attempt ${attempt} successful`);
      return result;
    } catch (error) {
      console.error(`DEBUG: Query attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message.includes('syntax error') || 
          error.message.includes('relation') && error.message.includes('does not exist') ||
          error.message.includes('column') && error.message.includes('does not exist')) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`DEBUG: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

const router = express.Router();

// Configure multer for file uploads (memory storage for Supabase)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio, video, and image files are allowed'));
    }
  }
});

// POST /media/upload - Upload media (authenticated users only)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, description, media_type, category, release_date } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    if (!title || !media_type) {
      return res.status(400).json({ error: 'Title and media_type are required' });
    }

    if (!['audio', 'video', 'image'].includes(media_type)) {
      return res.status(400).json({ error: 'Invalid media_type' });
    }

    // Map frontend media types to database values
    const dbMediaType = media_type === 'audio' ? 'MUSIC' : media_type === 'video' ? 'VIDEO' : 'IMAGE';

    // Determine Supabase bucket
    const bucket = media_type === 'audio' ? 'audio' : media_type === 'video' ? 'videos' : 'images';

    // Validate file type and size
    const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/aac'];
    const allowedVideo = ['video/mp4', 'video/x-matroska', 'video/webm'];
    const allowedImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedTypes = media_type === 'audio' ? allowedAudio : media_type === 'video' ? allowedVideo : allowedImage;
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      return res.status(400).json({ error: 'File too large' });
    }

    // Get user's full name and id to auto-populate artist field and for media_files
    const userResult = await pool.query('SELECT full_name, user_id FROM users WHERE email = $1', [req.user.email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'User not found' });
    }
    const userFullName = userResult.rows[0].full_name || req.user.email; // Fallback to email if full_name is null
    const userId = userResult.rows[0].user_id;

    const media_id = uuidv4();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${Date.now()}_${sanitizedName}`;

    // Upload to Supabase
    let uploadData;
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: `Failed to upload file to ${bucket}: ${error.message}` });
      }
      uploadData = data;
    } catch (supabaseError) {
      console.error('Supabase client error:', supabaseError);
      return res.status(500).json({ error: 'Storage service unavailable' });
    }

    const file_size = file.size;
    const currentDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

    await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_url, file_path, file_size, artist, category, release_date, copyright_declared, is_approved, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
      [media_id, title, description || '', dbMediaType, req.user.email, filePath, filePath, file_size, userFullName, category || '', currentDate, true, false]
    );

    // Insert into media_files table
    await pool.query(
      `INSERT INTO media_files (user_id, bucket, file_path, file_type, file_size, title)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, bucket, filePath, file.mimetype, file_size, title]
    );

    res.status(201).json({ message: 'Media uploaded successfully, pending approval', media_id });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/my - Get user's own media (must come before :id route)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name,
              COALESCE(like_count, 0) as likes,
              COALESCE(comment_count, 0) as comments
       FROM media m
       JOIN users u ON m.uploader_email = u.email
       LEFT JOIN (SELECT media_id, COUNT(*) as like_count FROM media_interactions WHERE interaction_type = 'LIKE' GROUP BY media_id) li ON m.media_id = li.media_id
       LEFT JOIN (SELECT media_id, COUNT(*) as comment_count FROM media_comments GROUP BY media_id) mc ON m.media_id = mc.media_id
       WHERE m.uploader_email = $1
       ORDER BY m.uploaded_at DESC`,
      [req.user.email]
    );

    // Normalize media data to match frontend expectations
    const normalizedMedia = result.rows.map(media => ({
      ...media,
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type === 'IMAGE' ? 'image' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

    // Add signed URLs
    await addSignedUrls(normalizedMedia);

    res.json({ media: normalizedMedia });
  } catch (error) {
    console.error('Error fetching my media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/liked - Get user's liked media IDs
router.get('/liked', authenticateToken, async (req, res) => {
  try {
    console.log(`Fetching liked media for user: ${req.user.email}`);

    const result = await pool.query(
      `SELECT mi.media_id
        FROM media_interactions mi
        WHERE mi.user_email = $1 AND mi.interaction_type = 'LIKE'`,
      [req.user.email]
    );

    // Extract media IDs that user has liked
    const likedMediaIds = result.rows.map(row => row.media_id);

    console.log(`Found ${likedMediaIds.length} liked media IDs for user ${req.user.email}`);

    res.json({ likedMediaIds });
  } catch (error) {
    console.error('Error fetching liked media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/favorites - Get user's favorited media (must come before :id route)
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    console.log(`Fetching favorites for user: ${req.user.email}`);

    const result = await pool.query(
      `SELECT mi.media_id
        FROM media_interactions mi
        WHERE mi.user_email = $1 AND mi.interaction_type = 'FAVORITE'`,
      [req.user.email]
    );

    // Extract media IDs that user has favorited
    const favoritedMediaIds = result.rows.map(row => row.media_id);

    console.log(`Found ${favoritedMediaIds.length} favorited media IDs for user ${req.user.email}`);

    res.json({ favoritedMediaIds });
  } catch (error) {
    console.error('Error fetching favorited media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/pending - Get pending media (admin only)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name,
              COALESCE(like_count, 0) as likes,
              COALESCE(comment_count, 0) as comments
       FROM media m
       JOIN users u ON m.uploader_email = u.email
       LEFT JOIN (SELECT media_id, COUNT(*) as like_count FROM media_interactions WHERE interaction_type = 'LIKE' GROUP BY media_id) li ON m.media_id = li.media_id
       LEFT JOIN (SELECT media_id, COUNT(*) as comment_count FROM media_comments GROUP BY media_id) mc ON m.media_id = mc.media_id
       WHERE m.is_approved = false
       ORDER BY m.uploaded_at ASC`
    );

    // Normalize media data to match frontend expectations
    const normalizedMedia = result.rows.map(media => ({
      ...media,
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type === 'IMAGE' ? 'image' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

    // Add signed URLs
    await addSignedUrls(normalizedMedia);

    res.json({ media: normalizedMedia });
  } catch (error) {
    console.error('Error fetching pending media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media - List approved media with filters and sorting
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort_by = 'date', filter_type, search, genre, artist, date, duration, popularity } = req.query;
    const offset = (page - 1) * limit;

    let orderBy = 'm.uploaded_at DESC';
    if (sort_by === 'likes') {
      orderBy = 'likes DESC';
    } else if (sort_by === 'comments') {
      orderBy = 'comments DESC';
    } else if (sort_by === 'creator') {
      orderBy = 'u.full_name ASC';
    } else if (sort_by === 'popularity') {
      orderBy = 'likes DESC'; // Sort by likes for popularity
    }

    // For authenticated users, show approved media plus their own unapproved uploads
    // For anonymous users, show only approved media
    let whereClause;
    let params;
    let paramIndex;
    if (req.user && req.user.email) {
      whereClause = '(m.is_approved = true OR m.uploader_email = $1)';
      params = [req.user.email];
      paramIndex = 2;
    } else {
      whereClause = 'm.is_approved = true';
      params = [];
      paramIndex = 1;
    }

    // Add type filter
    if (filter_type && ['audio', 'video', 'image'].includes(filter_type)) {
      // Normalize frontend format to database format
      const dbMediaType = filter_type === 'audio' ? 'MUSIC' : filter_type === 'video' ? 'VIDEO' : 'IMAGE';
      whereClause += ` AND m.media_type = $${paramIndex}`;
      params.push(dbMediaType);
      paramIndex++;
    }

    // Add genre filter (using category)
    if (genre && genre.trim()) {
      whereClause += ` AND m.category ILIKE $${paramIndex}`;
      params.push(`%${genre.trim()}%`);
      paramIndex++;
    }

    // Add artist filter
    if (artist && artist.trim()) {
      whereClause += ` AND m.artist ILIKE $${paramIndex}`;
      params.push(`%${artist.trim()}%`);
      paramIndex++;
    }

    // Add date filter
    if (date) {
      let dateCondition = '';
      const now = new Date();
      if (date === 'today') {
        const today = now.toISOString().split('T')[0];
        dateCondition = `m.uploaded_at >= '${today} 00:00:00'`;
      } else if (date === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        dateCondition = `m.uploaded_at >= '${weekAgo}'`;
      } else if (date === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        dateCondition = `m.uploaded_at >= '${monthAgo}'`;
      } else if (date === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        dateCondition = `m.uploaded_at >= '${yearAgo}'`;
      }
      if (dateCondition) {
        whereClause += ` AND ${dateCondition}`;
      }
    }

    // Add duration filter (approximate based on file size for now, since duration isn't stored)
    if (duration) {
      let sizeCondition = '';
      if (duration === 'short') {
        sizeCondition = 'm.file_size < 5000000'; // < 5MB for short
      } else if (duration === 'medium') {
        sizeCondition = 'm.file_size BETWEEN 5000000 AND 20000000'; // 5-20MB for medium
      } else if (duration === 'long') {
        sizeCondition = 'm.file_size > 20000000'; // > 20MB for long
      }
      if (sizeCondition) {
        whereClause += ` AND ${sizeCondition}`;
      }
    }

    // Add popularity filter (affects sorting or additional conditions)
    if (popularity) {
      if (popularity === 'trending') {
        // Trending: recent with high engagement
        whereClause += ` AND m.uploaded_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' AND ((SELECT COUNT(*) FROM media_interactions WHERE media_id = m.media_id AND interaction_type = 'LIKE') > 0 OR (SELECT COUNT(*) FROM media_comments WHERE media_id = m.media_id) > 0)`;
      } else if (popularity === 'popular') {
        // Popular: high likes
        whereClause += ` AND (SELECT COUNT(*) FROM media_interactions WHERE media_id = m.media_id AND interaction_type = 'LIKE') > 5`;
      } else if (popularity === 'new') {
        // New: recent uploads
        whereClause += ` AND m.uploaded_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'`;
      }
    }

    // Add search filter
    if (search && search.trim()) {
      whereClause += ` AND (m.title ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex} OR m.artist ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const query = `
      SELECT m.*, u.full_name as creator_name,
             COALESCE(like_count, 0) as likes,
             COALESCE(comment_count, 0) as comments
      FROM media m
      JOIN users u ON m.uploader_email = u.email
      LEFT JOIN (SELECT media_id, COUNT(*) as like_count FROM media_interactions WHERE interaction_type = 'LIKE' GROUP BY media_id) li ON m.media_id = li.media_id
      LEFT JOIN (SELECT media_id, COUNT(*) as comment_count FROM media_comments GROUP BY media_id) mc ON m.media_id = mc.media_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM media m WHERE ${whereClause}
    `;
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Normalize media data to match frontend expectations
    const normalizedMedia = result.rows.map(media => ({
      ...media,
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type === 'IMAGE' ? 'image' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

    // Add signed URLs
    await addSignedUrls(normalizedMedia);

    res.json({
      media: normalizedMedia,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/notifications - Get user notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const result = await NotificationService.getUserNotifications(
      req.user.email,
      parseInt(page),
      parseInt(limit),
      unread_only === 'true'
    );

    // Add a header to indicate if fallback notifications are being used
    if (result.source && result.source.startsWith('fallback')) {
      res.set('X-Notification-Source', result.source);
      if (result.fallback_reason) {
        res.set('X-Fallback-Reason', result.fallback_reason);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/:id - Get media details and increment view_count
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Increment view_count
    await pool.query('UPDATE media SET view_count = view_count + 1 WHERE media_id = $1', [id]);

    // Allow users to see details of their own media regardless of approval status
    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name,
               COALESCE(like_count, 0) as likes,
               COALESCE(comment_count, 0) as comments
        FROM media m
        JOIN users u ON m.uploader_email = u.email
        LEFT JOIN (SELECT media_id, COUNT(*) as like_count FROM media_interactions WHERE interaction_type = 'LIKE' GROUP BY media_id) li ON m.media_id = li.media_id
        LEFT JOIN (SELECT media_id, COUNT(*) as comment_count FROM media_comments GROUP BY media_id) mc ON m.media_id = mc.media_id
        WHERE m.media_id = $1 AND (m.is_approved = true OR m.uploader_email = $2)`,
      [id, req.user?.email || '']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Normalize media data to match frontend expectations
    const normalizedMedia = {
      ...result.rows[0],
      media_type: result.rows[0].media_type === 'MUSIC' ? 'audio' : result.rows[0].media_type === 'VIDEO' ? 'video' : result.rows[0].media_type === 'IMAGE' ? 'image' : result.rows[0].media_type,
      likes: parseInt(result.rows[0].likes) || 0,
      comments: parseInt(result.rows[0].comments) || 0
    };

    // Add signed URL
    const bucket = getBucketFromMediaType(result.rows[0].media_type);
    if (bucket && normalizedMedia.file_path) {
      normalizedMedia.signed_url = await generateSignedUrl(bucket, normalizedMedia.file_path);
    }

    res.json({ media: normalizedMedia });
  } catch (error) {
    console.error('Error fetching media details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/download - Increment download_count and return file_path
router.post('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE media SET download_count = download_count + 1 WHERE media_id = $1 AND is_approved = true RETURNING file_path, title, uploader_email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = result.rows[0];

    // Generate URL for download
    const bucket = getBucketFromMediaType(media.media_type);
    let downloadUrl = null;
    if (bucket && media.file_path) {
      downloadUrl = `https://rkuzqajmxnatyulwoxzy.supabase.co/storage/v1/object/public/${bucket}/${encodeURIComponent(media.file_path)}`;
    }

    // Send download notification if user is authenticated and not the owner
    if (req.user && req.user.email && media.uploader_email !== req.user.email) {
      try {
        await NotificationService.createNotification({
          recipientEmail: media.uploader_email,
          actorEmail: req.user.email,
          actionType: 'DOWNLOAD',
          mediaId: id,
          mediaTitle: media.title,
          message: `${req.user.email.split('@')[0]} downloaded your media "${media.title}"`,
          priority: 'normal'
        });
      } catch (notificationError) {
        console.error('Error sending download notification:', notificationError);
        // Don't fail the download operation if notification fails
      }
    }

    res.json({ download_url: downloadUrl });
  } catch (error) {
    console.error('Error processing download:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/like - Add/update LIKE interaction
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Like request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id, title, uploader_email FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = mediaCheck.rows[0];
    const wasAlreadyLiked = await pool.query(
      'SELECT 1 FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [id, req.user.email, 'LIKE']
    );

    // Upsert interaction
    const result = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type)
       VALUES ($1, $2, 'LIKE')
       ON CONFLICT (user_email, media_id, interaction_type) DO NOTHING`,
      [id, req.user.email]
    );
    console.log(`Like operation result: ${result.rowCount} rows affected`);

    // Send notification only if this is a new like (not a re-like)
    if (result.rowCount > 0 && media.uploader_email !== req.user.email) {
      try {
        await NotificationService.createNotification({
          recipientEmail: media.uploader_email,
          actorEmail: req.user.email,
          actionType: 'LIKE',
          mediaId: id,
          mediaTitle: media.title,
          message: `${req.user.email.split('@')[0]} liked your media "${media.title}"`,
          priority: 'normal'
        });
      } catch (notificationError) {
        console.error('Error sending like notification:', notificationError);
        // Don't fail the like operation if notification fails
      }
    }

    res.json({ message: 'Liked successfully' });
  } catch (error) {
    console.error('Error liking media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/:id/like - Remove LIKE interaction
router.delete('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Unlike request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete interaction
    const result = await pool.query(
      'DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [id, req.user.email, 'LIKE']
    );
    console.log(`Unlike operation result: ${result.rowCount} rows affected`);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Like not found' });
    }

    res.json({ message: 'Unliked successfully' });
  } catch (error) {
    console.error('Error unliking media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/favorite - Add/update FAVORITE interaction
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Favorite request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id, title, uploader_email FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = mediaCheck.rows[0];
    const wasAlreadyFavorited = await pool.query(
      'SELECT 1 FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [id, req.user.email, 'FAVORITE']
    );

    // Upsert interaction
    const result = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type)
       VALUES ($1, $2, 'FAVORITE')
       ON CONFLICT (user_email, media_id, interaction_type) DO NOTHING`,
      [id, req.user.email]
    );
    console.log(`Favorite operation result: ${result.rowCount} rows affected`);

    // Send notification only if this is a new favorite (not a re-favorite)
    if (result.rowCount > 0 && media.uploader_email !== req.user.email) {
      try {
        await NotificationService.createNotification({
          recipientEmail: media.uploader_email,
          actorEmail: req.user.email,
          actionType: 'FAVORITE',
          mediaId: id,
          mediaTitle: media.title,
          message: `${req.user.email.split('@')[0]} favorited your media "${media.title}"`,
          priority: 'normal'
        });
      } catch (notificationError) {
        console.error('Error sending favorite notification:', notificationError);
        // Don't fail the favorite operation if notification fails
      }
    }

    res.json({ message: 'Favorited successfully' });
  } catch (error) {
    console.error('Error favoriting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/:id/favorite - Remove FAVORITE interaction
router.delete('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Unfavorite request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete interaction
    const result = await pool.query(
      'DELETE FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
      [id, req.user.email, 'FAVORITE']
    );
    console.log(`Unfavorite operation result: ${result.rowCount} rows affected`);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Unfavorited successfully' });
  } catch (error) {
    console.error('Error unfavoriting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/comment - Add comment
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text } = req.body;

    console.log(`Comment request for media ${id} by user ${req.user.email}: ${comment_text}`);

    if (!comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id, title, uploader_email FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = mediaCheck.rows[0];
    const comment_id = uuidv4();
    await pool.query(
      'INSERT INTO media_comments (comment_id, media_id, user_email, comment) VALUES ($1, $2, $3, $4)',
      [comment_id, id, req.user.email, comment_text.trim()]
    );

    // Send notification to media owner if not commenting on own media
    if (media.uploader_email !== req.user.email) {
      try {
        await NotificationService.createNotification({
          recipientEmail: media.uploader_email,
          actorEmail: req.user.email,
          actionType: 'COMMENT',
          mediaId: id,
          mediaTitle: media.title,
          message: `${req.user.email.split('@')[0]} commented on your media "${media.title}": "${comment_text.substring(0, 50)}${comment_text.length > 50 ? '...' : ''}"`,
          priority: 'normal',
          metadata: { commentId: comment_id, commentText: comment_text }
        });
      } catch (notificationError) {
        console.error('Error sending comment notification:', notificationError);
        // Don't fail the comment operation if notification fails
      }
    }

    console.log(`Comment added successfully with ID: ${comment_id}`);
    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/comment/:comment_id - Delete comment
router.delete('/comment/:comment_id', authenticateToken, async (req, res) => {
  try {
    const { comment_id } = req.params;
    console.log(`Delete comment request for comment ${comment_id} by user ${req.user.email}`);

    // Check if comment exists and belongs to user
    const commentCheck = await pool.query('SELECT comment_id FROM media_comments WHERE comment_id = $1 AND user_email = $2', [comment_id, req.user.email]);
    if (commentCheck.rows.length === 0) {
      console.log(`Comment ${comment_id} not found or unauthorized`);
      return res.status(404).json({ error: 'Comment not found or unauthorized' });
    }

    // Delete comment (will cascade to replies and likes)
    await pool.query('DELETE FROM media_comments WHERE comment_id = $1', [comment_id]);
    console.log(`Comment deleted successfully: ${comment_id}`);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/:id/comments - List comments with replies
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('=== DEBUG: Fetching comments for media ID:', id);
    console.log('DEBUG: Query parameters:', { page, limit, offset });
    console.log('DEBUG: Database connection test...');

    // Test database connection first with retry
    try {
      const connectionTest = await executeQueryWithRetry('SELECT 1 as test', []);
      console.log('DEBUG: Database connection successful');
    } catch (connError) {
      console.error('DEBUG: Database connection failed:', connError);
      return res.status(500).json({ 
        error: 'Database connection failed after retries', 
        details: connError.message,
        suggestion: 'The database may be temporarily unavailable. Please try again in a moment.'
      });
    }

    // Test if required tables exist
    console.log('DEBUG: Checking if required tables exist...');
    try {
      const tablesCheck = await executeQueryWithRetry(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('media_comments', 'users', 'comment_likes')
      `, []);
      console.log('DEBUG: Found tables:', tablesCheck.rows.map(r => r.table_name));
      
      const missingTables = [];
      const requiredTables = ['media_comments', 'users', 'comment_likes'];
      for (const table of requiredTables) {
        if (!tablesCheck.rows.find(r => r.table_name === table)) {
          missingTables.push(table);
        }
      }
      
      if (missingTables.length > 0) {
        console.error('DEBUG: Missing tables:', missingTables);
        return res.status(500).json({ 
          error: 'Required tables missing from database', 
          details: `Missing tables: ${missingTables.join(', ')}` 
        });
      }
    } catch (tablesError) {
      console.error('DEBUG: Error checking tables:', tablesError);
      return res.status(500).json({ error: 'Failed to check table existence', details: tablesError.message });
    }

    // Test if media exists
    console.log('DEBUG: Checking if media exists...');
    try {
      const mediaCheck = await executeQueryWithRetry('SELECT media_id FROM media WHERE media_id = $1', [id]);
      console.log('DEBUG: Media exists:', mediaCheck.rows.length > 0);
      if (mediaCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Media not found' });
      }
    } catch (mediaError) {
      console.error('DEBUG: Error checking media:', mediaError);
      return res.status(500).json({ error: 'Failed to check media existence', details: mediaError.message });
    }

    console.log('DEBUG: Executing main comments query...');
    const result = await executeQueryWithRetry(
      `SELECT mc.comment_id, mc.media_id, mc.user_email, mc.comment as comment_text, mc.parent_comment_id, mc.created_at, mc.updated_at, u.full_name as commenter_name,
              COALESCE(cl.like_count, 0) as likes,
              COALESCE(reply_count.reply_count, 0) as reply_count
       FROM media_comments mc
       JOIN users u ON mc.user_email = u.email
       LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM comment_likes GROUP BY comment_id) cl ON mc.comment_id = cl.comment_id
       LEFT JOIN (SELECT parent_comment_id, COUNT(*) as reply_count FROM media_comments WHERE parent_comment_id IS NOT NULL GROUP BY parent_comment_id) reply_count ON mc.comment_id = reply_count.parent_comment_id
       WHERE mc.media_id = $1 AND mc.parent_comment_id IS NULL
       ORDER BY mc.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );
    console.log('DEBUG: Comments fetched:', result.rows.length);

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(result.rows.map(async (comment) => {
      console.log('DEBUG: Fetching replies for comment:', comment.comment_id);
      const repliesResult = await executeQueryWithRetry(
        `SELECT mc.comment_id, mc.media_id, mc.user_email, mc.comment as comment_text, mc.parent_comment_id, mc.created_at, mc.updated_at, u.full_name as commenter_name,
                COALESCE(cl.like_count, 0) as likes
         FROM media_comments mc
         JOIN users u ON mc.user_email = u.email
         LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM comment_likes GROUP BY comment_id) cl ON mc.comment_id = cl.comment_id
         WHERE mc.parent_comment_id = $1
         ORDER BY mc.created_at ASC`,
        [comment.comment_id]
      );
      console.log('DEBUG: Replies for comment', comment.comment_id, ':', repliesResult.rows.length);
      return {
        ...comment,
        replies: repliesResult.rows
      };
    }));

    // Get total count
    console.log('DEBUG: Getting total count...');
    const countResult = await executeQueryWithRetry('SELECT COUNT(*) FROM media_comments WHERE media_id = $1 AND parent_comment_id IS NULL', [id]);
    const total = parseInt(countResult.rows[0].count);
    console.log('DEBUG: Total comments count:', total);

    console.log('DEBUG: Successfully fetched comments, sending response');
    res.json({
      comments: commentsWithReplies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('=== ERROR: Error fetching comments ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /media/:id/comment/:comment_id/reply - Add reply to comment
router.post('/:id/comment/:comment_id/reply', authenticateToken, async (req, res) => {
  try {
    const { id, comment_id } = req.params;
    const { reply_text } = req.body;

    console.log(`Reply request for comment ${comment_id} on media ${id} by user ${req.user.email}: ${reply_text}`);

    if (!reply_text || reply_text.trim() === '') {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id, title, uploader_email FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const media = mediaCheck.rows[0];

    // Check if parent comment exists and get comment author
    const commentCheck = await pool.query('SELECT comment_id, user_email FROM media_comments WHERE comment_id = $1', [comment_id]);
    if (commentCheck.rows.length === 0) {
      console.log(`Parent comment ${comment_id} not found`);
      return res.status(404).json({ error: 'Parent comment not found' });
    }

    const parentComment = commentCheck.rows[0];
    const reply_id = uuidv4();
    await pool.query(
      'INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id) VALUES ($1, $2, $3, $4, $5)',
      [reply_id, id, req.user.email, reply_text.trim(), comment_id]
    );

    // Send notification to parent comment author if not replying to own comment
    if (parentComment.user_email !== req.user.email) {
      try {
        await NotificationService.createNotification({
          recipientEmail: parentComment.user_email,
          actorEmail: req.user.email,
          actionType: 'REPLY',
          mediaId: id,
          mediaTitle: media.title,
          message: `${req.user.email.split('@')[0]} replied to your comment on "${media.title}": "${reply_text.substring(0, 50)}${reply_text.length > 50 ? '...' : ''}"`,
          priority: 'normal',
          metadata: { 
            replyId: reply_id, 
            parentCommentId: comment_id,
            replyText: reply_text 
          }
        });
      } catch (notificationError) {
        console.error('Error sending reply notification:', notificationError);
        // Don't fail the reply operation if notification fails
      }
    }

    console.log(`Reply added successfully with ID: ${reply_id}`);
    res.status(201).json({ message: 'Reply added successfully' });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/reply/:reply_id - Delete reply
router.delete('/reply/:reply_id', authenticateToken, async (req, res) => {
  try {
    const { reply_id } = req.params;
    console.log(`Delete reply request for reply ${reply_id} by user ${req.user.email}`);

    // Check if reply exists and belongs to user
    const replyCheck = await pool.query('SELECT comment_id FROM media_comments WHERE comment_id = $1 AND user_email = $2 AND parent_comment_id IS NOT NULL', [reply_id, req.user.email]);
    if (replyCheck.rows.length === 0) {
      console.log(`Reply ${reply_id} not found or unauthorized`);
      return res.status(404).json({ error: 'Reply not found or unauthorized' });
    }

    // Delete reply (will cascade to likes)
    await pool.query('DELETE FROM media_comments WHERE comment_id = $1', [reply_id]);
    console.log(`Reply deleted successfully: ${reply_id}`);

    res.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Error deleting reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/comment/:comment_id/like - Like a comment
router.post('/comment/:comment_id/like', authenticateToken, async (req, res) => {
  try {
    const { comment_id } = req.params;
    console.log(`Like request for comment ${comment_id} by user ${req.user.email}`);

    // Check if comment exists
    const commentCheck = await pool.query('SELECT comment_id FROM media_comments WHERE comment_id = $1', [comment_id]);
    if (commentCheck.rows.length === 0) {
      console.log(`Comment ${comment_id} not found`);
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Upsert like
    const result = await pool.query(
      `INSERT INTO comment_likes (comment_id, user_email)
       VALUES ($1, $2)
       ON CONFLICT (comment_id, user_email) DO NOTHING`,
      [comment_id, req.user.email]
    );
    console.log(`Comment like operation result: ${result.rowCount} rows affected`);

    res.json({ message: 'Comment liked successfully' });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/comment/:comment_id/like - Unlike a comment
router.delete('/comment/:comment_id/like', authenticateToken, async (req, res) => {
  try {
    const { comment_id } = req.params;
    console.log(`Unlike request for comment ${comment_id} by user ${req.user.email}`);

    // Check if comment exists
    const commentCheck = await pool.query('SELECT comment_id FROM media_comments WHERE comment_id = $1', [comment_id]);
    if (commentCheck.rows.length === 0) {
      console.log(`Comment ${comment_id} not found`);
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Delete like
    const result = await pool.query(
      'DELETE FROM comment_likes WHERE comment_id = $1 AND user_email = $2',
      [comment_id, req.user.email]
    );
    console.log(`Comment unlike operation result: ${result.rowCount} rows affected`);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Like not found' });
    }

    res.json({ message: 'Comment unliked successfully' });
  } catch (error) {
    console.error('Error unliking comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/report - Report media
router.post('/:id/report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // Check if media exists
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1', [id]);
    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const report_id = uuidv4();
    await pool.query(
      'INSERT INTO reports (report_id, reporter_email, media_id, report_type, reason) VALUES ($1, $2, $3, $4, $5)',
      [report_id, req.user.email, id, 'MEDIA', reason.trim()]
    );

    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error reporting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NOTE: /media/my route moved above :id route to prevent route matching issues

// GET /media/reports - Get media reports (admin only)
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT r.*, m.title as media_title, u.full_name as reporter_name
       FROM reports r
       JOIN media m ON r.media_id = m.media_id
       JOIN users u ON r.reporter_email = u.email
       WHERE r.report_type = 'MEDIA' AND r.status = 'PENDING'
       ORDER BY r.created_at DESC`
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/notifications - Get user notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_email = $1 ORDER BY created_at DESC',
      [req.user.email]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/analytics - Get media analytics (admin only)
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get total uploads
    const totalUploadsResult = await pool.query('SELECT COUNT(*) FROM media');
    const totalUploads = parseInt(totalUploadsResult.rows[0].count);

    // Get total views
    const totalViewsResult = await pool.query('SELECT SUM(view_count) FROM media');
    const totalViews = parseInt(totalViewsResult.rows[0].sum) || 0;

    // Get total downloads
    const totalDownloadsResult = await pool.query('SELECT SUM(download_count) FROM media');
    const totalDownloads = parseInt(totalDownloadsResult.rows[0].sum) || 0;

    // Get total likes
    const totalLikesResult = await pool.query('SELECT COUNT(*) FROM media_interactions WHERE interaction_type = "LIKE"');
    const totalLikes = parseInt(totalLikesResult.rows[0].count);

    // Get pending approvals
    const pendingApprovalsResult = await pool.query('SELECT COUNT(*) FROM media WHERE is_approved = false');
    const pendingApprovals = parseInt(pendingApprovalsResult.rows[0].count);

    // Get reports count
    const reportsCountResult = await pool.query('SELECT COUNT(*) FROM reports WHERE report_type = "MEDIA" AND status = "PENDING"');
    const reportsCount = parseInt(reportsCountResult.rows[0].count);

    res.json({
      totalUploads,
      totalViews,
      totalDownloads,
      totalLikes,
      pendingApprovals,
      reportsCount
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/approve - Approve media (admin only)
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'UPDATE media SET is_approved = true WHERE media_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Create notification for uploader
    const notification_id = uuidv4();
    await pool.query(
      'INSERT INTO notifications (notification_id, user_email, notification_type, message, related_media_id) VALUES ($1, $2, $3, $4, $5)',
      [notification_id, result.rows[0].uploader_email, 'MEDIA_APPROVED', `Your media "${result.rows[0].title}" has been approved!`, id]
    );

    res.json({ message: 'Media approved successfully' });
  } catch (error) {
    console.error('Error approving media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/reject - Reject media (admin only)
router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'UPDATE media SET is_approved = false WHERE media_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Create notification for uploader
    const notification_id = uuidv4();
    await pool.query(
      'INSERT INTO notifications (notification_id, user_email, notification_type, message, related_media_id) VALUES ($1, $2, $3, $4, $5)',
      [notification_id, result.rows[0].uploader_email, 'MEDIA_REJECTED', `Your media "${result.rows[0].title}" has been rejected.`, id]
    );

    res.json({ message: 'Media rejected successfully' });
  } catch (error) {
    console.error('Error rejecting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/:id - Delete user's own media
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if media belongs to user
    const mediaCheck = await pool.query('SELECT * FROM media WHERE media_id = $1 AND uploader_email = $2', [id, req.user.email]);
    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found or unauthorized' });
    }

    const media = mediaCheck.rows[0];

    // Delete file from Supabase
    if (media.file_path) {
      const bucket = getBucketFromMediaType(media.media_type);
      if (bucket) {
        try {
          await supabase.storage.from(bucket).remove([media.file_path]);
        } catch (error) {
          console.error('Error deleting from Supabase:', error);
          // Continue with db delete even if storage delete fails
        }
      }
    }

    // Delete from database
    await pool.query('DELETE FROM media WHERE media_id = $1', [id]);

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/reports/:report_id/resolve - Resolve report (admin only)
router.post('/reports/:report_id/resolve', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { report_id } = req.params;

    await pool.query(
      'UPDATE reports SET status = "RESOLVED" WHERE report_id = $1',
      [report_id]
    );

    res.json({ message: 'Report resolved successfully' });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/notifications/:notification_id/read - Mark notification as read
router.post('/notifications/:notification_id/read', authenticateToken, async (req, res) => {
  try {
    const { notification_id } = req.params;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_email = $2',
      [notification_id, req.user.email]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;