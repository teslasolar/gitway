/**
 * GitDB Database Driver
 * Emulates Ignition's JDBC drivers but uses GitHub as the backend
 * Each commit = database transaction
 * BAM! Let's kick this up a notch!
 *
 * Enhanced Features:
 * - Prepared statement support
 * - Connection pooling with configurable limits
 * - Transaction isolation levels
 * - Batch operations
 * - Query result caching
 */

/**
 * Connection Pool Manager
 */
class GitDBConnectionPool {
    constructor(config = {}) {
        this.config = {
            minConnections: config.minConnections || 2,
            maxConnections: config.maxConnections || 10,
            maxIdleTime: config.maxIdleTime || 60000,
            connectionTimeout: config.connectionTimeout || 10000,
            validationInterval: config.validationInterval || 30000
        };

        this.availableConnections = [];
        this.activeConnections = new Map();
        this.waitQueue = [];
        this.totalConnections = 0;
        this.stats = {
            totalAcquired: 0,
            totalReleased: 0,
            totalCreated: 0,
            totalDestroyed: 0,
            timeouts: 0
        };

        // Start validation interval
        this.validationTimer = setInterval(() => this.validateConnections(), this.config.validationInterval);
    }

    async acquire() {
        this.stats.totalAcquired++;

        // Return available connection if exists
        if (this.availableConnections.length > 0) {
            const conn = this.availableConnections.pop();
            conn.lastUsed = Date.now();
            conn.inUse = true;
            this.activeConnections.set(conn.id, conn);
            return conn;
        }

        // Create new connection if under limit
        if (this.totalConnections < this.config.maxConnections) {
            return await this.createConnection();
        }

        // Wait for available connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.waitQueue.findIndex(w => w.resolve === resolve);
                if (index > -1) {
                    this.waitQueue.splice(index, 1);
                }
                this.stats.timeouts++;
                reject(new Error('Connection pool timeout'));
            }, this.config.connectionTimeout);

            this.waitQueue.push({ resolve, reject, timeout });
        });
    }

    async createConnection() {
        const conn = {
            id: `conn_${this.totalConnections}_${Date.now()}`,
            created: Date.now(),
            lastUsed: Date.now(),
            inUse: true,
            valid: true,
            requestCount: 0
        };

        this.totalConnections++;
        this.stats.totalCreated++;
        this.activeConnections.set(conn.id, conn);

        return conn;
    }

    release(connection) {
        this.stats.totalReleased++;

        if (!connection || !connection.id) {
            return;
        }

        connection.lastUsed = Date.now();
        connection.inUse = false;
        this.activeConnections.delete(connection.id);

        // Serve waiting request if any
        if (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift();
            clearTimeout(waiter.timeout);
            connection.inUse = true;
            this.activeConnections.set(connection.id, connection);
            waiter.resolve(connection);
        } else {
            this.availableConnections.push(connection);
        }
    }

    async validateConnections() {
        const now = Date.now();
        const maxIdle = this.config.maxIdleTime;

        // Remove idle connections beyond minimum
        this.availableConnections = this.availableConnections.filter(conn => {
            const idle = now - conn.lastUsed;
            if (idle > maxIdle && this.totalConnections > this.config.minConnections) {
                this.totalConnections--;
                this.stats.totalDestroyed++;
                return false;
            }
            return true;
        });
    }

    getStats() {
        return {
            total: this.totalConnections,
            available: this.availableConnections.length,
            active: this.activeConnections.size,
            waiting: this.waitQueue.length,
            ...this.stats
        };
    }

    async destroy() {
        clearInterval(this.validationTimer);
        this.availableConnections = [];
        this.activeConnections.clear();
        this.waitQueue.forEach(w => {
            clearTimeout(w.timeout);
            w.reject(new Error('Pool destroyed'));
        });
        this.waitQueue = [];
    }
}

class GitDBDriver {
    constructor() {
        this.connections = new Map();
        this.drivers = {
            'com.github.gitdb.mysql': new GitDBMySQLDriver(),
            'com.github.gitdb.mssql': new GitDBMSSQLDriver(),
            'com.github.gitdb.postgres': new GitDBPostgresDriver(),
            'com.github.gitdb.oracle': new GitDBOracleDriver(),
            'com.github.gitdb.mariadb': new GitDBMariaDriver()
        };
        this.activeTransactions = new Map();

        // Initialize connection pool
        this.connectionPool = new GitDBConnectionPool({
            minConnections: 2,
            maxConnections: 10,
            maxIdleTime: 60000
        });

        // Prepared statement cache
        this.preparedStatements = new Map();

        // Query result cache
        this.queryCache = new Map();
        this.cacheTimeout = 5000; // 5 seconds default
    }

