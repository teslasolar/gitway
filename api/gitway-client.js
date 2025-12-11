/**
 * GitWay API Client Library
 * Consume GitWay API from GitHub Pages
 */

class GitWayClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://teslasolar.github.io/gitway';
        this.version = options.version || 'v1';
        this.cache = new Map();
        this.cacheTimeout = options.cacheTimeout || 60000; // 1 minute default
        this.listeners = new Map();
    }

    /**
     * Get API endpoint URL
     */
    getUrl(endpoint) {
        if (endpoint.startsWith('/')) {
            return `${this.baseUrl}${endpoint}`;
        }
        return `${this.baseUrl}/api/${this.version}/${endpoint}`;
    }

    /**
     * Fetch with caching
     */
    async fetchWithCache(endpoint, options = {}) {
        const url = this.getUrl(endpoint);
        const cacheKey = url;

        // Check cache
        if (!options.noCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        // Fetch fresh data
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`Failed to fetch ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get API status
     */
    async getStatus() {
        return this.fetchWithCache('status.json');
    }

    /**
     * Get configuration
     */
    async getConfig() {
        return this.fetchWithCache('config.json');
    }

    /**
     * Get available components
     */
    async getComponents() {
        return this.fetchWithCache('components.json');
    }

    /**
     * Get collections metadata
     */
    async getCollections() {
        return this.fetchWithCache('collections.json');
    }

    /**
     * Get API manifest
     */
    async getManifest() {
        return this.fetchWithCache('manifest.json');
    }

    /**
     * Get UI views configuration
     */
    async getViews() {
        return this.fetchWithCache('/views.json');
    }

    /**
     * Get discovered gateway components
     */
    async getGatewayComponents() {
        return this.fetchWithCache('/gateway-components.json');
    }

    /**
     * Get data from a collection
     */
    async getCollectionData(collection, type = 'list') {
        const endpoint = `/api/${this.version}/data/${collection}/${type}.json`;
        return this.fetchWithCache(endpoint);
    }

    /**
     * Poll an endpoint for changes
     */
    pollEndpoint(endpoint, callback, interval = 5000) {
        const pollId = Math.random().toString(36).substr(2, 9);

        const poll = async () => {
            try {
                const data = await this.fetchWithCache(endpoint, { noCache: true });
                callback(null, data);
            } catch (error) {
                callback(error, null);
            }
        };

        // Initial poll
        poll();

        // Set up interval
        const intervalId = setInterval(poll, interval);

        this.listeners.set(pollId, intervalId);

        return pollId;
    }

    /**
     * Stop polling
     */
    stopPolling(pollId) {
        if (this.listeners.has(pollId)) {
            clearInterval(this.listeners.get(pollId));
            this.listeners.delete(pollId);
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Connect to WebSocket bridge (if available)
     */
    connectWebSocket(url = 'ws://localhost:3001') {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);

                this.ws.onopen = () => {
                    console.log('Connected to GitWay WebSocket');
                    resolve(this.ws);
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                };

                this.ws.onclose = () => {
                    console.log('WebSocket connection closed');
                    // Attempt reconnection after 5 seconds
                    setTimeout(() => this.connectWebSocket(url), 5000);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(data) {
        // Emit events based on message type
        if (data.type === 'update') {
            this.emit('update', data);
        } else if (data.type === 'error') {
            this.emit('error', data);
        }
    }

    /**
     * Event emitter functionality
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    /**
     * Helper method to build the interface dynamically
     */
    async buildInterface(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }

        // Get views configuration
        const views = await this.getViews();

        // Build the interface
        container.innerHTML = `
            <div class="gitway-interface">
                <header class="gitway-header">
                    <h1>GitWay Interface</h1>
                    <div class="connection-status" id="connection-status">
                        <span class="status-indicator"></span>
                        <span class="status-text">Disconnected</span>
                    </div>
                </header>
                <main class="gitway-main">
                    <div id="gitway-content"></div>
                </main>
            </div>
        `;

        // Update status
        this.updateConnectionStatus();

        return views;
    }

    /**
     * Update connection status display
     */
    async updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        try {
            const status = await this.getStatus();
            const indicator = statusElement.querySelector('.status-indicator');
            const text = statusElement.querySelector('.status-text');

            if (status.status === 'online') {
                indicator.style.background = '#10b981';
                text.textContent = 'Connected';
            } else {
                indicator.style.background = '#ef4444';
                text.textContent = 'Disconnected';
            }
        } catch (error) {
            const indicator = statusElement.querySelector('.status-indicator');
            const text = statusElement.querySelector('.status-text');
            indicator.style.background = '#ef4444';
            text.textContent = 'Error';
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitWayClient;
} else if (typeof window !== 'undefined') {
    window.GitWayClient = GitWayClient;
}

// Auto-initialize if data attributes are present
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const element = document.querySelector('[data-gitway-api]');
        if (element) {
            const options = {
                baseUrl: element.dataset.gitwayApi,
                version: element.dataset.gitwayVersion || 'v1',
                cacheTimeout: parseInt(element.dataset.gitwayCacheTimeout) || 60000
            };

            window.gitwayClient = new GitWayClient(options);

            // Auto-connect WebSocket if specified
            if (element.dataset.gitwayWebsocket) {
                window.gitwayClient.connectWebSocket(element.dataset.gitwayWebsocket);
            }

            // Auto-build interface if container specified
            if (element.dataset.gitwayContainer) {
                window.gitwayClient.buildInterface(element.dataset.gitwayContainer);
            }
        }
    });
}