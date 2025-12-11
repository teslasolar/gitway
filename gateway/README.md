# GitWay Gateway Integration

This directory contains the Ignition Gateway integration components for GitWay, including GitDB database drivers that emulate Ignition's JDBC driver architecture.

## Architecture

GitWay provides a complete database driver ecosystem that mirrors Ignition's JDBC implementation:

### Database Drivers

Each GitDB driver implements the same interface as Ignition's JDBC drivers:

- **MySQL Driver** (`com.github.gitdb.mysql`)
  - Full MySQL SQL dialect support
  - Parameter substitution with `?` placeholders
  - AUTO_INCREMENT support

- **SQL Server Driver** (`com.github.gitdb.mssql`)
  - T-SQL dialect support
  - Named parameters with `@param` syntax
  - IDENTITY columns

- **PostgreSQL Driver** (`com.github.gitdb.postgres`)
  - PostgreSQL dialect with `$1, $2` parameters
  - SERIAL columns for auto-increment
  - Array and JSON support

- **Oracle Driver** (`com.github.gitdb.oracle`)
  - PL/SQL support
  - `:1, :2` parameter syntax
  - SEQUENCE-based auto-increment

- **MariaDB Driver** (`com.github.gitdb.mariadb`)
  - Enhanced MySQL compatibility
  - JSON column support
  - Window functions

## How It Works

### 1. Database as Git Repository

Each database is a Git repository where:
- **Commits** = Database transactions
- **Branches** = Database schemas/environments
- **Tags** = Database snapshots/backups
- **Files** = Tables/Collections

### 2. Transaction Flow

```javascript
// Start transaction (creates Git branch)
const txn = gitDB.beginTransaction();

// Execute operations (staged changes)
txn.insert('tags', { path: '[default]Temp', value: 75.5 });
txn.update('alarms', { id: 1 }, { active: false });

// Commit (creates Git commit)
await txn.commit(); // Creates SHA: abc123...
```

### 3. Ignition Integration

The drivers integrate seamlessly with Ignition's `system.db` functions:

```python
# In Ignition scripting
dataset = system.db.runQuery("SELECT * FROM tags", "GitDB_MySQL")
system.db.runPrepUpdate("INSERT INTO audit VALUES (?, ?, ?)",
                        [timestamp, user, action], "GitDB_MySQL")
```

## Configuration

### Bridge Server

The bridge server (`bridge-server.js`) provides:
- WebSocket connections for real-time updates
- REST API for HTTP queries
- CORS support for GitHub Pages access

```bash
# Start the bridge server
node gateway/bridge-server.js

# Configure in .env
IGNITION_HOST=pred
IGNITION_PORT=8088
BRIDGE_PORT=3001
```

### Driver Configuration

Each driver can be configured in `jdbc-drivers-config.json`:

```json
{
  "MySQL": {
    "className": "com.github.gitdb.mysql.Driver",
    "jdbcUrl": "gitdb:mysql://{host}:{port}/{database}",
    "connectionProperties": {
      "zeroDateTimeBehavior": "convertToNull",
      "useSSL": false
    }
  }
}
```

## Module Structure

When deployed as an Ignition module:

```
gitway-module.modl
├── module.xml          # Module descriptor
├── lib/
│   ├── gitway-gateway.jar
│   ├── gitway-common.jar
│   └── gitway-drivers.jar
└── doc/
    └── index.html
```

## Features

### Version Control Benefits

1. **Full Audit Trail**: Every database change is tracked with:
   - Who made the change (Git author)
   - When it was made (Git timestamp)
   - What changed (Git diff)
   - Why it changed (Git commit message)

2. **Time Travel**: Query data at any point in history:
   ```sql
   SELECT * FROM tags AT COMMIT 'abc123'
   ```

3. **Branching**: Test changes in isolated branches:
   ```sql
   CREATE BRANCH 'feature/new-tags'
   CHECKOUT 'feature/new-tags'
   ```

4. **Rollback**: Easily revert problematic changes:
   ```sql
   REVERT COMMIT 'def456'
   ```

### Ignition-Specific Features

- **Tag History**: Store tag history as Git commits
- **Alarm Journal**: Alarm events as Git log entries
- **Audit Log**: Built-in via Git history
- **Named Queries**: Stored as JSON files in Git
- **Transaction Groups**: Batch operations in Git commits

## API Endpoints

The bridge server exposes:

- `GET /api/status` - Gateway connection status
- `GET /api/tags/read/:tagPath` - Read tag value
- `POST /api/tags/write` - Write tag value
- `POST /api/tags/read-bulk` - Bulk tag read
- `WS /` - WebSocket for subscriptions

## Usage Examples

### From Ignition Script

```python
# Get GitDB connection
conn = system.db.getConnection("GitDB_MySQL")

# Run query
results = system.db.runQuery("""
    SELECT tagPath, value, quality
    FROM tags
    WHERE tagPath LIKE '%Temperature%'
""", "GitDB_MySQL")

# Process results
for row in results:
    print row["tagPath"], row["value"]
```

### From Perspective Component

```javascript
// In custom property binding
runScript("""
    dataset = system.db.runNamedQuery(
        "GitDB",
        "getActiveAlarms",
        {"priority": "High"}
    )
    return dataset
""", 5000) // Poll every 5 seconds
```

### From WebDev API

```python
def doGet(request, session):
    # Query GitDB
    data = system.db.runQuery(
        "SELECT * FROM audit ORDER BY timestamp DESC LIMIT 100",
        "GitDB_PostgreSQL"
    )

    # Return as JSON
    return {'json': system.dataset.toJSON(data)}
```

## Performance Considerations

- **Caching**: Recent commits cached locally
- **Indexing**: JSON files indexed for fast queries
- **Batching**: Multiple operations batched into single commits
- **Compression**: Large datasets compressed in Git

## Security

- **Authentication**: GitHub token or SSH keys
- **Authorization**: Git branch permissions
- **Encryption**: SSL/TLS for API calls
- **Audit**: Complete Git history

## Troubleshooting

### Connection Issues

```bash
# Test bridge connection
curl http://localhost:3001/api/status

# Check Ignition gateway
curl http://pred:8088/StatusPing
```

### Driver Issues

```python
# Test driver in Ignition
print system.db.getConnectionInfo("GitDB_MySQL")
```

## License

MIT - See LICENSE file