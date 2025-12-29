const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTestMedia() {
  const client = await pool.connect();
  
  try {
    console.log('Creating test media for approval system...');
    
    // Create 3 unapproved media items for testing
    const testMedia = [
      {
        media_id: 'test-pending-1',
        uploader_email: 'test@akhizwe.technologies',
        media_type: 'video',
        title: 'Pending Video Test 1',
        file_url: 'test_video_1.mp4',
        file_path: 'test_video_1.mp4',
        file_size: 1024000,
        is_approved: false,
        uploaded_at: new Date(),
        copyright_declared: true,
        monetization_enabled: false,
        description: 'Test video pending approval',
        artist: 'Test Artist',
        category: 'test',
        creator_name: 'Test Artist',
        release_date: new Date(),
        view_count: 0,
        download_count: 0
      },
      {
        media_id: 'test-pending-2',
        uploader_email: 'test@akhizwe.technologies',
        media_type: 'audio',
        title: 'Pending Audio Test 2',
        file_url: 'test_audio_2.mp3',
        file_path: 'test_audio_2.mp3',
        file_size: 2048000,
        is_approved: false,
        uploaded_at: new Date(),
        copyright_declared: true,
        monetization_enabled: false,
        description: 'Test audio pending approval',
        artist: 'Test Artist',
        category: 'test',
        creator_name: 'Test Artist',
        release_date: new Date(),
        view_count: 0,
        download_count: 0
      },
      {
        media_id: 'test-pending-3',
        uploader_email: 'test@akhizwe.technologies',
        media_type: 'image',
        title: 'Pending Image Test 3',
        file_url: 'test_image_3.jpg',
        file_path: 'test_image_3.jpg',
        file_size: 512000,
        is_approved: false,
        uploaded_at: new Date(),
        copyright_declared: true,
        monetization_enabled: false,
        description: 'Test image pending approval',
        artist: 'Test Artist',
        category: 'test',
        creator_name: 'Test Artist',
        release_date: new Date(),
        view_count: 0,
        download_count: 0
      }
    ];

    for (const media of testMedia) {
      const query = `
        INSERT INTO media (
          media_id, uploader_email, media_type, title, file_url, file_path, file_size,
          is_approved, uploaded_at, copyright_declared, monetization_enabled,
          description, artist, category, creator_name, release_date, view_count, download_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (media_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          is_approved = EXCLUDED.is_approved
      `;
      
      const values = [
        media.media_id, media.uploader_email, media.media_type, media.title,
        media.file_url, media.file_path, media.file_size, media.is_approved,
        media.uploaded_at, media.copyright_declared, media.monetization_enabled,
        media.description, media.artist, media.category, media.creator_name,
        media.release_date, media.view_count, media.download_count
      ];
      
      await client.query(query, values);
      console.log(`Created test media: ${media.title}`);
    }
    
    console.log('✅ Test media created successfully!');
    
    // Verify creation
    const result = await client.query(
      'SELECT COUNT(*) as count FROM media WHERE is_approved = false'
    );
    console.log(`📊 Total unapproved media: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error creating test media:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestMedia();