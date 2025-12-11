/**
 * GitDB Database Driver
 * Emulates Ignition's JDBC drivers but uses GitHub as the backend
 * Each commit = database transaction
 * BAM! Let's kick this up a notch!
 */

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
    getConnection(name, driverClass = null) {
        if (this.connections.has(name)) {
            return this.connections.get(name);
        }

        // Get datasource config if exists
        const datasources = JSON.parse(localStorage.getItem('gitdb_datasources') || '{}');
        const datasource = datasources[name];

        if (datasource) {
            driverClass = datasource.driver;
        }

        // Create new connection
        const conn = new GitDBConnection(name, this, driverClass);
        this.connections.set(name, conn);
        return conn;
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
 * GitDB Connection (like java.sql.Connection)
 */
class GitDBConnection {
    constructor(name, driver, driverClass = 'com.github.gitdb.mysql') {
        this.name = name;
        this.driver = driver;
        this.driverClass = driverClass;
        this.autoCommit = true;
        this.closed = false;
        this.transactionId = null;

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
     * Close connection
     */
    close() {
        if (this.transactionId) {
            this.rollback();
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
        GitDBDataset
    };
} else if (typeof window !== 'undefined') {
    window.GitDBDriver = GitDBDriver;
    window.GitDBConnection = GitDBConnection;
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