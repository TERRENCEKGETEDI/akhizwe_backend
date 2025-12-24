require('dotenv').config();
const NotificationService = require('./src/services/notificationService');

async function testAllNotificationTypes() {
    try {
        console.log('=== TESTING ALL NOTIFICATION TYPES ===\n');

        const testNotifications = [
            {
                type: 'LIKE',
                recipientEmail: 'terrencekgetedi@gmail.com',
                actorEmail: 'admin@gmail.com',
                mediaId: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
                mediaTitle: 'Testing Video',
                message: 'admin liked your media "Testing Video"'
            },
            {
                type: 'FAVORITE',
                recipientEmail: 'terrencekgetedi@gmail.com',
                actorEmail: 'admin@gmail.com',
                mediaId: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
                mediaTitle: 'Testing Video',
                message: 'admin favorited your media "Testing Video"'
            },
            {
                type: 'COMMENT',
                recipientEmail: 'terrencekgetedi@gmail.com',
                actorEmail: 'admin@gmail.com',
                mediaId: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
                mediaTitle: 'Testing Video',
                message: 'admin commented on your media "Testing Video": Amazing work!'
            }
        ];

        for (const test of testNotifications) {
            console.log(`Testing ${test.type} notification...`);
            
            const result = await NotificationService.createNotification({
                recipientEmail: test.recipientEmail,
                actorEmail: test.actorEmail,
                actionType: test.type,
                mediaId: test.mediaId,
                mediaTitle: test.mediaTitle,
                message: test.message,
                priority: 'normal'
            });

            if (result) {
                console.log(`✅ ${test.type} notification created successfully!`);
                console.log(`   Notification ID: ${result.notification_id}`);
                console.log(`   Message: ${result.message}\n`);
            } else {
                console.log(`❌ ${test.type} notification failed to create\n`);
            }
        }

        console.log('=== ALL NOTIFICATION TESTS COMPLETED ===');

    } catch (error) {
        console.error('❌ Error during notification testing:', error);
    }
}

// Run the comprehensive test
testAllNotificationTypes();