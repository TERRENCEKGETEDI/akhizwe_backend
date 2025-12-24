const NotificationService = require('./src/services/notificationService');
const pool = require('./src/db');

async function testBrowserNotifications() {
    console.log('🌐 Testing notifications for browser display...\n');

    try {
        // Get the admin user (who should be logged in)
        const adminUser = await pool.query('SELECT email, full_name FROM users WHERE email = $1', ['admin@bathinibona.co.za']);
        
        if (adminUser.rows.length === 0) {
            console.log('❌ Admin user not found');
            return;
        }

        const admin = adminUser.rows[0];
        console.log(`👤 Testing with admin user: ${admin.email} (${admin.full_name})`);

        // Get any media from database
        const media = await pool.query('SELECT media_id, title, uploader_email FROM media LIMIT 1');
        
        if (media.rows.length === 0) {
            console.log('❌ No media found for testing');
            return;
        }

        const testMedia = media.rows[0];
        console.log(`📱 Using media: ${testMedia.title} (ID: ${testMedia.media_id})`);

        // Create a notification for the admin user
        console.log('\n📤 Creating test notification for admin...');
        const testNotification = await NotificationService.createNotification({
            recipientEmail: admin.email,
            actorEmail: 'system@bathinibona.co.za',
            actionType: 'SYSTEM',
            mediaId: testMedia.media_id,
            mediaTitle: testMedia.title,
            message: `Test notification: System check - notifications are working!`,
            priority: 'high'
        });

        if (testNotification) {
            console.log('✅ Test notification created successfully!');
            console.log(`   - Notification ID: ${testNotification.notification_id}`);
            console.log(`   - Message: ${testNotification.message}`);
            console.log(`   - Created: ${testNotification.created_at}`);
            
            // Get notifications for admin to verify
            const adminNotifications = await NotificationService.getUserNotifications(admin.email, 1, 10);
            console.log(`✅ Admin now has ${adminNotifications.notifications.length} total notifications`);
            
            // Check unread count
            const unreadCount = await NotificationService.getUnreadCount(admin.email);
            console.log(`✅ Unread count: ${unreadCount}`);
            
            console.log('\n🎯 Browser Testing Instructions:');
            console.log('   1. Make sure you are logged in as admin@bathinibona.co.za');
            console.log('   2. Refresh your browser page');
            console.log('   3. Look for the bell icon (🔔) in the top-right corner');
            console.log('   4. Click the bell to see your notifications');
            console.log('   5. You should see the test notification: "Test notification: System check - notifications are working!"');
            
            console.log('\n💡 If you don\'t see notifications:');
            console.log('   - Check browser console (F12) for WebSocket connection errors');
            console.log('   - Ensure you are logged in as admin@bathinibona.co.za');
            console.log('   - Check if the notification bell icon appears in the UI');
            
            // Don't clean up this test notification so user can see it
            console.log('\n🔄 Test notification will remain in system for verification');
            
        } else {
            console.log('❌ Failed to create test notification');
        }

    } catch (error) {
        console.error('❌ Error during browser testing:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

// Run the test
testBrowserNotifications();