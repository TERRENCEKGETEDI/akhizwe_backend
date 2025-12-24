-- Test notification insertion
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
    'LIKE',
    'admin liked your media Testing',
    'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
    'in_app',
    'normal',
    'admin@gmail.com',
    'LIKE',
    '{"mediaTitle": "Testing", "actorName": "admin"}',
    NOW(),
    false
);