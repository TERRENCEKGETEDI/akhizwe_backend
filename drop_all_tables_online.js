const pool = require('./src/db');

async function dropAllTables() {
  const client = await pool.connect();
  try {
    // Get all tables
    const res = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    const tables = res.rows.map(row => row.tablename);

    // Drop each table
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`Dropped table: ${table}`);
    }

    console.log('All tables dropped successfully.');
  } catch (err) {
    console.error('Error dropping tables:', err);
  } finally {
    client.release();
  }
}

dropAllTables();