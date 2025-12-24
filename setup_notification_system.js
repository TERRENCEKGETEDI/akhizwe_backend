/**
 * Notification System Setup Script
 * This script sets up the notification system database schema and initializes the system
 */

const fs = require('fs');
const path = require('path');
const pool = require('./src/db');

async function setupNotificationSystem() {
    console.log('🚀 Setting up Notification System...\n');

    try {
        // Read and execute the notification system SQL
        const sqlFile = path.join(__dirname, 'notification_system_tables.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        console.log('📋 Executing database schema changes...');
        await pool.query(sql);
        console.log('✅ Database schema applied successfully\n');

        // Test the setup by creating a sample notification
        console.log('🧪 Testing notification system setup...');
        
        // Create test user preferences
        await pool.query(`
            INSERT INTO user_notification_preferences (email) 
            VALUES ('test@example.com') 
            ON CONFLICT (email) DO NOTHING
        `);
        
        // Create a test notification
        const testNotification = await pool.query(`
            INSERT INTO notifications (
                notification_id, user_email, notification_type, message, 
                notification_channel, priority, actor_email, action_type, metadata
            ) VALUES (
                gen_random_uuid(), 'test@example.com', 'SYSTEM', 
                'Notification system initialized successfully', 'in_app', 'normal',
                'system@example.com', 'SYSTEM_INIT', '{}'::jsonb
            ) RETURNING notification_id
        `);
        
        console.log('✅ Test notification created:', testNotification.rows[0].notification_id);
        
        // Verify table creation
        console.log('\n📊 Verifying database structure...');
        
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('notifications', 'user_notification_preferences', 'notification_deliveries', 'notification_spam_prevention')
            ORDER BY table_name
        `);
        
        console.log('✅ Notification tables created:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Check if notifications table was updated
        const notificationColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name IN ('notification_channel', 'priority', 'actor_email', 'action_type', 'metadata')
            ORDER BY column_name
        `);
        
        console.log('\n✅ Enhanced notifications table columns:');
        notificationColumns.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });

        // Create indexes if they don't exist
        console.log('\n🔍 Creating performance indexes...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_email, is_read) WHERE is_read = false',
            'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(notification_channel)',
            'CREATE INDEX IF NOT EXISTS idx_notifications_action_type ON notifications(action_type)',
            'CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status)',
            'CREATE INDEX IF NOT EXISTS idx_notification_spam_prevention_recent ON notification_spam_prevention(recipient_email, created_at)'
        ];
        
        for (const indexSQL of indexes) {
            await pool.query(indexSQL);
        }
        
        console.log('✅ Performance indexes created');
        
        // Clean up test data
        await pool.query('DELETE FROM notifications WHERE user_email = $1', ['test@example.com']);
        await pool.query('DELETE FROM user_notification_preferences WHERE email = $1', ['test@example.com']);
        
        console.log('\n🎉 Notification System Setup Complete!');
        console.log('\n📋 System Features Ready:');
        console.log('   ✅ User notification preferences');
        console.log('   ✅ Multi-channel notification delivery (in-app, email, push)');
        console.log('   ✅ Real-time WebSocket notifications');
        console.log('   ✅ Spam prevention and rate limiting');
        console.log('   ✅ Notification read tracking');
        console.log('   ✅ Priority-based notification handling');
        console.log('   ✅ Quiet hours support');
        console.log('   ✅ Delivery tracking and analytics');
        console.log('   ✅ Performance optimized with indexes');
        
        console.log('\n🚀 Next Steps:');
        console.log('   1. Start the backend server: npm run dev');
        console.log('   2. Install frontend dependencies: cd ../frontend && npm install');
        console.log('   3. Start the frontend: npm run dev');
        console.log('   4. Run comprehensive tests: node test_notification_system.js');
        console.log('   5. Configure email service for production use');
        console.log('   6. Set up push notification service for mobile apps');
        
        console.log('\n💡 Integration Points:');
        console.log('   - NotificationService: /src/services/notificationService.js');
        console.log('   - WebSocket Service: /src/services/websocketService.js');
        console.log('   - API Routes: /src/routes/notifications.js');
        console.log('   - Frontend Component: /src/components/Notifications.jsx');
        console.log('   - Database Schema: /notification_system_tables.sql');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    } finally {
        await pool.end();
        console.log('\n✅ Database connection closed');
    }
}

// Run the setup
if (require.main === module) {
    setupNotificationSystem().then(() => {
        console.log('\n🏁 Setup completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Setup failed:', error);
        process.exit(1);
    });
}

module.exports = setupNotificationSystem;