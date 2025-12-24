require('dotenv').config();
const pool = require('./src/db');

async function checkAfterLike() {
    try {
        console.log('\n=== CHECKING DATABASE AFTER LIKE ===');
        
        // Check media interactions
        const interactionsQuery = `
            SELECT 
                mi.*,
                m.title as media_title,
                m.uploader_email
            FROM media_interactions mi
            JOIN media m ON mi.media_id = m.media_id
            ORDER BY mi.created_at DESC
        `;
        
        const interactionsResult = await pool.query(interactionsQuery);
        
        console.log(`\n📊 MEDIA INTERACTIONS: ${interactionsResult.rows.length} records`);
        if (interactionsResult.rows.length > 0) {
            interactionsResult.rows.forEach((interaction, index) => {
                console.log(`${index + 1}. ${interaction.interaction_type} - ${interaction.media_title} by ${interaction.user_email} (uploader: ${interaction.uploader_email})`);
            });
        } else {
            console.log('❌ No interactions found');
        }
        
        // Check notifications
        const notificationsQuery = `
            SELECT 
                n.*,
                m.title as media_title
            FROM notifications n
            LEFT JOIN media m ON n.related_media_id = m.media_id
            ORDER BY n.created_at DESC
        `;
        
        const notificationsResult = await pool.query(notificationsQuery);
        
        console.log(`\n🔔 NOTIFICATIONS: ${notificationsResult.rows.length} records`);
        if (notificationsResult.rows.length > 0) {
            notificationsResult.rows.forEach((notification, index) => {
                console.log(`${index + 1}. ${notification.notification_type} - ${notification.message} (for: ${notification.user_email})`);
            });
        } else {
            console.log('❌ No notifications found');
        }
        
        // Check media view counts
        const mediaQuery = `
            SELECT 
                media_id,
                title,
                view_count,
                download_count,
                updated_at
            FROM media
            ORDER BY updated_at DESC
        `;
        
        const mediaResult = await pool.query(mediaQuery);
        
        console.log(`\n📹 MEDIA STATUS:`);
        mediaResult.rows.forEach((media) => {
            console.log(`- ${media.title}: ${media.view_count} views, ${media.download_count} downloads`);
        });
        
        return {
            interactions: interactionsResult.rows,
            notifications: notificationsResult.rows,
            media: mediaResult.rows
        };
        
    } catch (error) {
        console.error('Error checking database after like:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Export for testing
module.exports = { checkAfterLike };

// Run if called directly
if (require.main === module) {
    checkAfterLike();
}