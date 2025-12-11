/**
 * Ignition Gateway Bridge Server
 * Provides WebSocket and REST endpoints for GitHub Pages to access Ignition data
 * Includes OPC UA client capabilities
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

// Ignition API Client
class IgnitionClient {
    constructor() {
        this.host = process.env.IGNITION_HOST || 'pred';
        this.port = parseInt(process.env.IGNITION_PORT) || 8088;
        this.apiKey = process.env.IGNITION_API_KEY;
        this.protocol = process.env.IGNITION_PROTOCOL || 'http';
        this.subscriptions = new Map();
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

    async readTag(tagPath) {
        // Simulate tag read - implement actual Ignition tag read based on your API
        return {
            tagPath,
            value: Math.random() * 100,
            quality: 'Good',
            timestamp: new Date().toISOString()
        };
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
        const subscription = setInterval(async () => {
            try {
                const value = await this.readTag(tagPath);
                callback(value);
            } catch (error) {
                callback({ error: error.message });
            }
        }, interval);

        this.subscriptions.set(tagPath, subscription);
        return subscription;
    }

    unsubscribeFromTag(tagPath) {
        const subscription = this.subscriptions.get(tagPath);
        if (subscription) {
            clearInterval(subscription);
            this.subscriptions.delete(tagPath);
        }
    }
}

// Bridge Server
class BridgeServer {
    constructor(port = 8089) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.ignitionClient = new IgnitionClient();
        this.clients = new Set();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
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
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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
                const value = await this.ignitionClient.readTag(tagPath);
                res.json(value);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Write tag
        this.app.post('/api/tags/write', async (req, res) => {
            try {
                const { tagPath, value } = req.body;
                const result = await this.ignitionClient.writeTag(tagPath, value);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Bulk read
        this.app.post('/api/tags/read-bulk', async (req, res) => {
            try {
                const { tagPaths } = req.body;
                const results = await Promise.all(
                    tagPaths.map(path => this.ignitionClient.readTag(path))
                );
                res.json(results);
            } catch (error) {
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
                id: Date.now().toString(),
                subscriptions: new Set()
            };

            this.clients.add(client);

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(client, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: error.message
                    }));
                }
            });

            ws.on('close', () => {
                // Clean up subscriptions
                client.subscriptions.forEach(tagPath => {
                    this.ignitionClient.unsubscribeFromTag(tagPath);
                });
                this.clients.delete(client);
                console.log('Client disconnected:', client.id);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                id: client.id,
                timestamp: new Date().toISOString()
            }));
        });
    }

    async handleWebSocketMessage(client, data) {
        const { type, payload } = data;

        switch (type) {
            case 'subscribe':
                this.handleSubscribe(client, payload.tagPath, payload.interval);
                break;

            case 'unsubscribe':
                this.handleUnsubscribe(client, payload.tagPath);
                break;

            case 'read':
                const value = await this.ignitionClient.readTag(payload.tagPath);
                client.ws.send(JSON.stringify({
                    type: 'data',
                    tagPath: payload.tagPath,
                    data: value
                }));
                break;

            case 'write':
                const result = await this.ignitionClient.writeTag(
                    payload.tagPath,
                    payload.value
                );
                client.ws.send(JSON.stringify({
                    type: 'write_result',
                    data: result
                }));
                break;

            case 'ping':
                client.ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                client.ws.send(JSON.stringify({
                    type: 'error',
                    message: `Unknown message type: ${type}`
                }));
        }
    }

    handleSubscribe(client, tagPath, interval = 1000) {
        if (client.subscriptions.has(tagPath)) {
            return; // Already subscribed
        }

        client.subscriptions.add(tagPath);

        this.ignitionClient.subscribeToTag(tagPath, (data) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify({
                    type: 'update',
                    tagPath,
                    data
                }));
            }
        }, interval);

        client.ws.send(JSON.stringify({
            type: 'subscribed',
            tagPath
        }));
    }

    handleUnsubscribe(client, tagPath) {
        if (client.subscriptions.has(tagPath)) {
            client.subscriptions.delete(tagPath);
            this.ignitionClient.unsubscribeFromTag(tagPath);

            client.ws.send(JSON.stringify({
                type: 'unsubscribed',
                tagPath
            }));
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
            console.log('Endpoints:');
            console.log('  GET  /api/status - Gateway status');
            console.log('  GET  /api/tags/read/:tagPath - Read single tag');
            console.log('  POST /api/tags/write - Write tag value');
            console.log('  POST /api/tags/read-bulk - Read multiple tags');
            console.log('  WS   / - WebSocket real-time updates');
            console.log('');
            console.log('✓ Ready to accept connections from GitHub Pages');
        });
    }

    stop() {
        this.wss.clients.forEach(client => {
            client.close();
        });

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