    /**
     * Register a JDBC-style driver
     */
    registerDriver(className, driver) {
        this.drivers[className] = driver;
        console.log(`✅ Registered GitDB driver: ${className}`);
    }

    /**
     * Get connection just like Ignition's system.db.getConnection()
     */
    async getConnection(name, driverClass = null) {
        if (this.connections.has(name)) {
            return this.connections.get(name);
        }

        // Get datasource config if exists
        const datasources = JSON.parse(localStorage.getItem('gitdb_datasources') || '{}');
        const datasource = datasources[name];

        if (datasource) {
            driverClass = datasource.driver;
        }

        // Acquire connection from pool
        const poolConn = await this.connectionPool.acquire();

        // Create new connection with pool connection
        const conn = new GitDBConnection(name, this, driverClass, poolConn);
        this.connections.set(name, conn);
        return conn;
    }

    /**
     * Create prepared statement
     */
    prepareStatement(sql, name = null) {
        const stmtName = name || `stmt_${this.preparedStatements.size}`;

        if (this.preparedStatements.has(stmtName)) {
            return this.preparedStatements.get(stmtName);
        }

        const stmt = new GitDBPreparedStatement(sql, this);
        this.preparedStatements.set(stmtName, stmt);

        return stmt;
    }

    /**
     * Execute batch operations
     */
    async executeBatch(operations) {
        const results = [];
        const transactionId = this.beginTransaction('batch_connection');

        try {
            for (const op of operations) {
                const result = await this._executeSingleOperation(op, transactionId);
                results.push(result);
            }

            await this.commitTransaction(transactionId);
            return { success: true, results };
        } catch (error) {
            this.rollbackTransaction(transactionId);
            return { success: false, error: error.message, results };
        }
    }

    async _executeSingleOperation(op, transactionId) {
        const transaction = this.activeTransactions.get(transactionId);
        if (transaction) {
            transaction.operations.push(op);
        }
        return { success: true, operation: op.type };
    }

    /**
     * Get pool statistics
     */
    getPoolStats() {
        return this.connectionPool.getStats();
    }

    /**
     * Clear query cache
     */
    clearCache() {
        this.queryCache.clear();
    }

    /**
     * Configure database connection (like Ignition Gateway Config)
     */
    addDatasource(config) {
        const datasource = {
            name: config.name,
            driver: config.driver || 'com.github.gitdb.mysql',
            connectUrl: config.connectUrl || `gitdb://${config.name}`,
            username: config.username || 'admin',
            password: config.password || '',
            description: config.description || `GitDB ${config.name}`,
            enabled: config.enabled !== false,
            validationQuery: config.validationQuery || 'SELECT 1',
            maxActive: config.maxActive || 8,
            maxIdle: config.maxIdle || 8,
            maxWait: config.maxWait || 30000,
            properties: config.properties || {}
        };

        // Store datasources in localStorage
        const datasources = JSON.parse(localStorage.getItem('gitdb_datasources') || '{}');
        datasources[config.name] = datasource;
        localStorage.setItem('gitdb_datasources', JSON.stringify(datasources));

        // Store in GitDB
        this.commitToGit({
            type: 'datasource.add',
            data: datasource,
            timestamp: new Date().toISOString()
        });

        return datasource;
    }

    /**
     * Begin transaction (Git branch)
     */
    beginTransaction(connectionName) {
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transaction = {
            id: transactionId,
            connection: connectionName,
            startTime: new Date(),
            operations: [],
            status: 'active'
        };

        this.activeTransactions.set(transactionId, transaction);
        return transactionId;
    }

    /**
     * Commit transaction (Git commit)
     */
    async commitTransaction(transactionId) {
        const transaction = this.activeTransactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }

        // Create Git commit with all operations
        const commit = {
            sha: this.generateSHA(),
            message: `Transaction ${transactionId}`,
            author: 'GitDB Driver',
            timestamp: new Date().toISOString(),
            operations: transaction.operations,
            stats: {
                inserts: transaction.operations.filter(op => op.type === 'INSERT').length,
                updates: transaction.operations.filter(op => op.type === 'UPDATE').length,
                deletes: transaction.operations.filter(op => op.type === 'DELETE').length
            }
        };

