/**
 * Auto-Configuration System
 * Periodically discovers gateway components and updates the interface
 */

const GatewayDiscovery = require('./gateway-discovery');
const DynamicComponentBuilder = require('./dynamic-components');
const fs = require('fs');
const path = require('path');

class AutoConfigurator {
    constructor(options = {}) {
        this.discoveryInterval = options.discoveryInterval || 60000; // 1 minute default
        this.discovery = new GatewayDiscovery();
        this.builder = new DynamicComponentBuilder();
        this.lastConfig = null;
        this.running = false;
    }

    async start() {
        console.log('🚀 Starting Auto-Configuration System\n');
        console.log(`  Discovery interval: ${this.discoveryInterval / 1000} seconds`);
        console.log('  Press Ctrl+C to stop\n');

        this.running = true;

        // Run initial discovery
        await this.runDiscovery();

        // Set up periodic discovery
        this.intervalId = setInterval(async () => {
            if (this.running) {
                await this.runDiscovery();
            }
        }, this.discoveryInterval);
    }

    stop() {
        console.log('\n⏹ Stopping auto-configuration...');
        this.running = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    async runDiscovery() {
        console.log(`\n[${new Date().toISOString()}] Running discovery...`);

        try {
            // Run discovery
            const config = await this.discovery.discover();

            // Check if configuration has changed
            if (this.hasConfigChanged(config)) {
                console.log('📝 Configuration changed, rebuilding interface...');

                // Rebuild components
                const components = this.builder.buildComponents();
                console.log(`  Generated ${components.length} components`);

                // Save new HTML
                this.builder.saveHTML();

                // Save configuration snapshot
                this.saveSnapshot(config);

                this.lastConfig = config;

                console.log('✅ Interface updated successfully');
            } else {
                console.log('ℹ️  No changes detected');
            }
        } catch (error) {
            console.error('❌ Discovery failed:', error.message);
        }
    }

    hasConfigChanged(newConfig) {
        if (!this.lastConfig) return true;

        // Compare key metrics
        const oldEndpoints = Object.keys(this.lastConfig.apiEndpoints || {}).length;
        const newEndpoints = Object.keys(newConfig.apiEndpoints || {}).length;

        const oldModules = Object.keys(this.lastConfig.capabilities || {}).length;
        const newModules = Object.keys(newConfig.capabilities || {}).length;

        const oldFeatures = Object.values(this.lastConfig.features || {}).filter(f => f).length;
        const newFeatures = Object.values(newConfig.features || {}).filter(f => f).length;

        return oldEndpoints !== newEndpoints ||
               oldModules !== newModules ||
               oldFeatures !== newFeatures;
    }

    saveSnapshot(config) {
        const snapshotPath = path.join(__dirname, 'config-snapshots');

        // Create snapshots directory if it doesn't exist
        if (!fs.existsSync(snapshotPath)) {
            fs.mkdirSync(snapshotPath);
        }

        // Save snapshot with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(snapshotPath, `config-${timestamp}.json`);

        fs.writeFileSync(filename, JSON.stringify(config, null, 2));
        console.log(`  Snapshot saved: ${filename}`);
    }

    async monitorChanges() {
        console.log('\n🔍 Monitoring mode enabled');
        console.log('  Watching for changes in gateway configuration...\n');

        // Create a simple HTTP server to serve the dynamic interface
        const express = require('express');
        const app = express();
        const PORT = 8090;

        app.use(express.static(__dirname));

        app.get('/status', (req, res) => {
            res.json({
                running: this.running,
                lastDiscovery: this.lastConfig?.gateway?.discovered,
                components: Object.keys(this.lastConfig?.components || {}).length,
                features: Object.values(this.lastConfig?.features || {}).filter(f => f).length
            });
        });

        app.listen(PORT, () => {
            console.log(`📡 Monitoring interface available at: http://localhost:${PORT}/ignition-dynamic.html`);
            console.log(`📊 Status endpoint: http://localhost:${PORT}/status\n`);
        });
    }
}

// Command-line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse arguments
    args.forEach(arg => {
        if (arg.startsWith('--interval=')) {
            options.discoveryInterval = parseInt(arg.split('=')[1]) * 1000;
        }
    });

    const configurator = new AutoConfigurator(options);

    // Handle shutdown
    process.on('SIGINT', () => {
        configurator.stop();
        process.exit(0);
    });

    // Start auto-configuration
    configurator.start().catch(error => {
        console.error('Failed to start:', error);
        process.exit(1);
    });

    // Enable monitoring if requested
    if (args.includes('--monitor')) {
        configurator.monitorChanges();
    }
}

module.exports = AutoConfigurator;