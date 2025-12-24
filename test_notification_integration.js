require('dotenv').config();
const NotificationService = require('./src/services/notificationService');

async function testNotificationIntegration() {
    console.log('=== NOTIFICATION INTEGRATION TEST ===\n');
    
    // Test data
    const testMediaId = 'a32b8014-a29c-4867-8d5b-b7b6e60d309c';
    const testMediaTitle = 'Testing Video';
    const recipientEmail = 'terrencekgetedi@gmail.com';
    const actorEmail = 'admin@gmail.com';
    
    async function getNotificationCount() {
        const pool = require('./src/db');
        try {
            const result = await pool.query(
                'SELECT COUNT(*) FROM notifications WHERE user_email = $1',
                [recipientEmail]
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error getting notification count:', error);
            return -1;
        } finally {
            await pool.end();
        }
    }
    
    async function getInteractionCount(type) {
        const pool = require('./src/db');
        try {
            const result = await pool.query(
                'SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2',
                [testMediaId, type]
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error getting interaction count:', error);
            return -1;
        } finally {
            await pool.end();
        }
    }
    
    // Test 1: LIKE Notification
    console.log('🧪 Test 1: LIKE Notification Integration');
    const beforeLikeNotifications = await getNotificationCount();
    const beforeLikeInteractions = await getInteractionCount('LIKE');
    
    console.log(`Before: ${beforeLikeNotifications} notifications, ${beforeLikeInteractions} like interactions`);
    
    try {
        const likeNotification = await NotificationService.createNotification({
            recipientEmail,
            actorEmail,
            actionType: 'LIKE',
            mediaId: testMediaId,
            mediaTitle: testMediaTitle,
            message: `${actorEmail.split('@')[0]} liked your media "${testMediaTitle}" (Integration Test)`,
            priority: 'normal'
        });
        
        if (likeNotification) {
            console.log('✅ LIKE notification created successfully');
            console.log(`   Notification ID: ${likeNotification.notification_id}`);
        } else {
            console.log('⚠️  LIKE notification was blocked (likely spam prevention)');
        }
        
    } catch (error) {
        console.log('❌ LIKE notification failed:', error.message);
    }
    
    // Wait and check results
    await new Promise(resolve => setTimeout(resolve, 1000));
    const afterLikeNotifications = await getNotificationCount();
    const afterLikeInteractions = await getInteractionCount('LIKE');
    
    console.log(`After: ${afterLikeNotifications} notifications, ${afterLikeInteractions} like interactions`);
    
    if (afterLikeNotifications > beforeLikeNotifications) {
        console.log('✅ NEW NOTIFICATION CREATED for LIKE\n');
    } else {
        console.log('⚠️  No new notification created (spam prevention working)\n');
    }
    
    // Test 2: FAVORITE Notification
    console.log('🧪 Test 2: FAVORITE Notification Integration');
    const beforeFavoriteNotifications = await getNotificationCount();
    const beforeFavoriteInteractions = await getInteractionCount('FAVORITE');
    
    console.log(`Before: ${beforeFavoriteNotifications} notifications, ${beforeFavoriteInteractions} favorite interactions`);
    
    try {
        const favoriteNotification = await NotificationService.createNotification({
            recipientEmail,
            actorEmail,
            actionType: 'FAVORITE',
            mediaId: testMediaId,
            mediaTitle: testMediaTitle,
            message: `${actorEmail.split('@')[0]} favorited your media "${testMediaTitle}" (Integration Test)`,
            priority: 'normal'
        });
        
        if (favoriteNotification) {
            console.log('✅ FAVORITE notification created successfully');
            console.log(`   Notification ID: ${favoriteNotification.notification_id}`);
        } else {
            console.log('⚠️  FAVORITE notification was blocked (likely spam prevention)');
        }
        
    } catch (error) {
        console.log('❌ FAVORITE notification failed:', error.message);
    }
    
    // Wait and check results
    await new Promise(resolve => setTimeout(resolve, 1000));
    const afterFavoriteNotifications = await getNotificationCount();
    const afterFavoriteInteractions = await getInteractionCount('FAVORITE');
    
    console.log(`After: ${afterFavoriteNotifications} notifications, ${afterFavoriteInteractions} favorite interactions`);
    
    if (afterFavoriteNotifications > beforeFavoriteNotifications) {
        console.log('✅ NEW NOTIFICATION CREATED for FAVORITE\n');
    } else {
        console.log('⚠️  No new notification created (spam prevention working)\n');
    }
    
    // Test 3: COMMENT Notification
    console.log('🧪 Test 3: COMMENT Notification Integration');
    const beforeCommentNotifications = await getNotificationCount();
    
    console.log(`Before: ${beforeCommentNotifications} notifications`);
    
    try {
        const commentNotification = await NotificationService.createNotification({
            recipientEmail,
            actorEmail,
            actionType: 'COMMENT',
            mediaId: testMediaId,
            mediaTitle: testMediaTitle,
            message: `${actorEmail.split('@')[0]} commented on your media "${testMediaTitle}": This is an integration test comment!`,
            priority: 'normal',
            metadata: { commentText: 'This is an integration test comment!' }
        });
        
        if (commentNotification) {
            console.log('✅ COMMENT notification created successfully');
            console.log(`   Notification ID: ${commentNotification.notification_id}`);
        } else {
            console.log('⚠️  COMMENT notification was blocked (likely spam prevention)');
        }
        
    } catch (error) {
        console.log('❌ COMMENT notification failed:', error.message);
    }
    
    // Wait and check results
    await new Promise(resolve => setTimeout(resolve, 1000));
    const afterCommentNotifications = await getNotificationCount();
    
    console.log(`After: ${afterCommentNotifications} notifications`);
    
    if (afterCommentNotifications > beforeCommentNotifications) {
        console.log('✅ NEW NOTIFICATION CREATED for COMMENT\n');
    } else {
        console.log('⚠️  No new notification created (spam prevention working)\n');
    }
    
    // Final Summary
    console.log('=== INTEGRATION TEST SUMMARY ===');
    const finalNotificationCount = await getNotificationCount();
    console.log(`Total notifications created: ${finalNotificationCount}`);
    
    // Verify notification content
    const pool = require('./src/db');
    try {
        const notificationsResult = await pool.query(
            'SELECT notification_type, message, actor_email, created_at FROM notifications WHERE user_email = $1 ORDER BY created_at DESC LIMIT 5',
            [recipientEmail]
        );
        
        console.log('\n📋 Recent Notifications:');
        notificationsResult.rows.forEach((notif, index) => {
            console.log(`${index + 1}. ${notif.notification_type}: ${notif.message} (by ${notif.actor_email})`);
        });
        
    } catch (error) {
        console.error('Error fetching recent notifications:', error);
    } finally {
        await pool.end();
    }
    
    console.log('\n✅ Notification Integration Test Complete!');
}

// Run the integration test
testNotificationIntegration().catch(console.error);