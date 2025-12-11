# 🔧 Ignition Dynamic Component System

A JSON-based, auto-configuring interface that discovers your Ignition gateway capabilities and builds components automatically.

## Features

- **Automatic Discovery**: Scans your Ignition gateway to find available modules and endpoints
- **JSON Configuration**: All components defined in `gateway-components.json`
- **Dynamic UI Generation**: Builds interface based on discovered capabilities
- **Auto-Configuration**: Monitors for changes and updates interface automatically
- **No Hardcoding**: Everything is discovered and configured dynamically

## Components

### 1. Gateway Discovery (`gateway-discovery.js`)
Discovers what's available on your Ignition gateway:
- API endpoints
- Installed modules
- Tag providers
- Projects
- Database connections
- Alarm journals
- Device connections

### 2. Dynamic Component Builder (`dynamic-components.js`)
Builds UI components based on discovered capabilities:
- Tag readers/writers
- Alarm viewers
- Database query tools
- History viewers
- Status monitors

### 3. Auto-Configurator (`auto-configure.js`)
Monitors and updates the interface automatically:
- Periodic discovery
- Change detection
- Interface rebuilding
- Configuration snapshots

## Usage

### Quick Start

1. **Run Discovery**
   ```bash
   node gateway-discovery.js
   ```
   This scans your gateway and creates `gateway-components.json`

2. **Build Interface**
   ```bash
   node dynamic-components.js
   ```
   This generates `ignition-dynamic.html` based on discovered components

3. **Open Interface**
   Open `ignition-dynamic.html` in your browser

### Auto-Configuration Mode

Run continuous discovery and auto-update:
```bash
node auto-configure.js --interval=60
```

With monitoring interface:
```bash
node auto-configure.js --monitor --interval=30
```

## Configuration Structure

### `gateway-components.json`
```json
{
  "gateway": {
    "host": "pred",
    "port": 8088,
    "protocol": "http",
    "discovered": "2025-12-10T22:13:16.113Z"
  },
  "components": {
    "endpoints": [...],      // Discovered API endpoints
    "modules": [...],        // Installed modules
    "tagProviders": [...],   // Tag providers
    "projects": [...],       // Projects
    "databases": [...],      // Database connections
    "devices": [...],        // Connected devices
    "alarmJournals": [...]   // Alarm journals
  },
  "capabilities": {
    "perspective": false,    // Module availability
    "vision": false,
    "webdev": false,
    ...
  },
  "features": {
    "tags": true,           // Feature availability
    "history": false,
    "alarms": true,
    ...
  }
}
```

## Component Definition

Each component in the system has:
```javascript
{
  id: 'unique-id',
  type: 'component-type',
  name: 'Display Name',
  icon: '🔧',
  config: {
    endpoint: '/api/endpoint',
    operations: ['read', 'write']
  },
  ui: {
    type: 'card',
    inputs: [...],
    buttons: [...],
    display: {...}
  }
}
```

## Discovered Components

Based on your gateway scan:

| Component | Available | Description |
|-----------|-----------|-------------|
| Gateway Status | ✓ | Basic status monitoring |
| Tag Reader | ✓ | Read tag values |
| Tag Writer | ✓ | Write tag values |
| Alarm Viewer | ✓ | View active alarms |
| Database Query | ✓ | Execute queries |

## Adding Custom Components

Edit `dynamic-components.js` to add custom components:

```javascript
buildCustomComponent() {
    this.components.push({
        id: 'custom-tool',
        name: 'My Custom Tool',
        icon: '🛠️',
        config: {
            endpoint: '/my/endpoint'
        },
        ui: {
            // UI configuration
        }
    });
}
```

## API Integration

The system works with your bridge server:
- Bridge URL: `http://localhost:3001`
- Handles all gateway communication
- Provides CORS support for GitHub Pages

## Monitoring

Access monitoring at `http://localhost:8090` when running with `--monitor`:
- Live status updates
- Configuration changes
- Component statistics

## Benefits

1. **No Manual Configuration**: Everything is discovered automatically
2. **Adapts to Changes**: Updates when new modules are installed
3. **JSON-Based**: Easy to understand and modify
4. **GitHub Pages Ready**: Can be deployed as static site
5. **Extensible**: Easy to add custom components

## Troubleshooting

### Discovery finds limited endpoints
- Most Ignition API endpoints require Web Dev module
- Some modules need specific configuration
- Check gateway logs for access issues

### Components not appearing
- Run discovery again: `node gateway-discovery.js`
- Check `gateway-components.json` for discovered items
- Rebuild interface: `node dynamic-components.js`

### Auto-configuration not updating
- Check console for discovery errors
- Verify gateway is accessible
- Review snapshots in `config-snapshots/` folder

## Architecture

```
┌─────────────────┐
│ Ignition Gateway│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Gateway         │──> gateway-components.json
│ Discovery       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Dynamic         │──> ignition-dynamic.html
│ Component       │
│ Builder         │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Web Interface   │
│ (Auto-generated)│
└─────────────────┘
```

## Next Steps

1. Install Web Dev module on Ignition for more features
2. Configure API endpoints in Web Dev
3. Add custom components for specific needs
4. Deploy to GitHub Pages for remote access
5. Set up secure tunneling for production use

## Files Generated

- `gateway-components.json` - Discovered configuration
- `ignition-dynamic.html` - Generated interface
- `config-snapshots/*.json` - Historical configurations

## License

MIT - Free to use and modify