const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFavoritesAPI() {
  console.log('=== Testing Favorites API Endpoint ===');
  
  try {
    // Test the favorites endpoint
    const response = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGJhdGhpbmlib25hLmNvLnphIiwiaWF0IjoxNzA4NDYwMDAwLCJleHAiOjE3MDg0NjM2MDB9.abc123',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Favorites endpoint working correctly');
      console.log('Favorited media IDs:', data.favoritedMediaIds);
    } else {
      console.log('❌ Favorites endpoint failed');
      console.log('Error:', data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error testing favorites API:', error);
  }
}

testFavoritesAPI();