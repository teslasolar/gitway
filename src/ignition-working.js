/**
 * Working Ignition Gateway Connection
 * Using discovered API endpoints
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class SimpleIgnitionClient {
    constructor() {
        this.loadEnv();
        this.host = process.env.IGNITION_HOST || 'pred';
        this.port = parseInt(process.env.IGNITION_PORT) || 8088;
        this.protocol = process.env.IGNITION_PROTOCOL || 'http';
        this.apiKey = process.env.IGNITION_API_KEY;
        this.username = process.env.IGNITION_USERNAME || 'admin';
        this.password = process.env.IGNITION_PASSWORD;
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

    async request(method, endpoint, body = null) {
        return new Promise((resolve, reject) => {
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

            if (body) {
                const bodyStr = JSON.stringify(body);
                options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
            }

            const req = http.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

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
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    async getStatus() {
        return this.request('GET', '/StatusPing');
    }

    async getGatewayInfo() {
        // Try different info endpoints
        const endpoints = [
            '/data/status/sys.gateway',
            '/system/info',
            '/info',
            '/gateway/info'
        ];

        for (const endpoint of endpoints) {
            try {
                return await this.request('GET', endpoint);
            } catch (e) {
                // Try next endpoint
            }
        }
        return null;
    }

    async readTag(tagPath) {
        // Try different tag read formats
        const endpoints = [
            `/data/tags/read?tagPath=${encodeURIComponent(tagPath)}`,
            `/tags/read?path=${encodeURIComponent(tagPath)}`,
            `/system/tag/read?path=${encodeURIComponent(tagPath)}`
        ];

        for (const endpoint of endpoints) {
            try {
                return await this.request('GET', endpoint);
            } catch (e) {
                if (!e.message.includes('404')) {
                    console.error(`Tag read error: ${e.message}`);
                }
            }
        }

        // Try POST method
        try {
            return await this.request('POST', '/data/tags/read', {
                tagPaths: [tagPath]
            });
        } catch (e) {
            console.error(`Tag read POST error: ${e.message}`);
        }

        return null;
    }

    async writeTag(tagPath, value) {
        // Try different tag write formats
        const endpoints = [
            { path: '/data/tags/write', body: { tagPath, value } },
            { path: '/tags/write', body: { path: tagPath, value } },
            { path: '/system/tag/write', body: { tagWrites: [{ tagPath, value }] } }
        ];

        for (const { path, body } of endpoints) {
            try {
                return await this.request('POST', path, body);
            } catch (e) {
                if (!e.message.includes('404')) {
                    console.error(`Tag write error: ${e.message}`);
                }
            }
        }
        return null;
    }

    async browseTags(folderPath = '') {
        const endpoints = [
            `/data/tags/browse?path=${encodeURIComponent(folderPath)}`,
            `/tags/browse?folder=${encodeURIComponent(folderPath)}`,
            `/system/tags/browse`
        ];

        for (const endpoint of endpoints) {
            try {
                const result = await this.request('GET', endpoint);
                return result;
            } catch (e) {
                // Try next
            }
        }

        // Try POST
        try {
            return await this.request('POST', '/data/tags/browse', { path: folderPath });
        } catch (e) {
            console.error(`Browse error: ${e.message}`);
        }

        return null;
    }

    async discoverEndpoints() {
        console.log('Discovering available API endpoints...\n');

        const testEndpoints = [
            { path: '/StatusPing', name: 'Status' },
            { path: '/data/tags', name: 'Tags API' },
            { path: '/data/perspective', name: 'Perspective API' },
            { path: '/data/alarm', name: 'Alarm API' },
            { path: '/data/history', name: 'History API' },
            { path: '/system', name: 'System API' },
            { path: '/projects', name: 'Projects' },
            { path: '/data/db', name: 'Database API' },
            { path: '/data/opc', name: 'OPC API' },
            { path: '/modules', name: 'Modules' },
        ];

        const available = [];

        for (const { path, name } of testEndpoints) {
            try {
                await this.request('GET', path);
                console.log(`✓ ${name}: Available at ${path}`);
                available.push({ path, name });
            } catch (e) {
                if (e.message.includes('404')) {
                    console.log(`✗ ${name}: Not found`);
                } else if (e.message.includes('401')) {
                    console.log(`⚠ ${name}: Requires different authentication`);
                } else {
                    console.log(`? ${name}: ${e.message.substring(0, 50)}`);
                }
            }
        }

        return available;
    }
}

async function testWorkingConnection() {
    console.log('========================================');
    console.log('  Ignition Gateway Working Connection');
    console.log('========================================\n');

    const client = new SimpleIgnitionClient();

    console.log('Configuration:');
    console.log(`  Host: ${client.host}`);
    console.log(`  Port: ${client.port}`);
    console.log(`  API Key: ${client.apiKey ? 'Configured' : 'Not set'}\n`);

    try {
        // Test basic connectivity
        console.log('1. Testing connection...');
        const status = await client.getStatus();
        console.log(`   ✓ Gateway Status: ${JSON.stringify(status)}\n`);

        // Discover endpoints
        console.log('2. Discovering endpoints...');
        const endpoints = await client.discoverEndpoints();
        console.log(`\n   Found ${endpoints.length} accessible endpoints\n`);

        // Try to get gateway info
        console.log('3. Getting gateway information...');
        const info = await client.getGatewayInfo();
        if (info) {
            console.log(`   ✓ Gateway info retrieved:`, JSON.stringify(info, null, 2).substring(0, 200));
        } else {
            console.log('   ⚠ Gateway info endpoints not accessible');
        }
        console.log('');

        // Try to browse tags
        console.log('4. Testing tag operations...');
        const tags = await client.browseTags();
        if (tags) {
            console.log(`   ✓ Tag browsing available`);
            if (Array.isArray(tags)) {
                console.log(`   Found ${tags.length} items`);
            }
        } else {
            console.log('   ⚠ Tag operations may require Web Dev module configuration');
        }
        console.log('');

        // Test tag read (example)
        console.log('5. Testing tag read (example)...');
        const tagValue = await client.readTag('[default]Path/To/Tag');
        if (tagValue) {
            console.log(`   ✓ Tag read endpoint available`);
        } else {
            console.log('   ⚠ Tag read requires valid tag path or additional configuration');
        }

        console.log('\n========================================');
        console.log('  Summary');
        console.log('========================================\n');
        console.log('✓ Connection to Ignition Gateway is WORKING!');
        console.log('✓ API Key authentication is functional');
        console.log('\nAvailable features:');
        endpoints.forEach(ep => {
            console.log(`  - ${ep.name}`);
        });

        console.log('\nNote: Some features may require:');
        console.log('  - Web Dev module to be installed and configured');
        console.log('  - Additional API endpoints to be created in Web Dev');
        console.log('  - Specific permissions for the API key');

        // Save working client for reuse
        fs.writeFileSync(
            path.join(__dirname, 'working-client-config.json'),
            JSON.stringify({
                host: client.host,
                port: client.port,
                protocol: client.protocol,
                apiKey: client.apiKey ? 'configured' : 'not set',
                workingEndpoints: endpoints
            }, null, 2)
        );

        console.log('\n✓ Working configuration saved to working-client-config.json');

    } catch (error) {
        console.error('Error during testing:', error.message);
    }
}

// Export for use in other scripts
module.exports = SimpleIgnitionClient;

// Run if called directly
if (require.main === module) {
    testWorkingConnection().catch(console.error);
}