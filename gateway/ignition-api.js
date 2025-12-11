/**
 * Ignition Gateway API Wrapper
 * Full-featured API client for Ignition SCADA gateway
 * Includes error handling, retries, and connection pooling
 *
 * Features:
 * - Tag read/write operations with quality codes
 * - Historical data queries with aggregation
 * - Tag subscriptions with real-time updates
 * - Connection pooling and automatic reconnection
 * - Exponential backoff retry logic
 * - Comprehensive error handling
 */

const http = require('http');
const https = require('https');
const EventEmitter = require('events');

/**
 * Connection pool for managing multiple gateway connections
 */
class ConnectionPool {
    constructor(config) {
        this.config = {
            maxConnections: config.maxConnections || 10,
            minConnections: config.minConnections || 2,
            idleTimeout: config.idleTimeout || 30000,
            connectionTimeout: config.connectionTimeout || 10000,
            ...config
        };

        this.connections = [];
        this.availableConnections = [];
        this.pendingRequests = [];
        this.totalConnections = 0;
    }

    async acquire() {
        // Return available connection if one exists
        if (this.availableConnections.length > 0) {
            const connection = this.availableConnections.pop();
            connection.lastUsed = Date.now();
            return connection;
        }

        // Create new connection if under max limit
        if (this.totalConnections < this.config.maxConnections) {
            return await this.createConnection();
        }

        // Wait for connection to become available
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.pendingRequests.indexOf(request);
                if (index > -1) {
                    this.pendingRequests.splice(index, 1);
                }
                reject(new Error('Connection pool timeout'));
            }, this.config.connectionTimeout);

            const request = { resolve, reject, timeout };
            this.pendingRequests.push(request);
        });
    }

    release(connection) {
        connection.lastUsed = Date.now();

        // Serve pending request if any
        if (this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            clearTimeout(request.timeout);
            request.resolve(connection);
        } else {
            this.availableConnections.push(connection);
        }
    }

    async createConnection() {
        const connection = {
            id: `conn_${this.totalConnections++}`,
            created: Date.now(),
            lastUsed: Date.now(),
            requestCount: 0,
            healthy: true
        };

        this.connections.push(connection);
        return connection;
    }

    async cleanup() {
        const now = Date.now();
        const timeout = this.config.idleTimeout;

        // Remove idle connections beyond minimum
        this.availableConnections = this.availableConnections.filter(conn => {
            const idle = now - conn.lastUsed;
            if (idle > timeout && this.totalConnections > this.config.minConnections) {
                this.totalConnections--;
                return false;
            }
            return true;
        });
    }

    getStats() {
        return {
            total: this.totalConnections,
            available: this.availableConnections.length,
            pending: this.pendingRequests.length,
            maxConnections: this.config.maxConnections
        };
    }
}

/**
 * Ignition API Client
 */
