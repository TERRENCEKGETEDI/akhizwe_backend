-- Notification System Database Schema
-- This file contains the enhanced notification tables and user preferences

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    in_app_notifications BOOLEAN DEFAULT true,
    
    -- Media interaction notifications
    like_notifications BOOLEAN DEFAULT true,
    favorite_notifications BOOLEAN DEFAULT true,
    comment_notifications BOOLEAN DEFAULT true,
    reply_notifications BOOLEAN DEFAULT true,
    download_notifications BOOLEAN DEFAULT true,
    
    -- Notification frequency settings
    frequency_digest BOOLEAN DEFAULT false, -- Daily/weekly digest instead of immediate
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    
    -- Spam prevention settings
    min_interval_minutes INTEGER DEFAULT 5, -- Minimum time between similar notifications
    max_daily_notifications INTEGER DEFAULT 100,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced notifications table (extends existing notifications table)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(20) DEFAULT 'in_app' CHECK (notification_channel IN ('email', 'push', 'in_app'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255) REFERENCES users(email); -- Who performed the action
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) NOT NULL; -- LIKE, FAVORITE, COMMENT, REPLY, DOWNLOAD
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB; -- Additional data (content title, etc.)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP; -- When notification should expire

-- Notification delivery tracking
CREATE TABLE IF NOT EXISTS notification_deliveries (
    delivery_id VARCHAR(50) PRIMARY KEY,
    notification_id VARCHAR(50) REFERENCES notifications(notification_id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'in_app')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification read tracking with more detail
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_channels JSONB; -- Which channels the user has read the notification from

-- Notification spam prevention - track recent similar notifications
CREATE TABLE IF NOT EXISTS notification_spam_prevention (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
    actor_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    related_media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent spam: max 1 notification per actor per action type per media per hour
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_email, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(notification_channel);
CREATE INDEX IF NOT EXISTS idx_notifications_action_type ON notifications(action_type);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_spam_prevention_recent ON notification_spam_prevention(recipient_email, created_at);

-- Unique constraint: max 1 notification per actor per action type per media per hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_spam_prevention_unique_hourly 
ON notification_spam_prevention (recipient_email, actor_email, action_type, related_media_id, DATE_TRUNC('hour', created_at));

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_notification_preferences
DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER update_user_notification_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();