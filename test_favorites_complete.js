const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFavoritesWithFreshToken() {
  console.log('=== Testing Favorites with Fresh Token ===');
  
  try {
    // Step 1: Login to get a fresh token
    console.log('\n--- Step 1: Login to get fresh token ---');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0719999999',
        password: 'password123'
      })
    });
    
    console.log('Login response status:', loginResponse.status);
    const loginData = await loginResponse.json();
    console.log('Login response data:', loginData);
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Got fresh token:', token.substring(0, 20) + '...');
    
    // Step 2: Test the favorites endpoint with the fresh token
    console.log('\n--- Step 2: Test favorites endpoint with fresh token ---');
    const favoritesResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Favorites response status:', favoritesResponse.status);
    const favoritesData = await favoritesResponse.json();
    console.log('Favorites response data:', favoritesData);
    
    if (favoritesResponse.ok) {
      console.log('✅ Favorites endpoint working correctly');
      console.log('Favorited media IDs:', favoritesData.favoritedMediaIds);
    } else {
      console.log('❌ Favorites endpoint failed');
      console.log('Error:', favoritesData.error || 'Unknown error');
    }
    
    // Step 3: Test adding a favorite
    console.log('\n--- Step 3: Test adding a favorite ---');
    // First get some media to favorite
    const mediaResponse = await fetch('http://localhost:5000/api/media?limit=1');
    const mediaData = await mediaResponse.json();
    
    if (mediaData.media && mediaData.media.length > 0) {
      const mediaId = mediaData.media[0].media_id;
      console.log('Testing favorite with media ID:', mediaId);
      
      const addFavoriteResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Add favorite response status:', addFavoriteResponse.status);
      const addFavoriteData = await addFavoriteResponse.json();
      console.log('Add favorite response data:', addFavoriteData);
      
      // Step 4: Test removing a favorite
      console.log('\n--- Step 4: Test removing a favorite ---');
      const removeFavoriteResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Remove favorite response status:', removeFavoriteResponse.status);
      const removeFavoriteData = await removeFavoriteResponse.json();
      console.log('Remove favorite response data:', removeFavoriteData);
    } else {
      console.log('❌ No media found to test with');
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

testFavoritesWithFreshToken();