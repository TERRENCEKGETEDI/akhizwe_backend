

// Test if the /my route is working with existing user
async function testMyRouteSimple() {
  try {
    console.log('🧪 Testing /my media route with existing user...\n');
    
    // Use built-in fetch from Node.js 18+
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed. Trying with different credentials...');
      
      // Try with user1@mail.com user
      const loginResponse2 = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '0711111111', // Try different phone
          password: 'password123'
        })
      });
      
      if (!loginResponse2.ok) {
        console.log('❌ Both login attempts failed');
        return;
      }
      
      const loginData = await loginResponse2.json();
      const token = loginData.token;
      console.log('✅ Login successful with second attempt, got token');
      
      // Test the /my route
      const myMediaResponse = await fetch('http://localhost:5000/api/media/my', {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 /my route response status: ${myMediaResponse.status}`);
      
      if (myMediaResponse.ok) {
        const data = await myMediaResponse.json();
        console.log('✅ /my route is working!');
        console.log(`📊 Found ${data.media?.length || 0} media items`);
        console.log('📄 Response data:', JSON.stringify(data, null, 2));
      } else {
        const errorText = await myMediaResponse.text();
        console.log('❌ /my route failed');
        console.log('Error response:', errorText);
      }
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('✅ Login successful, got token');
    
    // Test the /my route
    const myMediaResponse = await fetch('http://localhost:5000/api/media/my', {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 /my route response status: ${myMediaResponse.status}`);
    
    if (myMediaResponse.ok) {
      const data = await myMediaResponse.json();
      console.log('✅ /my route is working!');
      console.log(`📊 Found ${data.media?.length || 0} media items`);
      console.log('📄 Response data:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await myMediaResponse.text();
      console.log('❌ /my route failed');
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to server. Make sure the backend is running on port 5000');
    }
  }
}

testMyRouteSimple().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal test error:', error);
  process.exit(1);
});