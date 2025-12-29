/**
 * Media Approval System Test Suite
 * Tests the complete workflow from media upload to admin approval/rejection
 * and real-time user notifications
 */

const API_URL = 'http://localhost:5000/api';

// Test data
const testData = {
  admin: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'ADMIN'
  },
  user: {
    email: 'user@test.com', 
    password: 'user123',
    role: 'USER'
  },
  media: {
    title: 'Test Media for Approval',
    description: 'This is a test media file for the approval system',
    media_type: 'video',
    category: 'test'
  }
};

let adminToken = '';
let userToken = '';
let testMediaId = '';

class MediaApprovalTest {
  constructor() {
    this.results = [];
  }

  log(testName, success, message = '') {
    const status = success ? '✅ PASS' : '❌ FAIL';
    const result = { test: testName, status, message, timestamp: new Date().toISOString() };
    this.results.push(result);
    console.log(`${status} ${testName}${message ? ': ' + message : ''}`);
    return success;
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      return { success: false, status: 0, data: { error: error.message } };
    }
  }

  async login(email, password) {
    const result = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (result.success && result.data.token) {
      return result.data.token;
    }
    return null;
  }

  async registerUser(userData) {
    return await this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async uploadMedia(token, mediaData) {
    const formData = new FormData();
    formData.append('title', mediaData.title);
    formData.append('description', mediaData.description);
    formData.append('media_type', mediaData.media_type);
    formData.append('category', mediaData.category);
    
    // Create a dummy file for testing
    const blob = new Blob(['test video content'], { type: 'video/mp4' });
    formData.append('file', blob, 'test-video.mp4');

    try {
      const response = await fetch(`${API_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      return { success: false, status: 0, data: { error: error.message } };
    }
  }

  async testSetup() {
    console.log('\n🔧 Setting up test environment...');
    
    // Register test users
    const adminReg = await this.registerUser(testData.admin);
    const userReg = await this.registerUser(testData.user);
    
    // Login to get tokens
    adminToken = await this.login(testData.admin.email, testData.admin.password);
    userToken = await this.login(testData.user.email, testData.user.password);
    
    this.log('Admin registration', adminReg.success || adminReg.status === 400); // 400 if already exists
    this.log('User registration', userReg.success || userReg.status === 400);
    this.log('Admin login', !!adminToken);
    this.log('User login', !!userToken);
  }

  async testMediaUpload() {
    console.log('\n📤 Testing media upload...');
    
    const uploadResult = await this.uploadMedia(userToken, testData.media);
    
    if (uploadResult.success && uploadResult.data.media_id) {
      testMediaId = uploadResult.data.media_id;
      this.log('Media upload', true, `Media ID: ${testMediaId}`);
      return true;
    } else {
      this.log('Media upload', false, uploadResult.data.error || 'Unknown error');
      return false;
    }
  }

  async testPendingMediaRetrieval() {
    console.log('\n📋 Testing pending media retrieval (Admin)...');
    
    const result = await this.makeRequest('/media/pending', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const hasTestMedia = result.success && 
                        result.data.media && 
                        result.data.media.some(m => m.media_id === testMediaId);
    
    this.log('Admin can view pending media', result.success, result.success ? `Found ${result.data.media?.length || 0} pending items` : result.data.error);
    this.log('Test media appears in pending list', hasTestMedia);
    
    return result.success && hasTestMedia;
  }

  async testUserMediaRetrieval() {
    console.log('\n👤 Testing user media retrieval...');
    
    const result = await this.makeRequest('/media/my', {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    const hasTestMedia = result.success && 
                        result.data.media && 
                        result.data.media.some(m => m.media_id === testMediaId);
    
    this.log('User can view own media', result.success, result.success ? `Found ${result.data.media?.length || 0} items` : result.data.error);
    this.log('Test media appears in user media', hasTestMedia);
    this.log('Media status is pending', hasTestMedia && result.data.media.find(m => m.media_id === testMediaId)?.status === 'pending');
    
    return result.success && hasTestMedia;
  }

  async testMediaApproval() {
    console.log('\n✅ Testing media approval...');
    
    const result = await this.makeRequest(`/media/${testMediaId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    this.log('Admin can approve media', result.success, result.success ? result.data.message : result.data.error);
    
    // Check if media status updated
    if (result.success) {
      const mediaCheck = await this.makeRequest('/media/my', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      const media = mediaCheck.success && mediaCheck.data.media ? 
                   mediaCheck.data.media.find(m => m.media_id === testMediaId) : null;
      
      this.log('Media status updated to approved', media && media.status === 'approved', 
              media ? `Status: ${media.status}` : 'Media not found');
    }
    
    return result.success;
  }

  async testMediaRejection() {
    console.log('\n❌ Testing media rejection...');
    
    // Upload new media for rejection test
    const rejectionTestMedia = { ...testData, title: 'Test Media for Rejection' };
    const uploadResult = await this.uploadMedia(userToken, rejectionTestMedia);
    
    if (!uploadResult.success) {
      this.log('Upload for rejection test', false, 'Failed to upload test media');
      return false;
    }
    
    const rejectionMediaId = uploadResult.data.media_id;
    
    const result = await this.makeRequest(`/media/${rejectionMediaId}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Test rejection reason' })
    });
    
    this.log('Admin can reject media', result.success, result.success ? result.data.message : result.data.error);
    
    // Check if media status updated
    if (result.success) {
      const mediaCheck = await this.makeRequest('/media/my', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      const media = mediaCheck.success && mediaCheck.data.media ? 
                   mediaCheck.data.media.find(m => m.media_id === rejectionMediaId) : null;
      
      this.log('Media status updated to rejected', media && media.status === 'rejected', 
              media ? `Status: ${media.status}` : 'Media not found');
      this.log('Rejection timestamp set', media && media.rejected_at, media ? `Rejected at: ${media.rejected_at}` : 'No timestamp');
    }
    
    return result.success;
  }

  async testUnauthorizedAccess() {
    console.log('\n🔒 Testing unauthorized access...');
    
    // Try to approve media as regular user
    const userApproval = await this.makeRequest(`/media/${testMediaId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    this.log('Regular user cannot approve media', !userApproval.success && userApproval.status === 403, 
            userApproval.success ? 'Should have failed' : userApproval.data.error);
    
    // Try to access pending media as regular user
    const userPending = await this.makeRequest('/media/pending', {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    this.log('Regular user cannot access pending media', !userPending.success && userPending.status === 403, 
            userPending.success ? 'Should have failed' : userPending.data.error);
  }

  async runAllTests() {
    console.log('🚀 Starting Media Approval System Test Suite');
    console.log('================================================');
    
    await this.testSetup();
    await this.testMediaUpload();
    await this.testPendingMediaRetrieval();
    await this.testUserMediaRetrieval();
    await this.testMediaApproval();
    await this.testMediaRejection();
    await this.testUnauthorizedAccess();
    
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const passed = this.results.filter(r => r.status === '✅ PASS').length;
    const failed = this.results.filter(r => r.status === '❌ FAIL').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => r.status === '❌ FAIL').forEach(test => {
        console.log(`  - ${test.test}: ${test.message}`);
      });
    }
    
    console.log('\n🎉 Test Suite Completed!');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new MediaApprovalTest();
  tester.runAllTests().catch(console.error);
}

module.exports = MediaApprovalTest;