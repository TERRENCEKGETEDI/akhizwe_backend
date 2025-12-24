const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class TestDataManager {
  constructor() {
    this.resetStats = {
      resetsPerformed: 0,
      totalRecordsRemoved: 0,
      errors: []
    };
    
    this.testUsers = {
      user1: { email: 'user1@mail.com', password: 'testpass123', full_name: 'Video User' },
      user2: { email: 'user2@mail.com', password: 'testpass123', full_name: 'Music User' },
      admin: { email: 'admin@test.com', password: 'admin123', full_name: 'Admin User', role: 'ADMIN' }
    };
    
    this.mediaFiles = {
      videos: [
        'uploads/dance1.mp4',
        'uploads/bb42fcf24e88f9dfca3a77ae5f1d8176.mp4',
        'uploads/ac485d7700eef180fca5d34ed6e1205b.mp4'
      ],
      music: [
        'uploads/amapiano1.mp3',
        'uploads/Bafana_Ba_Moyah.mp3',
        'uploads/Ge_Ke_Thutxi_Top__feat._Emkayy_SA,_Droshka_My63,_LTC_Christly,_Dhura,_Trippy.mp3'
      ]
    };
  }

  // Reset interaction tables (comments, likes, favorites, reports)
  async resetInteractionTables() {
    try {
      console.log('🔄 Resetting interaction tables...');
      
      let totalRemoved = 0;
      
      // Truncate in correct order (due to foreign key dependencies)
      const tables = [
        'comment_likes',
        'media_comments', 
        'media_interactions',
        'reports',
        'notifications'
      ];
      
      for (const table of tables) {
        const result = await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        const removed = result.rowCount || 0;
        totalRemoved += removed;
        console.log(`  ✅ ${table}: ${removed} records removed`);
      }
      
      this.resetStats.totalRecordsRemoved += totalRemoved;
      console.log(`📊 Total records removed: ${totalRemoved}`);
      
      return true;
    } catch (error) {
      this.resetStats.errors.push(`Reset interaction tables failed: ${error.message}`);
      console.error('❌ Reset interaction tables failed:', error);
      return false;
    }
  }

  // Reset all tables (nuclear option)
  async resetAllTables() {
    try {
      console.log('💥 Resetting ALL tables...');
      
      // Order matters due to foreign key dependencies
      const resetOrder = [
        'comment_likes',
        'media_comments',
        'media_interactions', 
        'reports',
        'notifications',
        'media',
        'users'
      ];
      
      let totalRemoved = 0;
      
      for (const table of resetOrder) {
        const result = await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        const removed = result.rowCount || 0;
        totalRemoved += removed;
        console.log(`  ✅ ${table}: ${removed} records removed`);
      }
      
      this.resetStats.totalRecordsRemoved += totalRemoved;
      console.log(`📊 Total records removed: ${totalRemoved}`);
      
      return true;
    } catch (error) {
      this.resetStats.errors.push(`Reset all tables failed: ${error.message}`);
      console.error('❌ Reset all tables failed:', error);
      return false;
    }
  }

  // Ensure test users exist
  async ensureTestUsers() {
    try {
      console.log('👥 Ensuring test users exist...');
      
      for (const [key, user] of Object.entries(this.testUsers)) {
        const user_id = uuidv4();
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        await pool.query(`
          INSERT INTO users (email, full_name, phone, password_hash, role, data_balance, wallet_balance, is_blocked)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            data_balance = EXCLUDED.data_balance,
            wallet_balance = EXCLUDED.wallet_balance,
            is_blocked = EXCLUDED.is_blocked
        `, [
          user.email,
          user.full_name,
          '+27123456789',
          hashedPassword,
          user.role || 'USER',
          1000,
          500,
          false
        ]);
        
        console.log(`  ✅ ${user.email} (${user.full_name})`);
      }
      
      return true;
    } catch (error) {
      this.resetStats.errors.push(`Ensure test users failed: ${error.message}`);
      console.error('❌ Ensure test users failed:', error);
      return false;
    }
  }

  // Create fresh test media
  async reseedTestMedia() {
    try {
      console.log('🎬 Reseeding test media...');
      
      let totalCreated = 0;
      
      // Clear existing media first
      await pool.query('TRUNCATE TABLE media CASCADE');
      
      // Create videos for user1@mail.com (correct assignment)
      for (let i = 0; i < this.mediaFiles.videos.length; i++) {
        const media_id = uuidv4();
        await pool.query(`
          INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_url, file_size, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          media_id,
          `Test Video ${i + 1}`,
          `This is test video number ${i + 1} uploaded by user1@mail.com for comprehensive testing`,
          'video',
          'user1@mail.com',
          this.mediaFiles.videos[i],
          `/${this.mediaFiles.videos[i]}`,
          1024000 + (i * 100000),
          true
        ]);
        
        totalCreated++;
        console.log(`  ✅ Video ${i + 1}: ${media_id}`);
      }
      
      // Create music for user2@mail.com (correct assignment)
      for (let i = 0; i < this.mediaFiles.music.length; i++) {
        const media_id = uuidv4();
        await pool.query(`
          INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_url, file_size, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          media_id,
          `Test Music ${i + 1}`,
          `This is test music number ${i + 1} uploaded by user2@mail.com for comprehensive testing`,
          'audio',
          'user2@mail.com',
          this.mediaFiles.music[i],
          `/${this.mediaFiles.music[i]}`,
          512000 + (i * 50000),
          true
        ]);
        
        totalCreated++;
        console.log(`  ✅ Music ${i + 1}: ${media_id}`);
      }
      
      console.log(`📊 Total media created: ${totalCreated}`);
      return true;
    } catch (error) {
      this.resetStats.errors.push(`Reseed test media failed: ${error.message}`);
      console.error('❌ Reseed test media failed:', error);
      return false;
    }
  }

  // Complete reset and reseed cycle
  async completeResetAndReseed() {
    try {
      this.resetStats.resetsPerformed++;
      console.log(`\n🔄 === RESET AND RESEED CYCLE #${this.resetStats.resetsPerformed} ===`);
      
      // Step 1: Reset interaction tables
      if (!(await this.resetInteractionTables())) {
        throw new Error('Failed to reset interaction tables');
      }
      
      // Step 2: Ensure users exist
      if (!(await this.ensureTestUsers())) {
        throw new Error('Failed to ensure test users');
      }
      
      // Step 3: Reseed media
      if (!(await this.reseedTestMedia())) {
        throw new Error('Failed to reseed test media');
      }
      
      console.log('✅ Complete reset and reseed cycle finished successfully');
      return true;
    } catch (error) {
      this.resetStats.errors.push(`Complete reset failed: ${error.message}`);
      console.error('❌ Complete reset failed:', error);
      return false;
    }
  }

  // Get current test statistics
  async getTestStats() {
    try {
      const stats = {};
      
      // Get user counts
      const userResult = await pool.query('SELECT email, role FROM users WHERE email LIKE \'%@mail.com\' OR email = \'admin@test.com\'');
      stats.users = userResult.rows;
      
      // Get media counts by type and uploader
      const mediaResult = await pool.query('SELECT media_type, uploader_email, COUNT(*) as count FROM media GROUP BY media_type, uploader_email ORDER BY media_type, uploader_email');
      stats.media = mediaResult.rows;
      
      // Get interaction counts
      const interactionResult = await pool.query('SELECT interaction_type, COUNT(*) as count FROM media_interactions GROUP BY interaction_type');
      stats.interactions = interactionResult.rows;
      
      // Get comment counts
      const commentResult = await pool.query('SELECT COUNT(*) as count FROM media_comments');
      stats.comments = parseInt(commentResult.rows[0].count);
      
      // Get report counts
      const reportResult = await pool.query('SELECT COUNT(*) as count FROM reports');
      stats.reports = parseInt(reportResult.rows[0].count);
      
      return stats;
    } catch (error) {
      this.resetStats.errors.push(`Get test stats failed: ${error.message}`);
      console.error('❌ Get test stats failed:', error);
      return null;
    }
  }

  // Print current test statistics
  async printTestStats() {
    const stats = await this.getTestStats();
    
    console.log('\n📊 === CURRENT TEST STATISTICS ===');
    
    if (stats) {
      console.log(`👥 Users (${stats.users.length}):`);
      stats.users.forEach(user => console.log(`  - ${user.email} (${user.role})`));
      
      console.log(`\n🎬 Media (${stats.media.length} groups):`);
      stats.media.forEach(media => console.log(`  - ${media.media_type}: ${media.uploader_email} (${media.count} items)`));
      
      console.log(`\n💫 Interactions (${stats.interactions.length} types):`);
      stats.interactions.forEach(interaction => console.log(`  - ${interaction.interaction_type}: ${interaction.count}`));
      
      console.log(`\n💬 Comments: ${stats.comments}`);
      console.log(`🚨 Reports: ${stats.reports}`);
    }
    
    console.log(`\n🔄 Reset cycles performed: ${this.resetStats.resetsPerformed}`);
    console.log(`📊 Total records removed: ${this.resetStats.totalRecordsRemoved}`);
    
    if (this.resetStats.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.resetStats.errors.length}`);
      this.resetStats.errors.forEach((error, index) => console.log(`  ${index + 1}. ${error}`));
    }
  }

  // Verify database integrity
  async verifyDatabaseIntegrity() {
    try {
      console.log('\n🔍 Verifying database integrity...');
      
      let issuesFound = 0;
      
      // Check for orphaned interactions
      const orphanInteractions = await pool.query(`
        SELECT COUNT(*) as count 
        FROM media_interactions mi 
        LEFT JOIN media m ON mi.media_id = m.media_id 
        WHERE m.media_id IS NULL
      `);
      
      if (parseInt(orphanInteractions.rows[0].count) > 0) {
        console.log(`⚠️  Found ${orphanInteractions.rows[0].count} orphaned interactions`);
        issuesFound++;
      }
      
      // Check for orphaned comments
      const orphanComments = await pool.query(`
        SELECT COUNT(*) as count 
        FROM media_comments mc 
        LEFT JOIN media m ON mc.media_id = m.media_id 
        WHERE m.media_id IS NULL
      `);
      
      if (parseInt(orphanComments.rows[0].count) > 0) {
        console.log(`⚠️  Found ${orphanComments.rows[0].count} orphaned comments`);
        issuesFound++;
      }
      
      // Check for invalid media types
      const invalidMediaTypes = await pool.query(`
        SELECT COUNT(*) as count 
        FROM media 
        WHERE media_type NOT IN ('VIDEO', 'MUSIC')
      `);
      
      if (parseInt(invalidMediaTypes.rows[0].count) > 0) {
        console.log(`⚠️  Found ${invalidMediaTypes.rows[0].count} media items with invalid types`);
        issuesFound++;
      }
      
      if (issuesFound === 0) {
        console.log('✅ Database integrity check passed');
      } else {
        console.log(`❌ Database integrity check found ${issuesFound} issues`);
      }
      
      return issuesFound === 0;
    } catch (error) {
      this.resetStats.errors.push(`Database integrity check failed: ${error.message}`);
      console.error('❌ Database integrity check failed:', error);
      return false;
    }
  }
}

// Run test data manager if executed directly
if (require.main === module) {
  const manager = new TestDataManager();
  
  const command = process.argv[2] || 'stats';
  
  switch (command) {
    case 'reset':
      manager.completeResetAndReseed()
        .then(() => manager.printTestStats());
      break;
    case 'stats':
      manager.printTestStats();
      break;
    case 'verify':
      manager.verifyDatabaseIntegrity();
      break;
    case 'clean':
      manager.resetAllTables()
        .then(() => console.log('🧹 All tables cleaned'));
      break;
    default:
      console.log('Usage: node test_data_manager.js [reset|stats|verify|clean]');
  }
}

module.exports = TestDataManager;