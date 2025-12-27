const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const EventEmitter = require('events');

class WebSocketService {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: function (origin, callback) {
                    // Allow requests with no origin (like mobile apps or curl requests)
                    if (!origin) return callback(null, true);

                    const allowedOrigins = [
                        process.env.FRONTEND_URL || "http://localhost:5173",
                        'http://localhost:3000', // Development frontend
                        'https://akhizwe-app.web.app' // Production frontend
                    ];

                    if (allowedOrigins.indexOf(origin) !== -1) {
                        callback(null, true);
                    } else {
                        console.log(`WebSocket CORS blocked origin: ${origin}`);
                        callback(new Error('Not allowed by CORS'));
                    }
                },
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        this.connectedUsers = new Map(); // Map of user email to socket ID
        this.notificationEmitter = new EventEmitter();
        
        this.setupMiddleware();
        this.setupEventHandlers();
        
        // Make emitter globally available
        global.notificationEmitter = this.notificationEmitter;
        
        // Listen for notifications from the service
        this.notificationEmitter.on('new_notification', (notification) => {
            this.sendNotificationToUser(notification);
        });
        
        console.log('WebSocket service initialized');
    }
    
    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            console.log('WebSocket connection attempt - handshake auth:', socket.handshake.auth);
            console.log('WebSocket connection attempt - headers:', socket.handshake.headers);
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
                console.log('WebSocket token extracted:', token ? 'present' : 'missing');

                if (!token) {
                    console.error('WebSocket authentication failed: No token provided');
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
                socket.user = decoded;

                console.log(`WebSocket authentication successful for user: ${decoded.email}`);
                next();
            } catch (error) {
                console.error('WebSocket authentication error:', error.message);
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }
    
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log('WebSocket connection event triggered');
            const userEmail = socket.user?.email;
            console.log(`User attempting connection: ${userEmail || 'unknown'} (Socket ID: ${socket.id})`);

            if (!socket.user) {
                console.error('Connection failed: No user attached to socket');
                socket.disconnect();
                return;
            }

            console.log(`User connected: ${userEmail} (Socket ID: ${socket.id})`);
            
            // Store user connection
            this.connectedUsers.set(userEmail, socket.id);
            
            // Send initial unread count
            this.sendUnreadCount(userEmail);
            
            // Handle client requesting notifications
            socket.on('get_notifications', async (data) => {
                try {
                    const { page = 1, limit = 20 } = data || {};
                    const NotificationService = require('./notificationService');
                    const result = await NotificationService.getUserNotifications(userEmail, page, limit);
                    socket.emit('notifications_list', result);
                } catch (error) {
                    console.error('Error fetching notifications:', error);
                    socket.emit('error', { message: 'Failed to fetch notifications' });
                }
            });
            
            // Handle marking notification as read
            socket.on('mark_notification_read', async (data) => {
                try {
                    const { notificationId } = data;
                    const NotificationService = require('./notificationService');
                    await NotificationService.markAsRead(notificationId, userEmail);
                    
                    // Send updated unread count
                    this.sendUnreadCount(userEmail);
                    
                    socket.emit('notification_marked_read', { notificationId });
                } catch (error) {
                    console.error('Error marking notification as read:', error);
                    socket.emit('error', { message: 'Failed to mark notification as read' });
                }
            });
            
            // Handle marking all notifications as read
            socket.on('mark_all_read', async () => {
                try {
                    const NotificationService = require('./notificationService');
                    await NotificationService.markAllAsRead(userEmail);
                    
                    // Send updated unread count
                    this.sendUnreadCount(userEmail);
                    
                    socket.emit('all_notifications_marked_read');
                } catch (error) {
                    console.error('Error marking all notifications as read:', error);
                    socket.emit('error', { message: 'Failed to mark all notifications as read' });
                }
            });
            
            // Handle getting notification preferences
            socket.on('get_notification_preferences', async () => {
                try {
                    const NotificationService = require('./notificationService');
                    const preferences = await NotificationService.getUserPreferences(userEmail);
                    socket.emit('notification_preferences', preferences);
                } catch (error) {
                    console.error('Error getting notification preferences:', error);
                    socket.emit('error', { message: 'Failed to get notification preferences' });
                }
            });
            
            // Handle updating notification preferences
            socket.on('update_notification_preferences', async (data) => {
                try {
                    const NotificationService = require('./notificationService');
                    const preferences = await NotificationService.updateUserPreferences(userEmail, data);
                    socket.emit('notification_preferences_updated', preferences);
                } catch (error) {
                    console.error('Error updating notification preferences:', error);
                    socket.emit('error', { message: 'Failed to update notification preferences' });
                }
            });
            
            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`User disconnected: ${userEmail} (Reason: ${reason})`);
                this.connectedUsers.delete(userEmail);
            });
            
            // Handle connection errors
            socket.on('error', (error) => {
                console.error(`Socket error for user ${userEmail}:`, error);
            });
        });
    }
    
    /**
     * Send notification to specific user
     */
    sendNotificationToUser(notification) {
        const userSocketId = this.connectedUsers.get(notification.user_email);
        
        if (userSocketId) {
            this.io.to(userSocketId).emit('new_notification', notification);
            console.log(`Real-time notification sent to ${notification.user_email}`);
        } else {
            console.log(`User ${notification.user_email} not connected, notification queued`);
        }
    }
    
    /**
     * Send unread count to user
     */
    async sendUnreadCount(userEmail) {
        try {
            const NotificationService = require('./notificationService');
            const count = await NotificationService.getUnreadCount(userEmail);
            
            const userSocketId = this.connectedUsers.get(userEmail);
            if (userSocketId) {
                this.io.to(userSocketId).emit('unread_count', { count });
            }
        } catch (error) {
            console.error('Error sending unread count:', error);
        }
    }
    
    /**
     * Broadcast notification to all connected users (for system-wide notifications)
     */
    broadcastNotification(notification) {
        this.io.emit('system_notification', notification);
        console.log('System notification broadcasted to all users');
    }
    
    /**
     * Check if user is online
     */
    isUserOnline(userEmail) {
        return this.connectedUsers.has(userEmail);
    }
    
    /**
     * Get connected users count
     */
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    
    /**
     * Get list of connected users
     */
    getConnectedUsers() {
        return Array.from(this.connectedUsers.keys());
    }
    
    /**
     * Send message to specific user
     */
    sendToUser(userEmail, event, data) {
        const userSocketId = this.connectedUsers.get(userEmail);
        
        if (userSocketId) {
            this.io.to(userSocketId).emit(event, data);
            return true;
        }
        return false;
    }
    
    /**
     * Disconnect user
     */
    disconnectUser(userEmail) {
        const userSocketId = this.connectedUsers.get(userEmail);
        
        if (userSocketId) {
            this.io.sockets.sockets.get(userSocketId)?.disconnect();
            this.connectedUsers.delete(userEmail);
            return true;
        }
        return false;
    }
}

// Store instance globally for use in other modules
let websocketService = null;

module.exports = {
    initialize: (server) => {
        websocketService = new WebSocketService(server);
        return websocketService;
    },
    
    getInstance: () => {
        return websocketService;
    }
};