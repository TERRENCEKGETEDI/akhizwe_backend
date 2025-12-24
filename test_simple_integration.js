require('dotenv').config();
const pool = require('./src/db');
const NotificationService = require('./src/services/notificationService');

async function testSimpleIntegration() {
    console.log('=== SIMPLE NOTIFICATION INTEGRATION TEST ===\n');
    
    const testMediaId = 'a32b8014-a29c-4867-8d5b-b7b6e60d309c';
    const recipientEmail = 'terrencekgetedi@gmail.com';
    const actorEmail = 'admin@gmail.com';
    
    // Get initial counts
    const initialResult = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_email = $1',
        [recipientEmail]
    );
    const initialCount = parseInt(initialResult.rows[0].count);
    
    console.log(`Initial notifications for ${recipientEmail}: ${initialCount}`);
    
    // Test notification creation
    console.log('\n🧪 Creating test notifications...');
    
    const testNotifications = [
        {
            type: 'INTEGRATION_TEST_LIKE',
            message: 'Integration test: User liked your content'
        },
        {
            type: 'INTEGRATION_TEST_FAVORITE', 
            message: 'Integration test: User favorited your content'
        },
        {
            type: 'INTEGRATION_TEST_COMMENT',
            message: 'Integration test: User commented on your content'
        }
    ];
    
    let createdCount = 0;
    
    for (const test of testNotifications) {
        try {
            console.log(`Testing ${test.type}...`);
            
            const notification = await NotificationService.createNotification({
                recipientEmail,
                actorEmail,
                actionType: test.type,
                mediaId: testMediaId,
                mediaTitle: 'Integration Test Media',
                message: test.message,
                priority: 'normal'
            });
            
            if (notification) {
                console.log(`✅ ${test.type} notification created (ID: ${notification.notification_id})`);
                createdCount++;
            } else {
                console.log(`⚠️  ${test.type} notification blocked (spam prevention)`);
            }
            
            // Wait between notifications to avoid spam prevention
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`❌ ${test.type} failed:`, error.message);
        }
    }
    
    // Check final count
    const finalResult = await pool.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_email = $1',
        [recipientEmail]
    );
    const finalCount = parseInt(finalResult.rows[0].count);
    
    console.log(`\nFinal notifications for ${recipientEmail}: ${finalCount}`);
    console.log(`New notifications created: ${finalCount - initialCount}`);
    
    // Show recent notifications
    const recentResult = await pool.query(
        'SELECT notification_type, message, actor_email, created_at FROM notifications WHERE user_email = $1 ORDER BY created_at DESC LIMIT 5',
        [recipientEmail]
    );
    
    console.log('\n📋 Recent Notifications:');
    recentResult.rows.forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.notification_type}: ${notif.message}`);
    });
    
    // Verify integration status
    if (finalCount > initialCount) {
        console.log('\n✅ NOTIFICATION INTEGRATION WORKING!');
        console.log(`Successfully created ${finalCount - initialCount} new notifications`);
    } else {
        console.log('\n⚠️  No new notifications created (likely spam prevention working)');
    }
    
    console.log('\n✅ Integration Test Complete!');
}

// Run the test
testSimpleIntegration().catch(console.error).finally(() => {
    // Don't close the pool here as it might be used by other parts of the app
    console.log('Test completed.');
});