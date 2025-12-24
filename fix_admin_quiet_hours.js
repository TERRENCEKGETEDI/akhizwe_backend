const pool = require('./src/db');

async function fixAdminQuietHours() {
    console.log('🔧 Fixing admin user quiet hours...\n');

    try {
        // Update admin user preferences to disable quiet hours
        const result = await pool.query(
            `UPDATE user_notification_preferences 
             SET quiet_hours_start = '00:00:00', 
                 quiet_hours_end = '23:59:59' 
             WHERE email = $1`,
            ['admin@bathinibona.co.za']
        );

        if (result.rowCount > 0) {
            console.log('✅ Admin user quiet hours disabled');
        } else {
            console.log('❌ No preferences found for admin user, creating defaults...');
            
            // Create default preferences for admin
            await pool.query(
                `INSERT INTO user_notification_preferences (
                    email, 
                    like_notifications, 
                    favorite_notifications, 
                    comment_notifications, 
                    reply_notifications, 
                    download_notifications, 
                    in_app_notifications, 
                    email_notifications, 
                    push_notifications, 
                    quiet_hours_start, 
                    quiet_hours_end
                ) VALUES ($1, true, true, true, true, true, true, true, true, '00:00:00', '23:59:59')
                ON CONFLICT (email) DO UPDATE SET
                    quiet_hours_start = '00:00:00',
                    quiet_hours_end = '23:59:59'`,
                ['admin@bathinibona.co.za']
            );
            console.log('✅ Admin user preferences created with quiet hours disabled');
        }

        // Verify the update
        const prefs = await pool.query(
            'SELECT * FROM user_notification_preferences WHERE email = $1',
            ['admin@bathinibona.co.za']
        );

        if (prefs.rows.length > 0) {
            const adminPrefs = prefs.rows[0];
            console.log('\n📋 Admin preferences:');
            console.log(`   - Quiet hours start: ${adminPrefs.quiet_hours_start}`);
            console.log(`   - Quiet hours end: ${adminPrefs.quiet_hours_end}`);
            console.log(`   - In-app notifications: ${adminPrefs.in_app_notifications}`);
            console.log(`   - Like notifications: ${adminPrefs.like_notifications}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

fixAdminQuietHours();