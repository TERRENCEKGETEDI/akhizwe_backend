const db = require('./src/db');

// Migration to add approval_status field to media table
async function addApprovalStatusField() {
    try {
        // Add the new approval_status column with default value 'pending'
        await db.query(`
            ALTER TABLE media 
            ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' 
            CHECK (approval_status IN ('pending', 'approved', 'rejected'))
        `);
        
        console.log('✅ Successfully added approval_status column to media table');
        
        // Update existing records to set approval_status based on is_approved
        await db.query(`
            UPDATE media 
            SET approval_status = CASE 
                WHEN is_approved = true THEN 'approved'
                WHEN is_approved = false THEN 'pending'
                ELSE 'pending'
            END
        `);
        
        console.log('✅ Successfully updated existing records with approval_status values');
        
        // Verify the changes
        const result = await db.query('SELECT media_id, title, is_approved, approval_status FROM media LIMIT 5');
        console.log('Sample data after migration:');
        result.rows.forEach(row => {
            console.log(`- ${row.title}: is_approved=${row.is_approved}, approval_status=${row.approval_status}`);
        });
        
    } catch (error) {
        console.error('❌ Error adding approval_status field:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    addApprovalStatusField()
        .then(() => {
            console.log('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = addApprovalStatusField;