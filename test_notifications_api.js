require('dotenv').config();
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

// Create tokens for both users
const createToken = (email, role = 'USER') => {
    return jwt.sign(
        { email, role },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
        { expiresIn: '24h' }
    );
};

async function testNotificationsAPI() {
    console.log('=== NOTIFICATIONS API TEST ===\n');
    
    const baseUrl = 'http://localhost:5000/api';
    
    // Test as content owner (who should have notifications)
    const contentOwnerToken = createToken('terrencekgetedi@gmail.com', 'USER');
    console.log('Testing as content owner (terrencekgetedi@gmail.com)...');
    
    try {
        const response = await fetch(`${baseUrl}/notifications`, {
            headers: {
                'Authorization': `Bearer ${contentOwnerToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Notifications API working!');
            console.log(`📊 Found ${result.notifications.length} notifications`);
            console.log('📋 Recent notifications:');
            
            result.notifications.forEach((notif, index) => {
                console.log(`   ${index + 1}. ${notif.notification_type}: ${notif.message}`);
            });
        } else {
            console.log('❌ API Error:', result);
        }
        
    } catch (error) {
        console.log('❌ Request failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test as actor (who should have no notifications)
    const actorToken = createToken('admin@gmail.com', 'ADMIN');
    console.log('Testing as actor (admin@gmail.com)...');
    
    try {
        const response = await fetch(`${baseUrl}/notifications`, {
            headers: {
                'Authorization': `Bearer ${actorToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Notifications API working!');
            console.log(`📊 Found ${result.notifications.length} notifications (should be 0)`);
            
            if (result.notifications.length === 0) {
                console.log('✅ Correct: Actor has no notifications (they perform actions, not receive them)');
            } else {
                console.log('⚠️  Unexpected: Actor has notifications');
            }
        } else {
            console.log('❌ API Error:', result);
        }
        
    } catch (error) {
        console.log('❌ Request failed:', error.message);
    }
    
    console.log('\n✅ Notifications API Test Complete!');
}

// Run the test
testNotificationsAPI().catch(console.error);