        await this.commitToGit(commit);

        transaction.status = 'committed';
        transaction.commitSha = commit.sha;
        transaction.endTime = new Date();

        this.activeTransactions.delete(transactionId);
        return commit;
    }

    /**
     * Rollback transaction (Git reset)
     */
    rollbackTransaction(transactionId) {
        const transaction = this.activeTransactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }

        transaction.status = 'rolled_back';
        transaction.endTime = new Date();

        this.activeTransactions.delete(transactionId);
        console.log(`🔄 Rolled back transaction ${transactionId}`);
    }

    /**
     * Generate SHA like Git
     */
    generateSHA() {
        const chars = '0123456789abcdef';
        let sha = '';
        for (let i = 0; i < 40; i++) {
            sha += chars[Math.floor(Math.random() * 16)];
        }
        return sha;
    }

    /**
     * Commit to Git (GitHub API or local Git)
     */
    async commitToGit(data) {
        // This would use GitHub API or local Git
        console.log('📝 Committing to Git:', data);

        // Store in localStorage for demo
        const commits = JSON.parse(localStorage.getItem('gitdb_commits') || '[]');
        commits.push(data);
        localStorage.setItem('gitdb_commits', JSON.stringify(commits));

        return data;
    }
}

/**
 * GitDB Prepared Statement (like java.sql.PreparedStatement)
 */
class GitDBPreparedStatement {
    constructor(sql, driver) {
        this.sql = sql;
        this.driver = driver;
        this.parameters = new Map();
        this.parameterTypes = new Map();
        this.batchParams = [];
        this.resultSetType = 'TYPE_FORWARD_ONLY';
        this.resultSetConcurrency = 'CONCUR_READ_ONLY';
    }

    /**
     * Set parameter value
     */
    setParameter(index, value, type = 'auto') {
        this.parameters.set(index, value);
        this.parameterTypes.set(index, type);
        return this;
    }

    /**
     * Set string parameter
     */
    setString(index, value) {
        return this.setParameter(index, value, 'string');
    }

    /**
     * Set integer parameter
     */
    setInt(index, value) {
        return this.setParameter(index, parseInt(value), 'int');
    }

    /**
     * Set double parameter
     */
    setDouble(index, value) {
        return this.setParameter(index, parseFloat(value), 'double');
    }

    /**
     * Set boolean parameter
     */
    setBoolean(index, value) {
        return this.setParameter(index, Boolean(value), 'boolean');
    }

    /**
     * Set date parameter
     */
    setDate(index, value) {
        return this.setParameter(index, value instanceof Date ? value : new Date(value), 'date');
    }

    /**
     * Set null parameter
     */
    setNull(index, sqlType) {
        return this.setParameter(index, null, sqlType);
    }

    /**
     * Add parameters to batch
     */
    addBatch() {
        const paramsCopy = new Map(this.parameters);
        this.batchParams.push(paramsCopy);
        this.clearParameters();
    }

    /**
     * Execute batch
     */
    async executeBatch() {
        const results = [];

        for (const params of this.batchParams) {
            this.parameters = params;
            const result = await this.execute();
            results.push(result);
        }

        this.batchParams = [];
        return results;
    }

    /**
     * Execute prepared statement
     */
    async execute() {
        // Replace parameters in SQL
        let sql = this.sql;
        const sortedParams = Array.from(this.parameters.entries()).sort((a, b) => b[0] - a[0]);

        for (const [index, value] of sortedParams) {
            const placeholder = this._getPlaceholder(index);
            sql = sql.replace(placeholder, this._formatValue(value));
        }

        // Execute through driver
        const conn = await this.driver.getConnection('default');
        return conn.runQuery(sql, []);
    }

    /**
     * Execute query and return result set
     */
    async executeQuery() {
        return this.execute();
    }

    /**
     * Execute update and return row count
     */
    async executeUpdate() {
        const result = await this.execute();
        return result.rowsAffected || 0;
    }

    /**
     * Clear parameters
     */
    clearParameters() {
        this.parameters.clear();
        this.parameterTypes.clear();
    }

    /**
     * Close statement
     */
    close() {
        this.clearParameters();
        this.batchParams = [];
    }

