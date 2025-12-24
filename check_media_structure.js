const pool = require('./src/db');

async function checkMediaStructure() {
    try {
        const result = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'media\' ORDER BY ordinal_position');
        console.log('Media table columns:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name} (${row.data_type})`);
        });

        // Also check some sample data
        const sample = await pool.query('SELECT * FROM media LIMIT 1');
        if (sample.rows.length > 0) {
            console.log('\nSample media record:');
            console.log(JSON.stringify(sample.rows[0], null, 2));
        } else {
            console.log('\nNo media records found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkMediaStructure();