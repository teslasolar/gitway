# KonomiML GitDB Engine 🧠

Visual state management for GitWay database operations using the KonomiML Engine.

Developed by **Konomi Systems** - konomi-systems.com

## Overview

KonomiML GitDB Engine provides visual, emoji-driven state management for database operations in GitWay. It tracks every database operation through clear visual states, making complex transactions easy to understand and debug.

## Features 🚀

### Visual State Tracking
Every database operation is represented with emojis and clear state descriptions:

- 🔌 **Disconnected** - No active connection
- 🔄 **Connecting** - Establishing connection
- ✅ **Connected** - Database ready
- 🚀 **Transaction Begin** - Starting new transaction
- ▶️ **Transaction Active** - Operations in progress
- 💾 **Committing** - Saving to Git
- ✅ **Complete** - Operation successful

### Multi-Driver Support
KonomiML manages all GitDB drivers with unique visual indicators:

- 🐬 **MySQL** - MySQL-compatible operations
- 🏢 **SQL Server** - Microsoft SQL Server
- 🐘 **PostgreSQL** - PostgreSQL database
- 🔴 **Oracle** - Oracle database
- 🦭 **MariaDB** - MariaDB enhanced MySQL

### Transaction States
Track complex transactions visually:

```
🚀 TXN_BEGIN → ▶️ TXN_ACTIVE → 💾 TXN_COMMITTING → ✅ TXN_COMMITTED
                     ↓
                ↩️ TXN_ROLLING_BACK → 🔙 TXN_ROLLED_BACK
```

### Query Execution Flow
Visual query execution tracking:

```
📝 QUERY_PARSING → ⚡ QUERY_EXECUTING → 📊 QUERY_FETCHING → ✅ QUERY_COMPLETE
```

### Git Integration States
Track Git operations:

```
📁 GIT_IDLE → 📝 GIT_STAGING → 💾 GIT_COMMITTING → ☁️ GIT_PUSHING → 🔄 GIT_SYNCED
```

## Installation

### For Jython 2.7 (Ignition)

```python
# In Ignition script console
import sys
sys.path.append("C:/GitWay/konomi-ml")

from konomi_gitdb_engine import KonomiGitDBEngine
engine = KonomiGitDBEngine()
```

### For Node.js Bridge

```javascript
// Load KonomiML Bridge
const konomiML = require('./konomi-bridge.js');
konomiML.initialize();
```

## Usage Examples

### Basic Database Connection

```python
# Create engine instance
engine = KonomiGitDBEngine()

# Connect to database with visual feedback
engine.connect_database("MyDB", "mysql")
# Output:
# 🔄 Connecting to database: MyDB
#   🔄 DB_CONNECTING - Connecting to database
#   ✅ DB_CONNECTED - Database connected
#   🐬 DRIVER_MYSQL - MySQL driver active
```

### Execute Transaction

```python
# Begin transaction with state tracking
engine.begin_transaction("MyDB")
# 🚀 TXN_BEGIN - Beginning transaction
# ▶️ TXN_ACTIVE - Transaction active

# Execute queries with visual feedback
engine.execute_query("MyDB", "SELECT * FROM tags")
# ⚡ QUERY_EXECUTING - Executing query
# 📊 QUERY_FETCHING - Fetching results
# ✅ QUERY_COMPLETE - Query complete

# Commit with Git integration
engine.commit_transaction("MyDB", "Update tags")
# 💾 TXN_COMMITTING - Committing transaction
# 📝 GIT_STAGING - Staging changes
# 💾 GIT_COMMITTING - Creating Git commit
# ✅ TXN_COMMITTED - Transaction committed
# 🔄 GIT_SYNCED - Synchronized with GitHub
```

### Workflows

Run pre-defined workflows with visual tracking:

```python
# Full database cycle
engine.execute_workflow("full_cycle")

# Test all drivers
engine.execute_workflow("multi_driver")

# Transaction testing with rollback
engine.execute_workflow("transaction_test")
```

## Command Line Interface

```bash
# Show help
jython konomi_gitdb_engine.py help

# Check status
jython konomi_gitdb_engine.py status

# Connect to database
jython konomi_gitdb_engine.py connect MyDB mysql

# Execute workflow
jython konomi_gitdb_engine.py workflow full_cycle
```

## State Reference

### Connection States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 0 | DB_DISCONNECTED | 🔌 | Database disconnected |
| 1 | DB_CONNECTING | 🔄 | Connecting to database |
| 2 | DB_CONNECTED | ✅ | Database connected |

### Transaction States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 10 | TXN_IDLE | ⏸️ | No active transaction |
| 11 | TXN_BEGIN | 🚀 | Beginning transaction |
| 12 | TXN_ACTIVE | ▶️ | Transaction active |
| 13 | TXN_COMMITTING | 💾 | Committing transaction |
| 14 | TXN_COMMITTED | ✅ | Transaction committed |
| 15 | TXN_ROLLING_BACK | ↩️ | Rolling back transaction |
| 16 | TXN_ROLLED_BACK | 🔙 | Transaction rolled back |

### Query States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 20 | QUERY_IDLE | ⏸️ | No active query |
| 21 | QUERY_PARSING | 📝 | Parsing SQL query |
| 22 | QUERY_EXECUTING | ⚡ | Executing query |
| 23 | QUERY_FETCHING | 📊 | Fetching results |
| 24 | QUERY_COMPLETE | ✅ | Query complete |

