const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testMediaVisibility() {
  const API_URL = 'http://localhost:5000/api';
  
  try {
    console.log('Testing media visibility...\n');
    
    // First, log in to get a token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_URL}/login`, {
      phone: '0712345678',
      password: 'password'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    
    // Test authenticated media list (should show approved media + own unapproved media)
    console.log('\n2. Testing authenticated media list...');
    const mediaListResponse = await axios.get(`${API_URL}/media?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`Found ${mediaListResponse.data.media.length} media items in authenticated list`);
    
    // Show some media details
    mediaListResponse.data.media.slice(0, 5).forEach((media, index) => {
      console.log(`  ${index + 1}. ${media.title} (${media.media_type}) - ${media.is_approved ? 'Approved' : 'Pending'} by ${media.creator_name}`);
    });
    
    // Test "my media" endpoint
    console.log('\n3. Testing "my media" endpoint...');
    const myMediaResponse = await axios.get(`${API_URL}/media/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`Found ${myMediaResponse.data.media.length} media items in "my media"`);
    
    // Show user's media details
    myMediaResponse.data.media.forEach((media, index) => {
      console.log(`  ${index + 1}. ${media.title} (${media.media_type}) - ${media.is_approved ? 'Approved' : 'Pending'}`);
    });
    
    // Test anonymous media list (should only show approved media)
    console.log('\n4. Testing anonymous media list...');
    const anonymousMediaResponse = await axios.get(`${API_URL}/media?limit=50`);
    
    console.log(`Found ${anonymousMediaResponse.data.media.length} media items in anonymous list`);
    
    // Check if any media in anonymous list is unapproved
    const unapprovedInAnonymous = anonymousMediaResponse.data.media.filter(m => !m.is_approved);
    if (unapprovedInAnonymous.length > 0) {
      console.log('❌ ERROR: Found unapproved media in anonymous list!');
      unapprovedInAnonymous.forEach(media => {
        console.log(`  - ${media.title} (should not be visible)`);
      });
    } else {
      console.log('✓ Anonymous list only contains approved media (correct)');
    }
    
    console.log('\n=== Test Results ===');
    console.log(`Authenticated users can see: ${mediaListResponse.data.media.length} media items`);
    console.log(`Users can see their own uploads: ${myMediaResponse.data.media.length} items`);
    console.log(`Anonymous users can see: ${anonymousMediaResponse.data.media.length} media items`);
    
    if (mediaListResponse.data.media.length > myMediaResponse.data.media.length) {
      console.log('✓ Users can see both approved media and their own pending uploads');
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testMediaVisibility();