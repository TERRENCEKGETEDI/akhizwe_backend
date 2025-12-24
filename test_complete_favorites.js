const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const pool = require('./src/db');
const bcrypt = require('bcryptjs');

async function testCompleteFavoritesWorkflow() {
  console.log('=== Testing Complete Favorites Workflow ===');
  
  try {
    // Create a test user with known credentials
    console.log('\n--- Setting up test user ---');
    const testUserEmail = 'completetest@example.com';
    const testUserPhone = '0719998887';
    const testPassword = 'completetest123';
    
    // Clean up any existing test user
    await pool.query('DELETE FROM users WHERE email = $1 OR phone = $2', [testUserEmail, testUserPhone]);
    
    // Create user
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    await pool.query(
      'INSERT INTO users (email, full_name, phone, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6)',
      [testUserEmail, 'Complete Test User', testUserPhone, hashedPassword, 'USER', 100]
    );
    
    console.log('✅ Test user created');
    
    // Login to get token
    console.log('\n--- Step 1: Login to get token ---');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testUserPhone,
        password: testPassword
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginData);
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Got authentication token');
    
    // Step 2: Get initial favorites (should be empty)
    console.log('\n--- Step 2: Get initial favorites (should be empty) ---');
    const getFavoritesResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const getFavoritesData = await getFavoritesResponse.json();
    console.log('Get favorites status:', getFavoritesResponse.status);
    console.log('Initial favorites:', getFavoritesData.favoritedMediaIds);
    
    if (!getFavoritesResponse.ok) {
      console.log('❌ Failed to get initial favorites');
      return;
    }
    
    // Step 3: Get some media to favorite
    console.log('\n--- Step 3: Get media to favorite ---');
    const mediaResponse = await fetch('http://localhost:5000/api/media?limit=5');
    const mediaData = await mediaResponse.json();
    console.log('Available media count:', mediaData.media?.length || 0);
    
    if (!mediaData.media || mediaData.media.length === 0) {
      console.log('❌ No media available to test with');
      return;
    }
    
    const testMediaId = mediaData.media[0].media_id;
    console.log('Using media ID for testing:', testMediaId);
    
    // Step 4: Add favorite
    console.log('\n--- Step 4: Add favorite ---');
    const addFavoriteResponse = await fetch(`http://localhost:5000/api/media/${testMediaId}/favorite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const addFavoriteData = await addFavoriteResponse.json();
    console.log('Add favorite status:', addFavoriteResponse.status);
    console.log('Add favorite response:', addFavoriteData);
    
    if (!addFavoriteResponse.ok) {
      console.log('❌ Failed to add favorite');
      return;
    }
    
    // Step 5: Get favorites again (should now include the new favorite)
    console.log('\n--- Step 5: Get favorites after adding ---');
    const getFavoritesAfterResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const getFavoritesAfterData = await getFavoritesAfterResponse.json();
    console.log('Get favorites after status:', getFavoritesAfterResponse.status);
    console.log('Favorites after adding:', getFavoritesAfterData.favoritedMediaIds);
    
    if (!getFavoritesAfterResponse.ok) {
      console.log('❌ Failed to get favorites after adding');
      return;
    }
    
    const favoritesAfterAdd = getFavoritesAfterData.favoritedMediaIds || [];
    if (!favoritesAfterAdd.includes(testMediaId)) {
      console.log('❌ Favorite was not persisted correctly');
      return;
    }
    
    console.log('✅ Favorite was successfully added and persisted');
    
    // Step 6: Remove favorite
    console.log('\n--- Step 6: Remove favorite ---');
    const removeFavoriteResponse = await fetch(`http://localhost:5000/api/media/${testMediaId}/favorite`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const removeFavoriteData = await removeFavoriteResponse.json();
    console.log('Remove favorite status:', removeFavoriteResponse.status);
    console.log('Remove favorite response:', removeFavoriteData);
    
    if (!removeFavoriteResponse.ok) {
      console.log('❌ Failed to remove favorite');
      return;
    }
    
    // Step 7: Get favorites again (should be empty again)
    console.log('\n--- Step 7: Get favorites after removing ---');
    const getFavoritesFinalResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const getFavoritesFinalData = await getFavoritesFinalResponse.json();
    console.log('Get favorites final status:', getFavoritesFinalResponse.status);
    console.log('Favorites after removing:', getFavoritesFinalData.favoritedMediaIds);
    
    if (!getFavoritesFinalResponse.ok) {
      console.log('❌ Failed to get favorites after removing');
      return;
    }
    
    const favoritesFinal = getFavoritesFinalData.favoritedMediaIds || [];
    if (favoritesFinal.includes(testMediaId)) {
      console.log('❌ Favorite was not removed correctly');
      return;
    }
    
    console.log('✅ Favorite was successfully removed');
    
    // Step 8: Test adding favorite again to ensure toggle works both ways
    console.log('\n--- Step 8: Test adding favorite again ---');
    const addFavoriteAgainResponse = await fetch(`http://localhost:5000/api/media/${testMediaId}/favorite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const addFavoriteAgainData = await addFavoriteAgainResponse.json();
    console.log('Add favorite again status:', addFavoriteAgainResponse.status);
    
    if (!addFavoriteAgainResponse.ok) {
      console.log('❌ Failed to add favorite again');
      return;
    }
    
    // Final check
    const getFavoritesFinalCheckResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const getFavoritesFinalCheckData = await getFavoritesFinalCheckResponse.json();
    const favoritesFinalCheck = getFavoritesFinalCheckData.favoritedMediaIds || [];
    
    console.log('\n=== FINAL RESULTS ===');
    console.log('✅ Complete favorites workflow test PASSED');
    console.log('✅ Authentication working correctly');
    console.log('✅ Add favorite working correctly');
    console.log('✅ Remove favorite working correctly');
    console.log('✅ Data persistence working correctly');
    console.log('✅ Toggle functionality working correctly');
    console.log('✅ Final favorites count:', favoritesFinalCheck.length);
    
    // Cleanup
    await pool.query('DELETE FROM users WHERE email = $1', [testUserEmail]);
    console.log('\n✅ Test user cleaned up');
    
  } catch (error) {
    console.error('❌ Error during complete favorites workflow test:', error);
  } finally {
    await pool.end();
  }
}

testCompleteFavoritesWorkflow();