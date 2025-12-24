// Test if the /my route exists by checking response without auth
async function testRouteExists() {
  try {
    console.log('🧪 Testing if /my route exists...\n');
    
    // Test the /my route without authentication
    const myMediaResponse = await fetch('http://localhost:5000/api/media/my', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 /my route response status: ${myMediaResponse.status}`);
    
    if (myMediaResponse.status === 401) {
      console.log('✅ /my route exists! (401 = unauthorized, which is expected)');
    } else if (myMediaResponse.status === 404) {
      console.log('❌ /my route does not exist (404 = not found)');
    } else {
      const errorText = await myMediaResponse.text();
      console.log('⚠️ Unexpected response:', errorText);
    }
    
    // Also test a route we know exists
    console.log('\n🧪 Testing a known route (/media)...');
    const mediaResponse = await fetch('http://localhost:5000/api/media', {
      method: 'GET'
    });
    
    console.log(`📡 /media route response status: ${mediaResponse.status}`);
    
    if (mediaResponse.status === 200) {
      console.log('✅ /media route works correctly');
    } else {
      console.log('❌ /media route failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to server. Make sure the backend is running on port 5000');
    }
  }
}

testRouteExists().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal test error:', error);
  process.exit(1);
});