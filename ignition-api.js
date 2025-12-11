/**
 * Ignition 8.3 Gateway API Client
 * Flexible, template-based API interface for Ignition SCADA
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class IgnitionGatewayAPI {
    constructor(config = {}) {
        this.loadConfiguration(config);
        this.authToken = null;
        this.cache = new Map();
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrentRequests = 5;
    }

    /**
     * Load configuration from file and environment variables
     */
    loadConfiguration(overrides = {}) {
        // Load base config
        const configPath = path.join(__dirname, 'ignition-config.json');
        let config = {};

        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        // Load environment variables (override config file)
        if (process.env.IGNITION_HOST) {
            config.connection = config.connection || {};
            config.connection.host = process.env.IGNITION_HOST;
        }
        if (process.env.IGNITION_PORT) {
            config.connection.port = parseInt(process.env.IGNITION_PORT);
        }
        if (process.env.IGNITION_PROTOCOL) {
            config.connection.protocol = process.env.IGNITION_PROTOCOL;
        }
        if (process.env.IGNITION_USERNAME) {
            config.authentication = config.authentication || {};
            config.authentication.username = process.env.IGNITION_USERNAME;
        }
        if (process.env.IGNITION_PASSWORD) {
            config.authentication = config.authentication || {};
            config.authentication.password = process.env.IGNITION_PASSWORD;
        }

        // Apply runtime overrides
        this.config = this.deepMerge(config, overrides);

        // Initialize HTTP/HTTPS agent
        const protocol = this.config.connection.protocol || 'https';
        this.httpAgent = protocol === 'https' ? https : http;
    }

    /**
     * Deep merge configuration objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    /**
     * Build full URL from endpoint template
     */
    buildUrl(endpoint, params = {}) {
        const { protocol, host, port, gatewayContext } = this.config.connection;
        let url = `${protocol}://${host}:${port}`;

        if (gatewayContext) {
            url += `/${gatewayContext}`;
        }

        // Handle endpoint templates
        let finalEndpoint = endpoint;

        // Replace template variables like {tagPath}, {projectName}, etc.
        for (const [key, value] of Object.entries(params)) {
            finalEndpoint = finalEndpoint.replace(`{${key}}`, encodeURIComponent(value));
        }

        // Add query parameters
        if (params.query) {
            const queryString = new URLSearchParams(params.query).toString();
            finalEndpoint += `?${queryString}`;
        }

        return url + finalEndpoint;
    }

    /**
     * Make authenticated HTTP request
     */
    async request(method, endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            // Wait if too many concurrent requests
            if (this.activeRequests >= this.maxConcurrentRequests) {
                this.requestQueue.push(() => this.request(method, endpoint, options)
                    .then(resolve).catch(reject));
                return;
            }

            this.activeRequests++;

            const url = new URL(this.buildUrl(endpoint, options.params));

            const requestOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...this.getAuthHeaders(),
                    ...(options.headers || {})
                },
                timeout: this.config.connection.timeout || 30000,
                rejectUnauthorized: process.env.SSL_VERIFY !== 'false'
            };

            const req = this.httpAgent.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    this.activeRequests--;
                    this.processQueue();

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const result = data ? JSON.parse(data) : {};
                            this.cacheResult(endpoint, result);
                            resolve(result);
                        } catch (e) {
                            resolve(data); // Return raw data if not JSON
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                this.activeRequests--;
                this.processQueue();
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                this.activeRequests--;
                this.processQueue();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    /**
     * Process queued requests
     */
    processQueue() {
        if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
            const nextRequest = this.requestQueue.shift();
            nextRequest();
        }
    }

    /**
     * Get authentication headers
     */
    getAuthHeaders() {
        const headers = {};
        const { type, username, password, apiKey } = this.config.authentication;

        if (type === 'basic' && username && password) {
            const auth = Buffer.from(`${username}:${password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        } else if (type === 'bearer' && this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else if (apiKey) {
            headers['X-API-Key'] = apiKey;
        }

        return headers;
    }

    /**
     * Cache results if caching is enabled
     */
    cacheResult(key, value) {
        if (this.config.cache?.enabled) {
            this.cache.set(key, {
                value,
                timestamp: Date.now()
            });

            // Clean old cache entries
            if (this.cache.size > (this.config.cache.maxSize || 100)) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
        }
    }

    /**
     * Get cached result if available and valid
     */
    getCached(key) {
        if (!this.config.cache?.enabled) return null;

        const cached = this.cache.get(key);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            if (age < (this.config.cache.ttl || 60000)) {
                return cached.value;
            }
            this.cache.delete(key);
        }
        return null;
    }

    // ============= Tag Operations =============

    /**
     * Read tag value(s)
     */
    async readTags(tagPaths, options = {}) {
        if (!Array.isArray(tagPaths)) {
            tagPaths = [tagPaths];
        }

        const endpoint = '/system/webdev/tags/read';
        return this.request('POST', endpoint, {
            body: {
                tagPaths,
                provider: options.provider || this.config.tagProvider.default
            }
        });
    }

    /**
     * Write tag value(s)
     */
    async writeTags(tagWrites, options = {}) {
        if (!Array.isArray(tagWrites)) {
            tagWrites = [tagWrites];
        }

        const endpoint = '/system/webdev/tags/write';
        return this.request('POST', endpoint, {
            body: {
                tagWrites,
                provider: options.provider || this.config.tagProvider.default
            }
        });
    }

    /**
     * Browse tags
     */
    async browseTags(path = '', options = {}) {
        const endpoint = '/system/webdev/tags/browse';
        return this.request('POST', endpoint, {
            body: {
                path,
                recursive: options.recursive || false,
                provider: options.provider || this.config.tagProvider.default
            }
        });
    }

    // ============= History Operations =============

    /**
     * Query tag history
     */
    async queryTagHistory(tagPaths, startDate, endDate, options = {}) {
        const endpoint = '/system/webdev/history/query';
        return this.request('POST', endpoint, {
            body: {
                tagPaths: Array.isArray(tagPaths) ? tagPaths : [tagPaths],
                startDate,
                endDate,
                returnSize: options.returnSize || 1000,
                aggregationMode: options.aggregationMode || 'Average',
                intervalHours: options.intervalHours,
                provider: options.provider || this.config.tagProvider.historyProvider
            }
        });
    }

    // ============= Alarm Operations =============

    /**
     * Query alarms
     */
    async queryAlarms(filters = {}) {
        const endpoint = '/system/webdev/alarms/query';
        return this.request('POST', endpoint, {
            body: {
                startDate: filters.startDate,
                endDate: filters.endDate,
                state: filters.state || ['ActiveUnacked', 'ActiveAcked'],
                priority: filters.priority,
                provider: filters.provider || this.config.tagProvider.alarmJournal
            }
        });
    }

    /**
     * Acknowledge alarms
     */
    async acknowledgeAlarms(alarmIds, notes = '') {
        const endpoint = '/system/webdev/alarms/ack';
        return this.request('POST', endpoint, {
            body: {
                alarmIds: Array.isArray(alarmIds) ? alarmIds : [alarmIds],
                notes
            }
        });
    }

    // ============= Named Query Operations =============

    /**
     * Execute named query
     */
    async executeNamedQuery(path, parameters = {}) {
        const endpoint = '/system/webdev/named-query/execute';
        return this.request('POST', endpoint, {
            body: {
                path,
                parameters
            }
        });
    }

    // ============= Project Operations =============

    /**
     * Get project information
     */
    async getProjectInfo(projectName) {
        const endpoint = `/system/project/${projectName}/info`;
        return this.request('GET', endpoint);
    }

    /**
     * Execute project script
     */
    async executeScript(projectName, scriptPath, parameters = {}) {
        const endpoint = `/system/project/${projectName}/script/execute`;
        return this.request('POST', endpoint, {
            body: {
                path: scriptPath,
                parameters
            }
        });
    }

    // ============= Perspective Operations =============

    /**
     * Send message to Perspective session
     */
    async sendPerspectiveMessage(sessionId, messageType, payload = {}) {
        const endpoint = '/system/perspective/message';
        return this.request('POST', endpoint, {
            body: {
                sessionId,
                messageType,
                payload
            }
        });
    }

    // ============= Gateway Status =============

    /**
     * Get gateway status
     */
    async getStatus() {
        const cached = this.getCached('status');
        if (cached) return cached;

        const endpoint = '/system/status';
        return this.request('GET', endpoint);
    }

    /**
     * Get gateway performance metrics
     */
    async getPerformanceMetrics() {
        const endpoint = '/system/performance';
        return this.request('GET', endpoint);
    }

    // ============= Utility Methods =============

    /**
     * Test connection to gateway
     */
    async testConnection() {
        try {
            const status = await this.getStatus();
            return {
                connected: true,
                status,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Batch operations
     */
    async batch(operations) {
        const results = await Promise.allSettled(
            operations.map(op => {
                const { method, ...params } = op;
                return this[method](...(params.args || []));
            })
        );

        return results.map((result, index) => ({
            operation: operations[index],
            status: result.status,
            value: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason.message : null
        }));
    }
}

module.exports = IgnitionGatewayAPI;