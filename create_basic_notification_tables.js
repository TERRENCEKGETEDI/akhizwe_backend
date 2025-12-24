/**
 * Basic Notification System Setup
 * Creates just the essential notification tables without complex features
 */

const pool = require('./src/db');

async function setupBasicNotificationSystem() {
    console.log('🔧 Setting up Basic Notification System...\n');

    try {
        // Create user notification preferences table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_notification_preferences (
                email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
                email_notifications BOOLEAN DEFAULT true,
                push_notifications BOOLEAN DEFAULT true,
                in_app_notifications BOOLEAN DEFAULT true,
                like_notifications BOOLEAN DEFAULT true,
                favorite_notifications BOOLEAN DEFAULT true,
                comment_notifications BOOLEAN DEFAULT true,
                reply_notifications BOOLEAN DEFAULT true,
                download_notifications BOOLEAN DEFAULT true,
                frequency_digest BOOLEAN DEFAULT false,
                quiet_hours_start TIME DEFAULT '22:00:00',
                quiet_hours_end TIME DEFAULT '08:00:00',
                min_interval_minutes INTEGER DEFAULT 5,
                max_daily_notifications INTEGER DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ user_notification_preferences table created');

        // Add columns to existing notifications table
        const columnsToAdd = [
            'notification_channel VARCHAR(20) DEFAULT \'in_app\' CHECK (notification_channel IN (\'email\', \'push\', \'in_app\'))',
            'priority VARCHAR(10) DEFAULT \'normal\' CHECK (priority IN (\'low\', \'normal\', \'high\', \'urgent\'))',
            'actor_email VARCHAR(255) REFERENCES users(email)',
            'action_type VARCHAR(50)',
            'metadata JSONB',
            'expires_at TIMESTAMP',
            'read_at TIMESTAMP',
            'read_channels JSONB'
        ];

        for (const column of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ${column}`);
                console.log(`✅ Added column: ${column.split(' ')[0]}`);
            } catch (error) {
                console.log(`⚠️ Column already exists or error: ${column.split(' ')[0]}`);
            }
        }

        // Create notification delivery tracking table
        await pool.query(`
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
            )
        `);
        console.log('✅ notification_deliveries table created');

        // Create notification spam prevention table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notification_spam_prevention (
                id SERIAL PRIMARY KEY,
                recipient_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
                actor_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE,
                action_type VARCHAR(50) NOT NULL,
                related_media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ notification_spam_prevention table created');

        // Create basic indexes
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_email, is_read) WHERE is_read = false');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(notification_channel)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_action_type ON notifications(action_type)');
        console.log('✅ Basic indexes created');

        // Test the setup
        console.log('\n🧪 Testing notification system setup...');
        
        await pool.query(`
            INSERT INTO user_notification_preferences (email) 
            VALUES ('test@example.com') 
            ON CONFLICT (email) DO NOTHING
        `);
        
        console.log('✅ Test data inserted');
        
        // Clean up test data
        await pool.query('DELETE FROM user_notification_preferences WHERE email = $1', ['test@example.com']);
        
        console.log('\n🎉 Basic Notification System Setup Complete!');
        console.log('\n📋 Tables Created:');
        console.log('   ✅ user_notification_preferences');
        console.log('   ✅ notification_deliveries');
        console.log('   ✅ notification_spam_prevention');
        console.log('   ✅ Enhanced notifications table with new columns');
        
        return true;
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        throw error;
    }
}

// Run the setup
if (require.main === module) {
    setupBasicNotificationSystem().then(() => {
        console.log('\n🏁 Setup completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Setup failed:', error);
        process.exit(1);
    });
}

module.exports = setupBasicNotificationSystem;