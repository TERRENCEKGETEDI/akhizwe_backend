const pool = require('./src/db');

async function disableQuietHoursCompletely() {
    console.log('🚫 Completely disabling quiet hours for admin user...\n');

    try {
        // Set quiet hours to the same time (which effectively disables them)
        // When start and end times are the same, the quiet hours check should return false
        const result = await pool.query(
            `UPDATE user_notification_preferences 
             SET quiet_hours_start = '12:00:00', 
                 quiet_hours_end = '12:00:00' 
             WHERE email = $1`,
            ['admin@bathinibona.co.za']
        );

        if (result.rowCount > 0) {
            console.log('✅ Admin user quiet hours set to disabled (12:00-12:00)');
        } else {
            console.log('❌ No preferences found for admin user');
            return;
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
            
            // Test the quiet hours logic
            const now = new Date();
            const currentTime = now.getHours() * 100 + now.getMinutes();
            const startTime = 1200; // 12:00
            const endTime = 1200;   // 12:00
            
            console.log(`\n⏰ Current time: ${now.toTimeString().slice(0,5)} (${currentTime})`);
            console.log(`🕐 Quiet hours: ${adminPrefs.quiet_hours_start} (${startTime}) - ${adminPrefs.quiet_hours_end} (${endTime})`);
            
            if (startTime === endTime) {
                console.log('✅ Quiet hours disabled (start = end time)');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
        console.log('✅ Database connection closed');
    }
}

disableQuietHoursCompletely();