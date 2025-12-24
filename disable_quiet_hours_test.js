require('dotenv').config();
const pool = require('./src/db');

async function disableQuietHoursForTesting() {
    try {
        console.log('=== DISABLING QUIET HOURS FOR TESTING ===');
        
        // Disable quiet hours for both users to test notifications
        const users = ['terrencekgetedi@gmail.com', 'admin@gmail.com'];
        
        for (const email of users) {
            await pool.query(
                `UPDATE user_notification_preferences 
                 SET quiet_hours_start = '00:00:00', quiet_hours_end = '00:00:00', updated_at = CURRENT_TIMESTAMP
                 WHERE email = $1`,
                [email]
            );
            console.log(`✅ Quiet hours disabled for ${email}`);
        }
        
        console.log('✅ Quiet hours disabled for testing');
        
    } catch (error) {
        console.error('❌ Error disabling quiet hours:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
disableQuietHoursForTesting();