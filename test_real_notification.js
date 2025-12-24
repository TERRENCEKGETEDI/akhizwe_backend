const NotificationService = require('./src/services/notificationService');

async function testRealNotification() {
    console.log('Testing notification creation with real users...');

    try {
        // Test notification creation
        const notification = await NotificationService.createNotification({
            recipientEmail: 'user1@mail.com', // Media owner
            actorEmail: 'user2@mail.com',     // Liker
            actionType: 'LIKE',
            mediaId: 'ee226431-5c33-414f-9a47-47ff7f7569de',
            mediaTitle: 'Test Video 1',
            message: 'user2 liked your media "Test Video 1"',
            priority: 'normal'
        });

        console.log('Notification created:', notification);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

testRealNotification();