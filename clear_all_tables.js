const pool = require('./src/db');

async function clearAllTables() {
  try {
    // Get all table names from the current database
    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tables = result.rows.map(row => row.tablename);

    console.log('Tables found:', tables);

    // Truncate each table
    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      console.log(`Truncated table: ${table}`);
    }

    console.log('All tables cleared successfully.');
  } catch (error) {
    console.error('Error clearing tables:', error);
  } finally {
    await pool.end();
  }
}

clearAllTables();