const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bathini',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

async function getReferencedTables(tableName) {
  const result = await pool.query(`
    SELECT DISTINCT ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
  `, [tableName]);
  return result.rows.map(row => row.referenced_table);
}

function topologicalSort(tables, dependencies) {
  const visited = new Set();
  const visiting = new Set();
  const sorted = [];

  function visit(table) {
    if (visited.has(table)) return;
    if (visiting.has(table)) throw new Error('Circular dependency detected');

    visiting.add(table);
    for (const dep of dependencies[table] || []) {
      visit(dep);
    }
    visiting.delete(table);
    visited.add(table);
    sorted.push(table);
  }

  for (const table of tables) {
    if (!visited.has(table)) {
      visit(table);
    }
  }

  return sorted;
}

async function generateCreateTables() {
  try {
    // Query all table names in public schema
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);

    let sqlOutput = '';

    for (const tableName of tables) {
      console.log(`\n-- CREATE TABLE for ${tableName}`);
      const createTableSQL = await buildCreateTableSQL(tableName);
      console.log(createTableSQL);
      sqlOutput += `\n-- CREATE TABLE for ${tableName}\n${createTableSQL}\n`;
    }

    // Write to file
    fs.writeFileSync('create_tables_from_local.sql', sqlOutput);
    console.log('\nSQL statements written to create_tables_from_local.sql');
  } catch (error) {
    console.error('Error generating CREATE TABLE statements:', error);
  } finally {
    await pool.end();
  }
}

async function buildCreateTableSQL(tableName) {
  // Query columns
  const columnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  const columns = columnsResult.rows;

  // Query primary keys
  const pkResult = await pool.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `, [tableName]);

  const primaryKeys = pkResult.rows.map(row => row.column_name);

  // Query unique constraints
  const uniqueResult = await pool.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `, [tableName]);

  const uniques = {};
  uniqueResult.rows.forEach(row => {
    if (!uniques[row.constraint_name]) uniques[row.constraint_name] = [];
    uniques[row.constraint_name].push(row.column_name);
  });

  // Query foreign keys
  const fkResult = await pool.query(`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
  `, [tableName]);

  const foreignKeys = fkResult.rows;

  // Build column definitions
  const columnDefs = columns.map(col => {
    let def = `"${col.column_name}" ${col.data_type}`;

    if (col.character_maximum_length) {
      def += `(${col.character_maximum_length})`;
    } else if (col.numeric_precision && col.data_type !== 'integer') {
      def += `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
    }

    if (col.column_default !== null) {
      def += ` DEFAULT ${col.column_default}`;
    }

    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }

    return def;
  });

  // Add constraints
  const constraints = [];

  if (primaryKeys.length > 0) {
    constraints.push(`PRIMARY KEY (${primaryKeys.map(pk => `"${pk}"`).join(', ')})`);
  }

  for (const [constraintName, cols] of Object.entries(uniques)) {
    constraints.push(`UNIQUE (${cols.map(col => `"${col}"`).join(', ')})`);
  }

  for (const fk of foreignKeys) {
    let fkDef = `FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}"("${fk.foreign_column_name}")`;
    if (fk.update_rule !== 'NO ACTION') {
      fkDef += ` ON UPDATE ${fk.update_rule}`;
    }
    if (fk.delete_rule !== 'NO ACTION') {
      fkDef += ` ON DELETE ${fk.delete_rule}`;
    }
    constraints.push(fkDef);
  }

  // Combine
  let sql = `CREATE TABLE "${tableName}" (\n`;
  sql += columnDefs.map(def => `  ${def}`).join(',\n');
  if (constraints.length > 0) {
    sql += ',\n' + constraints.map(c => `  ${c}`).join(',\n');
  }
  sql += '\n);';

  return sql;
}

generateCreateTables();