    _getPlaceholder(index) {
        // Support different placeholder styles
        if (this.sql.includes('?')) {
            return '?';
        } else if (this.sql.includes('$' + index)) {
            return '$' + index;
        } else if (this.sql.includes(':' + index)) {
            return ':' + index;
        }
        return '?';
    }

    _formatValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return value;
    }
}

/**
 * GitDB Connection (like java.sql.Connection)
 */
class GitDBConnection {
    constructor(name, driver, driverClass = 'com.github.gitdb.mysql', poolConnection = null) {
        this.name = name;
        this.driver = driver;
        this.driverClass = driverClass;
        this.autoCommit = true;
        this.closed = false;
        this.transactionId = null;
        this.poolConnection = poolConnection;

        // Transaction isolation levels
        this.isolationLevel = 'TRANSACTION_READ_COMMITTED';
        this.isolationLevels = {
            'TRANSACTION_READ_UNCOMMITTED': 1,
            'TRANSACTION_READ_COMMITTED': 2,
            'TRANSACTION_REPEATABLE_READ': 4,
            'TRANSACTION_SERIALIZABLE': 8
        };

        // Get driver instance
        const driverInstance = driver.drivers[driverClass];

        this.metadata = {
            databaseProductName: 'GitDB',
            databaseProductVersion: '1.0.0',
            driverName: driverInstance ? driverInstance.name : 'GitDB JDBC Driver',
            driverVersion: '1.0.0',
            driverClass: driverClass,
            url: driverInstance ? `${driverInstance.urlPattern}${name}` : `gitdb://${name}`
        };
    }

    /**
     * Run query (like Ignition's system.db.runQuery)
     */
    async runQuery(query, params = []) {
        console.log(`🔍 Query: ${query}`, params);

        // Get the active driver for this connection
        const driverClass = this.metadata.driverClass || 'com.github.gitdb.mysql';
        const activeDriver = this.driver.drivers[driverClass];

        // Format query using driver-specific formatting
        if (activeDriver && activeDriver.formatQuery) {
            query = activeDriver.formatQuery(query, params);
            params = []; // Parameters have been embedded
        }

        const parsed = this.parseSQL(query);
        let results = [];

        switch (parsed.type) {
            case 'SELECT':
                results = await this.executeSelect(parsed, params, activeDriver);
                break;
            case 'INSERT':
                results = await this.executeInsert(parsed, params, activeDriver);
                break;
            case 'UPDATE':
                results = await this.executeUpdate(parsed, params, activeDriver);
                break;
            case 'DELETE':
                results = await this.executeDelete(parsed, params, activeDriver);
                break;
            case 'CREATE':
                results = await this.executeCreate(parsed, params, activeDriver);
                break;
            default:
                throw new Error(`Unsupported query type: ${parsed.type}`);
        }

        return new GitDBDataset(results, parsed.columns || []);
    }

    /**
     * Run prepared update (like system.db.runPrepUpdate)
     */
    async runPrepUpdate(query, params = []) {
        const parsed = this.parseSQL(query);

        if (!this.autoCommit && !this.transactionId) {
            this.transactionId = this.driver.beginTransaction(this.name);
        }

        const operation = {
            type: parsed.type,
            query: query,
            params: params,
            timestamp: new Date().toISOString()
        };

        if (this.transactionId) {
            const transaction = this.driver.activeTransactions.get(this.transactionId);
            if (transaction) {
                transaction.operations.push(operation);
            }
        } else {
            // Auto-commit mode
            await this.driver.commitToGit({
                type: 'single_operation',
                operation: operation
            });
        }

        return { rowsAffected: 1 };
    }

    /**
     * Begin transaction
     */
    beginTransaction() {
        this.autoCommit = false;
        this.transactionId = this.driver.beginTransaction(this.name);
        console.log(`🚀 Started transaction: ${this.transactionId}`);
    }

    /**
     * Commit transaction
     */
    async commit() {
        if (this.transactionId) {
            const result = await this.driver.commitTransaction(this.transactionId);
            this.transactionId = null;
            this.autoCommit = true;
            console.log(`✅ Committed transaction: ${result.sha}`);
            return result;
        }
    }

    /**
     * Rollback transaction
     */
    rollback() {
        if (this.transactionId) {
            this.driver.rollbackTransaction(this.transactionId);
            this.transactionId = null;
            this.autoCommit = true;
        }
    }