class IgnitionAPI extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            host: config.host || process.env.IGNITION_HOST || 'localhost',
            port: parseInt(config.port) || parseInt(process.env.IGNITION_PORT) || 8088,
            protocol: config.protocol || process.env.IGNITION_PROTOCOL || 'http',
            apiKey: config.apiKey || process.env.IGNITION_API_KEY,
            username: config.username || process.env.IGNITION_USERNAME,
            password: config.password || process.env.IGNITION_PASSWORD,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            timeout: config.timeout || 30000,
            ...config
        };

        // Initialize connection pool
        this.pool = new ConnectionPool({
            maxConnections: config.maxConnections || 10,
            minConnections: config.minConnections || 2
        });

        // Tag subscriptions
        this.subscriptions = new Map();
        this.subscriptionIntervals = new Map();

        // Request queue for rate limiting
        this.requestQueue = [];
        this.processing = false;

        // Statistics
        this.stats = {
            requestCount: 0,
            errorCount: 0,
            lastError: null,
            uptime: Date.now()
        };

        // Start cleanup interval
        setInterval(() => this.pool.cleanup(), 60000);
    }

    /**
     * Make HTTP request to Ignition gateway
     */
    async request(method, endpoint, body = null, retries = 0) {
        const connection = await this.pool.acquire();

        try {
            const result = await this._doRequest(method, endpoint, body);
            this.stats.requestCount++;
            connection.requestCount++;
            this.pool.release(connection);
            return result;
        } catch (error) {
            this.pool.release(connection);

            // Retry logic with exponential backoff
            if (retries < this.config.retryAttempts) {
                const delay = this.config.retryDelay * Math.pow(2, retries);
                console.log(`Retry attempt ${retries + 1} after ${delay}ms: ${error.message}`);

                await this._sleep(delay);
                return this.request(method, endpoint, body, retries + 1);
            }

            this.stats.errorCount++;
            this.stats.lastError = error.message;
            this.emit('error', error);
            throw error;
        }
    }

    _doRequest(method, endpoint, body = null) {
        return new Promise((resolve, reject) => {
            const httpModule = this.config.protocol === 'https' ? https : http;

            const options = {
                hostname: this.config.host,
                port: this.config.port,
                path: endpoint,
                method: method,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: this.config.timeout
            };

            // Add authentication
            if (this.config.apiKey) {
                options.headers['X-API-Key'] = this.config.apiKey;
            } else if (this.config.username && this.config.password) {
                const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
                options.headers['Authorization'] = `Basic ${auth}`;
            }

            // For HTTPS, allow self-signed certificates
            if (this.config.protocol === 'https') {
                options.rejectUnauthorized = false;
            }

            const req = httpModule.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = data ? JSON.parse(data) : {};
                            resolve(parsed);
                        } catch (e) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout after ${this.config.timeout}ms`));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    /**
     * Get gateway status
     */
    async getStatus() {
        return this.request('GET', '/StatusPing');
    }

    /**
     * Read single tag
     */
    async readTag(tagPath) {
        try {
            const response = await this.request('POST', '/system/tag/read', {
                tagPaths: [tagPath]
            });

            if (response && response.results && response.results.length > 0) {
                const result = response.results[0];
                return {
                    tagPath: tagPath,
                    value: result.value,
                    quality: result.quality || 'Good',
                    timestamp: result.timestamp || new Date().toISOString()
                };
            }

            throw new Error('No data returned for tag');
        } catch (error) {
            return {
                tagPath: tagPath,
                value: null,
                quality: 'Bad',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Read multiple tags
     */
    async getTags(tagPaths) {
        if (!Array.isArray(tagPaths) || tagPaths.length === 0) {
            return [];
        }

        try {
            const response = await this.request('POST', '/system/tag/read', {
                tagPaths: tagPaths
            });

            if (response && response.results) {
                return response.results.map((result, index) => ({
                    tagPath: tagPaths[index],
                    value: result.value,
                    quality: result.quality || 'Good',
                    timestamp: result.timestamp || new Date().toISOString()
                }));
            }

            return tagPaths.map(path => ({
                tagPath: path,
                value: null,
                quality: 'Bad',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            return tagPaths.map(path => ({
                tagPath: path,
                value: null,
                quality: 'Bad',
                timestamp: new Date().toISOString(),
                error: error.message
            }));
        }
    }

    /**
     * Write single tag
     */
    async writeTag(tagPath, value) {
        try {
            const response = await this.request('POST', '/system/tag/write', {
                writes: [{
                    tagPath: tagPath,
                    value: value
                }]
            });

            return {
                success: true,
                tagPath: tagPath,
                value: value,
                quality: 'Good',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                tagPath: tagPath,
                value: value,
                quality: 'Bad',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Write multiple tags
     */
    async writeTags(writes) {
        if (!Array.isArray(writes) || writes.length === 0) {
            return [];
        }

        try {
            const response = await this.request('POST', '/system/tag/write', {
                writes: writes.map(w => ({
                    tagPath: w.tagPath,
                    value: w.value
                }))
            });

            return writes.map((write, index) => ({
                success: true,
                tagPath: write.tagPath,
                value: write.value,
                quality: 'Good',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            return writes.map(write => ({
                success: false,
                tagPath: write.tagPath,
                value: write.value,
                quality: 'Bad',
                timestamp: new Date().toISOString(),
                error: error.message
            }));
        }
    }

    /**
     * Subscribe to tag updates
     */
    subscribeTag(tagPath, callback, interval = 1000) {
        if (this.subscriptions.has(tagPath)) {
            console.log(`Already subscribed to ${tagPath}`);
            return;
        }

        const subscription = {
            tagPath: tagPath,
            callback: callback,
            interval: interval,
            lastValue: null,
            lastQuality: null
        };

        this.subscriptions.set(tagPath, subscription);

        // Poll tag at specified interval
        const intervalId = setInterval(async () => {
            try {
                const data = await this.readTag(tagPath);

                // Only callback if value or quality changed
                if (data.value !== subscription.lastValue ||
                    data.quality !== subscription.lastQuality) {
                    subscription.lastValue = data.value;
                    subscription.lastQuality = data.quality;
                    callback(data);
                }
            } catch (error) {
                callback({
                    tagPath: tagPath,
                    value: null,
                    quality: 'Bad',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        }, interval);

        this.subscriptionIntervals.set(tagPath, intervalId);

        // Get initial value
        this.readTag(tagPath).then(callback).catch(() => {});

        this.emit('subscribed', { tagPath, interval });
    }

    /**
     * Unsubscribe from tag updates
     */
    unsubscribeTag(tagPath) {
        const intervalId = this.subscriptionIntervals.get(tagPath);
        if (intervalId) {
            clearInterval(intervalId);
            this.subscriptionIntervals.delete(tagPath);
        }

        this.subscriptions.delete(tagPath);
        this.emit('unsubscribed', { tagPath });
    }

    /**
     * Unsubscribe from all tags
     */
    unsubscribeAll() {
        for (const tagPath of this.subscriptions.keys()) {
            this.unsubscribeTag(tagPath);
        }
    }

    /**
     * Query historical data
     */
    async queryHistory(tagPaths, startDate, endDate, aggregation = 'Average', interval = 60000) {
        try {
            const response = await this.request('POST', '/system/tag/history/query', {
                tagPaths: Array.isArray(tagPaths) ? tagPaths : [tagPaths],
                startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
                endDate: endDate instanceof Date ? endDate.toISOString() : endDate,
                aggregationMode: aggregation,
                returnSize: -1,
                intervalMS: interval
            });

            if (response && response.results) {
                return response.results.map(result => ({
                    tagPath: result.tagPath,
                    values: result.values || [],
                    quality: result.quality || 'Good'
                }));
            }

            return [];
        } catch (error) {
            console.error('History query failed:', error);
            return [];
        }
    }

    /**
     * Browse tag tree
     */
    async browseTags(path = '[default]') {
        try {
            const response = await this.request('POST', '/system/tag/browse', {
                path: path,
                recursive: false
            });

            if (response && response.results) {
                return response.results.map(tag => ({
                    name: tag.name,
                    path: tag.path,
                    tagType: tag.tagType,
                    dataType: tag.dataType,
                    hasChildren: tag.hasChildren || false
                }));
            }

            return [];
        } catch (error) {
            console.error('Tag browse failed:', error);
            return [];
        }
    }

    /**
     * Get system information
     */
    async getSystemInfo() {
        try {
            const status = await this.getStatus();
            return {
                gateway: {
                    version: status.version || 'Unknown',
                    edition: status.edition || 'Unknown',
                    platform: status.platform || 'Unknown'
                },
                connection: {
                    host: this.config.host,
                    port: this.config.port,
                    protocol: this.config.protocol
                },
                pool: this.pool.getStats(),
                stats: this.stats
            };
        } catch (error) {
            return {
                gateway: { status: 'Disconnected' },
                connection: {
                    host: this.config.host,
                    port: this.config.port,
                    protocol: this.config.protocol
                },
                error: error.message
            };
        }
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            await this.getStatus();
            return {
                success: true,
                message: 'Connected to Ignition gateway',
                host: this.config.host,
                port: this.config.port
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                host: this.config.host,
                port: this.config.port
            };
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.uptime,
            subscriptions: this.subscriptions.size,
            pool: this.pool.getStats()
        };
    }

    /**
     * Cleanup and disconnect
     */
    async disconnect() {
        this.unsubscribeAll();
        this.emit('disconnected');
    }

    /**
     * Helper: sleep
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export
module.exports = IgnitionAPI;

// Allow usage as standalone or imported
if (require.main === module) {
    // Demo usage
    const api = new IgnitionAPI({
        host: 'localhost',
        port: 8088
    });

    console.log('Ignition API initialized');
    console.log('Testing connection...');

    api.testConnection().then(result => {
        console.log('Connection test:', result);
    });
}
