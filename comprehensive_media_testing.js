const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class ComprehensiveMediaTester {
  constructor() {
    this.testUsers = {
      user1: { email: 'user1@mail.com', password: 'testpass123', full_name: 'Video User' },
      user2: { email: 'user2@mail.com', password: 'testpass123', full_name: 'Music User' },
      admin: { email: 'admin@test.com', password: 'admin123', full_name: 'Admin User' }
    };
    
    this.testMedia = {
      videos: [],
      music: []
    };
    
    this.resetResults = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errors: []
    };
  }

  // Initialize database with proper structure
  async initializeDatabase() {
    try {
      console.log('🔧 Setting up database structure...');
      
      // Create media table with corrected constraints
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

      // Create media interactions table
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

      // Create media comments table
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

      // Create comment likes table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS comment_likes (
            like_id SERIAL PRIMARY KEY,
            comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
            user_email VARCHAR(255) REFERENCES users(email),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(comment_id, user_email)
        );
      `);

      // Create reports table
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

      // Create notifications table
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

      console.log('✅ Database structure created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error setting up database:', error);
      return false;
    }
  }

  // Create test users
  async createTestUsers() {
    try {
      console.log('👥 Creating test users...');
      
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
        
        console.log(`✅ Created user: ${user.email} (${user.full_name})`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error creating test users:', error);
      return false;
    }
  }

  // Create test media with proper user assignments
  async createTestMedia() {
    try {
      console.log('🎬 Creating test media...');
      
      // Create test videos for user1@mail.com
      const videoFiles = [
        'uploads/dance1.mp4',
        'uploads/bb42fcf24e88f9dfca3a77ae5f1d8176.mp4',
        'uploads/ac485d7700eef180fca5d34ed6e1205b.mp4'
      ];
      
      for (let i = 0; i < videoFiles.length; i++) {
        const media_id = uuidv4();
        await pool.query(`
          INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_url, file_size, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (media_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            media_type = EXCLUDED.media_type,
            uploader_email = EXCLUDED.uploader_email,
            file_path = EXCLUDED.file_path,
            file_url = EXCLUDED.file_url,
            file_size = EXCLUDED.file_size,
            is_approved = EXCLUDED.is_approved
        `, [
          media_id,
          `Test Video ${i + 1}`,
          `This is test video number ${i + 1} uploaded by user1@mail.com`,
          'video',
          'user1@mail.com',
          videoFiles[i],
          `/${videoFiles[i]}`,
          1024000 + (i * 100000),
          true
        ]);
        
        this.testMedia.videos.push(media_id);
        console.log(`✅ Created video: ${media_id}`);
      }

      // Create test music for user2@mail.com
      const musicFiles = [
        'uploads/amapiano1.mp3',
        'uploads/Bafana_Ba_Moyah.mp3',
        'uploads/Ge_Ke_Thutxi_Top__feat._Emkayy_SA,_Droshka_My63,_LTC_Christly,_Dhura,_Trippy.mp3'
      ];
      
      for (let i = 0; i < musicFiles.length; i++) {
        const media_id = uuidv4();
        await pool.query(`
          INSERT INTO media (media_id, title, description, media_type, uploader_email, file_path, file_url, file_size, is_approved)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (media_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            media_type = EXCLUDED.media_type,
            uploader_email = EXCLUDED.uploader_email,
            file_path = EXCLUDED.file_path,
            file_url = EXCLUDED.file_url,
            file_size = EXCLUDED.file_size,
            is_approved = EXCLUDED.is_approved
        `, [
          media_id,
          `Test Music ${i + 1}`,
          `This is test music number ${i + 1} uploaded by user2@mail.com`,
          'audio',
          'user2@mail.com',
          musicFiles[i],
          `/${musicFiles[i]}`,
          512000 + (i * 50000),
          true
        ]);
        
        this.testMedia.music.push(media_id);
        console.log(`✅ Created music: ${media_id}`);
      }
      
      console.log(`📊 Created ${this.testMedia.videos.length} videos and ${this.testMedia.music.length} music tracks`);
      return true;
    } catch (error) {
      console.error('❌ Error creating test media:', error);
      return false;
    }
  }

  // Generate JWT token for testing
  generateToken(email) {
    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'fallback-secret-key-for-testing';
      return jwt.sign({ email }, secret, { expiresIn: '1h' });
    } catch (error) {
      console.error('JWT generation error:', error);
      return null;
    }
  }

  // Reset and truncate all interaction tables
  async resetTestData() {
    try {
      console.log('🔄 Resetting test data...');
      
      // Truncate interaction tables in correct order (due to foreign keys)
      await pool.query('TRUNCATE TABLE comment_likes CASCADE');
      await pool.query('TRUNCATE TABLE media_comments CASCADE');
      await pool.query('TRUNCATE TABLE media_interactions CASCADE');
      await pool.query('TRUNCATE TABLE reports CASCADE');
      await pool.query('TRUNCATE TABLE notifications CASCADE');
      
      console.log('✅ Test data reset completed');
      return true;
    } catch (error) {
      console.error('❌ Error resetting test data:', error);
      return false;
    }
  }

  // Test media like functionality
  async testMediaLike(mediaId, userEmail) {
    try {
      this.resetResults.totalTests++;
      const token = this.generateToken(userEmail);
      
      // Test like
      const likeResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!likeResponse.ok) {
        throw new Error(`Like failed: ${likeResponse.status} ${likeResponse.statusText}`);
      }
      
      // Verify like was recorded
      const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
        [mediaId, userEmail, 'LIKE']
      );
      
      if (parseInt(checkResult.rows[0].count) !== 1) {
        throw new Error('Like was not properly recorded in database');
      }
      
      // Test unlike
      const unlikeResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/like`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!unlikeResponse.ok) {
        throw new Error(`Unlike failed: ${unlikeResponse.status} ${unlikeResponse.statusText}`);
      }
      
      // Verify like was removed
      const checkResult2 = await pool.query(
        'SELECT COUNT(*) as count FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
        [mediaId, userEmail, 'LIKE']
      );
      
      if (parseInt(checkResult2.rows[0].count) !== 0) {
        throw new Error('Like was not properly removed from database');
      }
      
      console.log(`✅ Media like test passed for ${mediaId} by ${userEmail}`);
      this.resetResults.passedTests++;
      return true;
    } catch (error) {
      console.error(`❌ Media like test failed for ${mediaId} by ${userEmail}:`, error.message);
      this.resetResults.failedTests++;
      this.resetResults.errors.push(`Media like test failed: ${error.message}`);
      return false;
    }
  }

  // Test media favorite functionality
  async testMediaFavorite(mediaId, userEmail) {
    try {
      this.resetResults.totalTests++;
      const token = this.generateToken(userEmail);
      
      // Test favorite
      const favResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!favResponse.ok) {
        throw new Error(`Favorite failed: ${favResponse.status} ${favResponse.statusText}`);
      }
      
      // Verify favorite was recorded
      const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
        [mediaId, userEmail, 'FAVORITE']
      );
      
      if (parseInt(checkResult.rows[0].count) !== 1) {
        throw new Error('Favorite was not properly recorded in database');
      }
      
      // Test unfavorite
      const unfavResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!unfavResponse.ok) {
        throw new Error(`Unfavorite failed: ${unfavResponse.status} ${unfavResponse.statusText}`);
      }
      
      // Verify favorite was removed
      const checkResult2 = await pool.query(
        'SELECT COUNT(*) as count FROM media_interactions WHERE media_id = $1 AND user_email = $2 AND interaction_type = $3',
        [mediaId, userEmail, 'FAVORITE']
      );
      
      if (parseInt(checkResult2.rows[0].count) !== 0) {
        throw new Error('Favorite was not properly removed from database');
      }
      
      console.log(`✅ Media favorite test passed for ${mediaId} by ${userEmail}`);
      this.resetResults.passedTests++;
      return true;
    } catch (error) {
      console.error(`❌ Media favorite test failed for ${mediaId} by ${userEmail}:`, error.message);
      this.resetResults.failedTests++;
      this.resetResults.errors.push(`Media favorite test failed: ${error.message}`);
      return false;
    }
  }

  // Test comment functionality
  async testComment(mediaId, userEmail) {
    try {
      this.resetResults.totalTests++;
      const token = this.generateToken(userEmail);
      
      // Test posting comment
      const commentText = `Test comment by ${userEmail} on ${mediaId}`;
      const commentResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment_text: commentText })
      });
      
      if (!commentResponse.ok) {
        throw new Error(`Comment failed: ${commentResponse.status} ${commentResponse.statusText}`);
      }
      
      // Get comment ID
      const commentsResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comments`);
      const commentsData = await commentsResponse.json();
      
      if (!commentsData.comments || commentsData.comments.length === 0) {
        throw new Error('No comments found after posting');
      }
      
      const commentId = commentsData.comments[0].comment_id;
      
      // Test liking comment
      const likeResponse = await fetch(`http://localhost:5000/api/media/comment/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!likeResponse.ok) {
        throw new Error(`Comment like failed: ${likeResponse.status} ${likeResponse.statusText}`);
      }
      
      // Verify comment like was recorded
      const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1 AND user_email = $2',
        [commentId, userEmail]
      );
      
      if (parseInt(checkResult.rows[0].count) !== 1) {
        throw new Error('Comment like was not properly recorded');
      }
      
      // Test replying to comment
      const replyText = `Test reply by ${userEmail} to comment ${commentId}`;
      const replyResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comment/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply_text: replyText })
      });
      
      if (!replyResponse.ok) {
        throw new Error(`Reply failed: ${replyResponse.status} ${replyResponse.statusText}`);
      }
      
      // Verify reply was recorded
      const repliesResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comments`);
      const repliesData = await repliesResponse.json();
      
      const hasReply = repliesData.comments.some(c => 
        c.replies && c.replies.length > 0 && c.replies[0].comment === replyText
      );
      
      if (!hasReply) {
        throw new Error('Reply was not properly recorded');
      }
      
      console.log(`✅ Comment test passed for ${mediaId} by ${userEmail}`);
      this.resetResults.passedTests++;
      return true;
    } catch (error) {
      console.error(`❌ Comment test failed for ${mediaId} by ${userEmail}:`, error.message);
      this.resetResults.failedTests++;
      this.resetResults.errors.push(`Comment test failed: ${error.message}`);
      return false;
    }
  }

  // Test report functionality
  async testReport(mediaId, userEmail) {
    try {
      this.resetResults.totalTests++;
      const token = this.generateToken(userEmail);
      
      // Test reporting media
      const reportReason = `Test report for media ${mediaId} by ${userEmail}`;
      const reportResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reportReason })
      });
      
      if (!reportResponse.ok) {
        throw new Error(`Report failed: ${reportResponse.status} ${reportResponse.statusText}`);
      }
      
      // Verify report was recorded
      const checkResult = await pool.query(
        'SELECT COUNT(*) as count FROM reports WHERE media_id = $1 AND reporter_email = $2 AND report_type = $3',
        [mediaId, userEmail, 'MEDIA']
      );
      
      if (parseInt(checkResult.rows[0].count) !== 1) {
        throw new Error('Report was not properly recorded in database');
      }
      
      console.log(`✅ Report test passed for ${mediaId} by ${userEmail}`);
      this.resetResults.passedTests++;
      return true;
    } catch (error) {
      console.error(`❌ Report test failed for ${mediaId} by ${userEmail}:`, error.message);
      this.resetResults.failedTests++;
      this.resetResults.errors.push(`Report test failed: ${error.message}`);
      return false;
    }
  }

  // Run comprehensive test for a media item
  async testMediaItem(mediaId, userEmail, mediaType) {
    console.log(`\n🎯 Testing ${mediaType} media: ${mediaId} with user: ${userEmail}`);
    
    try {
      // Test all interactions in sequence
      await this.testMediaLike(mediaId, userEmail);
      await this.resetTestData(); // Reset after like test
      
      await this.testMediaFavorite(mediaId, userEmail);
      await this.resetTestData(); // Reset after favorite test
      
      await this.testComment(mediaId, userEmail);
      await this.resetTestData(); // Reset after comment test
      
      await this.testReport(mediaId, userEmail);
      await this.resetTestData(); // Reset after report test
      
      console.log(`✅ All tests passed for ${mediaType} media ${mediaId}`);
      return true;
    } catch (error) {
      console.error(`❌ Test sequence failed for ${mediaType} media ${mediaId}:`, error.message);
      return false;
    }
  }

  // Run comprehensive testing for video page (user1@mail.com)
  async testVideoPage() {
    console.log('\n🎬 === TESTING VIDEO PAGE (user1@mail.com) ===');
    
    for (const videoId of this.testMedia.videos) {
      await this.testMediaItem(videoId, 'user1@mail.com', 'VIDEO');
    }
  }

  // Run comprehensive testing for music page (user2@mail.com)
  async testMusicPage() {
    console.log('\n🎵 === TESTING MUSIC PAGE (user2@mail.com) ===');
    
    for (const musicId of this.testMedia.music) {
      await this.testMediaItem(musicId, 'user2@mail.com', 'MUSIC');
    }
  }

  // Print final test results
  printResults() {
    console.log('\n📊 === FINAL TEST RESULTS ===');
    console.log(`Total Tests: ${this.resetResults.totalTests}`);
    console.log(`Passed: ${this.resetResults.passedTests}`);
    console.log(`Failed: ${this.resetResults.failedTests}`);
    console.log(`Success Rate: ${((this.resetResults.passedTests / this.resetResults.totalTests) * 100).toFixed(2)}%`);
    
    if (this.resetResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.resetResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    return {
      total: this.resetResults.totalTests,
      passed: this.resetResults.passedTests,
      failed: this.resetResults.failedTests,
      errors: this.resetResults.errors
    };
  }

  // Main test runner
  async runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive Media Testing System\n');
    
    try {
      // Initialize database
      if (!(await this.initializeDatabase())) {
        throw new Error('Failed to initialize database');
      }
      
      // Create test users
      if (!(await this.createTestUsers())) {
        throw new Error('Failed to create test users');
      }
      
      // Create test media
      if (!(await this.createTestMedia())) {
        throw new Error('Failed to create test media');
      }
      
      // Test video page (user1@mail.com)
      await this.testVideoPage();
      
      // Test music page (user2@mail.com)
      await this.testMusicPage();
      
      // Print results
      return this.printResults();
      
    } catch (error) {
      console.error('❌ Comprehensive test failed:', error);
      return this.printResults();
    }
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const tester = new ComprehensiveMediaTester();
  tester.runComprehensiveTests()
    .then(results => {
      console.log('\n🎉 Comprehensive testing completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = ComprehensiveMediaTester;