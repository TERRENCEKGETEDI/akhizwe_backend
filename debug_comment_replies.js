const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

class CommentReplyDebugger {
  constructor() {
    this.testResults = {
      testsRun: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  // Generate JWT token for testing
  generateToken(email) {
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-key-for-testing';
      return jwt.sign({ email }, secret, { expiresIn: '1h' });
    } catch (error) {
      console.error('JWT generation error:', error);
      return null;
    }
  }

  // Test comment reply functionality in detail
  async testCommentReplyDetailed(mediaId, userEmail) {
    try {
      this.testResults.testsRun++;
      const token = this.generateToken(userEmail);
      
      if (!token) {
        throw new Error('Failed to generate token');
      }

      console.log(`\n🔍 DEBUGGING: Comment reply for media ${mediaId} by ${userEmail}`);
      
      // Step 1: Post a comment
      const commentText = `Debug comment by ${userEmail}`;
      console.log(`1. Posting comment: "${commentText}"`);
      
      const commentResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ comment_text: commentText })
      });
      
      console.log(`   Comment response status: ${commentResponse.status}`);
      const commentData = await commentResponse.json();
      console.log(`   Comment response:`, commentData);
      
      if (!commentResponse.ok) {
        throw new Error(`Comment failed: ${commentResponse.status} ${commentResponse.statusText}`);
      }
      
      // Step 2: Get comments to find the comment ID
      console.log('2. Fetching comments to get comment ID...');
      const commentsResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comments`);
      const commentsData = await commentsResponse.json();
      
      console.log(`   Comments response status: ${commentsResponse.status}`);
      console.log(`   Found ${commentsData.comments?.length || 0} comments`);
      
      if (!commentsData.comments || commentsData.comments.length === 0) {
        throw new Error('No comments found after posting');
      }
      
      const commentId = commentsData.comments[0].comment_id;
      console.log(`   Using comment ID: ${commentId}`);
      
      // Step 3: Post a reply
      const replyText = `Debug reply by ${userEmail} to comment ${commentId}`;
      console.log(`3. Posting reply: "${replyText}"`);
      
      const replyResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comment/${commentId}/reply`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ reply_text: replyText })
      });
      
      console.log(`   Reply response status: ${replyResponse.status}`);
      const replyData = await replyResponse.json();
      console.log(`   Reply response:`, replyData);
      
      if (!replyResponse.ok) {
        throw new Error(`Reply failed: ${replyResponse.status} ${replyResponse.statusText}`);
      }
      
      // Step 4: Verify reply was recorded in database
      console.log('4. Checking database for reply...');
      const dbCheck = await pool.query(`
        SELECT mc.*, u.full_name as commenter_name
        FROM media_comments mc
        JOIN users u ON mc.user_email = u.email
        WHERE mc.parent_comment_id = $1 AND mc.comment = $2
      `, [commentId, replyText]);
      
      console.log(`   Database check found ${dbCheck.rows.length} matching replies`);
      if (dbCheck.rows.length > 0) {
        console.log(`   Reply found in DB:`, dbCheck.rows[0]);
      }
      
      // Step 5: Check via API again
      console.log('5. Fetching comments again to verify reply...');
      const finalCommentsResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/comments`);
      const finalCommentsData = await finalCommentsResponse.json();
      
      const hasReply = finalCommentsData.comments.some(c => 
        c.replies && c.replies.length > 0 && c.replies[0].comment_text === replyText
      );
      
      console.log(`   API check - reply found: ${hasReply}`);
      if (hasReply) {
        const reply = finalCommentsData.comments.find(c => c.replies && c.replies[0]?.comment_text === replyText)?.replies[0];
        console.log(`   Reply details:`, reply);
      }
      
      if (!hasReply) {
        throw new Error('Reply was not found in API response');
      }
      
      console.log(`✅ Comment reply test PASSED for ${mediaId}`);
      this.testResults.passed++;
      return true;
      
    } catch (error) {
      console.error(`❌ Comment reply test FAILED for ${mediaId}:`, error.message);
      this.testResults.failed++;
      this.testResults.errors.push(`Comment reply test failed: ${error.message}`);
      return false;
    }
  }

  // Run detailed debugging for one media item
  async debugOneMedia() {
    try {
      // Get a video ID from database
      const mediaResult = await pool.query(`
        SELECT media_id, media_type, uploader_email 
        FROM media 
        WHERE media_type = 'VIDEO' 
        LIMIT 1
      `);
      
      if (mediaResult.rows.length === 0) {
        throw new Error('No video media found for testing');
      }
      
      const media = mediaResult.rows[0];
      console.log(`🎬 Testing with media: ${media.media_id} (${media.media_type}) by ${media.uploader_email}`);
      
      // Test with the uploader
      await this.testCommentReplyDetailed(media.media_id, media.uploader_email);
      
    } catch (error) {
      console.error('Debug test failed:', error);
    }
  }

  // Print results
  printResults() {
    console.log('\n📊 === COMMENT REPLY DEBUG RESULTS ===');
    console.log(`Tests Run: ${this.testResults.testsRun}`);
    console.log(`Passed: ${this.testResults.passed}`);
    console.log(`Failed: ${this.testResults.failed}`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.testsRun) * 100).toFixed(2)}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
  }
}

// Run debug if executed directly
if (require.main === module) {
  const commentDebugger = new CommentReplyDebugger();
  commentDebugger.debugOneMedia()
    .then(() => commentDebugger.printResults())
    .catch(error => {
      console.error('Fatal debug error:', error);
      process.exit(1);
    });
}

module.exports = CommentReplyDebugger;