const fetch = global.fetch || require('node-fetch');

// Test if the /my route is working
async function testMyMediaRoute() {
  try {
    console.log('🧪 Testing /my media route...\n');
    
    // First, let's try to register and login to get a token
    const registerResponse = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        surname: 'User',
        phone: '0712345678',
        email: 'testuser' + Date.now() + '@mail.com',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });
    
    if (registerResponse.ok) {
      console.log('✅ User registered successfully');
    } else {
      console.log('⚠️ User registration failed (might already exist)');
    }
    
    // Login to get token
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '0712345678',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed');
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

testMyMediaRoute().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal test error:', error);
  process.exit(1);
});