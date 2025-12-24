require('dotenv').config();
const express = require('express');
const mediaRoutes = require('./src/routes/media');

// Mock request/response objects
function createMockReq(overrides = {}) {
    return {
        user: { email: 'admin@gmail.com', role: 'ADMIN' },
        params: {},
        body: {},
        query: {},
        ...overrides
    };
}

function createMockRes() {
    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.responseData = data;
            return this;
        },
        send: function(data) {
            this.responseData = data;
            return this;
        }
    };
    return res;
}

// Test notification tracking
let notificationCount = 0;
let interactionCount = 0;

async function getNotificationCount() {
    const pool = require('./src/db');
    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_email = $1',
            ['terrencekgetedi@gmail.com']
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
            ['a32b8014-a29c-4867-8d5b-b7b6e60d309c', type]
        );
        return parseInt(result.rows[0].count);
    } catch (error) {
        console.error('Error getting interaction count:', error);
        return -1;
    } finally {
        await pool.end();
    }
}

async function testDirectLikeRoute() {
    console.log('\n🧪 Testing LIKE route directly...');
    
    const beforeNotifications = await getNotificationCount();
    const beforeLikes = await getInteractionCount('LIKE');
    
    console.log(`Before: ${beforeNotifications} notifications, ${beforeLikes} likes`);
    
    try {
        // Create mock request/response
        const req = createMockReq({
            params: { id: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c' }
        });
        const res = createMockRes();
        
        // Call the like route handler directly
        await mediaRoutes.handleRequest('POST', '/a32b8014-a29c-4867-8d5b-b7b6e60d309c/like', req, res);
        
        console.log('✅ Like route executed');
        
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterNotifications = await getNotificationCount();
        const afterLikes = await getInteractionCount('LIKE');
        
        console.log(`After: ${afterNotifications} notifications, ${afterLikes} likes`);
        
        if (afterNotifications > beforeNotifications) {
            console.log('✅ NEW NOTIFICATION CREATED for LIKE');
        } else if (afterLikes > beforeLikes) {
            console.log('⚠️  Like recorded but no notification (likely spam prevention)');
        } else {
            console.log('❌ No like or notification recorded');
        }
        
    } catch (error) {
        console.log('❌ Like route test failed:', error.message);
    }
}

async function testDirectFavoriteRoute() {
    console.log('\n🧪 Testing FAVORITE route directly...');
    
    const beforeNotifications = await getNotificationCount();
    const beforeFavorites = await getInteractionCount('FAVORITE');
    
    console.log(`Before: ${beforeNotifications} notifications, ${beforeFavorites} favorites`);
    
    try {
        // Create mock request/response
        const req = createMockReq({
            params: { id: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c' }
        });
        const res = createMockRes();
        
        // Call the favorite route handler directly
        await mediaRoutes.handleRequest('POST', '/a32b8014-a29c-4867-8d5b-b7b6e60d309c/favorite', req, res);
        
        console.log('✅ Favorite route executed');
        
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterNotifications = await getNotificationCount();
        const afterFavorites = await getInteractionCount('FAVORITE');
        
        console.log(`After: ${afterNotifications} notifications, ${afterFavorites} favorites`);
        
        if (afterNotifications > beforeNotifications) {
            console.log('✅ NEW NOTIFICATION CREATED for FAVORITE');
        } else if (afterFavorites > beforeFavorites) {
            console.log('⚠️  Favorite recorded but no notification (likely spam prevention)');
        } else {
            console.log('❌ No favorite or notification recorded');
        }
        
    } catch (error) {
        console.log('❌ Favorite route test failed:', error.message);
    }
}

async function testDirectCommentRoute() {
    console.log('\n🧪 Testing COMMENT route directly...');
    
    const beforeNotifications = await getNotificationCount();
    
    console.log(`Before: ${beforeNotifications} notifications`);
    
    try {
        // Create mock request/response
        const req = createMockReq({
            params: { id: 'a32b8014-a29c-4867-8d5b-b7b6e60d309c' },
            body: { comment_text: 'This is a test comment from direct route test!' }
        });
        const res = createMockRes();
        
        // Call the comment route handler directly
        await mediaRoutes.handleRequest('POST', '/a32b8014-a29c-4867-8d5b-b7b6e60d309c/comment', req, res);
        
        console.log('✅ Comment route executed');
        
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterNotifications = await getNotificationCount();
        
        console.log(`After: ${afterNotifications} notifications`);
        
        if (afterNotifications > beforeNotifications) {
            console.log('✅ NEW NOTIFICATION CREATED for COMMENT');
        } else {
            console.log('❌ No notification created for comment');
        }
        
    } catch (error) {
        console.log('❌ Comment route test failed:', error.message);
    }
}

async function runDirectRouteTests() {
    console.log('=== DIRECT ROUTE NOTIFICATION TEST ===');
    console.log('Testing media routes directly with mock requests...\n');
    
    await testDirectLikeRoute();
    await testDirectFavoriteRoute();
    await testDirectCommentRoute();
    
    console.log('\n=== FINAL SUMMARY ===');
    const finalNotifications = await getNotificationCount();
    console.log(`Total notifications: ${finalNotifications}`);
    
    console.log('\n✅ Direct Route Test Complete!');
}

// Run the tests
runDirectRouteTests().catch(console.error);