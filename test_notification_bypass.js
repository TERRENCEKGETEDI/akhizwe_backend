require('dotenv').config();
const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function testNotificationBypassQuietHours() {
    try {
        console.log('=== TESTING NOTIFICATION WITH QUIET HOURS BYPASS ===');
        
        // Bypass quiet hours check by modifying the isQuietHours method temporarily
        const originalIsQuietHours = NotificationService.isQuietHours;
        NotificationService.isQuietHours = function() { return false; };
        
        const notificationParams = {
            recipientEmail: 'terrencekgetedi@gmail.com',
            actorEmail: 'admin@gmail.com',
            actionType: 'LIKE',
            mediaId: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
            mediaTitle: 'Testing',
            message: 'admin liked your media "Testing" (bypass test)',
            priority: 'normal'
        };
        
        console.log('Sending notification with bypassed quiet hours...');
        
        const result = await NotificationService.createNotification(notificationParams);
        
        if (result) {
            console.log('✅ Notification created successfully!');
            console.log('Notification ID:', result.notification_id);
        } else {
            console.log('❌ Notification was not created');
        }
        
        // Restore original method
        NotificationService.isQuietHours = originalIsQuietHours;
        
    } catch (error) {
        console.error('❌ Error testing notification:', error);
    }
}

// Import NotificationService after defining the bypass
const NotificationService = require('./src/services/notificationService');

// Run the test
testNotificationBypassQuietHours();