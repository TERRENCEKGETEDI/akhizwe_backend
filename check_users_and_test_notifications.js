const pool = require('./src/db');

async function checkUsersAndTestNotifications() {
    console.log('🔍 Checking existing users and testing notifications...\n');

    try {
        // Check existing users
        const users = await pool.query('SELECT email, full_name FROM users ORDER BY email');
        console.log('📋 Existing users in database:');
        users.rows.forEach(user => {
            console.log(`   - ${user.email} (${user.full_name})`);
        });

        if (users.rows.length === 0) {
            console.log('❌ No users found in database. Cannot test notifications.');
            return;
        }

        console.log(`\n✅ Found ${users.rows.length} users\n`);

        // Test notification system with real users
        const NotificationService = require('./src/services/notificationService');
        
        const testUser = users.rows[0]; // Use first user
        const testUser2 = users.rows.length > 1 ? users.rows[1] : testUser; // Use second user if available

        console.log('🧪 Testing Notification System...');
        console.log('=================================');

        // Test 1: Get user preferences
        console.log('\n1️⃣ Testing user preferences...');
        const preferences = await NotificationService.getUserPreferences(testUser.email);
        console.log('✅ Preferences retrieved:', Object.keys(preferences).length, 'settings');

        // Test 2: Create a test notification
        console.log('\n2️⃣ Creating test notification...');
        const testNotification = await NotificationService.createNotification({
            recipientEmail: testUser.email,
            actorEmail: testUser2.email,
            actionType: 'LIKE',
            mediaId: 'test-media-123',
            mediaTitle: 'Test Media Content',
            message: `${testUser2.full_name} liked your media "Test Media Content"`,
            priority: 'normal'
        });

        if (testNotification) {
            console.log('✅ Notification created successfully:', testNotification.notification_id);
            
            // Test 3: Get notifications for user
            console.log('\n3️⃣ Getting user notifications...');
            const userNotifications = await NotificationService.getUserNotifications(testUser.email, 1, 10);
            console.log('✅ Retrieved', userNotifications.notifications.length, 'notifications');
            
            // Test 4: Get unread count
            console.log('\n4️⃣ Getting unread count...');
            const unreadCount = await NotificationService.getUnreadCount(testUser.email);
            console.log('✅ Unread count:', unreadCount);

            // Test 5: Mark notification as read
            if (userNotifications.notifications.length > 0) {
                console.log('\n5️⃣ Marking notification as read...');
                await NotificationService.markAsRead(testNotification.notification_id, testUser.email);
                const newUnreadCount = await NotificationService.getUnreadCount(testUser.email);
                console.log('✅ Updated unread count:', newUnreadCount);
            }

            // Cleanup: Delete test notification
            console.log('\n🧹 Cleaning up test data...');
            await pool.query('DELETE FROM notifications WHERE notification_id = $1', [testNotification.notification_id]);
            console.log('✅ Test notification deleted');
        } else {
            console.log('❌ Failed to create notification');
        }

        console.log('\n🎉 Notification system test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

// Run the test
checkUsersAndTestNotifications();