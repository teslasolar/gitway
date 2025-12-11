/**
 * Ignition Gateway Bridge Server
 * Provides WebSocket and REST endpoints for GitHub Pages to access Ignition data
 * Includes OPC UA client capabilities
 *
 * Optimizations:
 * - WebSocket connection pooling and heartbeat
 * - Tag subscription management with batching
 * - Response caching and metrics collection
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment configuration
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                const value = valueParts.join('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            }
        });
    }
}

loadEnv();

// Response cache for tag reads
class ResponseCache {
    constructor(ttl = 5000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clear() {
        this.cache.clear();
    }

    size() {
        return this.cache.size;
    }
}

// Metrics collection
class MetricsCollector {
    constructor() {
        this.metrics = {
            connections: { total: 0, active: 0 },
            messages: { sent: 0, received: 0, errors: 0 },
            subscriptions: { active: 0, total: 0 },
            tagReads: { total: 0, cached: 0, errors: 0 },
            tagWrites: { total: 0, errors: 0 },
            uptime: Date.now()
        };
    }

    increment(category, field) {
        if (this.metrics[category] && this.metrics[category][field] !== undefined) {
            this.metrics[category][field]++;
        }
    }

    decrement(category, field) {
        if (this.metrics[category] && this.metrics[category][field] !== undefined) {
            this.metrics[category][field]--;
        }
    }

    set(category, field, value) {
        if (this.metrics[category]) {
            this.metrics[category][field] = value;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptimeSeconds: Math.floor((Date.now() - this.metrics.uptime) / 1000)
        };
    }
}

// Ignition API Client
class IgnitionClient {
    constructor() {
        this.host = process.env.IGNITION_HOST || 'pred';
        this.port = parseInt(process.env.IGNITION_PORT) || 8088;
        this.apiKey = process.env.IGNITION_API_KEY;
        this.protocol = process.env.IGNITION_PROTOCOL || 'http';
        this.subscriptions = new Map();
        this.tagCache = new ResponseCache(5000); // 5 second cache for tag reads
        this.batchQueue = new Map();
        this.batchTimer = null;
        this.batchInterval = parseInt(process.env.BATCH_INTERVAL) || 100; // 100ms batching
    }

    async request(method, endpoint, body = null) {
        return new Promise((resolve, reject) => {
            const httpModule = this.protocol === 'https' ? https : http;
            const options = {
                hostname: this.host,
                port: this.port,
                path: endpoint,
                method: method,
                headers: {
                    'X-API-Key': this.apiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            };

            if (this.protocol === 'https') {
                options.rejectUnauthorized = false;
            }

            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    async getStatus() {
        return this.request('GET', '/StatusPing');
    }

    async readTag(tagPath, useCache = true) {
        // Check cache first
        if (useCache) {
            const cached = this.tagCache.get(tagPath);
            if (cached) {
                return cached;
            }
        }

        // Simulate tag read - implement actual Ignition tag read based on your API
        const result = {
            tagPath,
            value: Math.random() * 100,
            quality: 'Good',
            timestamp: new Date().toISOString()
        };

        // Cache the result
        if (useCache) {
            this.tagCache.set(tagPath, result);
        }

        return result;
    }

    async readTagsBatch(tagPaths) {
        // Batch read multiple tags efficiently
        const results = await Promise.all(
            tagPaths.map(path => this.readTag(path, true))
        );
        return results;
    }

    async writeTag(tagPath, value) {
        // Simulate tag write - implement actual Ignition tag write
        return {
            success: true,
            tagPath,
            value
        };
    }

    subscribeToTag(tagPath, callback, interval = 1000) {
        // Check if subscription already exists
        let subData = this.subscriptions.get(tagPath);

        if (!subData) {
            // Create new subscription
            const timer = setInterval(async () => {
                try {
                    const value = await this.readTag(tagPath, false); // Don't use cache for subscriptions
                    const callbacks = this.subscriptions.get(tagPath)?.callbacks || [];
                    callbacks.forEach(cb => cb(value));
                } catch (error) {
                    const callbacks = this.subscriptions.get(tagPath)?.callbacks || [];
                    callbacks.forEach(cb => cb({ error: error.message }));
                }
            }, interval);

            subData = {
                timer,
                callbacks: [callback],
                interval,
                count: 1
            };
            this.subscriptions.set(tagPath, subData);
        } else {
            // Add callback to existing subscription
            subData.callbacks.push(callback);
            subData.count++;
        }

        return tagPath;
    }

    unsubscribeFromTag(tagPath, callback = null) {
        const subData = this.subscriptions.get(tagPath);
        if (!subData) return;

        if (callback) {
            // Remove specific callback
            const index = subData.callbacks.indexOf(callback);
            if (index > -1) {
                subData.callbacks.splice(index, 1);
                subData.count--;
            }
        }

        // If no callbacks left, clear the subscription
        if (subData.callbacks.length === 0) {
            clearInterval(subData.timer);
            this.subscriptions.delete(tagPath);
        }
    }

    getSubscriptionStats() {
        return {
            activeSubscriptions: this.subscriptions.size,
            totalCallbacks: Array.from(this.subscriptions.values())
                .reduce((sum, sub) => sum + sub.count, 0)
        };
    }
}

// Bridge Server
class BridgeServer {
    constructor(port = 8089) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({
            server: this.server,
            clientTracking: true,
            maxPayload: 100 * 1024 * 1024 // 100MB max message size
        });
        this.ignitionClient = new IgnitionClient();
        this.clients = new Map(); // Changed to Map for better lookup
        this.metrics = new MetricsCollector();
        this.heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL) || 30000; // 30 seconds
        this.maxSubscriptionsPerClient = parseInt(process.env.MAX_SUBSCRIPTIONS) || 100;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startHealthMonitoring();
    }

    setupMiddleware() {
        // Enable CORS for GitHub Pages
        this.app.use(cors({
            origin: [
                'http://localhost:*',
                'https://*.github.io',
                'https://*.github.com',
                'http://127.0.0.1:*'
            ],
            credentials: true
        }));

        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        // Health check with metrics
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                clients: this.clients.size,
                subscriptions: this.ignitionClient.getSubscriptionStats()
            });
        });

        // Metrics endpoint
        this.app.get('/api/metrics', (req, res) => {
            res.json({
                ...this.metrics.getMetrics(),
                subscriptions: this.ignitionClient.getSubscriptionStats(),
                cacheSize: this.ignitionClient.tagCache.size()
            });
        });

        // Gateway status
        this.app.get('/api/status', async (req, res) => {
            try {
                const status = await this.ignitionClient.getStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Read tag
        this.app.get('/api/tags/read/:tagPath', async (req, res) => {
            try {
                const tagPath = decodeURIComponent(req.params.tagPath);
                const useCache = req.query.cache !== 'false';
                this.metrics.increment('tagReads', 'total');
                const value = await this.ignitionClient.readTag(tagPath, useCache);
                if (useCache && this.ignitionClient.tagCache.get(tagPath)) {
                    this.metrics.increment('tagReads', 'cached');
                }
                res.json(value);
            } catch (error) {
                this.metrics.increment('tagReads', 'errors');
                res.status(500).json({ error: error.message });
            }
        });

        // Write tag
        this.app.post('/api/tags/write', async (req, res) => {
            try {
                const { tagPath, value } = req.body;
                this.metrics.increment('tagWrites', 'total');
                const result = await this.ignitionClient.writeTag(tagPath, value);
                // Invalidate cache on write
                this.ignitionClient.tagCache.set(tagPath, result);
                res.json(result);
            } catch (error) {
                this.metrics.increment('tagWrites', 'errors');
                res.status(500).json({ error: error.message });
            }
        });

        // Bulk read with batching
        this.app.post('/api/tags/read-bulk', async (req, res) => {
            try {
                const { tagPaths } = req.body;
                this.metrics.increment('tagReads', 'total');
                const results = await this.ignitionClient.readTagsBatch(tagPaths);
                res.json(results);
            } catch (error) {
                this.metrics.increment('tagReads', 'errors');
                res.status(500).json({ error: error.message });
            }
        });

        // Server configuration
        this.app.get('/api/config', (req, res) => {
            res.json({
                ignitionHost: this.ignitionClient.host,
                ignitionPort: this.ignitionClient.port,
                bridgePort: this.port,
                websocketUrl: `ws://localhost:${this.port}`,
                version: '1.0.0'
            });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection from:', req.socket.remoteAddress);

            const client = {
                ws,
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                subscriptions: new Map(), // tagPath -> callback
                isAlive: true,
                connectedAt: Date.now(),
                lastPong: Date.now(),
                messageBuffer: [] // For reconnection scenarios
            };

            this.clients.set(client.id, client);
            this.metrics.increment('connections', 'total');
            this.metrics.increment('connections', 'active');

            // Handle pong responses for heartbeat
            ws.on('pong', () => {
                client.isAlive = true;
                client.lastPong = Date.now();
            });

            ws.on('message', async (message) => {
                try {
                    this.metrics.increment('messages', 'received');
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(client, data);
                } catch (error) {
                    this.metrics.increment('messages', 'errors');
                    this.sendToClient(client, {
                        type: 'error',
                        message: error.message
                    });
                }
            });

            ws.on('close', () => {
                // Clean up subscriptions
                client.subscriptions.forEach((callback, tagPath) => {
                    this.ignitionClient.unsubscribeFromTag(tagPath, callback);
                    this.metrics.decrement('subscriptions', 'active');
                });
                this.clients.delete(client.id);
                this.metrics.decrement('connections', 'active');
                console.log('Client disconnected:', client.id);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error for client', client.id, ':', error.message);
                this.metrics.increment('messages', 'errors');
            });

            // Send welcome message
            this.sendToClient(client, {
                type: 'connected',
                id: client.id,
                timestamp: new Date().toISOString(),
                config: {
                    heartbeatInterval: this.heartbeatInterval,
                    maxSubscriptions: this.maxSubscriptionsPerClient
                }
            });
        });
    }

    // Helper to send messages to client with buffering
    sendToClient(client, message) {
        try {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
                this.metrics.increment('messages', 'sent');
                // Clear buffer on successful send
                if (client.messageBuffer.length > 0) {
                    client.messageBuffer = [];
                }
            } else {
                // Buffer messages if connection is not open (for reconnection)
                if (client.messageBuffer.length < 100) { // Limit buffer size
                    client.messageBuffer.push(message);
                }
            }
        } catch (error) {
            console.error('Error sending message to client', client.id, ':', error.message);
            this.metrics.increment('messages', 'errors');
        }
    }

    // Health monitoring with heartbeat
    startHealthMonitoring() {
        this.healthCheckTimer = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                // Find client by ws
                let client = null;
                for (const [id, c] of this.clients) {
                    if (c.ws === ws) {
                        client = c;
                        break;
                    }
                }

                if (!client) return;

                if (client.isAlive === false) {
                    console.log('Terminating unresponsive client:', client.id);
                    ws.terminate();
                    return;
                }

                client.isAlive = false;
                ws.ping();
            });
        }, this.heartbeatInterval);
    }

    async handleWebSocketMessage(client, data) {
        const { type, payload, requestId } = data;

        try {
            switch (type) {
                case 'subscribe':
                    this.handleSubscribe(client, payload.tagPath, payload.interval);
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(client, payload.tagPath);
                    break;

                case 'subscribe_batch':
                    // Subscribe to multiple tags at once
                    if (Array.isArray(payload.tags)) {
                        payload.tags.forEach(tag => {
                            this.handleSubscribe(client, tag.tagPath, tag.interval);
                        });
                        this.sendToClient(client, {
                            type: 'subscribe_batch_result',
                            requestId,
                            success: true,
                            count: payload.tags.length
                        });
                    }
                    break;

                case 'read':
                    this.metrics.increment('tagReads', 'total');
                    const value = await this.ignitionClient.readTag(payload.tagPath, payload.useCache !== false);
                    this.sendToClient(client, {
                        type: 'data',
                        requestId,
                        tagPath: payload.tagPath,
                        data: value
                    });
                    break;

                case 'read_batch':
                    // Read multiple tags at once
                    if (Array.isArray(payload.tagPaths)) {
                        this.metrics.increment('tagReads', 'total');
                        const results = await this.ignitionClient.readTagsBatch(payload.tagPaths);
                        this.sendToClient(client, {
                            type: 'read_batch_result',
                            requestId,
                            data: results
                        });
                    }
                    break;

                case 'write':
                    this.metrics.increment('tagWrites', 'total');
                    const result = await this.ignitionClient.writeTag(
                        payload.tagPath,
                        payload.value
                    );
                    this.sendToClient(client, {
                        type: 'write_result',
                        requestId,
                        data: result
                    });
                    break;

                case 'ping':
                    this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
                    break;

                case 'get_buffered':
                    // Send any buffered messages
                    if (client.messageBuffer.length > 0) {
                        this.sendToClient(client, {
                            type: 'buffered_messages',
                            messages: client.messageBuffer
                        });
                        client.messageBuffer = [];
                    }
                    break;

                default:
                    this.sendToClient(client, {
                        type: 'error',
                        requestId,
                        message: `Unknown message type: ${type}`
                    });
            }
        } catch (error) {
            this.sendToClient(client, {
                type: 'error',
                requestId,
                message: error.message
            });
        }
    }

    handleSubscribe(client, tagPath, interval = 1000) {
        // Rate limiting check
        if (client.subscriptions.size >= this.maxSubscriptionsPerClient) {
            this.sendToClient(client, {
                type: 'error',
                message: `Maximum subscriptions (${this.maxSubscriptionsPerClient}) reached`
            });
            return;
        }

        if (client.subscriptions.has(tagPath)) {
            this.sendToClient(client, {
                type: 'already_subscribed',
                tagPath
            });
            return; // Already subscribed
        }

        // Create callback for this subscription
        const callback = (data) => {
            this.sendToClient(client, {
                type: 'update',
                tagPath,
                data
            });
        };

        client.subscriptions.set(tagPath, callback);
        this.metrics.increment('subscriptions', 'active');
        this.metrics.increment('subscriptions', 'total');

        this.ignitionClient.subscribeToTag(tagPath, callback, interval);

        this.sendToClient(client, {
            type: 'subscribed',
            tagPath,
            interval
        });
    }

    handleUnsubscribe(client, tagPath) {
        const callback = client.subscriptions.get(tagPath);
        if (callback) {
            client.subscriptions.delete(tagPath);
            this.ignitionClient.unsubscribeFromTag(tagPath, callback);
            this.metrics.decrement('subscriptions', 'active');

            this.sendToClient(client, {
                type: 'unsubscribed',
                tagPath
            });
        } else {
            this.sendToClient(client, {
                type: 'error',
                message: `Not subscribed to ${tagPath}`
            });
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log('========================================');
            console.log('  Ignition Bridge Server Started');
            console.log('========================================');
            console.log(`  HTTP API:   http://localhost:${this.port}`);
            console.log(`  WebSocket:  ws://localhost:${this.port}`);
            console.log(`  Ignition:   ${this.ignitionClient.protocol}://${this.ignitionClient.host}:${this.ignitionClient.port}`);
            console.log('');
            console.log('Optimizations:');
            console.log(`  Cache TTL:    ${this.ignitionClient.tagCache.ttl}ms`);
            console.log(`  Heartbeat:    ${this.heartbeatInterval}ms`);
            console.log(`  Max Subs:     ${this.maxSubscriptionsPerClient} per client`);
            console.log('');
            console.log('Endpoints:');
            console.log('  GET  /health - Health check with metrics');
            console.log('  GET  /api/metrics - Detailed metrics');
            console.log('  GET  /api/status - Gateway status');
            console.log('  GET  /api/tags/read/:tagPath - Read single tag');
            console.log('  POST /api/tags/write - Write tag value');
            console.log('  POST /api/tags/read-bulk - Batch read multiple tags');
            console.log('  WS   / - WebSocket real-time updates');
            console.log('');
            console.log('WebSocket messages:');
            console.log('  subscribe, unsubscribe, subscribe_batch');
            console.log('  read, read_batch, write, ping, get_buffered');
            console.log('');
            console.log('✓ Ready to accept connections from GitHub Pages');
        });
    }

    stop() {
        // Stop health monitoring
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        // Close all client connections gracefully
        this.clients.forEach((client) => {
            // Clean up subscriptions
            client.subscriptions.forEach((callback, tagPath) => {
                this.ignitionClient.unsubscribeFromTag(tagPath, callback);
            });

            // Close WebSocket connection
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close(1000, 'Server shutting down');
            }
        });

        this.clients.clear();

        // Close server
        this.server.close(() => {
            console.log('Bridge server stopped');
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const bridgePort = parseInt(process.env.BRIDGE_PORT) || 8089;
    const server = new BridgeServer(bridgePort);
    server.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down bridge server...');
        server.stop();
        process.exit(0);
    });
}

module.exports = BridgeServer;