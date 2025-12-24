const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugFavoriteAPI() {
  console.log('=== Debugging Favorites API ===');
  
  try {
    // Test 1: Check if server is running
    console.log('\n--- Test 1: Server Health Check ---');
    const healthResponse = await fetch('http://localhost:5000/api/media');
    console.log('Server health check status:', healthResponse.status);
    
    // Test 2: Try favorites endpoint without auth
    console.log('\n--- Test 2: Favorites without Auth ---');
    try {
      const noAuthResponse = await fetch('http://localhost:5000/api/media/favorites');
      console.log('No auth response status:', noAuthResponse.status);
      const noAuthData = await noAuthResponse.json();
      console.log('No auth response data:', noAuthData);
    } catch (error) {
      console.log('No auth error:', error.message);
    }
    
    // Test 3: Try with invalid token
    console.log('\n--- Test 3: Favorites with Invalid Token ---');
    try {
      const invalidTokenResponse = await fetch('http://localhost:5000/api/media/favorites', {
        headers: {
          'Authorization': 'Bearer invalid_token',
          'Content-Type': 'application/json'
        }
      });
      console.log('Invalid token response status:', invalidTokenResponse.status);
      const invalidTokenData = await invalidTokenResponse.json();
      console.log('Invalid token response data:', invalidTokenData);
    } catch (error) {
      console.log('Invalid token error:', error.message);
    }
    
    // Test 4: Try the specific media endpoint mentioned in the error
    console.log('\n--- Test 4: Testing Media Endpoint ---');
    try {
      const mediaResponse = await fetch('http://localhost:5000/api/media/favorites', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGJhdGhpbmlib25hLmNvLnphIiwiaWF0IjoxNzA4NDYwMDAwLCJleHAiOjE3MDg0NjM2MDB9.abc123',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Favorites endpoint response status:', mediaResponse.status);
      console.log('Favorites endpoint response headers:', Object.fromEntries(mediaResponse.headers.entries()));
      
      const data = await mediaResponse.json();
      console.log('Favorites endpoint response data:', data);
      
      if (mediaResponse.ok) {
        console.log('✅ Favorites endpoint working correctly');
        console.log('Favorited media IDs:', data.favoritedMediaIds);
      } else {
        console.log('❌ Favorites endpoint failed');
        console.log('Error:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.log('Favorites endpoint error:', error.message);
    }
    
  } catch (error) {
    console.error('Error during API debugging:', error);
  }
}

debugFavoriteAPI();