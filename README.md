# GitWay - Dynamic Gateway Interface

A Perspective-like dynamic interface that assembles from JSON configurations, bridging GitHub Pages to Ignition SCADA gateways.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start bridge server
node bridge-server.js

# Open interface
open index.html
```

## 📁 Project Structure

```
gitway/
├── index.html           # Main application (UI + API)
├── views.json          # UI configuration
├── bridge-server.js    # WebSocket/REST bridge to Ignition
├── api/                # API endpoints and client library
├── config/             # Configuration files
├── docs/               # Documentation
├── gitdb/              # GitHub database integration
├── perspective-project/ # Ignition Perspective project files
└── src/                # Source code modules
```

## 🌐 Access Points

- **Local**: http://localhost:8080/
- **GitHub Pages**: https://teslasolar.github.io/gitway/
- **API**: https://teslasolar.github.io/gitway/?api=status

## 🔌 API Usage

The index.html serves as both UI and API endpoint:

```javascript
// Access API via query parameter
fetch('https://teslasolar.github.io/gitway/?api=status')

// Or via hash
fetch('https://teslasolar.github.io/gitway/#api/config')
```

Available endpoints:
- `?api=status` - System status
- `?api=config` - Configuration
- `?api=components` - Available components
- `?api=manifest` - API documentation
- `?api=views` - UI configuration

## ⚙️ Configuration

Create `.env` file:
```env
IGNITION_HOST=your_gateway_host
IGNITION_PORT=8088
IGNITION_PROTOCOL=http
IGNITION_API_KEY=your_api_key
BRIDGE_PORT=3001
```

## 📚 Documentation

- [Quick Start Guide](docs/QUICKSTART.md)
- [API Documentation](docs/API_USAGE.md)
- [Bridge Setup](docs/BRIDGE_SETUP.md)
- [Complete Documentation](docs/GITWAY_COMPLETE.md)

## 🏗️ Features

- ✅ Single index.html with dynamic JSON assembly
- ✅ Integrated API endpoints
- ✅ WebSocket real-time updates
- ✅ GitDB (GitHub as database)
- ✅ Perspective-compatible components
- ✅ Auto-discovery of gateway components

## 📦 Deployment

### GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in settings
3. Access at: https://[username].github.io/gitway

### Local Development
```bash
# Run with Python
python -m http.server 8080

# Or with Node.js
npx http-server
```

## 🤝 License

MIT