const NotificationService = require('./src/services/notificationService');
const pool = require('./src/db');

async function testRealUserNotifications() {
    console.log('🧪 Testing notifications with real users...\n');

    try {
        // Get users from database
        const users = await pool.query('SELECT email, full_name FROM users ORDER BY email');
        
        if (users.rows.length < 2) {
            console.log('❌ Need at least 2 users for testing');
            return;
        }

        // Use first two users for testing
        const user1 = users.rows[0];
        const user2 = users.rows[1];
        
        console.log(`👤 User 1: ${user1.email} (${user1.full_name})`);
        console.log(`👤 User 2: ${user2.email} (${user2.full_name})`);

        // Get any media from database
        const media = await pool.query('SELECT media_id, title, uploader_email FROM media LIMIT 1');
        
        if (media.rows.length === 0) {
            console.log('❌ No media found for testing');
            return;
        }

        const testMedia = media.rows[0];
        console.log(`📱 Using media: ${testMedia.title} (ID: ${testMedia.media_id})`);
        console.log(`📤 Media uploaded by: ${testMedia.uploader_email}`);

        // Create notification where user2 likes user1's media
        console.log('\n📤 Creating test notification...');
        console.log(`   - ${user2.full_name} will like ${user1.full_name}'s media`);
        
        const testNotification = await NotificationService.createNotification({
            recipientEmail: testMedia.uploader_email, // Media owner gets notified
            actorEmail: user2.email, // User who performed action
            actionType: 'LIKE',
            mediaId: testMedia.media_id,
            mediaTitle: testMedia.title,
            message: `${user2.full_name} liked your media "${testMedia.title}"`,
            priority: 'high'
        });

        if (testNotification) {
            console.log('✅ Test notification created successfully!');
            console.log(`   - Notification ID: ${testNotification.notification_id}`);
            console.log(`   - Message: ${testNotification.message}`);
            console.log(`   - Recipient: ${testNotification.user_email}`);
            console.log(`   - Actor: ${testNotification.actor_email}`);
            console.log(`   - Created: ${testNotification.created_at}`);
            
            // Get notifications for the recipient
            const recipientNotifications = await NotificationService.getUserNotifications(testMedia.uploader_email, 1, 10);
            console.log(`\n✅ ${testMedia.uploader_email} now has ${recipientNotifications.notifications.length} notifications`);
            
            // Check unread count
            const unreadCount = await NotificationService.getUnreadCount(testMedia.uploader_email);
            console.log(`✅ Unread count: ${unreadCount}`);
            
            console.log('\n🎯 Browser Testing Instructions:');
            console.log('   1. Make sure you are logged in as:', testMedia.uploader_email);
            console.log('   2. Refresh your browser page');
            console.log('   3. Look for the bell icon (🔔) in the top-right corner');
            console.log('   4. Click the bell to see your notifications');
            console.log('   5. You should see the test notification in the list');
            
            console.log('\n💡 If you don\'t see notifications:');
            console.log('   - Check browser console (F12) for WebSocket connection errors');
            console.log('   - Ensure you are logged in as the correct user');
            console.log('   - Check if the notification bell icon appears in the UI');
            
            // Don't clean up this test notification so user can see it
            console.log('\n🔄 Test notification will remain in system for verification');
            
        } else {
            console.log('❌ Failed to create test notification');
        }

    } catch (error) {
        console.error('❌ Error during testing:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

// Run the test
testRealUserNotifications();