const pool = require('./src/db');
const fs = require('fs');

async function exportData() {
  const client = await pool.connect();
  try {
    // Get all tables
    const tablesRes = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    const tables = tablesRes.rows.map(row => row.tablename);

    let sql = '';

    for (const table of tables) {
      // Get column names
      const columnsRes = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [table]);
      const columns = columnsRes.rows.map(row => row.column_name);

      // Get data
      const dataRes = await client.query(`SELECT * FROM ${table}`);
      const rows = dataRes.rows;

      if (rows.length > 0) {
        sql += `-- Data for table ${table}\n`;
        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return val;
          });
          sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sql += '\n';
      }
    }

    fs.writeFileSync('local_db_data_backup.sql', sql);
    console.log('Data exported to local_db_data_backup.sql');
  } catch (err) {
    console.error('Error exporting data:', err);
  } finally {
    client.release();
  }
}

exportData();