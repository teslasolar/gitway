/**
 * Gateway Discovery Module
 * Automatically discovers Ignition gateway components and capabilities
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class GatewayDiscovery {
    constructor() {
        this.loadEnv();
        this.host = process.env.IGNITION_HOST || 'pred';
        this.port = parseInt(process.env.IGNITION_PORT) || 8088;
        this.protocol = process.env.IGNITION_PROTOCOL || 'http';
        this.apiKey = process.env.IGNITION_API_KEY;
        this.discoveredComponents = {};
        this.capabilities = {};
    }

    loadEnv() {
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

    async request(method, endpoint) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                port: this.port,
                path: endpoint,
                method: method,
                headers: {
                    'X-API-Key': this.apiKey,
                    'Accept': 'application/json'
                },
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        headers: res.headers
                    });
                });
            });

            req.on('error', (error) => {
                resolve({
                    status: 0,
                    error: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ status: 0, error: 'timeout' });
            });

            req.end();
        });
    }

    async discover() {
        console.log('🔍 Starting Gateway Discovery...\n');
        console.log(`Target: ${this.protocol}://${this.host}:${this.port}\n`);

        // Discover base endpoints
        await this.discoverBaseEndpoints();

        // Discover modules
        await this.discoverModules();

        // Discover tag providers
        await this.discoverTagProviders();

        // Discover projects
        await this.discoverProjects();

        // Discover databases
        await this.discoverDatabases();

        // Discover device connections
        await this.discoverDevices();

        // Discover alarm journals
        await this.discoverAlarmJournals();

        // Generate configuration
        const config = this.generateConfiguration();

        // Save configuration
        this.saveConfiguration(config);

        return config;
    }

    async discoverBaseEndpoints() {
        console.log('📡 Discovering base endpoints...');

        const endpoints = [
            { path: '/StatusPing', name: 'status', type: 'system' },
            { path: '/data', name: 'data-api', type: 'data' },
            { path: '/system', name: 'system-api', type: 'system' },
            { path: '/system/webdev', name: 'webdev', type: 'module' },
            { path: '/system/perspective', name: 'perspective', type: 'module' },
            { path: '/system/alarm', name: 'alarm', type: 'module' },
            { path: '/system/tag', name: 'tag', type: 'module' },
            { path: '/system/opc', name: 'opc', type: 'module' },
            { path: '/system/projects', name: 'projects', type: 'system' },
            { path: '/system/database', name: 'database', type: 'module' },
            { path: '/system/report', name: 'reporting', type: 'module' },
            { path: '/system/script', name: 'scripting', type: 'module' },
            { path: '/data/tags', name: 'tags-data', type: 'data' },
            { path: '/data/history', name: 'history-data', type: 'data' },
            { path: '/data/alarm', name: 'alarm-data', type: 'data' },
            { path: '/data/db', name: 'database-data', type: 'data' }
        ];

        this.discoveredComponents.endpoints = [];

        for (const endpoint of endpoints) {
            const response = await this.request('GET', endpoint.path);

            if (response.status === 200) {
                console.log(`  ✓ Found: ${endpoint.name} at ${endpoint.path}`);
                this.discoveredComponents.endpoints.push({
                    ...endpoint,
                    available: true,
                    response: response.status
                });
            } else if (response.status === 404) {
                console.log(`  ✗ Not found: ${endpoint.name}`);
            } else if (response.status === 401) {
                console.log(`  ⚠ Unauthorized: ${endpoint.name} (needs auth)`);
                this.discoveredComponents.endpoints.push({
                    ...endpoint,
                    available: false,
                    requiresAuth: true,
                    response: response.status
                });
            }
        }

        console.log('');
    }

    async discoverModules() {
        console.log('🔧 Discovering installed modules...');

        const moduleEndpoints = [
            { name: 'Perspective', check: '/system/perspective/status', module: 'perspective' },
            { name: 'Vision', check: '/system/vision/status', module: 'vision' },
            { name: 'Web Dev', check: '/system/webdev/status', module: 'webdev' },
            { name: 'Reporting', check: '/system/report/status', module: 'reporting' },
            { name: 'Alarm Notification', check: '/system/alarm-notification/status', module: 'alarm-notification' },
            { name: 'SMS Notification', check: '/system/sms/status', module: 'sms' },
            { name: 'Voice Notification', check: '/system/voice/status', module: 'voice' },
            { name: 'DNP3', check: '/system/dnp3/status', module: 'dnp3' },
            { name: 'IEC 61850', check: '/system/iec61850/status', module: 'iec61850' },
            { name: 'Modbus', check: '/system/modbus/status', module: 'modbus' },
            { name: 'OPC UA', check: '/system/opcua/status', module: 'opcua' },
            { name: 'MQTT', check: '/system/mqtt/status', module: 'mqtt' },
            { name: 'SQL Bridge', check: '/system/sqlbridge/status', module: 'sqlbridge' },
            { name: 'Tag Historian', check: '/system/historian/status', module: 'historian' },
            { name: 'Enterprise Administration', check: '/system/ems/status', module: 'ems' }
        ];

        this.discoveredComponents.modules = [];

        for (const module of moduleEndpoints) {
            const response = await this.request('GET', module.check);

            if (response.status === 200) {
                console.log(`  ✓ ${module.name} - Installed`);
                this.discoveredComponents.modules.push({
                    ...module,
                    installed: true,
                    status: 'active'
                });
                this.capabilities[module.module] = true;
            } else if (response.status !== 404) {
                console.log(`  ⚠ ${module.name} - Status ${response.status}`);
                this.discoveredComponents.modules.push({
                    ...module,
                    installed: false,
                    status: 'unknown'
                });
            }
        }

        console.log('');
    }

    async discoverTagProviders() {
        console.log('🏷️  Discovering tag providers...');

        // Try different endpoints for tag providers
        const tagEndpoints = [
            '/data/tags/providers',
            '/system/tag/providers',
            '/tags/providers',
            '/system/webdev/tags/providers'
        ];

        this.discoveredComponents.tagProviders = [];

        for (const endpoint of tagEndpoints) {
            const response = await this.request('GET', endpoint);

            if (response.status === 200) {
                try {
                    const providers = JSON.parse(response.data);
                    console.log(`  ✓ Found ${providers.length || 1} tag provider(s)`);
                    this.discoveredComponents.tagProviders = providers;
                    break;
                } catch (e) {
                    // Try default provider
                    this.discoveredComponents.tagProviders = [{ name: 'default' }];
                }
            }
        }

        if (this.discoveredComponents.tagProviders.length === 0) {
            console.log('  ℹ Using default tag provider');
            this.discoveredComponents.tagProviders = [{ name: 'default', type: 'standard' }];
        }

        console.log('');
    }

    async discoverProjects() {
        console.log('📁 Discovering projects...');

        const projectEndpoints = [
            '/system/projects',
            '/projects',
            '/data/projects'
        ];

        this.discoveredComponents.projects = [];

        for (const endpoint of projectEndpoints) {
            const response = await this.request('GET', endpoint);

            if (response.status === 200) {
                try {
                    const projects = JSON.parse(response.data);
                    console.log(`  ✓ Found ${projects.length || 0} project(s)`);
                    this.discoveredComponents.projects = projects;
                    break;
                } catch (e) {
                    console.log('  ⚠ Could not parse project list');
                }
            }
        }

        console.log('');
    }

    async discoverDatabases() {
        console.log('💾 Discovering database connections...');

        const dbEndpoints = [
            '/system/db/connections',
            '/data/db/connections',
            '/system/database/connections'
        ];

        this.discoveredComponents.databases = [];

        for (const endpoint of dbEndpoints) {
            const response = await this.request('GET', endpoint);

            if (response.status === 200) {
                try {
                    const databases = JSON.parse(response.data);
                    console.log(`  ✓ Found ${databases.length || 0} database connection(s)`);
                    this.discoveredComponents.databases = databases;
                    break;
                } catch (e) {
                    console.log('  ⚠ Could not parse database list');
                }
            }
        }

        if (this.discoveredComponents.databases.length === 0) {
            console.log('  ℹ Using default database connection');
            this.discoveredComponents.databases = [{ name: 'default', type: 'unknown' }];
        }

        console.log('');
    }

    async discoverDevices() {
        console.log('🔌 Discovering device connections...');

        const deviceEndpoints = [
            '/system/devices',
            '/data/devices',
            '/system/opc/devices'
        ];

        this.discoveredComponents.devices = [];

        for (const endpoint of deviceEndpoints) {
            const response = await this.request('GET', endpoint);

            if (response.status === 200) {
                try {
                    const devices = JSON.parse(response.data);
                    console.log(`  ✓ Found ${devices.length || 0} device(s)`);
                    this.discoveredComponents.devices = devices;
                    break;
                } catch (e) {
                    console.log('  ⚠ Could not parse device list');
                }
            }
        }

        console.log('');
    }

    async discoverAlarmJournals() {
        console.log('🚨 Discovering alarm journals...');

        const alarmEndpoints = [
            '/system/alarm/journals',
            '/data/alarm/journals'
        ];

        this.discoveredComponents.alarmJournals = [];

        for (const endpoint of alarmEndpoints) {
            const response = await this.request('GET', endpoint);

            if (response.status === 200) {
                try {
                    const journals = JSON.parse(response.data);
                    console.log(`  ✓ Found ${journals.length || 0} alarm journal(s)`);
                    this.discoveredComponents.alarmJournals = journals;
                    break;
                } catch (e) {
                    console.log('  ⚠ Could not parse alarm journal list');
                }
            }
        }

        if (this.discoveredComponents.alarmJournals.length === 0) {
            console.log('  ℹ Using default alarm journal');
            this.discoveredComponents.alarmJournals = [{ name: 'default', type: 'standard' }];
        }

        console.log('');
    }

    generateConfiguration() {
        console.log('📝 Generating configuration...\n');

        const config = {
            gateway: {
                host: this.host,
                port: this.port,
                protocol: this.protocol,
                discovered: new Date().toISOString()
            },
            components: this.discoveredComponents,
            capabilities: this.capabilities,
            apiEndpoints: {},
            features: {}
        };

        // Build API endpoint map
        if (this.discoveredComponents.endpoints) {
            this.discoveredComponents.endpoints.forEach(ep => {
                if (ep.available) {
                    config.apiEndpoints[ep.name] = ep.path;
                }
            });
        }

        // Determine available features
        config.features = {
            tags: this.discoveredComponents.tagProviders?.length > 0,
            history: config.apiEndpoints['history-data'] !== undefined,
            alarms: this.discoveredComponents.alarmJournals?.length > 0,
            database: this.discoveredComponents.databases?.length > 0,
            perspective: this.capabilities['perspective'] === true,
            vision: this.capabilities['vision'] === true,
            reporting: this.capabilities['reporting'] === true,
            opcua: this.capabilities['opcua'] === true,
            mqtt: this.capabilities['mqtt'] === true,
            webdev: this.capabilities['webdev'] === true
        };

        // Add component-specific configurations
        config.tagConfig = {
            providers: this.discoveredComponents.tagProviders || [{ name: 'default' }],
            operations: {
                read: config.apiEndpoints['tags-data'] ? `${config.apiEndpoints['tags-data']}/read` : null,
                write: config.apiEndpoints['tags-data'] ? `${config.apiEndpoints['tags-data']}/write` : null,
                browse: config.apiEndpoints['tags-data'] ? `${config.apiEndpoints['tags-data']}/browse` : null
            }
        };

        config.alarmConfig = {
            journals: this.discoveredComponents.alarmJournals || [{ name: 'default' }],
            operations: {
                query: config.apiEndpoints['alarm-data'] ? `${config.apiEndpoints['alarm-data']}/query` : null,
                acknowledge: config.apiEndpoints['alarm-data'] ? `${config.apiEndpoints['alarm-data']}/ack` : null,
                history: config.apiEndpoints['alarm-data'] ? `${config.apiEndpoints['alarm-data']}/history` : null
            }
        };

        config.databaseConfig = {
            connections: this.discoveredComponents.databases || [{ name: 'default' }],
            operations: {
                query: config.apiEndpoints['database-data'] ? `${config.apiEndpoints['database-data']}/query` : null,
                namedQuery: config.apiEndpoints['database-data'] ? `${config.apiEndpoints['database-data']}/named-query` : null
            }
        };

        return config;
    }

    saveConfiguration(config) {
        const configPath = path.join(__dirname, 'gateway-components.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log('✅ Configuration saved to gateway-components.json');
        console.log('\n📊 Summary:');
        console.log(`  - Endpoints discovered: ${Object.keys(config.apiEndpoints).length}`);
        console.log(`  - Modules detected: ${Object.keys(config.capabilities).length}`);
        console.log(`  - Tag providers: ${config.components.tagProviders?.length || 0}`);
        console.log(`  - Projects: ${config.components.projects?.length || 0}`);
        console.log(`  - Databases: ${config.components.databases?.length || 0}`);
        console.log(`  - Devices: ${config.components.devices?.length || 0}`);

        console.log('\n✨ Available Features:');
        Object.entries(config.features).forEach(([feature, available]) => {
            console.log(`  - ${feature}: ${available ? '✓' : '✗'}`);
        });
    }

    async discoverCapabilities(component) {
        // Discover specific capabilities for a component
        const capabilities = {};

        if (component === 'tags') {
            // Test tag operations
            capabilities.read = await this.testEndpoint('/data/tags/read');
            capabilities.write = await this.testEndpoint('/data/tags/write');
            capabilities.browse = await this.testEndpoint('/data/tags/browse');
            capabilities.subscribe = await this.testEndpoint('/data/tags/subscribe');
        }

        return capabilities;
    }

    async testEndpoint(path) {
        const response = await this.request('GET', path);
        return response.status === 200 || response.status === 405; // 405 means endpoint exists but wrong method
    }
}

// Run discovery if called directly
if (require.main === module) {
    const discovery = new GatewayDiscovery();
    discovery.discover().then(config => {
        console.log('\n🎉 Discovery complete!');
    }).catch(error => {
        console.error('Discovery failed:', error);
    });
}

module.exports = GatewayDiscovery;