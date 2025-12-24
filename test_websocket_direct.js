const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./src/db');

async function testWebSocketDirect() {
    console.log('🔍 Testing WebSocket connection directly...\n');

    try {
        // Create a test user token
        const testUser = await pool.query('SELECT email FROM users WHERE email = $1', ['user1@mail.com']);
        if (testUser.rows.length === 0) {
            console.log('❌ Test user not found');
            return;
        }

        const userEmail = testUser.rows[0].email;
        console.log(`👤 Using test user: ${userEmail}`);

        // Create a test JWT token (using the same secret as the server)
        const token = jwt.sign({ email: userEmail }, 'your_super_secret_jwt_key_here', { expiresIn: '1h' });
        console.log(`🔑 Generated test token for ${userEmail}`);

        // Create Socket.IO client connection
        const io = require('socket.io-client');
        const socket = io('http://localhost:5000', {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('✅ WebSocket connected successfully');
            console.log(`   Socket ID: ${socket.id}`);
            
            // Request notifications
            socket.emit('get_notifications');
        });

        socket.on('connect_error', (error) => {
            console.log('❌ WebSocket connection error:', error.message);
        });

        socket.on('new_notification', (notification) => {
            console.log('📨 Received NEW notification:', notification.message);
            console.log('   Notification ID:', notification.notification_id);
        });

        socket.on('notifications_list', (data) => {
            console.log('📋 Received notifications list:');
            console.log(`   Total notifications: ${data.pagination.total}`);
            console.log(`   This page: ${data.notifications.length}`);
            
            if (data.notifications.length > 0) {
                console.log('   Latest notification:');
                const latest = data.notifications[0];
                console.log(`     - ${latest.message}`);
                console.log(`     - Created: ${latest.created_at}`);
                console.log(`     - Read: ${latest.is_read}`);
            }
        });

        socket.on('unread_count', (data) => {
            console.log(`🔢 Unread count: ${data.count}`);
        });

        socket.on('error', (error) => {
            console.log('❌ Socket error:', error);
        });

        // Keep connection alive and then close
        setTimeout(() => {
            console.log('\n🔚 Closing test connection...');
            socket.close();
            process.exit(0);
        }, 10000);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testWebSocketDirect();