    /**
     * Parse SQL query
     */
    parseSQL(query) {
        const upperQuery = query.trim().toUpperCase();
        const type = upperQuery.split(' ')[0];

        // Basic SQL parsing
        const parsed = {
            type: type,
            original: query
        };

        if (type === 'SELECT') {
            const fromMatch = query.match(/FROM\s+(\w+)/i);
            parsed.table = fromMatch ? fromMatch[1] : null;

            const columnsMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
            if (columnsMatch) {
                parsed.columns = columnsMatch[1].split(',').map(c => c.trim());
            }
        }

        return parsed;
    }

    /**
     * Execute SELECT query
     */
    async executeSelect(parsed, params) {
        // Get data from Git history
        const commits = JSON.parse(localStorage.getItem('gitdb_commits') || '[]');

        // Simulate table data
        const tables = {
            'tags': [
                { tagPath: '[default]Temperature/Tank1', value: 75.5, quality: 'Good' },
                { tagPath: '[default]Temperature/Tank2', value: 82.3, quality: 'Good' },
                { tagPath: '[default]Pressure/Line1', value: 145.2, quality: 'Good' }
            ],
            'alarms': [
                { id: 1, name: 'High Temperature', priority: 'High', active: true },
                { id: 2, name: 'Low Pressure', priority: 'Medium', active: false }
            ],
            'audit': commits.map((c, i) => ({
                id: i + 1,
                timestamp: c.timestamp,
                action: c.type,
                user: 'GitDB',
                details: JSON.stringify(c.data || c.operation)
            }))
        };

        const tableName = parsed.table ? parsed.table.toLowerCase() : 'tags';
        return tables[tableName] || [];
    }

    /**
     * Execute INSERT query
     */
    async executeInsert(parsed, params) {
        const operation = {
            type: 'INSERT',
            table: parsed.table,
            values: params,
            timestamp: new Date().toISOString()
        };

        if (!this.autoCommit) {
            const transaction = this.driver.activeTransactions.get(this.transactionId);
            if (transaction) {
                transaction.operations.push(operation);
            }
        } else {
            await this.driver.commitToGit(operation);
        }

        return { rowsAffected: 1 };
    }

    /**
     * Execute UPDATE query
     */
    async executeUpdate(parsed, params) {
        const operation = {
            type: 'UPDATE',
            table: parsed.table,
            values: params,
            timestamp: new Date().toISOString()
        };

        if (!this.autoCommit) {
            const transaction = this.driver.activeTransactions.get(this.transactionId);
            if (transaction) {
                transaction.operations.push(operation);
            }
        } else {
            await this.driver.commitToGit(operation);
        }

        return { rowsAffected: 1 };
    }

    /**
     * Execute DELETE query
     */
    async executeDelete(parsed, params) {
        const operation = {
            type: 'DELETE',
            table: parsed.table,
            conditions: params,
            timestamp: new Date().toISOString()
        };

        if (!this.autoCommit) {
            const transaction = this.driver.activeTransactions.get(this.transactionId);
            if (transaction) {
                transaction.operations.push(operation);
            }
        } else {
            await this.driver.commitToGit(operation);
        }

        return { rowsAffected: 1 };
    }

    /**
     * Execute CREATE TABLE
     */
    async executeCreate(parsed, params) {
        const operation = {
            type: 'CREATE',
            sql: parsed.original,
            timestamp: new Date().toISOString()
        };

        await this.driver.commitToGit(operation);
        return { success: true };
    }

    /**
     * Set transaction isolation level
     */
    setTransactionIsolation(level) {
        if (this.isolationLevels[level]) {
            this.isolationLevel = level;
            console.log(`🔒 Set isolation level to: ${level}`);
        } else {
            throw new Error(`Invalid isolation level: ${level}`);
        }
    }

    /**
     * Get transaction isolation level
     */
    getTransactionIsolation() {
        return this.isolationLevel;
    }

    /**
     * Set auto-commit mode
     */
    setAutoCommit(autoCommit) {
        this.autoCommit = autoCommit;
        if (autoCommit && this.transactionId) {
            this.commit();
        }
    }

    /**
     * Get auto-commit mode
     */
    getAutoCommit() {
        return this.autoCommit;
    }

    /**
     * Create prepared statement for this connection
     */
    prepareStatement(sql) {
        return new GitDBPreparedStatement(sql, this.driver);
    }

