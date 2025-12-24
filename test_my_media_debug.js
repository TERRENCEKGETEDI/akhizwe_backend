const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testMyMediaDebug() {
  const API_URL = 'http://localhost:5000/api';
  
  try {
    console.log('Testing /media/my endpoint...\n');
    
    // First, log in to get a token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      phone: '0712345678',
      password: 'password'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    console.log('Token:', token.substring(0, 20) + '...');
    
    // Test the /media/my endpoint with detailed error handling
    console.log('\n2. Testing /media/my endpoint...');
    try {
      const myMediaResponse = await axios.get(`${API_URL}/media/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✓ /media/my endpoint successful');
      console.log(`Found ${myMediaResponse.data.media.length} media items`);
      
      // Show user's media details
      myMediaResponse.data.media.forEach((media, index) => {
        console.log(`  ${index + 1}. ${media.title} (${media.media_type}) - ${media.is_approved ? 'Approved' : 'Pending'}`);
      });
      
    } catch (error) {
      console.log('❌ /media/my endpoint failed:');
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Data:', error.response?.data);
      console.log('Headers:', error.response?.headers);
      
      // Also test if we can access other authenticated endpoints
      console.log('\n3. Testing other authenticated endpoints...');
      
      // Test /media/favorites
      try {
        const favoritesResponse = await axios.get(`${API_URL}/media/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✓ /media/favorites works');
      } catch (favError) {
        console.log('❌ /media/favorites failed:', favError.response?.status, favError.response?.data);
      }
      
      // Test /media/liked
      try {
        const likedResponse = await axios.get(`${API_URL}/media/liked`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✓ /media/liked works');
      } catch (likedError) {
        console.log('❌ /media/liked failed:', likedError.response?.status, likedError.response?.data);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testMyMediaDebug();