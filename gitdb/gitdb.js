/**
 * GitDB - GitHub as a Database
 * Part of GitWay - Unified Ignition/GitHub Platform
 */

class GitDB {
    constructor(config) {
        this.owner = config.owner || 'teslasolar';
        this.repo = config.repo || 'gitway-db';
        this.token = config.token || process.env.GITHUB_TOKEN;
        this.branch = config.branch || 'main';
        this.baseURL = 'https://api.github.com';
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 60000; // 1 minute

        // Ignition integration
        this.ignitionEnabled = config.ignitionEnabled !== false;
        this.syncToIgnition = config.syncToIgnition || false;
    }

    // ============================================
    // CORE OPERATIONS
    // ============================================

    async get(path) {
        // Check cache first
        const cached = this.getFromCache(path);
        if (cached) return cached;

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;

        try {
            const response = await fetch(url, {
                headers: this.headers()
            });

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`GET failed: ${response.statusText}`);
            }

            const data = await response.json();
            const content = JSON.parse(atob(data.content));

            this.setCache(path, content);
            return content;
        } catch (error) {
            console.error(`GitDB GET error for ${path}:`, error);
            return null;
        }
    }

    async set(path, data, message) {
        const content = btoa(JSON.stringify(data, null, 2));

        // Get current file SHA for updates
        let sha = null;
        try {
            const existing = await this.getRaw(path);
            sha = existing.sha;
        } catch (e) {
            // File doesn't exist, that's ok for creation
        }

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify({
                message: message || `Update ${path} via GitWay`,
                content: content,
                branch: this.branch,
                sha: sha
            })
        });

        if (!response.ok) {
            throw new Error(`SET failed: ${response.statusText}`);
        }

        this.clearCache(path);

        // Sync to Ignition if enabled
        if (this.syncToIgnition && this.ignitionEnabled) {
            await this.syncDataToIgnition(path, data);
        }

        return await response.json();
    }

    async delete(path, message) {
        const existing = await this.getRaw(path);

        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.headers(),
            body: JSON.stringify({
                message: message || `Delete ${path} via GitWay`,
                sha: existing.sha,
                branch: this.branch
            })
        });

        if (!response.ok) {
            throw new Error(`DELETE failed: ${response.statusText}`);
        }

        this.clearCache(path);
        return await response.json();
    }

    async list(path) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            headers: this.headers()
        });

        if (!response.ok) {
            throw new Error(`LIST failed: ${response.statusText}`);
        }

        return await response.json();
    }

    // ============================================
    // IGNITION INTEGRATION
    // ============================================

    async syncDataToIgnition(path, data) {
        if (!this.ignitionEnabled) return;

        try {
            // Convert GitHub path to Ignition tag path
            const tagPath = this.pathToTagPath(path);

            // Write to Ignition via GitWay bridge
            const bridgeUrl = window.GitWay?.config?.bridgeUrl || 'http://localhost:3001';
            await fetch(`${bridgeUrl}/api/tags/write`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tagPath: tagPath,
                    value: JSON.stringify(data)
                })
            });

            console.log(`Synced ${path} to Ignition tag ${tagPath}`);
        } catch (error) {
            console.error('Failed to sync to Ignition:', error);
        }
    }

    async syncFromIgnition(tagPath) {
        if (!this.ignitionEnabled) return null;

        try {
            const bridgeUrl = window.GitWay?.config?.bridgeUrl || 'http://localhost:3001';
            const response = await fetch(`${bridgeUrl}/api/tags/read/${encodeURIComponent(tagPath)}`);
            const data = await response.json();

            // Convert tag value to GitHub storage
            const path = this.tagPathToPath(tagPath);
            const value = JSON.parse(data.value);

            await this.set(path, value, `Sync from Ignition tag ${tagPath}`);

            return value;
        } catch (error) {
            console.error('Failed to sync from Ignition:', error);
            return null;
        }
    }

    pathToTagPath(path) {
        // Convert: data/tags/sensor1.json -> [GitDB]tags/sensor1
        return `[GitDB]${path.replace('data/', '').replace('.json', '')}`;
    }

    tagPathToPath(tagPath) {
        // Convert: [GitDB]tags/sensor1 -> data/tags/sensor1.json
        return `data/${tagPath.replace('[GitDB]', '')}.json`;
    }

    // ============================================
    // COLLECTION OPERATIONS
    // ============================================

    collection(name) {
        return new GitDBCollection(this, name);
    }

    // ============================================
    // CACHE MANAGEMENT
    // ============================================

    getFromCache(path) {
        const cached = this.cache.get(path);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(path);
        return null;
    }

    setCache(path, data) {
        this.cache.set(path, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache(path) {
        if (path) {
            this.cache.delete(path);
        } else {
            this.cache.clear();
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    async getRaw(path) {
        const url = `${this.baseURL}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            headers: this.headers()
        });

        if (!response.ok) {
            throw new Error(`GET RAW failed: ${response.statusText}`);
        }

        return await response.json();
    }

    headers() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // ============================================
    // REAL-TIME SYNC
    // ============================================

    async watch(path, callback, interval = 5000) {
        let lastSHA = null;

        const poll = async () => {
            try {
                const data = await this.getRaw(path);
                if (data.sha !== lastSHA) {
                    lastSHA = data.sha;
                    const content = JSON.parse(atob(data.content));
                    callback(content, data.sha);
                }
            } catch (error) {
                console.error('Watch error:', error);
            }
        };

        // Initial fetch
        await poll();

        // Poll for changes
        const timer = setInterval(poll, interval);

        // Return unwatch function
        return () => clearInterval(timer);
    }
}

// ============================================
// COLLECTION CLASS
// ============================================

class GitDBCollection {
    constructor(db, name) {
        this.db = db;
        this.name = name;
        this.basePath = `data/collections/${name}`;
    }

    async create(id, data) {
        // Generate ID if not provided
        if (!id) {
            id = this.generateId();
        }

        const path = `${this.basePath}/${id}.json`;
        const docData = {
            _id: id,
            _created: new Date().toISOString(),
            _modified: new Date().toISOString(),
            ...data
        };

        await this.db.set(path, docData, `Create ${this.name}/${id}`);
        await this.updateIndex('add', id);

        return docData;
    }

    async read(id) {
        const path = `${this.basePath}/${id}.json`;
        return await this.db.get(path);
    }

    async update(id, data) {
        const existing = await this.read(id);
        if (!existing) {
            throw new Error(`Document ${id} not found`);
        }

        const docData = {
            ...existing,
            ...data,
            _id: id,
            _modified: new Date().toISOString()
        };

        const path = `${this.basePath}/${id}.json`;
        await this.db.set(path, docData, `Update ${this.name}/${id}`);

        return docData;
    }

    async delete(id) {
        const path = `${this.basePath}/${id}.json`;
        await this.db.delete(path, `Delete ${this.name}/${id}`);
        await this.updateIndex('remove', id);

        return { id, deleted: true };
    }

    async getAll() {
        const index = await this.getIndex();
        const items = [];

        for (let id of index.ids) {
            const item = await this.read(id);
            if (item) items.push(item);
        }

        return items;
    }

    async query() {
        return new GitDBQuery(this);
    }

    async getIndex() {
        const path = `${this.basePath}/index.json`;
        const index = await this.db.get(path);
        return index || { ids: [], count: 0, lastModified: null };
    }

    async updateIndex(operation, id) {
        const index = await this.getIndex();

        if (operation === 'add' && !index.ids.includes(id)) {
            index.ids.push(id);
            index.count = index.ids.length;
        } else if (operation === 'remove') {
            index.ids = index.ids.filter(existingId => existingId !== id);
            index.count = index.ids.length;
        }

        index.lastModified = new Date().toISOString();

        const path = `${this.basePath}/index.json`;
        await this.db.set(path, index, `Update ${this.name} index`);
    }

    generateId() {
        return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================
// QUERY BUILDER
// ============================================

class GitDBQuery {
    constructor(collection) {
        this.collection = collection;
        this.filters = [];
        this.sortField = null;
        this.sortOrder = 'asc';
        this.limitCount = null;
        this.skipCount = 0;
    }

    where(field, operator, value) {
        this.filters.push({ field, operator, value });
        return this;
    }

    orderBy(field, order = 'asc') {
        this.sortField = field;
        this.sortOrder = order;
        return this;
    }

    limit(count) {
        this.limitCount = count;
        return this;
    }

    skip(count) {
        this.skipCount = count;
        return this;
    }

    async execute() {
        let items = await this.collection.getAll();

        // Apply filters
        for (let filter of this.filters) {
            items = items.filter(item => {
                const value = this.getNestedValue(item, filter.field);

                switch (filter.operator) {
                    case '==':
                    case '===':
                        return value === filter.value;
                    case '!=':
                    case '!==':
                        return value !== filter.value;
                    case '>':
                        return value > filter.value;
                    case '<':
                        return value < filter.value;
                    case '>=':
                        return value >= filter.value;
                    case '<=':
                        return value <= filter.value;
                    case 'contains':
                        return String(value).includes(filter.value);
                    case 'startsWith':
                        return String(value).startsWith(filter.value);
                    case 'endsWith':
                        return String(value).endsWith(filter.value);
                    case 'in':
                        return Array.isArray(filter.value) && filter.value.includes(value);
                    case 'notIn':
                        return Array.isArray(filter.value) && !filter.value.includes(value);
                    default:
                        return false;
                }
            });
        }

        // Apply sorting
        if (this.sortField) {
            items.sort((a, b) => {
                const aVal = this.getNestedValue(a, this.sortField);
                const bVal = this.getNestedValue(b, this.sortField);

                if (aVal === bVal) return 0;

                const comparison = aVal > bVal ? 1 : -1;
                return this.sortOrder === 'asc' ? comparison : -comparison;
            });
        }

        // Apply skip
        if (this.skipCount > 0) {
            items = items.slice(this.skipCount);
        }

        // Apply limit
        if (this.limitCount) {
            items = items.slice(0, this.limitCount);
        }

        return items;
    }

    getNestedValue(obj, path) {
        const parts = path.split('.');
        let value = obj;

        for (let part of parts) {
            if (value == null) return null;
            value = value[part];
        }

        return value;
    }
}

// ============================================
// GITWAY INTEGRATION
// ============================================

class GitWayDB extends GitDB {
    constructor(config) {
        super(config);
        this.gitway = config.gitway || window.GitWay;
        this.perspectiveEnabled = config.perspectiveEnabled !== false;
    }

    async storeTagHistory(tagPath, value) {
        const history = await this.collection('tag_history');
        await history.create(null, {
            tagPath: tagPath,
            value: value,
            quality: 'Good',
            timestamp: new Date().toISOString(),
            source: 'ignition'
        });
    }

    async storeAlarmEvent(alarm) {
        const alarms = await this.collection('alarms');
        await alarms.create(null, {
            ...alarm,
            timestamp: new Date().toISOString(),
            source: 'ignition'
        });
    }

    async storeAuditEvent(event) {
        const audit = await this.collection('audit');
        await audit.create(null, {
            ...event,
            timestamp: new Date().toISOString()
        });
    }
}

// ============================================
// EXPORT
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GitDB, GitDBCollection, GitDBQuery, GitWayDB };
} else if (typeof window !== 'undefined') {
    window.GitDB = GitDB;
    window.GitDBCollection = GitDBCollection;
    window.GitDBQuery = GitDBQuery;
    window.GitWayDB = GitWayDB;
}