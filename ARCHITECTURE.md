# GitWay Architecture - Ignition Digital Twin Mapping

## Component Mapping: GitWay ↔ Ignition

This document maps GitWay components to their Ignition equivalents, creating a complete digital twin architecture.

## Core Components

### 🎨 **Kaleidoscope** = Ignition Perspective
**Our free, open-source Perspective renderer**
- Location: `/kaleidoscope/`
- Purpose: Dynamic UI assembly from JSON
- Features:
  - Drag-and-drop components
  - Real-time data binding
  - Responsive design
  - Works on GitHub Pages

### 💾 **GitDB** = Ignition Database Connections
**GitHub as a database with JDBC-style drivers**
- Location: `/gitdb/`
- Drivers:
  - MySQL → `GitDBMySQLDriver`
  - PostgreSQL → `GitDBPostgresDriver`
  - SQL Server → `GitDBMSSQLDriver`
  - Oracle → `GitDBOracleDriver`
  - MariaDB → `GitDBMariaDriver`
- Features:
  - Git commits = Database transactions
  - Branches = Schemas
  - Complete audit trail

### 🧠 **KonomiML** = Ignition Scripting + Gateway Events
**State management engine with 300+ states**
- Location: `/konomi-ml/`
- Components:
  - `konomi_mega_state_engine.py` - Main state engine (Jython compatible)
  - `konomi_gitdb_engine.py` - Database state management
  - `konomi-bridge.js` - JavaScript bridge
- Features:
  - Visual state tracking with emojis
  - AI/ML pipeline states
  - Database operation states
  - Error recovery workflows

### 🌉 **Bridge Server** = Ignition Gateway Network
**WebSocket/REST bridge connecting GitHub Pages to Ignition**
- Location: `/gateway/bridge-server.js`
- Features:
  - Real-time tag updates
  - Bidirectional communication
  - CORS support for GitHub Pages
  - Multiple protocol support

### 📊 **GitWay Core** = Ignition Gateway
**Main application serving as gateway**
- Location: `/index.html`
- Features:
  - Dual-mode: UI + API
  - Dynamic component assembly
  - JSON-based configuration
  - Serves both web UI and API endpoints

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    GitWay Core                        │  │
│  │                   (index.html)                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │Kaleidoscope│  │   GitDB    │  │  KonomiML  │    │  │
│  │  │(Perspective)│  │ (Database) │  │  (States)  │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                             ↕                               │
│                    Bridge Server (Gateway)                  │
│                             ↕                               │
│                     Ignition Gateway                        │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure Mapping

```
gitway/                           # = Ignition Installation Root
├── index.html                   # = Gateway Web Interface (Main UI + API)
│
├── gateway/                     # = Ignition Gateway Core
│   ├── bridge-server.js        # = Gateway Network + OPC Bridge
│   ├── jdbc-drivers-config.json # = Database Driver Configurations
│   ├── module.xml              # = Module Descriptor
│   └── README.md              # = Gateway Documentation
│
├── kaleidoscope/               # = Perspective Module (Our Version)
│   ├── index.html             # = Perspective Designer/Runtime
│   └── README.md              # = Kaleidoscope Documentation
│
├── gitdb/                      # = Database System (lib/jdbc equivalent)
│   ├── gitdb-driver.js        # = JDBC-style Driver Implementation
│   ├── gitdb.js               # = GitHub Database Core
│   └── README.md              # = GitDB Documentation
│
├── konomi-ml/                  # = Scripting Engine + State Management
│   ├── konomi_mega_state_engine.py  # = 300+ State Management (Jython)
│   ├── konomi_gitdb_engine.py      # = Database State Engine (Jython)
│   ├── konomi-bridge.js           # = JavaScript Bridge
│   ├── demo.html                  # = Interactive State Demo
│   └── README.md                  # = KonomiML Documentation
│
├── tag-provider/               # = Tag Providers (data/tags)
│   └── gitway-tags.json      # = Default Tag Provider Configuration
│
├── perspective-project/        # = Projects (data/projects)
│   ├── project.json          # = Project Configuration
│   └── com.inductiveautomation.perspective/
│       └── views/            # = Perspective Views
│
├── api/                       # = WebDev Module Equivalent
│   ├── gitway-client.js      # = JavaScript API Client
│   ├── v1/                   # = API Version 1 Endpoints
│   └── README.md             # = API Documentation
│
├── config/                    # = Configuration (data/config)
│   ├── gateway.json          # = Gateway Configuration
│   └── settings.json         # = System Settings
│
├── docs/                      # = Documentation
│   ├── QUICKSTART.md        # = Quick Start Guide
│   ├── API_USAGE.md         # = API Documentation
│   └── GITWAY_COMPLETE.md   # = Complete Documentation
│
├── scripts/                   # = Utility Scripts
├── src/                      # = Source Modules
└── screens/                  # = Screenshots
```

