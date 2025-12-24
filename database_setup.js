const pool = require('./src/db');

class DatabaseSetup {
  constructor() {
    this.setupResults = {
      tablesCreated: [],
      errors: [],
      warnings: []
    };
  }

  // Check if users table exists and create if needed
  async setupUsersTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            user_id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            phone VARCHAR(20),
            role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
            is_active BOOLEAN DEFAULT true,
            data_balance INT DEFAULT 0,
            wallet_balance DECIMAL(10,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      this.setupResults.tablesCreated.push('users');
      console.log('✅ Users table ready');
      return true;
    } catch (error) {
      this.setupResults.errors.push(`Users table setup failed: ${error.message}`);
      console.error('❌ Users table setup failed:', error);
      return false;
    }
  }

  // Set up media table with proper constraints
  async setupMediaTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media (
            media_id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            media_type VARCHAR(10) CHECK (media_type IN ('VIDEO', 'MUSIC')),
            uploader_email VARCHAR(255) REFERENCES users(email),
            file_path TEXT NOT NULL,
            file_size INT NOT NULL,
            artist VARCHAR(255),
            category VARCHAR(100),
            release_date DATE,
            copyright_declared BOOLEAN DEFAULT FALSE,
            is_approved BOOLEAN DEFAULT TRUE,
            view_count INT DEFAULT 0,
            download_count INT DEFAULT 0,
            monetization_enabled BOOLEAN DEFAULT FALSE,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      this.setupResults.tablesCreated.push('media');
      console.log('✅ Media table ready');
      return true;
    } catch (error) {
      this.setupResults.errors.push(`Media table setup failed: ${error.message}`);
      console.error('❌ Media table setup failed:', error);
      return false;
    }
  }

  // Set up interaction tables
  async setupInteractionTables() {
    try {
      // Media interactions (likes, favorites)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media_interactions (
            interaction_id SERIAL PRIMARY KEY,
            media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
            user_email VARCHAR(255) REFERENCES users(email),
            interaction_type VARCHAR(20) CHECK (interaction_type IN ('LIKE', 'FAVORITE')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(media_id, user_email, interaction_type)
        );
      `);
      
      // Comments
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media_comments (
            comment_id VARCHAR(50) PRIMARY KEY,
            media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
            user_email VARCHAR(255) REFERENCES users(email),
            comment_text TEXT NOT NULL,
            parent_comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Comment likes
      await pool.query(`
        CREATE TABLE IF NOT EXISTS comment_likes (
            like_id SERIAL PRIMARY KEY,
            comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
            user_email VARCHAR(255) REFERENCES users(email),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(comment_id, user_email)
        );
      `);
      
      this.setupResults.tablesCreated.push('media_interactions', 'media_comments', 'comment_likes');
      console.log('✅ Interaction tables ready');
      return true;
    } catch (error) {
      this.setupResults.errors.push(`Interaction tables setup failed: ${error.message}`);
      console.error('❌ Interaction tables setup failed:', error);
      return false;
    }
  }

  // Set up reports and notifications
  async setupSystemTables() {
    try {
      // Reports table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
            report_id VARCHAR(50) PRIMARY KEY,
            reporter_email VARCHAR(255) REFERENCES users(email),
            reported_email VARCHAR(255) REFERENCES users(email),
            media_id VARCHAR(50) REFERENCES media(media_id),
            comment_id VARCHAR(50) REFERENCES media_comments(comment_id),
            report_type VARCHAR(20) CHECK (report_type IN ('USER', 'MEDIA', 'COMMENT')),
            reason TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Notifications table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            notification_id VARCHAR(50) PRIMARY KEY,
            user_email VARCHAR(255) REFERENCES users(email),
            notification_type VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            related_media_id VARCHAR(50) REFERENCES media(media_id),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      this.setupResults.tablesCreated.push('reports', 'notifications');
      console.log('✅ System tables ready');
      return true;
    } catch (error) {
      this.setupResults.errors.push(`System tables setup failed: ${error.message}`);
      console.error('❌ System tables setup failed:', error);
      return false;
    }
  }

  // Check existing data and provide recommendations
  async checkExistingData() {
    try {
      console.log('\n📊 Checking existing data...');
      
      // Check users
      const userResult = await pool.query('SELECT COUNT(*) as count, email, role FROM users GROUP BY email, role');
      console.log(`👥 Users found: ${userResult.rows.length}`);
      userResult.rows.forEach(user => {
        console.log(`   - ${user.email} (${user.role})`);
      });
      
      // Check media
      const mediaResult = await pool.query('SELECT COUNT(*) as count, media_type, uploader_email FROM media GROUP BY media_type, uploader_email');
      console.log(`🎬 Media found: ${mediaResult.rows.length} groups`);
      mediaResult.rows.forEach(media => {
        console.log(`   - ${media.media_type}: ${media.uploader_email} (${media.count} items)`);
      });
      
      // Check interactions
      const interactionsResult = await pool.query('SELECT COUNT(*) as count, interaction_type FROM media_interactions GROUP BY interaction_type');
      console.log(`💫 Interactions found: ${interactionsResult.rows.length} types`);
      interactionsResult.rows.forEach(interaction => {
        console.log(`   - ${interaction.interaction_type}: ${interaction.count} items`);
      });
      
      return {
        users: userResult.rows,
        media: mediaResult.rows,
        interactions: interactionsResult.rows
      };
    } catch (error) {
      this.setupResults.errors.push(`Data check failed: ${error.message}`);
      console.error('❌ Data check failed:', error);
      return null;
    }
  }

  // Clean all data (nuclear option)
  async cleanAllData() {
    try {
      console.log('🧹 Cleaning all data...');
      
      // Drop tables in reverse dependency order
      await pool.query('DROP TABLE IF EXISTS comment_likes CASCADE');
      await pool.query('DROP TABLE IF EXISTS media_comments CASCADE');
      await pool.query('DROP TABLE IF EXISTS media_interactions CASCADE');
      await pool.query('DROP TABLE IF EXISTS notifications CASCADE');
      await pool.query('DROP TABLE IF EXISTS reports CASCADE');
      await pool.query('DROP TABLE IF EXISTS media CASCADE');
      await pool.query('DROP TABLE IF EXISTS users CASCADE');
      
      console.log('✅ All data cleaned');
      return true;
    } catch (error) {
      this.setupResults.errors.push(`Data clean failed: ${error.message}`);
      console.error('❌ Data clean failed:', error);
      return false;
    }
  }

  // Main setup function
  async setupDatabase() {
    console.log('🚀 Setting up database structure...\n');
    
    try {
      // Clean existing data first (optional - can be commented out)
      // await this.cleanAllData();
      
      // Setup tables in order
      const setupSteps = [
        { name: 'Users', func: () => this.setupUsersTable() },
        { name: 'Media', func: () => this.setupMediaTable() },
        { name: 'Interactions', func: () => this.setupInteractionTables() },
        { name: 'System Tables', func: () => this.setupSystemTables() }
      ];
      
      for (const step of setupSteps) {
        console.log(`\n🔧 Setting up ${step.name}...`);
        await step.func();
      }
      
      // Check existing data
      await this.checkExistingData();
      
      // Print summary
      this.printSetupResults();
      
      return true;
    } catch (error) {
      console.error('💥 Database setup failed:', error);
      this.setupResults.errors.push(`Setup failed: ${error.message}`);
      this.printSetupResults();
      return false;
    }
  }

  // Print setup results
  printSetupResults() {
    console.log('\n📋 === DATABASE SETUP RESULTS ===');
    console.log(`Tables created: ${this.setupResults.tablesCreated.length}`);
    this.setupResults.tablesCreated.forEach(table => console.log(`  ✅ ${table}`));
    
    if (this.setupResults.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${this.setupResults.warnings.length}`);
      this.setupResults.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    if (this.setupResults.errors.length > 0) {
      console.log(`\n❌ Errors: ${this.setupResults.errors.length}`);
      this.setupResults.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    if (this.setupResults.errors.length === 0) {
      console.log('\n🎉 Database setup completed successfully!');
    }
  }
}

// Run setup if executed directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.setupDatabase()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Fatal setup error:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSetup;