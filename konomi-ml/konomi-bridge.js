/**
 * KonomiML JavaScript Bridge
 * Connects KonomiML State Engine with GitWay Database Systems
 * Provides state management for browser and Node.js environments
 * Developed by Konomi Systems - konomi-systems.com
 */

class KonomiMLBridge {
    constructor() {
        // Initialize state storage
        this.megaStates = new Map();
        this.stateHistory = [];
        this.currentState = null;
        this.stateTransitions = new Map();
        this.activeWorkflows = new Map();
        this.errorStates = [];

        // Load GitDB driver if available
        this.gitDBDriver = null;
        this.connections = new Map();

        // Initialize the mega state configuration
        this._loadMegaStates();

        console.log('🧠⚡ KonomiML Bridge initialized!');
        console.log(`💫 ${this.megaStates.size} states loaded`);
        console.log('Developed by Konomi Systems - konomi-systems.com');
    }

    /**
     * Load all state definitions
     */
    _loadMegaStates() {
        // Core System States (0-99)
        const systemStates = [
            [0, "SYSTEM_OFFLINE", "🔴", "System completely offline"],
            [1, "SYSTEM_BOOTING", "🟠", "System boot sequence initiated"],
            [2, "SYSTEM_INITIALIZING", "🟡", "System initialization in progress"],
            [3, "SYSTEM_LOADING", "⏳", "Loading system components"],
            [4, "SYSTEM_CONFIGURING", "⚙️", "Configuring system parameters"],
            [5, "SYSTEM_READY", "🟢", "System ready for operations"],
            [6, "SYSTEM_ACTIVE", "✅", "System actively processing"],
            [7, "SYSTEM_IDLE", "⏸️", "System idle, awaiting commands"],
            [8, "SYSTEM_SUSPENDED", "💤", "System suspended, low power"],
            [9, "SYSTEM_SHUTTING_DOWN", "🔻", "System shutdown sequence"],
        ];

        // AI/ML States (100-299)
        const aiStates = [
            [100, "AI_IDLE", "🤖", "AI system idle"],
            [101, "AI_INITIALIZING", "🧠", "AI system initializing"],
            [102, "AI_LOADING_MODEL", "📥", "Loading AI model"],
            [110, "TRAIN_PREPARING", "📚", "Preparing training data"],
            [117, "TRAIN_EPOCH_START", "🔄", "Starting training epoch"],
            [125, "TRAIN_COMPLETE", "🏆", "Training complete"],
            [130, "INFER_READY", "🎯", "Ready for inference"],
            [136, "INFER_EXECUTING", "⚡", "Executing inference"],
            [141, "INFER_COMPLETE", "✅", "Inference complete"],
        ];

        // Database States (300-399)
        const dbStates = [
            [300, "DB_OFFLINE", "🔌", "Database offline"],
            [301, "DB_CONNECTING", "🔄", "Connecting to database"],
            [303, "DB_CONNECTED", "✅", "Database connected"],
            [310, "TXN_IDLE", "⏸️", "Transaction idle"],
            [311, "TXN_STARTING", "🚀", "Starting transaction"],
            [312, "TXN_ACTIVE", "▶️", "Transaction active"],
            [314, "TXN_COMMITTING", "💾", "Committing transaction"],
            [315, "TXN_COMMITTED", "✅", "Transaction committed"],
            [316, "TXN_ROLLING_BACK", "↩️", "Rolling back"],
            [317, "TXN_ROLLED_BACK", "🔙", "Rolled back"],
            [320, "QUERY_PARSING", "📝", "Parsing query"],
            [323, "QUERY_EXECUTING", "▶️", "Executing query"],
            [330, "QUERY_COMPLETE", "✅", "Query complete"],
        ];

        // Git States (400-499)
        const gitStates = [
            [400, "GIT_UNINITIALIZED", "📂", "No Git repository"],
            [401, "GIT_INITIALIZING", "🌱", "Initializing repository"],
            [402, "GIT_CLEAN", "✨", "Working tree clean"],
            [403, "GIT_MODIFIED", "📝", "Files modified"],
            [410, "GIT_COMMITTING", "💾", "Creating commit"],
            [432, "GIT_PUSHING", "⬆️", "Pushing changes"],
            [433, "GIT_SYNCING", "🔄", "Synchronizing"],
        ];

        // Error States (900-999)
        const errorStates = [
            [900, "ERROR_UNKNOWN", "❓", "Unknown error"],
            [901, "ERROR_SYSTEM", "💀", "System error"],
            [902, "ERROR_FATAL", "☠️", "Fatal error"],
            [903, "ERROR_CRITICAL", "🆘", "Critical error"],
            [904, "ERROR_WARNING", "⚠️", "Warning"],
            [960, "RECOVERY_STARTING", "🏥", "Recovery starting"],
            [963, "RECOVERY_COMPLETE", "✅", "Recovery complete"],
        ];

        // Load all states
        [...systemStates, ...aiStates, ...dbStates, ...gitStates, ...errorStates]
            .forEach(([id, name, emoji, description]) => {
                this.megaStates.set(id, {
                    id,
                    name,
                    emoji,
                    description,
                    category: this._getStateCategory(id),
                    timestamp: Date.now()
                });
            });
    }

