-- Complete Notification System Test Summary
-- This script demonstrates all notification types working correctly

-- 1. Show all media interactions (likes, favorites, comments)
SELECT '=== MEDIA INTERACTIONS ===' as section;
SELECT 
    interaction_type,
    user_email,
    created_at
FROM media_interactions 
ORDER BY created_at DESC;

-- 2. Show all comments
SELECT '=== COMMENTS ===' as section;
SELECT 
    user_email,
    comment,
    created_at
FROM media_comments
ORDER BY created_at DESC;

-- 3. Show all notifications by type
SELECT '=== NOTIFICATIONS BY TYPE ===' as section;
SELECT 
    notification_type,
    COUNT(*) as count,
    string_agg(message, ' | ' ORDER BY created_at) as messages
FROM notifications 
WHERE user_email = 'terrencekgetedi@gmail.com'
GROUP BY notification_type
ORDER BY notification_type;

-- 4. Show detailed notification log
SELECT '=== DETAILED NOTIFICATION LOG ===' as section;
SELECT 
    notification_type,
    message,
    actor_email,
    related_media_id,
    notification_channel,
    priority,
    created_at
FROM notifications 
WHERE user_email = 'terrencekgetedi@gmail.com'
ORDER BY created_at DESC;

-- 5. Summary statistics
SELECT '=== SUMMARY STATISTICS ===' as section;
SELECT 
    'Total Interactions' as metric,
    COUNT(*) as value
FROM media_interactions
UNION ALL
SELECT 
    'Total Comments' as metric,
    COUNT(*) as value
FROM media_comments
UNION ALL
SELECT 
    'Total Notifications' as metric,
    COUNT(*) as value
FROM notifications
WHERE user_email = 'terrencekgetedi@gmail.com'
UNION ALL
SELECT 
    'Like Notifications' as metric,
    COUNT(*) as value
FROM notifications
WHERE user_email = 'terrencekgetedi@gmail.com' AND notification_type = 'LIKE'
UNION ALL
SELECT 
    'Favorite Notifications' as metric,
    COUNT(*) as value
FROM notifications
WHERE user_email = 'terrencekgetedi@gmail.com' AND notification_type = 'FAVORITE'
UNION ALL
SELECT 
    'Comment Notifications' as metric,
    COUNT(*) as value
FROM notifications
WHERE user_email = 'terrencekgetedi@gmail.com' AND notification_type = 'COMMENT';