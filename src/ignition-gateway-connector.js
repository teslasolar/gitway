/**
 * Ignition Gateway Connector - Main Entry Point
 * Combines all modules for easy usage
 */

const IgnitionGatewayAPI = require('./ignition-api');
const AuthenticationHandler = require('./auth-handler');
const DataTransformer = require('./data-transformer');
const { TemplateExecutor } = require('./api-templates');

class IgnitionGatewayConnector {
    constructor(configOverrides = {}) {
        // Load configuration
        this.loadEnvironment();

        // Initialize API client
        this.api = new IgnitionGatewayAPI(configOverrides);

        // Initialize authentication
        this.auth = new AuthenticationHandler(this.api.config);

        // Initialize data transformer
        this.transformer = new DataTransformer();

        // Initialize template executor
        this.templates = new TemplateExecutor(this.api);

        this.isConnected = false;
    }

    /**
     * Load environment variables
     */
    loadEnvironment() {
        try {
            require('dotenv').config();
        } catch (e) {
            console.log('Note: dotenv not installed. Using environment variables directly.');
        }
    }

    /**
     * Connect to Ignition Gateway
     */
    async connect() {
        try {
            // Initialize authentication
            await this.auth.initialize(this.api);

            // Test connection
            const result = await this.api.testConnection();

            if (result.connected) {
                this.isConnected = true;
                console.log('✓ Connected to Ignition Gateway');
                console.log(`  Version: ${result.status?.version || 'Unknown'}`);
                console.log(`  Status: ${result.status?.state || 'Unknown'}`);
                return true;
            }

            throw new Error(result.error || 'Connection failed');
        } catch (error) {
            console.error('✗ Failed to connect:', error.message);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from gateway
     */
    disconnect() {
        this.isConnected = false;
        console.log('Disconnected from Ignition Gateway');
    }

    // ============= High-Level Operations =============

    /**
     * Read tags with transformation
     */
    async readTags(tagPaths, options = {}) {
        const results = await this.api.readTags(tagPaths, options);

        if (options.transform !== false) {
            return this.transformer.transformTagReadResults(results);
        }

        return results;
    }

    /**
     * Write tags with validation
     */
    async writeTags(tagWrites, options = {}) {
        const transformed = this.transformer.transformTagWriteData(tagWrites);
        return await this.api.writeTags(transformed, options);
    }

    /**
     * Query history with formatting
     */
    async queryHistory(tagPaths, startDate, endDate, options = {}) {
        const results = await this.api.queryTagHistory(
            tagPaths,
            startDate,
            endDate,
            options
        );

        const format = options.format || 'timeseries';
        return this.transformer.transformHistoryResults(results, format);
    }

    /**
     * Monitor tags in real-time
     */
    async monitorTags(tagPaths, callback, interval = 1000) {
        const monitor = setInterval(async () => {
            try {
                const values = await this.readTags(tagPaths);
                callback(null, values);
            } catch (error) {
                callback(error, null);
            }
        }, interval);

        return {
            stop: () => clearInterval(monitor)
        };
    }

    /**
     * Execute template
     */
    async executeTemplate(templatePath, ...params) {
        return await this.templates.execute(templatePath, ...params);
    }

    /**
     * Get active alarms
     */
    async getActiveAlarms(filters = {}) {
        const alarms = await this.api.queryAlarms({
            ...filters,
            state: ['ActiveUnacked', 'ActiveAcked']
        });

        return this.transformer.transformAlarmData(alarms);
    }

    /**
     * Execute named query with caching
     */
    async executeNamedQuery(path, parameters = {}, useCache = true) {
        const cacheKey = `nq_${path}_${JSON.stringify(parameters)}`;

        if (useCache) {
            const cached = this.api.getCached(cacheKey);
            if (cached) return cached;
        }

        const result = await this.api.executeNamedQuery(path, parameters);

        if (useCache) {
            this.api.cacheResult(cacheKey, result);
        }

        return result;
    }

    /**
     * Bulk operations
     */
    async bulk(operations) {
        return await this.api.batch(operations);
    }

    // ============= Utility Methods =============

    /**
     * Get gateway info
     */
    async getInfo() {
        return {
            status: await this.api.getStatus(),
            performance: await this.api.getPerformanceMetrics(),
            connection: {
                host: this.api.config.connection.host,
                port: this.api.config.connection.port,
                protocol: this.api.config.connection.protocol
            }
        };
    }

    /**
     * Export configuration
     */
    exportConfig() {
        const config = { ...this.api.config };

        // Remove sensitive data
        if (config.authentication) {
            config.authentication = {
                ...config.authentication,
                password: '***',
                apiKey: '***',
                clientSecret: '***'
            };
        }

        return config;
    }

    /**
     * Import configuration
     */
    importConfig(config) {
        this.api.loadConfiguration(config);
        this.auth.config = this.api.config;
    }
}

// ============= Example Usage =============

async function example() {
    // Create connector instance
    const gateway = new IgnitionGatewayConnector({
        connection: {
            host: 'your-ignition-server.com',
            port: 8088
        },
        authentication: {
            username: 'admin',
            password: 'password'
        }
    });

    try {
        // Connect to gateway
        await gateway.connect();

        // Read single tag
        const tagValue = await gateway.readTags('[default]Path/To/Tag');
        console.log('Tag value:', tagValue);

        // Read multiple tags
        const values = await gateway.readTags([
            '[default]Tag1',
            '[default]Tag2',
            '[default]Tag3'
        ]);
        console.log('Multiple values:', values);

        // Write tag
        await gateway.writeTags({
            path: '[default]Path/To/Tag',
            value: 100,
            dataType: 'Float4'
        });

        // Query history
        const history = await gateway.queryHistory(
            '[default]Path/To/Tag',
            new Date('2024-01-01'),
            new Date(),
            { format: 'table' }
        );
        console.log('History:', history);

        // Monitor tags in real-time
        const monitor = await gateway.monitorTags(
            ['[default]Tag1', '[default]Tag2'],
            (error, values) => {
                if (error) {
                    console.error('Monitor error:', error);
                } else {
                    console.log('Current values:', values);
                }
            },
            5000 // Poll every 5 seconds
        );

        // Stop monitoring after 30 seconds
        setTimeout(() => {
            monitor.stop();
            console.log('Monitoring stopped');
        }, 30000);

        // Get active alarms
        const alarms = await gateway.getActiveAlarms({
            priority: [3, 4] // High and Critical only
        });
        console.log('Active alarms:', alarms);

        // Execute named query
        const queryResult = await gateway.executeNamedQuery(
            'getProductionData',
            { startDate: '2024-01-01', endDate: '2024-01-31' }
        );
        console.log('Query result:', queryResult);

        // Use templates
        const templateResult = await gateway.executeTemplate(
            'tags.read.folder',
            '[default]Production',
            true // recursive
        );
        console.log('Folder contents:', templateResult);

        // Bulk operations
        const bulkResults = await gateway.bulk([
            {
                method: 'readTags',
                args: [['[default]Tag1', '[default]Tag2']]
            },
            {
                method: 'getActiveAlarms',
                args: []
            }
        ]);
        console.log('Bulk results:', bulkResults);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        gateway.disconnect();
    }
}

// Export the connector
module.exports = IgnitionGatewayConnector;

// Run example if called directly
if (require.main === module) {
    example().catch(console.error);
}