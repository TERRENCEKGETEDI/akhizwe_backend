const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const pool = require('./src/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testFavoritesWorking() {
  console.log('=== Testing Favorites with Known User ===');
  
  try {
    // Create a test user with known password
    console.log('\n--- Creating test user ---');
    const testUserEmail = 'favoritetest@example.com';
    const testUserPhone = '0719876543';
    const testPassword = 'testpass123';
    
    // Check if user exists and delete if needed
    await pool.query('DELETE FROM users WHERE email = $1 OR phone = $2', [testUserEmail, testUserPhone]);
    
    // Create user
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    await pool.query(
      'INSERT INTO users (email, full_name, phone, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6)',
      [testUserEmail, 'Favorite Test User', testUserPhone, hashedPassword, 'USER', 100]
    );
    
    console.log('✅ Test user created');
    console.log('Phone:', testUserPhone);
    console.log('Password:', testPassword);
    
    // Login to get token
    console.log('\n--- Login to get token ---');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testUserPhone,
        password: testPassword
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login status:', loginResponse.status);
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginData);
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Got token');
    
    // Test 1: Get favorites (should be empty initially)
    console.log('\n--- Test 1: Get initial favorites ---');
    const getFavoritesResponse = await fetch('http://localhost:5000/api/media/favorites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const getFavoritesData = await getFavoritesResponse.json();
    console.log('Get favorites status:', getFavoritesResponse.status);
    console.log('Get favorites data:', getFavoritesData);
    
    // Test 2: Get some media to favorite
    console.log('\n--- Test 2: Get media to favorite ---');
    const mediaResponse = await fetch('http://localhost:5000/api/media?limit=3');
    const mediaData = await mediaResponse.json();
    console.log('Media count:', mediaData.media?.length || 0);
    
    if (mediaData.media && mediaData.media.length > 0) {
      const mediaId = mediaData.media[0].media_id;
      console.log('Using media ID for testing:', mediaId);
      
      // Test 3: Add favorite
      console.log('\n--- Test 3: Add favorite ---');
      const addFavoriteResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const addFavoriteData = await addFavoriteResponse.json();
      console.log('Add favorite status:', addFavoriteResponse.status);
      console.log('Add favorite data:', addFavoriteData);
      
      // Test 4: Get favorites again (should now include the new favorite)
      console.log('\n--- Test 4: Get favorites after adding ---');
      const getFavoritesAfterResponse = await fetch('http://localhost:5000/api/media/favorites', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const getFavoritesAfterData = await getFavoritesAfterResponse.json();
      console.log('Get favorites after status:', getFavoritesAfterResponse.status);
      console.log('Get favorites after data:', getFavoritesAfterData);
      
      // Test 5: Remove favorite
      console.log('\n--- Test 5: Remove favorite ---');
      const removeFavoriteResponse = await fetch(`http://localhost:5000/api/media/${mediaId}/favorite`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const removeFavoriteData = await removeFavoriteResponse.json();
      console.log('Remove favorite status:', removeFavoriteResponse.status);
      console.log('Remove favorite data:', removeFavoriteData);
      
      // Test 6: Get favorites again (should be empty again)
      console.log('\n--- Test 6: Get favorites after removing ---');
      const getFavoritesFinalResponse = await fetch('http://localhost:5000/api/media/favorites', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const getFavoritesFinalData = await getFavoritesFinalResponse.json();
      console.log('Get favorites final status:', getFavoritesFinalResponse.status);
      console.log('Get favorites final data:', getFavoritesFinalData);
      
    } else {
      console.log('❌ No media found to test with');
    }
    
    // Cleanup
    await pool.query('DELETE FROM users WHERE email = $1', [testUserEmail]);
    console.log('\n✅ Test user cleaned up');
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await pool.end();
  }
}

testFavoritesWorking();