const io = require('socket.io-client');

async function debugWebSocketConnection() {
    console.log('🔍 Debugging WebSocket connection...\n');

    try {
        // Test WebSocket connection
        const token = 'test-token'; // This would come from localStorage in real app
        const socket = io('http://localhost:5000', {
            auth: {
                token: token
            }
        });

        socket.on('connect', () => {
            console.log('✅ WebSocket connected successfully');
            console.log('   Socket ID:', socket.id);
        });

        socket.on('connect_error', (error) => {
            console.log('❌ WebSocket connection error:', error.message);
        });

        socket.on('new_notification', (notification) => {
            console.log('📨 Received notification:', notification);
        });

        socket.on('error', (error) => {
            console.log('❌ WebSocket error:', error);
        });

        // Wait a moment then emit test event
        setTimeout(() => {
            console.log('\n📤 Emitting test event...');
            socket.emit('get_notifications');
        }, 1000);

        // Keep connection alive for testing
        setTimeout(() => {
            console.log('\n🔚 Closing connection...');
            socket.close();
            process.exit(0);
        }, 5000);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugWebSocketConnection();