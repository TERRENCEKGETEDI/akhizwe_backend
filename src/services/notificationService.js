const pool = require('../db');
const { v4: uuidv4 } = require('uuid');

class NotificationService {
    /**
     * Create and send notification to user
     * @param {Object} params - Notification parameters
     * @param {string} params.recipientEmail - Who receives the notification
     * @param {string} params.actorEmail - Who performed the action
     * @param {string} params.actionType - Type of action (LIKE, FAVORITE, COMMENT, REPLY, DOWNLOAD)
     * @param {string} params.mediaId - ID of the media content
     * @param {string} params.mediaTitle - Title of the media content
     * @param {string} params.message - Notification message
     * @param {Object} params.metadata - Additional metadata
     * @param {string} params.priority - Priority level
     */
    static async createNotification({
        recipientEmail,
        actorEmail,
        actionType,
        mediaId,
        mediaTitle,
        message,
        metadata = {},
        priority = 'normal'
    }) {
        try {
            // Skip if user is notifying themselves
            if (recipientEmail === actorEmail) {
                return null;
            }

            // Check user preferences
            const preferences = await this.getUserPreferences(recipientEmail);
            if (!this.shouldSendNotification(preferences, actionType)) {
                return null;
            }

            // Check spam prevention
            const spamCheck = await this.checkSpamPrevention(recipientEmail, actorEmail, actionType, mediaId);
            if (!spamCheck.allowed) {
                console.log(`Notification blocked by spam prevention: ${spamCheck.reason}`);
                return null;
            }

            // Check daily limits
            const dailyCount = await this.getDailyNotificationCount(recipientEmail);
            if (dailyCount >= preferences.max_daily_notifications) {
                console.log(`Daily notification limit reached for ${recipientEmail}`);
                return null;
            }

            // Check quiet hours
            if (this.isQuietHours(preferences)) {
                // Queue for later delivery
                await this.queueForLaterDelivery({
                    recipientEmail,
                    actorEmail,
                    actionType,
                    mediaId,
                    mediaTitle,
                    message,
                    metadata,
                    priority
                });
                return null;
            }

            // Create notification
            const notificationId = uuidv4();
            const notificationChannel = this.determineChannel(preferences, actionType);
            
            const notification = {
                notification_id: notificationId,
                user_email: recipientEmail,
                notification_type: actionType,
                message: message,
                related_media_id: mediaId,
                notification_channel: notificationChannel,
                priority: priority,
                actor_email: actorEmail,
                action_type: actionType,
                metadata: {
                    mediaTitle,
                    actorName: await this.getUserName(actorEmail),
                    ...metadata
                },
                created_at: new Date().toISOString(),
                is_read: false
            };

            // Insert notification
            await pool.query(
                `INSERT INTO notifications (
                    notification_id, user_email, notification_type, message, related_media_id,
                    notification_channel, priority, actor_email, action_type, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    notification.notification_id,
                    notification.user_email,
                    notification.notification_type,
                    notification.message,
                    notification.related_media_id,
                    notification.notification_channel,
                    notification.priority,
                    notification.actor_email,
                    notification.action_type,
                    JSON.stringify(notification.metadata)
                ]
            );

            // Record spam prevention entry
            await this.recordSpamPrevention(recipientEmail, actorEmail, actionType, mediaId);

            // Send notification through appropriate channels
            await this.sendNotification(notification, preferences);

            // Emit real-time notification
            await this.emitRealTimeNotification(notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    /**
     * Get user notification preferences
     */
    static async getUserPreferences(email) {
        try {
            const result = await pool.query(
                'SELECT * FROM user_notification_preferences WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                // Create default preferences
                await this.createDefaultPreferences(email);
                return await this.getUserPreferences(email);
            }

            return result.rows[0];
        } catch (error) {
            console.error('Error getting user preferences:', error);
            return this.getDefaultPreferences();
        }
    }

    /**
     * Create default notification preferences for user
     */
    static async createDefaultPreferences(email) {
        try {
            await pool.query(
                `INSERT INTO user_notification_preferences (email) VALUES ($1)`,
                [email]
            );
        } catch (error) {
            console.error('Error creating default preferences:', error);
        }
    }

    /**
     * Get default preferences
     */
    static getDefaultPreferences() {
        return {
            email_notifications: true,
            push_notifications: true,
            in_app_notifications: true,
            like_notifications: true,
            favorite_notifications: true,
            comment_notifications: true,
            reply_notifications: true,
            download_notifications: true,
            frequency_digest: false,
            quiet_hours_start: '22:00:00',
            quiet_hours_end: '08:00:00',
            min_interval_minutes: 5,
            max_daily_notifications: 100
        };
    }

    /**
     * Update user notification preferences
     */
    static async updateUserPreferences(email, preferences) {
        try {
            const allowedFields = [
                'email_notifications', 'push_notifications', 'in_app_notifications',
                'like_notifications', 'favorite_notifications', 'comment_notifications',
                'reply_notifications', 'download_notifications', 'frequency_digest',
                'quiet_hours_start', 'quiet_hours_end', 'min_interval_minutes',
                'max_daily_notifications'
            ];

            const updateFields = [];
            const values = [email];
            let paramCount = 1;

            for (const [key, value] of Object.entries(preferences)) {
                if (allowedFields.includes(key)) {
                    paramCount++;
                    updateFields.push(`${key} = $${paramCount}`);
                    values.push(value);
                }
            }

            if (updateFields.length > 0) {
                const query = `
                    UPDATE user_notification_preferences 
                    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE email = $1
                `;
                await pool.query(query, values);
            }

            return await this.getUserPreferences(email);
        } catch (error) {
            console.error('Error updating user preferences:', error);
            throw error;
        }
    }

    /**
     * Check if notification should be sent based on user preferences
     */
    static shouldSendNotification(preferences, actionType) {
        switch (actionType) {
            case 'LIKE':
                return preferences.like_notifications;
            case 'FAVORITE':
                return preferences.favorite_notifications;
            case 'COMMENT':
                return preferences.comment_notifications;
            case 'REPLY':
                return preferences.reply_notifications;
            case 'DOWNLOAD':
                return preferences.download_notifications;
            default:
                return true;
        }
    }

    /**
     * Check spam prevention rules
     */
    static async checkSpamPrevention(recipientEmail, actorEmail, actionType, mediaId) {
        try {
            // Check for recent similar notifications (within min_interval_minutes)
            const result = await pool.query(
                `SELECT np.created_at, unp.min_interval_minutes
                 FROM notification_spam_prevention np
                 JOIN user_notification_preferences unp ON np.recipient_email = unp.email
                 WHERE np.recipient_email = $1 
                   AND np.actor_email = $2 
                   AND np.action_type = $3 
                   AND np.related_media_id = $4
                   AND np.created_at > NOW() - INTERVAL '1 minute' * unp.min_interval_minutes
                 ORDER BY np.created_at DESC
                 LIMIT 1`,
                [recipientEmail, actorEmail, actionType, mediaId]
            );

            if (result.rows.length > 0) {
                const minInterval = result.rows[0].min_interval_minutes;
                const lastNotification = new Date(result.rows[0].created_at);
                const now = new Date();
                const minutesSinceLast = (now - lastNotification) / (1000 * 60);

                if (minutesSinceLast < minInterval) {
                    return {
                        allowed: false,
                        reason: `Too soon since last notification (${minutesSinceLast.toFixed(1)}m < ${minInterval}m)`
                    };
                }
            }

            return { allowed: true };
        } catch (error) {
            console.error('Error checking spam prevention:', error);
            return { allowed: true }; // Allow on error
        }
    }

    /**
     * Record spam prevention entry
     */
    static async recordSpamPrevention(recipientEmail, actorEmail, actionType, mediaId) {
        try {
            await pool.query(
                `INSERT INTO notification_spam_prevention 
                 (recipient_email, actor_email, action_type, related_media_id) 
                 VALUES ($1, $2, $3, $4)`,
                [recipientEmail, actorEmail, actionType, mediaId]
            );
        } catch (error) {
            console.error('Error recording spam prevention:', error);
        }
    }

    /**
     * Get daily notification count for user
     */
    static async getDailyNotificationCount(email) {
        try {
            const result = await pool.query(
                'SELECT COUNT(*) FROM notifications WHERE user_email = $1 AND DATE(created_at) = CURRENT_DATE',
                [email]
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error getting daily count:', error);
            return 0;
        }
    }

    /**
     * Check if current time is in quiet hours
     */
    static isQuietHours(preferences) {
        if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
            return false;
        }

        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const startTime = this.timeStringToInt(preferences.quiet_hours_start);
        const endTime = this.timeStringToInt(preferences.quiet_hours_end);

        if (startTime > endTime) {
            // Quiet hours span midnight
            return currentTime >= startTime || currentTime <= endTime;
        } else {
            // Normal quiet hours
            return currentTime >= startTime && currentTime <= endTime;
        }
    }

    /**
     * Convert time string (HH:MM) to integer (HHMM)
     */
    static timeStringToInt(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 100 + minutes;
    }

    /**
     * Determine notification channel based on preferences and action type
     */
    static determineChannel(preferences, actionType) {
        // High priority notifications go through all enabled channels
        const enabledChannels = [];
        if (preferences.in_app_notifications) enabledChannels.push('in_app');
        if (preferences.email_notifications) enabledChannels.push('email');
        if (preferences.push_notifications) enabledChannels.push('push');

        // For now, prioritize in_app for real-time, email for important
        if (actionType === 'DOWNLOAD' && preferences.email_notifications) {
            return 'email';
        }
        
        return enabledChannels.includes('in_app') ? 'in_app' : enabledChannels[0] || 'in_app';
    }

    /**
     * Send notification through appropriate channels
     */
    static async sendNotification(notification, preferences) {
        try {
            // In-app notification (always sent)
            await this.sendInAppNotification(notification);

            // Email notification (if enabled and appropriate)
            if (notification.notification_channel === 'email' || preferences.email_notifications) {
                await this.sendEmailNotification(notification);
            }

            // Push notification (if enabled and supported)
            if (notification.notification_channel === 'push' || preferences.push_notifications) {
                await this.sendPushNotification(notification);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    /**
     * Send in-app notification
     */
    static async sendInAppNotification(notification) {
        // In-app notifications are already stored in database
        // Real-time delivery will be handled by WebSocket
        console.log(`In-app notification sent: ${notification.notification_id}`);
    }

    /**
     * Send email notification (placeholder implementation)
     */
    static async sendEmailNotification(notification) {
        try {
            // Track delivery
            const deliveryId = uuidv4();
            await pool.query(
                `INSERT INTO notification_deliveries 
                 (delivery_id, notification_id, channel, status) 
                 VALUES ($1, $2, $3, $4)`,
                [deliveryId, notification.notification_id, 'email', 'sent']
            );

            // TODO: Implement actual email sending
            console.log(`Email notification sent: ${notification.notification_id}`);
        } catch (error) {
            console.error('Error sending email notification:', error);
        }
    }

    /**
     * Send push notification (placeholder implementation)
     */
    static async sendPushNotification(notification) {
        try {
            // Track delivery
            const deliveryId = uuidv4();
            await pool.query(
                `INSERT INTO notification_deliveries 
                 (delivery_id, notification_id, channel, status) 
                 VALUES ($1, $2, $3, $4)`,
                [deliveryId, notification.notification_id, 'push', 'sent']
            );

            // TODO: Implement actual push notification sending
            console.log(`Push notification sent: ${notification.notification_id}`);
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }

    /**
     * Queue notification for later delivery (quiet hours)
     */
    static async queueForLaterDelivery(notificationData) {
        // For now, just log. In production, this would add to a queue system
        console.log(`Notification queued for later delivery:`, notificationData);
    }

    /**
     * Get user name by email
     */
    static async getUserName(email) {
        try {
            const result = await pool.query('SELECT full_name FROM users WHERE email = $1', [email]);
            return result.rows[0]?.full_name || email;
        } catch (error) {
            console.error('Error getting user name:', error);
            return email;
        }
    }

    /**
     * Emit real-time notification via WebSocket
     */
    static async emitRealTimeNotification(notification) {
        try {
            // This will be implemented when we set up WebSocket support
            // For now, we'll use a simple event emitter pattern
            if (global.notificationEmitter) {
                global.notificationEmitter.emit('new_notification', notification);
            }
            console.log(`Real-time notification emitted: ${notification.notification_id}`);
        } catch (error) {
            console.error('Error emitting real-time notification:', error);
        }
    }

    /**
     * Get user's notifications with pagination - with fallback to media_interactions and media_comments
     */
    static async getUserNotifications(email, page = 1, limit = 20, unreadOnly = false) {
        try {
            // Try to get notifications from the notifications table first
            const notificationsResult = await this.getNotificationsFromTable(email, page, limit, unreadOnly);
            
            // If we got notifications from the table, return them
            if (notificationsResult.notifications.length > 0) {
                return notificationsResult;
            }
            
            // If no notifications in the notifications table, use fallback to media_interactions and media_comments
            console.log('No notifications found in notifications table, using fallback from media_interactions and media_comments');
            return await this.getFallbackNotifications(email, page, limit, unreadOnly);
            
        } catch (error) {
            console.error('Error getting user notifications:', error);
            // If there's an error with the main notifications table, fall back to interactions and comments
            console.log('Error accessing notifications table, using fallback from media_interactions and media_comments');
            return await this.getFallbackNotifications(email, page, limit, unreadOnly);
        }
    }

    /**
     * Get notifications from the main notifications table and ticket notifications
     */
    static async getNotificationsFromTable(email, page, limit, unreadOnly) {
        const offset = (page - 1) * limit;
        let whereClause = 'user_email = $1';
        const params = [email];

        if (unreadOnly) {
            whereClause += ' AND is_read = false';
        }

        // Query for notifications from both tables
        const notificationsQuery = `
            SELECT notification_id, user_email, notification_type, message, related_media_id, notification_channel, priority, actor_email, action_type, metadata, created_at, is_read
            FROM notifications
            WHERE ${whereClause}
            UNION ALL
            SELECT notification_id, user_email, notification_type::text, message, ticket_id as related_media_id, 'in_app' as notification_channel, 'normal' as priority, null as actor_email, 'TICKET' as action_type, json_build_object('transaction_ref', transaction_ref) as metadata, sent_at as created_at, false as is_read
            FROM ticket_notifications
            WHERE user_email = $1
            ORDER BY created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        const result = await pool.query(notificationsQuery, [...params, limit, offset]);

        // Get total count from both tables
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT notification_id FROM notifications WHERE ${whereClause}
                UNION ALL
                SELECT notification_id FROM ticket_notifications WHERE user_email = $1
            ) as combined
        `;
        const countResult = await pool.query(countQuery, params);

        return {
            notifications: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
            }
        };
    }

    /**
     * Fallback method to get notifications from media_interactions and media_comments tables
     */
    static async getFallbackNotifications(email, page = 1, limit = 20, unreadOnly = false) {
        try {
            const offset = (page - 1) * limit;
            const notifications = [];

            // Get user's media content (for determining what notifications they should receive)
            const userMediaResult = await pool.query(
                'SELECT media_id, title FROM media WHERE uploader_email = $1',
                [email]
            );
            
            const userMediaIds = userMediaResult.rows.map(row => row.media_id);
            
            if (userMediaIds.length === 0) {
                return {
                    notifications: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        pages: 0
                    },
                    source: 'fallback_empty'
                };
            }

            // Get interactions (likes and favorites) on user's content
            const interactionsResult = await pool.query(
                `SELECT mi.*, m.title as media_title, u.full_name as actor_name, u.email as actor_email
                 FROM media_interactions mi
                 JOIN media m ON mi.media_id = m.media_id
                 JOIN users u ON mi.user_email = u.email
                 WHERE mi.media_id = ANY($1) AND mi.user_email != $2
                 ORDER BY mi.created_at DESC
                 LIMIT $3 OFFSET $4`,
                [userMediaIds, email, limit, offset]
            );

            // Format interactions as notifications
            for (const interaction of interactionsResult.rows) {
                const notification = {
                    notification_id: `fallback_interaction_${interaction.interaction_id}`,
                    user_email: email, // Content owner
                    notification_type: interaction.interaction_type === 'LIKE' ? 'LIKE' : 'FAVORITE',
                    message: `${interaction.actor_name || interaction.actor_email} ${interaction.interaction_type.toLowerCase()}d your content "${interaction.media_title}"`,
                    related_media_id: interaction.media_id,
                    is_read: false, // Fallback notifications are always unread
                    created_at: interaction.created_at,
                    actor_email: interaction.actor_email,
                    action_type: interaction.interaction_type,
                    metadata: {
                        mediaTitle: interaction.media_title,
                        actorName: interaction.actor_name || interaction.actor_email,
                        fallback: true,
                        source: 'media_interactions'
                    },
                    priority: 'normal',
                    notification_channel: 'in_app'
                };
                notifications.push(notification);
            }

            // Get comments on user's content
            const commentsResult = await pool.query(
                `SELECT mc.*, m.title as media_title, u.full_name as actor_name, u.email as actor_email
                 FROM media_comments mc
                 JOIN media m ON mc.media_id = m.media_id
                 JOIN users u ON mc.user_email = u.email
                 WHERE mc.media_id = ANY($1) AND mc.user_email != $2
                 ORDER BY mc.created_at DESC
                 LIMIT $3 OFFSET $4`,
                [userMediaIds, email, limit, offset]
            );

            // Format comments as notifications
            for (const comment of commentsResult.rows) {
                const commentPreview = comment.comment_text.length > 50 
                    ? comment.comment_text.substring(0, 50) + '...' 
                    : comment.comment_text;
                    
                const notification = {
                    notification_id: `fallback_comment_${comment.comment_id}`,
                    user_email: email, // Content owner
                    notification_type: 'COMMENT',
                    message: `${comment.actor_name || comment.actor_email} commented on your content "${comment.media_title}": "${commentPreview}"`,
                    related_media_id: comment.media_id,
                    is_read: false, // Fallback notifications are always unread
                    created_at: comment.created_at,
                    actor_email: comment.actor_email,
                    action_type: 'COMMENT',
                    metadata: {
                        mediaTitle: comment.media_title,
                        actorName: comment.actor_name || comment.actor_email,
                        commentText: comment.comment_text,
                        fallback: true,
                        source: 'media_comments'
                    },
                    priority: 'normal',
                    notification_channel: 'in_app'
                };
                notifications.push(notification);
            }

            // Combine and sort all notifications by creation date
            notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Apply pagination
            const paginatedNotifications = notifications.slice(offset, offset + limit);

            // Get total count for pagination
            const interactionsCountResult = await pool.query(
                'SELECT COUNT(*) FROM media_interactions WHERE media_id = ANY($1) AND user_email != $2',
                [userMediaIds, email]
            );

            const commentsCountResult = await pool.query(
                'SELECT COUNT(*) FROM media_comments WHERE media_id = ANY($1) AND user_email != $2',
                [userMediaIds, email]
            );

            const totalCount = parseInt(interactionsCountResult.rows[0].count) + parseInt(commentsCountResult.rows[0].count);

            return {
                notifications: paginatedNotifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                },
                source: 'fallback',
                fallback_reason: 'Notifications table unavailable, displaying interactions and comments'
            };

        } catch (error) {
            console.error('Error getting fallback notifications:', error);
            return {
                notifications: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    pages: 0
                },
                source: 'fallback_error',
                error: error.message
            };
        }
    }

    /**
     * Mark notification as read - with fallback support
     */
    static async markAsRead(notificationId, email, channel = 'in_app') {
        try {
            // Handle fallback notifications (those starting with 'fallback_')
            if (notificationId.startsWith('fallback_')) {
                console.log('Fallback notification marked as read (no storage needed):', notificationId);
                // For fallback notifications, we just return success
                // In a real implementation, you might want to store this state in session or local storage
                return {
                    notification_id: notificationId,
                    user_email: email,
                    is_read: true,
                    read_at: new Date().toISOString(),
                    fallback: true
                };
            }

            // Handle regular notifications from the notifications table
            const result = await pool.query(
                `UPDATE notifications 
                 SET is_read = true, 
                     read_at = CURRENT_TIMESTAMP,
                     read_channels = COALESCE(read_channels, '{}'::jsonb) || $3::jsonb
                 WHERE notification_id = $1 AND user_email = $2
                 RETURNING *`,
                [notificationId, email, JSON.stringify({ [channel]: true })]
            );

            return result.rows[0];
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for user
     */
    static async markAllAsRead(email) {
        try {
            await pool.query(
                `UPDATE notifications 
                 SET is_read = true, 
                     read_at = CURRENT_TIMESTAMP
                 WHERE user_email = $1 AND is_read = false`,
                [email]
            );
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Get unread notification count for user - with fallback support
     */
    static async getUnreadCount(email) {
        try {
            // Get count from both notifications and ticket_notifications tables
            const countQuery = `
                SELECT COUNT(*) as total FROM (
                    SELECT notification_id FROM notifications WHERE user_email = $1 AND is_read = false
                    UNION ALL
                    SELECT notification_id FROM ticket_notifications WHERE user_email = $1
                ) as combined
            `;
            const result = await pool.query(countQuery, [email]);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Error getting unread count from notifications tables:', error);
            // Fallback: count interactions and comments as unread notifications
            try {
                const userMediaResult = await pool.query(
                    'SELECT media_id FROM media WHERE uploader_email = $1',
                    [email]
                );

                const userMediaIds = userMediaResult.rows.map(row => row.media_id);

                if (userMediaIds.length === 0) {
                    return 0;
                }

                const interactionsCountResult = await pool.query(
                    'SELECT COUNT(*) FROM media_interactions WHERE media_id = ANY($1) AND user_email != $2',
                    [userMediaIds, email]
                );

                const commentsCountResult = await pool.query(
                    'SELECT COUNT(*) FROM media_comments WHERE media_id = ANY($1) AND user_email != $2',
                    [userMediaIds, email]
                );

                return parseInt(interactionsCountResult.rows[0].count) + parseInt(commentsCountResult.rows[0].count);
            } catch (fallbackError) {
                console.error('Error getting fallback unread count:', fallbackError);
                return 0;
            }
        }
    }
}

module.exports = NotificationService;