/**
 * Example WebSocket Client for Optimized Bridge Server
 * Demonstrates new features: heartbeat, reconnection, batching, buffering
 */

class BridgeClient {
    constructor(url = 'ws://localhost:8089') {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.reconnectInterval = 5000;
        this.reconnectTimer = null;
        this.clientId = null;
        this.config = null;
        this.pendingRequests = new Map();
        this.requestCounter = 0;
        this.subscriptions = new Map();
    }

    connect() {
        console.log('Connecting to bridge server...');
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
            console.log('Connected to bridge server');
            this.connected = true;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // Request any buffered messages from previous connection
            this.send({ type: 'get_buffered' });
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        this.ws.on('close', () => {
            console.log('Disconnected from bridge server');
            this.connected = false;
            this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
        });

        // Send ping every 10 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping' });
            }
        }, 10000);
    }

    scheduleReconnect() {
        if (!this.reconnectTimer) {
            console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        }
    }

    handleMessage(message) {
        const { type, requestId } = message;

        switch (type) {
            case 'connected':
                this.clientId = message.id;
                this.config = message.config;
                console.log('Connected with ID:', this.clientId);
                console.log('Server config:', this.config);
                break;

            case 'pong':
                // Heartbeat response
                break;

            case 'update':
                // Tag subscription update
                console.log('Tag update:', message.tagPath, message.data);
                const handler = this.subscriptions.get(message.tagPath);
                if (handler) handler(message.data);
                break;

            case 'subscribed':
                console.log('Subscribed to:', message.tagPath);
                break;

            case 'unsubscribed':
                console.log('Unsubscribed from:', message.tagPath);
                break;

            case 'subscribe_batch_result':
                console.log('Batch subscribe result:', message.count, 'tags');
                break;

            case 'data':
            case 'write_result':
            case 'read_batch_result':
                // Resolve pending request
                if (requestId && this.pendingRequests.has(requestId)) {
                    const { resolve } = this.pendingRequests.get(requestId);
                    resolve(message);
                    this.pendingRequests.delete(requestId);
                }
                break;

            case 'buffered_messages':
                console.log('Received buffered messages:', message.messages.length);
                message.messages.forEach(msg => this.handleMessage(msg));
                break;

            case 'error':
                console.error('Server error:', message.message);
                if (requestId && this.pendingRequests.has(requestId)) {
                    const { reject } = this.pendingRequests.get(requestId);
                    reject(new Error(message.message));
                    this.pendingRequests.delete(requestId);
                }
                break;

            case 'already_subscribed':
                console.log('Already subscribed to:', message.tagPath);
                break;

            default:
                console.log('Unknown message type:', type, message);
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, message not sent');
        }
    }

    generateRequestId() {
        return `req-${++this.requestCounter}-${Date.now()}`;
    }

    // Promise-based request with timeout
    request(message, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            message.requestId = requestId;

            this.pendingRequests.set(requestId, { resolve, reject });

            // Set timeout
            const timer = setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, timeout);

            // Clean up timer on resolution
            const originalResolve = resolve;
            const originalReject = reject;

            this.pendingRequests.set(requestId, {
                resolve: (value) => {
                    clearTimeout(timer);
                    originalResolve(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    originalReject(error);
                }
            });

            this.send(message);
        });
    }

    // Read single tag
    async readTag(tagPath, useCache = true) {
        const response = await this.request({
            type: 'read',
            payload: { tagPath, useCache }
        });
        return response.data;
    }

    // Read multiple tags at once (batched)
    async readTags(tagPaths) {
        const response = await this.request({
            type: 'read_batch',
            payload: { tagPaths }
        });
        return response.data;
    }

    // Write tag value
    async writeTag(tagPath, value) {
        const response = await this.request({
            type: 'write',
            payload: { tagPath, value }
        });
        return response.data;
    }

    // Subscribe to tag updates
    subscribe(tagPath, callback, interval = 1000) {
        this.subscriptions.set(tagPath, callback);
        this.send({
            type: 'subscribe',
            payload: { tagPath, interval }
        });
    }

    // Subscribe to multiple tags at once
    subscribeBatch(tags) {
        tags.forEach(tag => {
            if (tag.callback) {
                this.subscriptions.set(tag.tagPath, tag.callback);
            }
        });
        this.send({
            type: 'subscribe_batch',
            payload: {
                tags: tags.map(t => ({
                    tagPath: t.tagPath,
                    interval: t.interval || 1000
                }))
            }
        });
    }

    // Unsubscribe from tag
    unsubscribe(tagPath) {
        this.subscriptions.delete(tagPath);
        this.send({
            type: 'unsubscribe',
            payload: { tagPath }
        });
    }

    disconnect() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Usage example
async function example() {
    const client = new BridgeClient('ws://localhost:8089');
    client.connect();

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // Read single tag
        console.log('\n--- Single Tag Read ---');
        const value = await client.readTag('System/Time/CurrentTime');
        console.log('Tag value:', value);

        // Read multiple tags at once (efficient)
        console.log('\n--- Batch Tag Read ---');
        const values = await client.readTags([
            'System/Time/CurrentTime',
            'System/Memory/FreeMemory',
            'System/CPU/Load'
        ]);
        console.log('Batch values:', values);

        // Subscribe to updates
        console.log('\n--- Tag Subscriptions ---');
        client.subscribe('System/Time/CurrentTime', (data) => {
            console.log('Time update:', data);
        }, 2000);

        // Batch subscribe
        client.subscribeBatch([
            {
                tagPath: 'System/Memory/FreeMemory',
                interval: 5000,
                callback: (data) => console.log('Memory update:', data)
            },
            {
                tagPath: 'System/CPU/Load',
                interval: 5000,
                callback: (data) => console.log('CPU update:', data)
            }
        ]);

        // Write tag
        console.log('\n--- Tag Write ---');
        const writeResult = await client.writeTag('TestTag', 42);
        console.log('Write result:', writeResult);

        // Keep running for 30 seconds to see updates
        await new Promise(resolve => setTimeout(resolve, 30000));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.disconnect();
    }
}

// Run example if executed directly
if (require.main === module) {
    example().catch(console.error);
}

module.exports = BridgeClient;
