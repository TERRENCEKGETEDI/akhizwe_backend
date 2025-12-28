const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and video files are allowed'));
    }
  }
});

// POST /media/upload - Upload media (authenticated users only)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { title, description, media_type, artist, category, release_date } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    if (!title || !media_type) {
      return res.status(400).json({ error: 'Title and media_type are required' });
    }

    if (!['audio', 'video'].includes(media_type)) {
      return res.status(400).json({ error: 'Invalid media_type' });
    }

    // Validate file type and size
    const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/aac'];
    const allowedVideo = ['video/mp4', 'video/x-matroska', 'video/webm'];
    const allowedTypes = media_type === 'audio' ? allowedAudio : allowedVideo;
    if (!allowedTypes.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'File too large' });
    }

    const media_id = uuidv4();
    const file_path = `uploads/${file.filename}`;
    const file_size = file.size;

    await pool.query(
      `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, artist, category, release_date, copyright_declared, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [media_id, title, description || '', media_type, req.user.email, file_path, file_size, artist || '', category || '', release_date || null, true, false]
    );

    res.status(201).json({ message: 'Media uploaded successfully, pending approval', media_id });
  } catch (error) {
    console.error('Error uploading media:', error);
    // Delete file if db insert fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/favorites - Get user's favorited media (must come before :id route)
router.get('/favorites', authMiddleware, async (req, res) => {
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

// GET /media - List approved media with filters and sorting
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, sort_by = 'date', filter_type, search } = req.query;
    const offset = (page - 1) * limit;

    let orderBy = 'm.uploaded_at DESC';
    if (sort_by === 'likes') {
      orderBy = 'likes DESC';
    } else if (sort_by === 'comments') {
      orderBy = 'comments DESC';
    } else if (sort_by === 'creator') {
      orderBy = 'u.full_name ASC';
    }

    let whereClause = 'm.is_approved = true';
    const params = [];
    let paramIndex = 1;

    // Add type filter
    if (filter_type && ['audio', 'video'].includes(filter_type)) {
      // Normalize frontend format to database format
      const dbMediaType = filter_type === 'audio' ? 'MUSIC' : 'VIDEO';
      whereClause += ` AND m.media_type = ${paramIndex}`;
      params.push(dbMediaType);
      paramIndex++;
    }

    // Add search filter
    if (search && search.trim()) {
      whereClause += ` AND (m.title ILIKE ${paramIndex} OR m.description ILIKE ${paramIndex} OR m.artist ILIKE ${paramIndex})`;
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
      LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
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
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

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

// GET /media/:id - Get media details and increment view_count
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Increment view_count
    await pool.query('UPDATE media SET view_count = view_count + 1 WHERE media_id = $1', [id]);

    const result = await pool.query(
      `SELECT m.*, u.full_name as creator_name,
              COALESCE(like_count, 0) as likes,
              COALESCE(comment_count, 0) as comments
       FROM media m
       JOIN users u ON m.uploader_email = u.email
       LEFT JOIN (SELECT media_id, COUNT(*) as like_count FROM media_interactions WHERE interaction_type = 'LIKE' GROUP BY media_id) li ON m.media_id = li.media_id
       LEFT JOIN (SELECT media_id, COUNT(*) as comment_count FROM media_comments GROUP BY media_id) mc ON m.media_id = mc.media_id
       WHERE m.media_id = $1 AND m.is_approved = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Normalize media data to match frontend expectations
    const normalizedMedia = {
      ...result.rows[0],
      media_type: result.rows[0].media_type === 'MUSIC' ? 'audio' : result.rows[0].media_type === 'VIDEO' ? 'video' : result.rows[0].media_type,
      likes: parseInt(result.rows[0].likes) || 0,
      comments: parseInt(result.rows[0].comments) || 0
    };

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
      'UPDATE media SET download_count = download_count + 1 WHERE media_id = $1 AND is_approved = true RETURNING file_path',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    res.json({ file_path: result.rows[0].file_path });
  } catch (error) {
    console.error('Error processing download:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/like - Add/update LIKE interaction
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Like request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    // Upsert interaction
    const result = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type)
       VALUES ($1, $2, 'LIKE')
       ON CONFLICT (user_email, media_id, interaction_type) DO NOTHING`,
      [id, req.user.email]
    );
    console.log(`Like operation result: ${result.rowCount} rows affected`);

    res.json({ message: 'Liked successfully' });
  } catch (error) {
    console.error('Error liking media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/:id/like - Remove LIKE interaction
router.delete('/:id/like', authMiddleware, async (req, res) => {
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
router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Favorite request for media ${id} by user ${req.user.email}`);

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    // Upsert interaction
    const result = await pool.query(
      `INSERT INTO media_interactions (media_id, user_email, interaction_type)
       VALUES ($1, $2, 'FAVORITE')
       ON CONFLICT (user_email, media_id, interaction_type) DO NOTHING`,
      [id, req.user.email]
    );
    console.log(`Favorite operation result: ${result.rowCount} rows affected`);

    res.json({ message: 'Favorited successfully' });
  } catch (error) {
    console.error('Error favoriting media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/:id/favorite - Remove FAVORITE interaction
router.delete('/:id/favorite', authMiddleware, async (req, res) => {
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
router.post('/:id/comment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text } = req.body;

    console.log(`Comment request for media ${id} by user ${req.user.email}: ${comment_text}`);

    if (!comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    const comment_id = uuidv4();
    await pool.query(
      'INSERT INTO media_comments (comment_id, media_id, user_email, comment) VALUES ($1, $2, $3, $4)',
      [comment_id, id, req.user.email, comment_text.trim()]
    );

    console.log(`Comment added successfully with ID: ${comment_id}`);
    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/comment/:comment_id - Delete comment
router.delete('/comment/:comment_id', authMiddleware, async (req, res) => {
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

    const result = await pool.query(
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

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(result.rows.map(async (comment) => {
      const repliesResult = await pool.query(
        `SELECT mc.comment_id, mc.media_id, mc.user_email, mc.comment as comment_text, mc.parent_comment_id, mc.created_at, mc.updated_at, u.full_name as commenter_name,
                COALESCE(cl.like_count, 0) as likes
         FROM media_comments mc
         JOIN users u ON mc.user_email = u.email
         LEFT JOIN (SELECT comment_id, COUNT(*) as like_count FROM comment_likes GROUP BY comment_id) cl ON mc.comment_id = cl.comment_id
         WHERE mc.parent_comment_id = $1
         ORDER BY mc.created_at ASC`,
        [comment.comment_id]
      );
      return {
        ...comment,
        replies: repliesResult.rows
      };
    }));

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM media_comments WHERE media_id = $1 AND parent_comment_id IS NULL', [id]);
    const total = parseInt(countResult.rows[0].count);

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
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /media/:id/comment/:comment_id/reply - Add reply to comment
router.post('/:id/comment/:comment_id/reply', authMiddleware, async (req, res) => {
  try {
    const { id, comment_id } = req.params;
    const { reply_text } = req.body;

    console.log(`Reply request for comment ${comment_id} on media ${id} by user ${req.user.email}: ${reply_text}`);

    if (!reply_text || reply_text.trim() === '') {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    // Check if media exists and is approved
    const mediaCheck = await pool.query('SELECT media_id FROM media WHERE media_id = $1 AND is_approved = true', [id]);
    if (mediaCheck.rows.length === 0) {
      console.log(`Media ${id} not found or not approved`);
      return res.status(404).json({ error: 'Media not found' });
    }

    // Check if parent comment exists
    const commentCheck = await pool.query('SELECT comment_id FROM media_comments WHERE comment_id = $1', [comment_id]);
    if (commentCheck.rows.length === 0) {
      console.log(`Parent comment ${comment_id} not found`);
      return res.status(404).json({ error: 'Parent comment not found' });
    }

    const reply_id = uuidv4();
    await pool.query(
      'INSERT INTO media_comments (comment_id, media_id, user_email, comment, parent_comment_id) VALUES ($1, $2, $3, $4, $5)',
      [reply_id, id, req.user.email, reply_text.trim(), comment_id]
    );

    console.log(`Reply added successfully with ID: ${reply_id}`);
    res.status(201).json({ message: 'Reply added successfully' });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /media/reply/:reply_id - Delete reply
router.delete('/reply/:reply_id', authMiddleware, async (req, res) => {
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
router.post('/comment/:comment_id/like', authMiddleware, async (req, res) => {
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
router.delete('/comment/:comment_id/like', authMiddleware, async (req, res) => {
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
router.post('/:id/report', authMiddleware, async (req, res) => {
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

// GET /media/my - Get user's own media
router.get('/my', authMiddleware, async (req, res) => {
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
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

    res.json({ media: normalizedMedia });
  } catch (error) {
    console.error('Error fetching my media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// GET /media/pending - Get pending media (admin only)
router.get('/pending', authMiddleware, async (req, res) => {
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
      media_type: media.media_type === 'MUSIC' ? 'audio' : media.media_type === 'VIDEO' ? 'video' : media.media_type,
      likes: parseInt(media.likes) || 0,
      comments: parseInt(media.comments) || 0
    }));

    res.json({ media: normalizedMedia });
  } catch (error) {
    console.error('Error fetching pending media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /media/reports - Get media reports (admin only)
router.get('/reports', authMiddleware, async (req, res) => {
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
router.get('/notifications', authMiddleware, async (req, res) => {
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
router.get('/analytics', authMiddleware, async (req, res) => {
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
router.post('/:id/approve', authMiddleware, async (req, res) => {
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
router.post('/:id/reject', authMiddleware, async (req, res) => {
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
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if media belongs to user
    const mediaCheck = await pool.query('SELECT * FROM media WHERE media_id = $1 AND uploader_email = $2', [id, req.user.email]);
    if (mediaCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found or unauthorized' });
    }

    const media = mediaCheck.rows[0];

    // Delete file if it exists
    if (media.file_path) {
      const filePath = path.join(__dirname, '../../', media.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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
router.post('/reports/:report_id/resolve', authMiddleware, async (req, res) => {
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
router.post('/notifications/:notification_id/read', authMiddleware, async (req, res) => {
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