    /**
     * Get state category based on ID range
     */
    _getStateCategory(stateId) {
        if (stateId < 100) return "SYSTEM";
        if (stateId < 300) return "AI_ML";
        if (stateId < 400) return "DATABASE";
        if (stateId < 500) return "GIT";
        if (stateId < 600) return "PIPELINE";
        if (stateId < 650) return "SECURITY";
        if (stateId < 700) return "NETWORK";
        if (stateId < 750) return "MONITORING";
        if (stateId < 900) return "DEPLOYMENT";
        return "ERROR";
    }

    /**
     * Initialize GitDB driver connection
     */
    async initializeGitDB() {
        try {
            // Check if GitDB driver is available
            if (typeof GitDBDriver !== 'undefined') {
                this.gitDBDriver = new GitDBDriver();
                this.gitDBDriver.addDatasource({
                    name: 'KonomiDB',
                    driver: 'com.github.gitdb.mysql'
                });

                await this.transitionTo(5, "GitDB initialized");
                console.log('✅ GitDB driver connected');
                return true;
            }
        } catch (error) {
            await this.transitionTo(901, `GitDB init failed: ${error.message}`);
            console.error('❌ GitDB initialization failed:', error);
            return false;
        }
    }

    /**
     * Transition to a new state
     */
    async transitionTo(targetState, metadata = null) {
        const stateInfo = this.megaStates.get(targetState);

        if (!stateInfo) {
            console.error(`❌ Invalid state ID: ${targetState}`);
            return false;
        }

        // Record transition
        const transition = {
            fromState: this.currentState?.id || 0,
            toState: targetState,
            timestamp: Date.now(),
            metadata
        };

        this.stateHistory.push(transition);

        // Update current state
        this.currentState = {
            ...stateInfo,
            timestamp: Date.now(),
            metadata
        };

        // Visual output
        const { emoji, name, description, category } = stateInfo;
        console.log(`  [${category}] ${emoji} ${name} - ${description}`);

        // Track errors
        if (targetState >= 900) {
            this.errorStates.push(targetState);
        }

        // Emit state change event for UI updates
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('konomi-state-change', {
                detail: { state: this.currentState, transition }
            }));
        }

        return true;
    }

    /**
     * Connect to database with state tracking
     */
    async connectDatabase(dbName, driverType = 'mysql') {
        console.log(`🔄 Connecting to database: ${dbName}`);

        const driverStates = {
            'mysql': 40,
            'mssql': 41,
            'postgres': 42,
            'oracle': 43,
            'mariadb': 44
        };

        await this.transitionTo(301, "DB_CONNECT_START");

        try {
            if (this.gitDBDriver) {
                const driverClass = `com.github.gitdb.${driverType}`;
                const conn = this.gitDBDriver.getConnection(dbName, driverClass);

                this.connections.set(dbName, {
                    connection: conn,
                    driver: driverType,
                    connected: true,
                    created: Date.now()
                });

                await this.transitionTo(303, "DB_CONNECTED");

                // Set driver-specific state
                const driverState = driverStates[driverType] || 40;
                await this.transitionTo(driverState, "DRIVER_ACTIVE");

                console.log(`✅ Connected to ${dbName} using ${driverType} driver`);
                return conn;
            }
        } catch (error) {
            await this.transitionTo(90, `CONNECTION_ERROR: ${error.message}`);
            console.error('❌ Connection failed:', error);
            return null;
        }
    }

    /**
     * Execute query with state tracking
     */
    async executeQuery(dbName, query, params = []) {
        const conn = this.connections.get(dbName);
        if (!conn) {
            console.error(`❌ No active connection for: ${dbName}`);
            return null;
        }

        console.log(`⚡ Executing query on: ${dbName}`);
        console.log(`   Query: ${query.substring(0, 50)}...`);

        await this.transitionTo(320, "QUERY_PARSING");
        await this.sleep(300);

        await this.transitionTo(323, "QUERY_EXECUTING");
        await this.sleep(500);

        try {
            const result = await conn.connection.runQuery(query, params);

            await this.transitionTo(330, "QUERY_COMPLETE");
            console.log('✅ Query executed successfully');
            return result;

        } catch (error) {
            await this.transitionTo(91, `QUERY_ERROR: ${error.message}`);
            console.error('❌ Query failed:', error);
            return null;
        }
    }

    /**
     * Execute a mega workflow
     */
    async executeMegaWorkflow(workflowName) {
        console.log(`🌟 Executing MEGA workflow: ${workflowName}`);

        const workflows = {
            'ai_training': [
                [1, "System boot"],
                [100, "AI idle"],
                [101, "AI initializing"],
                [110, "Preparing training data"],
                [117, "Epoch start"],
                [125, "Training complete"],
                [400, "Git init"],
                [410, "Git committing"],
                [432, "Git pushing"],
                [5, "System ready"]
            ],
            'database_cycle': [
                [1, "System boot"],
                [301, "DB connecting"],
                [303, "DB connected"],
                [311, "Transaction starting"],
                [312, "Transaction active"],
                [320, "Query parsing"],
                [323, "Query executing"],
                [330, "Query complete"],
                [314, "Committing"],
                [315, "Committed"],
                [5, "Complete"]
            ],
            'error_recovery': [
                [903, "Critical error"],
                [960, "Recovery starting"],
                [961, "Recovery in progress"],
                [963, "Recovery complete"],
                [5, "System ready"]
            ]
        };

        const workflow = workflows[workflowName];
        if (!workflow) {
            console.error(`❌ Unknown workflow: ${workflowName}`);
            return false;
        }

        for (const [stateId, description] of workflow) {
            await this.transitionTo(stateId, description);
            await this.sleep(500);
        }

        console.log(`✅ Workflow complete: ${workflowName}`);
        return true;
    }

    /**
     * Get visual state dashboard
     */
    getStateDashboard() {
        const categories = {};

        for (const [id, state] of this.megaStates) {
            const cat = state.category;
            if (!categories[cat]) {
                categories[cat] = [];
            }
            categories[cat].push(state);
        }

        return {
            current: this.currentState,
            categories,
            totalStates: this.megaStates.size,
            historyCount: this.stateHistory.length,
            errorCount: this.errorStates.length,
            connections: Array.from(this.connections.keys())
        };
    }

    /**
     * Create visual state monitor element
     */
    createStateMonitor() {
        if (typeof document === 'undefined') return null;

        const monitor = document.createElement('div');
        monitor.id = 'konomi-state-monitor';
        monitor.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border: 1px solid #00ff00;
            border-radius: 5px;
            z-index: 10000;
            max-height: 400px;
            overflow-y: auto;
        `;

        this.updateMonitor(monitor);

        // Update on state changes
        window.addEventListener('konomi-state-change', () => {
            this.updateMonitor(monitor);
        });

        return monitor;
    }

    /**
     * Update state monitor display
     */
    updateMonitor(monitor) {
        if (!monitor) return;

        const dashboard = this.getStateDashboard();
        const current = dashboard.current || { emoji: '❓', name: 'UNKNOWN', category: 'SYSTEM' };

        monitor.innerHTML = `
            <div style="border-bottom: 1px solid #00ff00; padding-bottom: 5px; margin-bottom: 5px;">
                <strong>🧠 KonomiML State Monitor</strong>
            </div>
            <div>Current: ${current.emoji} ${current.name}</div>
            <div>Category: ${current.category}</div>
            <div>States: ${dashboard.totalStates}</div>
            <div>History: ${dashboard.historyCount}</div>
            <div>Errors: ${dashboard.errorCount}</div>
            <div>DBs: ${dashboard.connections.join(', ') || 'None'}</div>
            <div style="margin-top: 10px; border-top: 1px solid #00ff00; padding-top: 5px;">
                <strong>Recent:</strong>
            </div>
            ${this.stateHistory.slice(-5).reverse().map(t => {
                const state = this.megaStates.get(t.toState);
                return `<div>${state.emoji} ${state.name}</div>`;
            }).join('')}
        `;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Export state data for analysis
     */
    exportStateData() {
        return {
            states: Array.from(this.megaStates.values()),
            history: this.stateHistory,
            current: this.currentState,
            errors: this.errorStates,
            timestamp: Date.now()
        };
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KonomiMLBridge;
} else if (typeof window !== 'undefined') {
    window.KonomiMLBridge = KonomiMLBridge;
}

// Auto-initialize in browser with visual monitor
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const konomi = new KonomiMLBridge();
        window.konomiML = konomi;

        // Initialize GitDB if available
        if (typeof GitDBDriver !== 'undefined') {
            konomi.initializeGitDB();
        }

        // Create visual monitor
        const monitor = konomi.createStateMonitor();
        if (monitor) {
            document.body.appendChild(monitor);
        }

        console.log('🧠 KonomiML Bridge ready in browser!');
    });
}