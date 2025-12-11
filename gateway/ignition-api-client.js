/**
 * Ignition 8.3 REST API Client
 * Automated project, tag, and UDT management
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class IgnitionAPIClient {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:8088/data/api/v1';
        this.apiKey = config.apiKey || '';
        this.username = config.username || 'admin';
        this.password = config.password || 'password';
        this.authMode = config.authMode || 'apikey'; // 'apikey' or 'basic'

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: this.getAuthHeaders()
        });

        // Add request/response interceptors
        this.setupInterceptors();
    }

    /**
     * Get authentication headers based on mode
     */
    getAuthHeaders() {
        if (this.authMode === 'apikey' && this.apiKey) {
            return {
                'X-Ignition-API-Token': this.apiKey
            };
        } else if (this.authMode === 'basic') {
            const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            return {
                'Authorization': `Basic ${auth}`
            };
        }
        return {};
    }

    /**
     * Setup axios interceptors for logging and error handling
     */
    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            config => {
                console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
                return config;
            },
            error => {
                console.error('Request error:', error.message);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            response => {
                console.log(`✅ ${response.status} ${response.config.url}`);
                return response;
            },
            error => {
                if (error.response) {
                    console.error(`❌ ${error.response.status} ${error.response.config.url}`);
                    console.error('Error:', error.response.data);
                } else {
                    console.error('Network error:', error.message);
                }
                return Promise.reject(error);
            }
        );
    }

    // ==================== Gateway Operations ====================

    /**
     * Get gateway status
     */
    async getGatewayStatus() {
        try {
            // Try different status endpoints based on Ignition version
            try {
                // Ignition 8.3+ API endpoint
                const response = await this.client.get('/gateway/status');
                return response.data;
            } catch (err) {
                // Fallback to StatusPing servlet
                const statusResponse = await axios.get(
                    this.baseUrl.replace('/data/api/v1', '') + '/StatusPing'
                );
                return statusResponse.data;
            }
        } catch (error) {
            throw new Error(`Failed to get gateway status: ${error.message}`);
        }
    }

    /**
     * Create gateway backup
     */
    async createBackup(options = {}) {
        const config = {
            includeProjects: options.includeProjects !== false,
            includeTags: options.includeTags !== false,
            includeGatewayConfig: options.includeGatewayConfig !== false
        };

        try {
            const response = await this.client.post('/gateway/backup', config, {
                responseType: 'arraybuffer'
            });

            const filename = `backup_${new Date().toISOString().split('T')[0]}.gwbk`;
            fs.writeFileSync(filename, response.data);
            console.log(`💾 Backup saved to ${filename}`);
            return filename;
        } catch (error) {
            throw new Error(`Failed to create backup: ${error.message}`);
        }
    }

    // ==================== Project Operations ====================

    /**
     * List all projects
     */
    async listProjects() {
        try {
            const response = await this.client.get('/projects');
            return response.data;
        } catch (error) {
            throw new Error(`Failed to list projects: ${error.message}`);
        }
    }

    /**
     * Get project details
     */
    async getProject(projectName) {
        try {
            const response = await this.client.get(`/projects/${projectName}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get project ${projectName}: ${error.message}`);
        }
    }

    /**
     * Import project from zip file
     */
    async importProject(zipPath, options = {}) {
        if (!fs.existsSync(zipPath)) {
            throw new Error(`File not found: ${zipPath}`);
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(zipPath));
        form.append('overwrite', (options.overwrite || false).toString());

        if (options.projectName) {
            form.append('projectName', options.projectName);
        }

        try {
            const response = await this.client.post('/projects/import', form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            console.log(`✅ Project imported successfully from ${zipPath}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to import project: ${error.message}`);
        }
    }

    /**
     * Export project to zip file
     */
    async exportProject(projectName, outputPath = null) {
        try {
            const response = await this.client.get(`/projects/${projectName}/export`, {
                responseType: 'arraybuffer'
            });

            const filename = outputPath || `${projectName}_export.zip`;
            fs.writeFileSync(filename, response.data);
            console.log(`📦 Project exported to ${filename}`);
            return filename;
        } catch (error) {
            throw new Error(`Failed to export project ${projectName}: ${error.message}`);
        }
    }

    /**
     * Create new project
     */
    async createProject(projectConfig) {
        const config = {
            name: projectConfig.name,
            title: projectConfig.title || projectConfig.name,
            description: projectConfig.description || '',
            enabled: projectConfig.enabled !== false,
            inheritable: projectConfig.inheritable || false
        };

        try {
            const response = await this.client.post('/projects', config);
            console.log(`✅ Project '${config.name}' created successfully`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to create project: ${error.message}`);
        }
    }

    /**
     * Delete project
     */
    async deleteProject(projectName) {
        try {
            await this.client.delete(`/projects/${projectName}`);
            console.log(`🗑️  Project '${projectName}' deleted`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete project ${projectName}: ${error.message}`);
        }
    }

    // ==================== Tag Operations ====================

    /**
     * Read tags
     */
    async readTags(tagPaths) {
        if (!Array.isArray(tagPaths)) {
            tagPaths = [tagPaths];
        }

        try {
            const response = await this.client.post('/tags/read', {
                tagPaths: tagPaths
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to read tags: ${error.message}`);
        }
    }

    /**
     * Write tags
     */
    async writeTags(tagWrites) {
        if (!Array.isArray(tagWrites)) {
            tagWrites = [tagWrites];
        }

        try {
            const response = await this.client.post('/tags/write', {
                tagWrites: tagWrites
            });
            console.log(`✏️  Wrote ${tagWrites.length} tag(s)`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to write tags: ${error.message}`);
        }
    }

    /**
     * Browse tags
     */
    async browseTags(path = '[default]', recursive = false) {
        try {
            const response = await this.client.post('/tags/browse', {
                path: path,
                recursive: recursive
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to browse tags: ${error.message}`);
        }
    }

    /**
     * Import tags from JSON
     */
    async importTags(jsonPath, options = {}) {
        let tagData;

        if (typeof jsonPath === 'string' && fs.existsSync(jsonPath)) {
            tagData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } else if (typeof jsonPath === 'object') {
            tagData = jsonPath;
        } else {
            throw new Error('Invalid tag data source');
        }

        const config = {
            provider: options.provider || 'default',
            basePath: options.basePath || '',
            collisionPolicy: options.collisionPolicy || 'overwrite',
            tags: tagData.tags || tagData
        };

        try {
            const response = await this.client.post('/tags/import', config);
            console.log(`📥 Tags imported successfully`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to import tags: ${error.message}`);
        }
    }

    /**
     * Export tags
     */
    async exportTags(paths, options = {}) {
        if (!Array.isArray(paths)) {
            paths = [paths];
        }

        const config = {
            provider: options.provider || 'default',
            paths: paths,
            recursive: options.recursive !== false
        };

        try {
            const response = await this.client.post('/tags/export', config);

            if (options.outputFile) {
                fs.writeFileSync(options.outputFile, JSON.stringify(response.data, null, 2));
                console.log(`📤 Tags exported to ${options.outputFile}`);
            }

            return response.data;
        } catch (error) {
            throw new Error(`Failed to export tags: ${error.message}`);
        }
    }

    // ==================== UDT Operations ====================

    /**
     * Import UDT definitions
     */
    async importUDTs(jsonPath, options = {}) {
        let udtData;

        if (typeof jsonPath === 'string' && fs.existsSync(jsonPath)) {
            udtData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } else if (typeof jsonPath === 'object') {
            udtData = jsonPath;
        } else {
            throw new Error('Invalid UDT data source');
        }

        // Extract UDTs from the structure
        let udts = [];
        if (udtData.tags) {
            // Handle structured format with folders
            const extractUDTs = (tags) => {
                for (const tag of tags) {
                    if (tag.tagType === 'UdtType') {
                        udts.push(tag);
                    } else if (tag.tagType === 'Folder' && tag.tags) {
                        extractUDTs(tag.tags);
                    }
                }
            };
            extractUDTs(udtData.tags);
        } else if (Array.isArray(udtData)) {
            udts = udtData;
        } else {
            udts = [udtData];
        }

        const config = {
            provider: options.provider || 'default',
            udts: udts
        };

        try {
            const response = await this.client.post('/tags/udts/import', config);
            console.log(`📥 ${udts.length} UDT(s) imported successfully`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to import UDTs: ${error.message}`);
        }
    }

    /**
     * Get UDT definition
     */
    async getUDT(udtName, provider = 'default') {
        try {
            const response = await this.client.get(`/tags/udts/${provider}/${udtName}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get UDT ${udtName}: ${error.message}`);
        }
    }

    // ==================== Module Operations ====================

    /**
     * List installed modules
     */
    async listModules() {
        try {
            const response = await this.client.get('/modules');
            return response.data;
        } catch (error) {
            throw new Error(`Failed to list modules: ${error.message}`);
        }
    }

    /**
     * Install module
     */
    async installModule(modlPath) {
        if (!fs.existsSync(modlPath)) {
            throw new Error(`File not found: ${modlPath}`);
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(modlPath));

        try {
            const response = await this.client.post('/modules/install', form, {
                headers: {
                    ...form.getHeaders()
                }
            });
            console.log(`📦 Module installed from ${modlPath}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to install module: ${error.message}`);
        }
    }

    // ==================== GitWay Specific Operations ====================

    /**
     * Import complete GitWay project with all resources
     */
    async importGitWayProject(basePath = '.') {
        console.log('🚀 Starting GitWay project import...\n');

        const results = {
            project: false,
            tags: false,
            udts: false,
            errors: []
        };

        // 1. Import Perspective project
        const projectZip = path.join(basePath, 'gitway-perspective.zip');
        if (fs.existsSync(projectZip)) {
            try {
                await this.importProject(projectZip, {
                    overwrite: true,
                    projectName: 'GitWay'
                });
                results.project = true;
                console.log('✅ Perspective project imported\n');
            } catch (error) {
                results.errors.push(`Project import: ${error.message}`);
                console.error(`❌ Project import failed: ${error.message}\n`);
            }
        } else {
            console.warn(`⚠️  Project file not found: ${projectZip}\n`);
        }

        // 2. Import UDT definitions
        const udtFile = path.join(basePath, 'gitway-udts.json');
        if (fs.existsSync(udtFile)) {
            try {
                await this.importUDTs(udtFile);
                results.udts = true;
                console.log('✅ UDT definitions imported\n');
            } catch (error) {
                results.errors.push(`UDT import: ${error.message}`);
                console.error(`❌ UDT import failed: ${error.message}\n`);
            }
        } else {
            console.warn(`⚠️  UDT file not found: ${udtFile}\n`);
        }

        // 3. Import tags
        const tagsFile = path.join(basePath, 'gitway-tags.json');
        if (fs.existsSync(tagsFile)) {
            try {
                await this.importTags(tagsFile);
                results.tags = true;
                console.log('✅ Tags imported\n');
            } catch (error) {
                results.errors.push(`Tag import: ${error.message}`);
                console.error(`❌ Tag import failed: ${error.message}\n`);
            }
        } else {
            console.warn(`⚠️  Tags file not found: ${tagsFile}\n`);
        }

        // Summary
        console.log('========================================');
        console.log('GitWay Import Summary:');
        console.log(`  Project: ${results.project ? '✅' : '❌'}`);
        console.log(`  UDTs:    ${results.udts ? '✅' : '❌'}`);
        console.log(`  Tags:    ${results.tags ? '✅' : '❌'}`);

        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.forEach(err => console.log(`  - ${err}`));
        }
        console.log('========================================\n');

        return results;
    }

    /**
     * Test API connection
     */
    async testConnection() {
        console.log('🔍 Testing Ignition API connection...\n');

        try {
            const status = await this.getGatewayStatus();
            console.log('✅ Connection successful!');

            // Handle different response formats
            if (status.state) {
                console.log(`   Gateway State: ${status.state}`);
            }
            if (status.version) {
                console.log(`   Gateway Version: ${status.version}`);
            }
            if (status.licenseMode) {
                console.log(`   License Mode: ${status.licenseMode}`);
            }
            if (status.uptime) {
                console.log(`   Uptime: ${status.uptime}`);
            }

            // Check if full API is available
            console.log('\n📡 Checking API availability...');
            try {
                const projects = await this.listProjects();
                console.log(`   ✅ REST API available - ${projects.length || 0} project(s) found`);
            } catch (apiError) {
                console.log('   ⚠️  REST API not available or requires authentication');
                console.log('   💡 Enable the REST API in Gateway Configuration');
                console.log('   💡 Create an API key in Platform → Security → API Keys');
            }

            return true;
        } catch (error) {
            console.error('❌ Connection failed:', error.message);
            return false;
        }
    }
}

// ==================== CLI Interface ====================

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    // Create client with environment variables or defaults
    const client = new IgnitionAPIClient({
        baseUrl: process.env.IGNITION_API_URL || 'http://pred:8088/data/api/v1',
        apiKey: process.env.IGNITION_API_KEY || '',
        username: process.env.IGNITION_USERNAME || 'admin',
        password: process.env.IGNITION_PASSWORD || 'password',
        authMode: process.env.IGNITION_AUTH_MODE || 'basic'
    });

    async function main() {
        switch(command) {
            case 'test':
                await client.testConnection();
                break;

            case 'import':
                await client.importGitWayProject(args[1] || '.');
                break;

            case 'projects':
                const projects = await client.listProjects();
                console.log('Projects:', projects);
                break;

            case 'backup':
                await client.createBackup();
                break;

            case 'export-project':
                if (!args[1]) {
                    console.error('Usage: node ignition-api-client.js export-project <projectName>');
                    process.exit(1);
                }
                await client.exportProject(args[1]);
                break;

            case 'export-tags':
                await client.exportTags('[default]', {
                    outputFile: 'exported-tags.json',
                    recursive: true
                });
                break;

            case 'help':
            default:
                console.log(`
Ignition API Client - GitWay Integration

Usage: node ignition-api-client.js <command> [options]

Commands:
  test              Test API connection
  import [path]     Import complete GitWay project
  projects          List all projects
  backup            Create gateway backup
  export-project    Export project to zip
  export-tags       Export tags to JSON
  help              Show this help

Environment Variables:
  IGNITION_API_URL      Gateway API URL (default: http://pred:8088/data/api/v1)
  IGNITION_API_KEY      API key for authentication
  IGNITION_USERNAME     Username for basic auth (default: admin)
  IGNITION_PASSWORD     Password for basic auth
  IGNITION_AUTH_MODE    Authentication mode: 'apikey' or 'basic' (default: basic)

Examples:
  node ignition-api-client.js test
  node ignition-api-client.js import ../gitway
  IGNITION_API_KEY=abc123 node ignition-api-client.js projects
                `);
                break;
        }
    }

    main().catch(console.error);
}

module.exports = IgnitionAPIClient;