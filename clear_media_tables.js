const pool = require('./src/db');

async function clearMediaTables() {
  try {
    const mediaTables = [
      'comment_likes',
      'media_comments',
      'media_interactions',
      'notifications',
      'media'
    ];

    console.log('Clearing media-related tables...');

    // Truncate each table in order to handle dependencies
    for (const table of mediaTables) {
      await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      console.log(`Truncated table: ${table}`);
    }

    console.log('Media-related tables cleared successfully.');
  } catch (error) {
    console.error('Error clearing media tables:', error);
  } finally {
    await pool.end();
  }
}

clearMediaTables();