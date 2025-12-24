require('dotenv').config();
const fetch = require('node-fetch');

// Mock JWT token for testing (normally this would come from authentication)
const createMockToken = (email, role = 'USER') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { email, role },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
        { expiresIn: '24h' }
    );
};

// Test configuration
const config = {
    baseUrl: 'http://localhost:3000/api',
    testUser: {
        email: 'admin@gmail.com',
        token: createMockToken('admin@gmail.com', 'ADMIN')
    },
    targetMedia: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c',
    targetUser: 'terrencekgetedi@gmail.com'
};

async function makeAuthenticatedRequest(endpoint, method = 'GET', data = null) {
    const url = `${config.baseUrl}${endpoint}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${config.testUser.token}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        const result = await response.json();
        return { success: response.ok, status: response.status, data: result };
    } catch (error) {
        console.error(`API Error (${method} ${endpoint}):`, error.message);
        return { success: false, error: error.message };
    }
}

async function getNotificationCount() {
    const pool = require('./src/db');
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_email = $1',
            [config.targetUser]
        );
        return parseInt(result.rows[0].count);
    } catch (error) {
        console.error('Error getting notification count:', error);
        return -1;
    } finally {
        await pool.end();
    }
}

async function getInteractionCount(type) {
    const pool = require('./src/db');
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM media_interactions WHERE media_id = $1 AND interaction_type = $2',
            [config.targetMedia, type]
        );
        return parseInt(result.rows[0].count);
    } catch (error) {
        console.error('Error getting interaction count:', error);
        return -1;
    } finally {
        await pool.end();
    }
}

async function testLikeNotification() {
    console.log('\n🧪 Testing LIKE notification...');
    
    const beforeCount = await getNotificationCount();
    const beforeLikes = await getInteractionCount('LIKE');
    
    console.log(`Before: ${beforeCount} notifications, ${beforeLikes} likes`);
    
    const result = await makeAuthenticatedRequest(`/media/${config.targetMedia}/like`, 'POST');
    
    if (result.success) {
        console.log('✅ Like API call successful');
        
        // Wait a moment for database update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterCount = await getNotificationCount();
        const afterLikes = await getInteractionCount('LIKE');
        
        console.log(`After: ${afterCount} notifications, ${afterLikes} likes`);
        
        if (afterCount > beforeCount) {
            console.log('✅ NEW NOTIFICATION CREATED for LIKE');
        } else if (afterLikes > beforeLikes) {
            console.log('⚠️  Like recorded but no notification (likely spam prevention)');
        } else {
            console.log('❌ No like or notification recorded');
        }
    } else {
        console.log('❌ Like API call failed:', result.data || result.error);
    }
}

async function testFavoriteNotification() {
    console.log('\n🧪 Testing FAVORITE notification...');
    
    const beforeCount = await getNotificationCount();
    const beforeFavorites = await getInteractionCount('FAVORITE');
    
    console.log(`Before: ${beforeCount} notifications, ${beforeFavorites} favorites`);
    
    const result = await makeAuthenticatedRequest(`/media/${config.targetMedia}/favorite`, 'POST');
    
    if (result.success) {
        console.log('✅ Favorite API call successful');
        
        // Wait a moment for database update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterCount = await getNotificationCount();
        const afterFavorites = await getInteractionCount('FAVORITE');
        
        console.log(`After: ${afterCount} notifications, ${afterFavorites} favorites`);
        
        if (afterCount > beforeCount) {
            console.log('✅ NEW NOTIFICATION CREATED for FAVORITE');
        } else if (afterFavorites > beforeFavorites) {
            console.log('⚠️  Favorite recorded but no notification (likely spam prevention)');
        } else {
            console.log('❌ No favorite or notification recorded');
        }
    } else {
        console.log('❌ Favorite API call failed:', result.data || result.error);
    }
}

async function testCommentNotification() {
    console.log('\n🧪 Testing COMMENT notification...');
    
    const beforeCount = await getNotificationCount();
    
    console.log(`Before: ${beforeCount} notifications`);
    
    const commentData = {
        comment_text: 'This is a test comment from API test!'
    };
    
    const result = await makeAuthenticatedRequest(`/media/${config.targetMedia}/comment`, 'POST', commentData);
    
    if (result.success) {
        console.log('✅ Comment API call successful');
        
        // Wait a moment for database update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterCount = await getNotificationCount();
        
        console.log(`After: ${afterCount} notifications`);
        
        if (afterCount > beforeCount) {
            console.log('✅ NEW NOTIFICATION CREATED for COMMENT');
        } else {
            console.log('❌ No notification created for comment');
        }
    } else {
        console.log('❌ Comment API call failed:', result.data || result.error);
    }
}

async function runNotificationTests() {
    console.log('=== API NOTIFICATION INTEGRATION TEST ===');
    console.log(`Target Media: ${config.targetMedia}`);
    console.log(`Test User: ${config.testUser.email}`);
    console.log(`Notification Recipient: ${config.targetUser}`);
    
    // Test each notification type
    await testLikeNotification();
    await testFavoriteNotification();
    await testCommentNotification();
    
    console.log('\n=== FINAL NOTIFICATION SUMMARY ===');
    const finalCount = await getNotificationCount();
    console.log(`Total notifications for ${config.targetUser}: ${finalCount}`);
    
    console.log('\n✅ API Notification Integration Test Complete!');
}

// Run the tests
runNotificationTests().catch(console.error);