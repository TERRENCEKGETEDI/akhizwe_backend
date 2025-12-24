const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testSimpleAPI() {
  console.log('=== Testing Simple API Endpoints ===');
  
  try {
    // Test the media list endpoint (should work without auth)
    console.log('\n--- Testing media list endpoint ---');
    const response1 = await fetch('http://localhost:5000/api/media');
    console.log('Media list status:', response1.status);
    const data1 = await response1.json();
    console.log('Media list data:', data1);
    
    // Test if the media routes are loaded at all
    console.log('\n--- Testing if media routes exist ---');
    const response2 = await fetch('http://localhost:5000/api/media?page=1&limit=10');
    console.log('Media with params status:', response2.status);
    const data2 = await response2.json();
    console.log('Media with params data:', data2);
    
  } catch (error) {
    console.error('Error testing simple API:', error);
  }
}

testSimpleAPI();