## Equivalent Features

| Ignition Feature | GitWay Implementation | Status |
|-----------------|----------------------|---------|
| **Perspective** | Kaleidoscope - JSON-based UI renderer | ✅ Implemented |
| **Vision** | Not implemented (Perspective-only focus) | ❌ Not Planned |
| **Database Connections** | GitDB with 5 driver types | ✅ Implemented |
| **Tag System** | JSON-based tags in `/tag-provider/` | ✅ Implemented |
| **Gateway Scripts** | KonomiML state engine | ✅ Implemented |
| **OPC UA Server** | WebSocket bridge server | ✅ Partial |
| **Historian** | Git commits as time-series data | ✅ Implemented |
| **Alarming** | State-based alarm system | 🚧 In Progress |
| **Reporting** | Not implemented | ❌ Not Planned |
| **SFC** | State machine via KonomiML | ✅ Partial |
| **WebDev** | API served via index.html | ✅ Implemented |
| **Gateway Network** | Bridge server for inter-gateway | ✅ Implemented |
| **Redundancy** | Git repository cloning | ✅ Natural |
| **Security** | GitHub OAuth + API tokens | ✅ Implemented |
| **Modules** | NPM packages + Git repos | ✅ Implemented |

## Key Innovations

### 1. **Kaleidoscope** (Our Perspective)
- Free, open-source alternative to Perspective
- Runs entirely in browser
- No licensing required
- GitHub Pages compatible

### 2. **GitDB** (Our Database System)
- Git commits as transactions
- Complete audit trail
- Version control built-in
- No traditional database needed

### 3. **KonomiML** (Our State Engine)
- 300+ predefined states
- Visual emoji-based feedback
- AI/ML pipeline support
- Jython 2.7 compatible for Ignition

### 4. **Bridge Architecture**
- Connects static GitHub Pages to live Ignition
- WebSocket for real-time data
- REST API for commands
- CORS-enabled for cross-origin

## Running the Digital Twin

### Development Mode
```bash
# Start bridge server
node gateway/bridge-server.js

# Open Kaleidoscope designer
open kaleidoscope/index.html

# Run KonomiML engine
jython konomi-ml/konomi_mega_state_engine.py

# Access main interface
open index.html
```

### Production Mode (GitHub Pages)
```bash
# Push to GitHub
git add .
git commit -m "Deploy digital twin"
git push

# Access at
https://[username].github.io/gitway/
```

## System Requirements

### For Full Digital Twin:
- Node.js 14+ (for bridge server)
- Modern browser (Chrome/Firefox/Edge)
- GitHub account
- Ignition 8.1+ (optional, for bridge)

### For Static Mode (GitHub Pages):
- Just a web browser!
- No server required
- Read-only access to data

## Benefits Over Traditional Ignition

1. **Cost**: Free and open-source
2. **Scalability**: Infinite via GitHub
3. **Version Control**: Built-in via Git
4. **Collaboration**: Native GitHub features
5. **Deployment**: Simple via GitHub Pages
6. **Audit Trail**: Complete Git history
7. **Backup**: Automatic via Git clones
8. **Updates**: Pull requests for changes

## Limitations vs Traditional Ignition

1. **Real-time Performance**: Limited by web technologies
2. **OPC UA**: No native industrial protocol support
3. **Driver Support**: Limited to web-accessible protocols
4. **Enterprise Features**: No official support
5. **Legacy Support**: No Vision client support

## Future Roadmap

### Phase 1 (Complete) ✅
- [x] GitDB database system
- [x] Kaleidoscope UI renderer
- [x] KonomiML state engine
- [x] Bridge server
- [x] Basic tag system

### Phase 2 (In Progress) 🚧
- [ ] Full alarm system
- [ ] Tag historian improvements
- [ ] Advanced Kaleidoscope components
- [ ] Module marketplace

### Phase 3 (Planned) 📋
- [ ] MQTT integration
- [ ] Advanced scripting
- [ ] Report generation
- [ ] Mobile app support
- [ ] Edge computing support

## Conclusion

GitWay represents a complete digital twin of Ignition SCADA, reimagined for the cloud-native, Git-centric world. By mapping traditional SCADA concepts to modern web technologies and Git workflows, we've created a system that's both familiar to SCADA engineers and accessible to web developers.

**Key Achievement**: We've successfully created:
- **Kaleidoscope** as our Perspective
- **GitDB** as our database layer
- **KonomiML** as our scripting/state engine
- **Bridge Server** as our gateway network

This creates a fully functional SCADA system that runs from GitHub!