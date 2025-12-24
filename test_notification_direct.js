require('dotenv').config();
const NotificationService = require('./src/services/notificationService');

async function testNotificationDirectly() {
    try {
        console.log('=== TESTING NOTIFICATION DIRECTLY ===');
        
        // Test notification parameters
        const notificationParams = {
            recipientEmail: 'terrencekgetedi@gmail.com',
            actorEmail: 'admin@gmail.com',
            actionType: 'LIKE',
            mediaId: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
            mediaTitle: 'Testing',
            message: 'admin liked your media "Testing"',
            priority: 'normal'
        };
        
        console.log('Sending notification with params:', notificationParams);
        
        const result = await NotificationService.createNotification(notificationParams);
        
        if (result) {
            console.log('✅ Notification created successfully!');
            console.log('Notification ID:', result.notification_id);
        } else {
            console.log('❌ Notification was not created (likely due to quiet hours or other restrictions)');
        }
        
    } catch (error) {
        console.error('❌ Error testing notification:', error);
    }
}

// Run the test
testNotificationDirectly();