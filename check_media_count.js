require('dotenv').config();
const pool = require('./src/db');

async function checkMediaCount() {
    try {
        // Count total media items
        const countQuery = `
            SELECT 
                COUNT(*) as total_media,
                COUNT(CASE WHEN media_type = 'audio' THEN 1 END) as audio_count,
                COUNT(CASE WHEN media_type = 'video' THEN 1 END) as video_count,
                COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_count,
                COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_count
            FROM media
        `;
        
        const countResult = await pool.query(countQuery);
        const counts = countResult.rows[0];
        
        console.log('\n=== MEDIA COUNT REPORT ===');
        console.log(`Total Media Items: ${counts.total_media}`);
        console.log(`Audio Files: ${counts.audio_count}`);
        console.log(`Video Files: ${counts.video_count}`);
        console.log(`Approved: ${counts.approved_count}`);
        console.log(`Pending Approval: ${counts.pending_count}`);
        
        // Get some sample media details
        const sampleQuery = `
            SELECT media_id, title, media_type, is_approved, uploader_email, uploaded_at
            FROM media
            ORDER BY uploaded_at DESC
            LIMIT 10
        `;
        
        const sampleResult = await pool.query(sampleQuery);
        
        console.log('\n=== SAMPLE MEDIA (Latest 10) ===');
        sampleResult.rows.forEach((media, index) => {
            console.log(`${index + 1}. ${media.title} (${media.media_type}) - ${media.is_approved ? 'Approved' : 'Pending'} - by ${media.uploader_email}`);
        });
        
        return counts;
        
    } catch (error) {
        console.error('Error checking media count:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

checkMediaCount();