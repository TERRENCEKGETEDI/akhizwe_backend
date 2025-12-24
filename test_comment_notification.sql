-- Test comment notification
INSERT INTO notifications (
    notification_id, 
    user_email, 
    notification_type, 
    message, 
    related_media_id, 
    notification_channel, 
    priority, 
    actor_email, 
    action_type, 
    metadata, 
    created_at, 
    is_read
) VALUES (
    gen_random_uuid(),
    'terrencekgetedi@gmail.com',
    'COMMENT',
    'admin commented on your media Testing: This is a great video!',
    'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
    'in_app',
    'normal',
    'admin@gmail.com',
    'COMMENT',
    '{"mediaTitle": "Testing", "actorName": "admin", "commentText": "This is a great video!"}',
    NOW(),
    false
);