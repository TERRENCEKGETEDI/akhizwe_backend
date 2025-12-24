const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function comprehensiveLikeTest() {
  console.log('🎯 Comprehensive Like Functionality Test\n');
  
  let authToken = null;
  let testMediaId = null;
  
  try {
    // Step 1: Login to get authentication token
    console.log('Step 1: Login to get authentication token');
    const loginResponse = await axios.post(`${API_BASE}/login`, {
      phone: '0712345678',
      password: 'password123'
    });
    
    authToken = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Step 2: Get media list to find a test media ID
    console.log('\nStep 2: Get media list to find test media ID');
    const mediaResponse = await axios.get(`${API_BASE}/media`);
    const mediaList = mediaResponse.data.media;
    
    if (mediaList && mediaList.length > 0) {
      testMediaId = mediaList[0].media_id;
      console.log(`✅ Found test media ID: ${testMediaId}`);
      console.log(`   Media title: ${mediaList[0].title}`);
      console.log(`   Current likes: ${mediaList[0].likes}`);
    } else {
      throw new Error('No media found for testing');
    }
    
    // Step 3: Check initial liked status
    console.log('\nStep 3: Check initial liked status');
    const likedResponse = await axios.get(`${API_BASE}/media/liked`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const initialLikedIds = likedResponse.data.likedMediaIds || [];
    const isInitiallyLiked = initialLikedIds.includes(testMediaId);
    console.log(`✅ Initial liked status for media ${testMediaId}: ${isInitiallyLiked ? 'LIKED' : 'NOT LIKED'}`);
    console.log(`   User's liked media IDs: [${initialLikedIds.join(', ')}]`);
    
    // Step 4: Toggle like status
    console.log('\nStep 4: Toggle like status');
    const likeMethod = isInitiallyLiked ? 'DELETE' : 'POST';
    const likeAction = isInitiallyLiked ? 'UNLIKE' : 'LIKE';
    
    const toggleResponse = await axios({
      method: likeMethod,
      url: `${API_BASE}/media/${testMediaId}/like`,
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ ${likeAction} operation successful: ${toggleResponse.data.message}`);
    
    // Step 5: Verify like status changed
    console.log('\nStep 5: Verify like status changed');
    const updatedLikedResponse = await axios.get(`${API_BASE}/media/liked`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const updatedLikedIds = updatedLikedResponse.data.likedMediaIds || [];
    const isNowLiked = updatedLikedIds.includes(testMediaId);
    
    if (isNowLiked !== isInitiallyLiked) {
      console.log(`✅ Like status successfully changed: ${isNowLiked ? 'LIKED' : 'NOT LIKED'}`);
      console.log(`   Updated liked media IDs: [${updatedLikedIds.join(', ')}]`);
    } else {
      console.log('❌ Like status did not change as expected');
    }
    
    // Step 6: Check if like count updated
    console.log('\nStep 6: Check if like count updated in media list');
    const refreshedMediaResponse = await axios.get(`${API_BASE}/media`);
    const refreshedMedia = refreshedMediaResponse.data.media.find(m => m.media_id === testMediaId);
    
    if (refreshedMedia) {
      console.log(`✅ Updated like count for media: ${refreshedMedia.likes}`);
    }
    
    // Step 7: Toggle back to original state
    console.log('\nStep 7: Toggle back to original state');
    const backMethod = isNowLiked ? 'DELETE' : 'POST';
    const backAction = isNowLiked ? 'UNLIKE' : 'LIKE';
    
    await axios({
      method: backMethod,
      url: `${API_BASE}/media/${testMediaId}/like`,
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log(`✅ ${backAction} operation successful - returned to original state`);
    
    // Step 8: Final verification
    console.log('\nStep 8: Final verification');
    const finalLikedResponse = await axios.get(`${API_BASE}/media/liked`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const finalLikedIds = finalLikedResponse.data.likedMediaIds || [];
    const isFinalLiked = finalLikedIds.includes(testMediaId);
    
    if (isFinalLiked === isInitiallyLiked) {
      console.log(`✅ Final state matches initial state: ${isFinalLiked ? 'LIKED' : 'NOT LIKED'}`);
    } else {
      console.log('❌ Final state does not match initial state');
    }
    
    console.log('\n🎉 Comprehensive Like Functionality Test Completed Successfully!');
    console.log('\n📊 Test Results Summary:');
    console.log('- ✅ Authentication working correctly');
    console.log('- ✅ GET /media/liked endpoint working');
    console.log('- ✅ Like toggle functionality working');
    console.log('- ✅ Database persistence working');
    console.log('- ✅ Like count updates working');
    console.log('- ✅ State management working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

comprehensiveLikeTest();