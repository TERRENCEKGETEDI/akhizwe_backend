// Simple script to populate database with test media data
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const { v4: uuidv4 } = require('uuid');

async function createTestMedia() {
  console.log('Creating test media data...\n');

  try {
    // First, let's check if we have any users to associate media with
    const usersResult = await pool.query('SELECT email FROM users LIMIT 2');
    console.log(`Found ${usersResult.rows.length} users in database`);
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No users found. Please create users first.');
      return;
    }

    const user1 = usersResult.rows[0].email;
    const user2 = usersResult.rows.length > 1 ? usersResult.rows[1].email : user1;

    console.log(`Using users: ${user1} and ${user2}\n`);

    // Create test videos
    const videoFiles = [
      {
        title: 'Amapiano Dance Video',
        description: 'Amazing amapiano dance performance',
        artist: 'Dance Artist',
        category: 'Dance'
      },
      {
        title: 'Summer Vibes Music Video',
        description: 'Fun summer music video with great beats',
        artist: 'Summer Artist',
        category: 'Music'
      }
    ];

    // Create test music
    const musicFiles = [
      {
        title: 'Amapiano Mix 2024',
        description: 'Latest amapiano tracks compilation',
        artist: 'Amapiano Master',
        category: 'Amapiano'
      },
      {
        title: 'Bafana Ba Moyah',
        description: 'Traditional South African music',
        artist: 'Traditional Artist',
        category: 'Traditional'
      }
    ];

    let createdCount = 0;

    // Create videos
    for (let i = 0; i < videoFiles.length; i++) {
      const media_id = uuidv4();
      const file = videoFiles[i];
      
      try {
        await pool.query(
          `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, artist, category, is_approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            media_id,
            file.title,
            file.description,
            'video', // Use lowercase 'video'
            user1,
            'uploads/dance1.mp4',
            1024000 + (i * 100000),
            file.artist,
            file.category,
            true // Mark as approved
          ]
        );
        console.log(`✅ Created video: "${file.title}" by ${file.artist}`);
        createdCount++;
      } catch (error) {
        console.log(`❌ Error creating video "${file.title}": ${error.message}`);
      }
    }

    // Create music
    for (let i = 0; i < musicFiles.length; i++) {
      const media_id = uuidv4();
      const file = musicFiles[i];
      
      try {
        await pool.query(
          `INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_size, artist, category, is_approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            media_id,
            file.title,
            file.description,
            'audio', // Use lowercase 'audio'
            user2,
            'uploads/amapiano1.mp3',
            512000 + (i * 50000),
            file.artist,
            file.category,
            true // Mark as approved
          ]
        );
        console.log(`✅ Created music: "${file.title}" by ${file.artist}`);
        createdCount++;
      } catch (error) {
        console.log(`❌ Error creating music "${file.title}": ${error.message}`);
      }
    }

    console.log(`\n🎉 Successfully created ${createdCount} media items!`);
    console.log('\n📊 You can now test the search functionality:');
    console.log('   - Search for "amapiano" (should find amapiano content)');
    console.log('   - Search for "artist names" (should find by artist)');
    console.log('   - Search for "video" or "music" (should find by description)');
    console.log('   - Use single characters like "a", "m", "d" to test basic search');

  } catch (error) {
    console.error('❌ Error creating test media:', error.message);
  } finally {
    await pool.end();
  }
}

createTestMedia();