### Git States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 30 | GIT_IDLE | 📁 | Git repository idle |
| 31 | GIT_STAGING | 📝 | Staging changes |
| 32 | GIT_COMMITTING | 💾 | Creating Git commit |
| 33 | GIT_PUSHING | ☁️ | Pushing to GitHub |
| 34 | GIT_SYNCED | 🔄 | Synchronized with GitHub |

### Driver States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 40 | DRIVER_MYSQL | 🐬 | MySQL driver active |
| 41 | DRIVER_MSSQL | 🏢 | SQL Server driver active |
| 42 | DRIVER_POSTGRES | 🐘 | PostgreSQL driver active |
| 43 | DRIVER_ORACLE | 🔴 | Oracle driver active |
| 44 | DRIVER_MARIADB | 🦭 | MariaDB driver active |

### Error States
| ID | State | Emoji | Description |
|----|-------|-------|-------------|
| 90 | ERROR_CONNECTION | ❌ | Connection error |
| 91 | ERROR_QUERY | ⚠️ | Query error |
| 92 | ERROR_TRANSACTION | 💔 | Transaction error |
| 99 | ERROR_FATAL | ☠️ | Fatal error |

## Integration with Ignition

### In Perspective Components

```python
# Custom property binding
def getDBStatus():
    from konomi_gitdb_engine import KonomiGitDBEngine
    engine = KonomiGitDBEngine()
    status = engine.get_status()

    return {
        "state": status.get("current_state_name"),
        "emoji": status.get("current_state_emoji"),
        "connections": status.get("active_connections")
    }
```

### In Gateway Scripts

```python
# Scheduled script for monitoring
def monitorDatabase():
    engine = system.gitdb.getKonomiEngine()

    # Check all connections
    for db in ["Production", "Development", "Archive"]:
        engine.connect_database(db, "mysql")
        result = engine.execute_query(db, "SELECT COUNT(*) FROM audit")

        if result:
            system.tag.writeBlocking(
                ["[GitWay]Database/" + db + "/Status"],
                ["Connected"]
            )
```

### In Transaction Groups

```python
# Pre-transaction script
def beforeTransaction(context):
    engine = system.gitdb.getKonomiEngine()
    engine.begin_transaction(context.datasource)

    # Visual state will show transaction progress
    return True

# Post-transaction script
def afterTransaction(context):
    engine = system.gitdb.getKonomiEngine()

    if context.success:
        engine.commit_transaction(context.datasource, context.name)
    else:
        engine.rollback_transaction(context.datasource)
```

## Architecture

```
KonomiML GitDB Engine
├── State Management (Java HashMap)
│   ├── Connection States
│   ├── Transaction States
│   ├── Query States
│   └── Git States
├── Driver Integration
│   ├── MySQL 🐬
│   ├── SQL Server 🏢
│   ├── PostgreSQL 🐘
│   ├── Oracle 🔴
│   └── MariaDB 🦭
├── JavaScript Bridge (Nashorn)
│   └── GitDB Driver Communication
└── Visual Feedback
    ├── Emoji States
    ├── Progress Tracking
    └── Error Visualization
```

## Benefits

### For Developers
- **Visual Debugging** - See exactly what's happening
- **State Tracking** - Know where operations are
- **Clear Workflows** - Pre-defined operation sequences
- **Error Clarity** - Visual error states

### For Operations
- **Real-time Monitoring** - Visual state indicators
- **Transaction Tracking** - See all database operations
- **Git Integration** - Full audit trail
- **Multi-driver Support** - Manage all databases

### For Management
- **Visual Reports** - Emoji-based status
- **Operation History** - Complete audit log
- **Performance Metrics** - State timing data
- **Error Analysis** - Visual error patterns

## Advanced Features

### Custom Workflows

Create custom workflows in the engine:

```python
def custom_workflow(self, workflow_name, db_name):
    if workflow_name == "backup_and_restore":
        # Visual backup workflow
        self.transition_to(31, "BACKUP_START")
        self.execute_query(db_name, "SELECT * INTO OUTFILE 'backup.sql' FROM tags")
        self.transition_to(32, "BACKUP_COMMIT")
        self.commit_transaction(db_name, "Backup created")
        self.transition_to(34, "BACKUP_COMPLETE")
```

### State Listeners

Add state change listeners:

```python
def on_state_change(old_state, new_state):
    # Log state changes
    logger.info("State: {} {} -> {} {}".format(
        old_state.get("emoji"),
        old_state.get("name"),
        new_state.get("emoji"),
        new_state.get("name")
    ))

    # Alert on errors
    if new_state.get("state_id") >= 90:
        system.util.sendMessage("DatabaseError", {
            "state": new_state.get("name"),
            "emoji": new_state.get("emoji")
        })
```

## Troubleshooting

### Common Issues

1. **Connection Failed** (🔌 → ❌)
   - Check driver configuration
   - Verify GitDB driver is loaded
   - Check network connectivity

2. **Transaction Error** (▶️ → 💔)
   - Check for lock conflicts
   - Verify Git repository state
   - Review query syntax

3. **Query Failed** (⚡ → ⚠️)
   - Check SQL syntax
   - Verify table existence
   - Review parameter binding

## Performance

KonomiML is optimized for Jython 2.7:
- Uses Java HashMap for speed
- Minimal memory footprint
- Async state transitions
- Efficient Git operations

## Support

**Developed by Konomi Systems**
- Website: konomi-systems.com
- GitHub: github.com/konomi-systems
- Support: support@konomi-systems.com

## License

MIT License - See LICENSE file

---

*KonomiML - Making database operations visual and intuitive* 🧠✨