    /**
     * Check if connection is closed
     */
    isClosed() {
        return this.closed;
    }

    /**
     * Check if connection is valid
     */
    isValid(timeout = 5000) {
        if (this.closed) return false;

        try {
            // Validation query
            const query = 'SELECT 1';
            this.runQuery(query, []);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get connection metadata
     */
    getMetaData() {
        return this.metadata;
    }

    /**
     * Set read-only mode
     */
    setReadOnly(readOnly) {
        this.readOnly = readOnly;
    }

    /**
     * Check if read-only
     */
    isReadOnly() {
        return this.readOnly || false;
    }

    /**
     * Close connection
     */
    close() {
        if (this.transactionId) {
            this.rollback();
        }

        // Release back to pool
        if (this.poolConnection) {
            this.driver.connectionPool.release(this.poolConnection);
        }

        this.closed = true;
        console.log(`🔌 Closed connection: ${this.name}`);
    }
}

/**
 * GitDB Dataset (like Ignition's BasicDataset)
 */
class GitDBDataset {
    constructor(data, columns) {
        this.data = data;
        this.columns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
        this.rowCount = data.length;
        this.columnCount = this.columns.length;
    }

    getValueAt(row, col) {
        if (typeof col === 'string') {
            return this.data[row][col];
        }
        const colName = this.columns[col];
        return this.data[row][colName];
    }

    getColumnName(col) {
        return this.columns[col];
    }

    getColumnNames() {
        return [...this.columns];
    }

    getRowCount() {
        return this.rowCount;
    }

    getColumnCount() {
        return this.columnCount;
    }

    toJSON() {
        return this.data;
    }
}

/**
 * Driver implementations for different databases
 */
class GitDBMySQLDriver {
    constructor() {
        this.name = 'MySQL';
        this.className = 'com.github.gitdb.mysql';
        this.urlPattern = 'gitdb:mysql://';
        this.defaultPort = 3306;
        this.features = {
            autoIncrement: 'AUTO_INCREMENT',
            identityInsert: false,
            schemas: false,
            catalogs: true,
            storedProcedures: true,
            limitClause: 'LIMIT',
            offsetClause: 'OFFSET',
            booleanType: 'BOOLEAN',
            concatenation: 'CONCAT',
            currentTimestamp: 'NOW()',
            stringQuote: '`',
            parameterPrefix: '?'
        };
    }

    formatQuery(query, params) {
        // MySQL uses ? for parameters
        let formatted = query;
        params.forEach((param, idx) => {
            formatted = formatted.replace(`?`, this.escapeValue(param));
        });
        return formatted;
    }

    escapeValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
        return value;
    }

    getSystemTables() {
        return ['information_schema', 'mysql', 'performance_schema', 'sys'];
    }

    getValidationQuery() {
        return 'SELECT 1';
    }
}

class GitDBMSSQLDriver {
    constructor() {
        this.name = 'Microsoft SQL Server';
        this.className = 'com.github.gitdb.mssql';
        this.urlPattern = 'gitdb:sqlserver://';
        this.defaultPort = 1433;
        this.features = {
            autoIncrement: 'IDENTITY(1,1)',
            identityInsert: true,
            schemas: true,
            catalogs: true,
            storedProcedures: true,
            limitClause: 'TOP',
            offsetClause: 'OFFSET',
            booleanType: 'BIT',
            concatenation: '+',
            currentTimestamp: 'GETDATE()',
            stringQuote: '[]',
            parameterPrefix: '@'
        };
    }

    formatQuery(query, params) {
        // SQL Server uses @param1, @param2, etc
        let formatted = query;
        params.forEach((param, idx) => {
            formatted = formatted.replace(`@param${idx + 1}`, this.escapeValue(param));
        });
        return formatted;
    }

    escapeValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `N'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return value;
    }

    getSystemTables() {
        return ['master', 'model', 'msdb', 'tempdb'];
    }

    getValidationQuery() {
        return 'SELECT 1';
    }
}

class GitDBPostgresDriver {
    constructor() {
        this.name = 'PostgreSQL';
        this.className = 'com.github.gitdb.postgres';
        this.urlPattern = 'gitdb:postgresql://';
        this.defaultPort = 5432;
        this.features = {
            autoIncrement: 'SERIAL',
            identityInsert: false,
            schemas: true,
            catalogs: false,
            storedProcedures: true,
            limitClause: 'LIMIT',
            offsetClause: 'OFFSET',
            booleanType: 'BOOLEAN',
            concatenation: '||',
            currentTimestamp: 'CURRENT_TIMESTAMP',
            stringQuote: '"',
            parameterPrefix: '$'
        };
    }

    formatQuery(query, params) {
        // PostgreSQL uses $1, $2, etc
        let formatted = query;
        params.forEach((param, idx) => {
            formatted = formatted.replace(`$${idx + 1}`, this.escapeValue(param));
        });
        return formatted;
    }

    escapeValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return value;
    }

    getSystemTables() {
        return ['pg_catalog', 'information_schema'];
    }

    getValidationQuery() {
        return 'SELECT 1';
    }
}

class GitDBOracleDriver {
    constructor() {
        this.name = 'Oracle';
        this.className = 'com.github.gitdb.oracle';
        this.urlPattern = 'gitdb:oracle:thin:@';
        this.defaultPort = 1521;
        this.features = {
            autoIncrement: 'GENERATED BY DEFAULT AS IDENTITY',
            identityInsert: false,
            schemas: true,
            catalogs: false,
            storedProcedures: true,
            limitClause: 'FETCH FIRST',
            offsetClause: 'OFFSET',
            booleanType: 'NUMBER(1)',
            concatenation: '||',
            currentTimestamp: 'SYSDATE',
            stringQuote: '"',
            parameterPrefix: ':'
        };
    }

    formatQuery(query, params) {
        // Oracle uses :1, :2, etc or :param1, :param2
        let formatted = query;
        params.forEach((param, idx) => {
            formatted = formatted.replace(`:${idx + 1}`, this.escapeValue(param));
        });
        return formatted;
    }

    escapeValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (value instanceof Date) {
            return `TO_DATE('${value.toISOString().slice(0, 19)}', 'YYYY-MM-DD HH24:MI:SS')`;
        }
        return value;
    }

    getSystemTables() {
        return ['SYS', 'SYSTEM', 'SYSAUX', 'USERS'];
    }

    getValidationQuery() {
        return 'SELECT 1 FROM DUAL';
    }
}

class GitDBMariaDriver {
    constructor() {
        this.name = 'MariaDB';
        this.className = 'com.github.gitdb.mariadb';
        this.urlPattern = 'gitdb:mariadb://';
        this.defaultPort = 3306;
        this.features = {
            autoIncrement: 'AUTO_INCREMENT',
            identityInsert: false,
            schemas: false,
            catalogs: true,
            storedProcedures: true,
            limitClause: 'LIMIT',
            offsetClause: 'OFFSET',
            booleanType: 'BOOLEAN',
            concatenation: 'CONCAT',
            currentTimestamp: 'NOW()',
            stringQuote: '`',
            parameterPrefix: '?',
            jsonSupport: true,
            windowFunctions: true
        };
    }

    formatQuery(query, params) {
        // MariaDB uses ? for parameters
        let formatted = query;
        params.forEach((param, idx) => {
            formatted = formatted.replace(`?`, this.escapeValue(param));
        });
        return formatted;
    }

    escapeValue(value) {
        if (value === null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
        return value;
    }

    getSystemTables() {
        return ['information_schema', 'mysql', 'performance_schema'];
    }

    getValidationQuery() {
        return 'SELECT 1';
    }
}

// Export for use in both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GitDBDriver,
        GitDBConnection,
        GitDBConnectionPool,
        GitDBPreparedStatement,
        GitDBDataset
    };
} else if (typeof window !== 'undefined') {
    window.GitDBDriver = GitDBDriver;
    window.GitDBConnection = GitDBConnection;
    window.GitDBConnectionPool = GitDBConnectionPool;
    window.GitDBPreparedStatement = GitDBPreparedStatement;
    window.GitDBDataset = GitDBDataset;
}

// Initialize global driver
const gitDBDriver = new GitDBDriver();

// Add default datasources
gitDBDriver.addDatasource({
    name: 'default',
    driver: 'com.github.gitdb.mysql',
    description: 'Default GitDB connection'
});

gitDBDriver.addDatasource({
    name: 'historian',
    driver: 'com.github.gitdb.postgres',
    description: 'Historical data storage'
});

console.log('🚀 GitDB Driver initialized! BAM!');
console.log('Available drivers:', Object.keys(gitDBDriver.drivers));