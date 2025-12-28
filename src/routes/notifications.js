const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

const router = express.Router();

// GET /notifications/preferences - Get user's notification preferences
router.get('/preferences', authMiddleware, async (req, res) => {
    try {
        const preferences = await NotificationService.getUserPreferences(req.user.email);
        res.json({ preferences });
    } catch (error) {
        console.error('Error getting notification preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /notifications/preferences - Update user's notification preferences
router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        const preferences = await NotificationService.updateUserPreferences(req.user.email, req.body);
        res.json({ 
            message: 'Notification preferences updated successfully',
            preferences 
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /notifications - Get user's notifications with pagination
router.get('/', authMiddleware, async (req, res) => {
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

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const count = await NotificationService.getUnreadCount(req.user.email);
        res.json({ unread_count: count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /notifications/:notification_id/read - Mark notification as read
router.post('/:notification_id/read', authMiddleware, async (req, res) => {
    try {
        const { notification_id } = req.params;
        const { channel = 'in_app' } = req.body;
        
        const notification = await NotificationService.markAsRead(notification_id, req.user.email, channel);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ 
            message: 'Notification marked as read',
            notification 
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /notifications/read-all - Mark all notifications as read
router.post('/read-all', authMiddleware, async (req, res) => {
    try {
        await NotificationService.markAllAsRead(req.user.email);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /notifications/:notification_id - Delete notification
router.delete('/:notification_id', authMiddleware, async (req, res) => {
    try {
        const { notification_id } = req.params;
        
        // Note: In a production system, you might want to soft-delete
        // For now, we'll just remove from database
        const pool = require('../db');
        const result = await pool.query(
            'DELETE FROM notifications WHERE notification_id = $1 AND user_email = $2',
            [notification_id, req.user.email]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;