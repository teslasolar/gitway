# 🚀 Ignition Gateway Bridge Setup

Connect your GitHub Pages site to your Ignition SCADA system through a WebSocket bridge!

## Architecture

```
[GitHub Pages Site] ←→ [Bridge Server:8089] ←→ [Ignition Gateway:8088]
     (Static)           (Local WebSocket)         (SCADA System)
```

## Features

- **Real-time WebSocket Connection**: Live data streaming from Ignition to web browser
- **REST API Fallback**: HTTP endpoints for single requests
- **CORS-Enabled**: Works from GitHub Pages or any domain
- **Tag Operations**: Read, write, and subscribe to Ignition tags
- **Real-time Charts**: Visualize tag data with Chart.js
- **Multi-client Support**: Connect multiple browsers simultaneously

## Quick Start

### 1. Install Dependencies

```bash
npm install express cors ws
# or
npm install
```

### 2. Configure Your Connection

Your `.env` file is already configured with:
- Ignition host: `pred`
- Port: `8088`
- API Key: Configured
- Protocol: `http`

### 3. Start the Bridge Server

```bash
# Start bridge server on port 8089
npm start

# Or run directly
node bridge-server.js
```

The bridge server will start on:
- HTTP API: `http://localhost:8089`
- WebSocket: `ws://localhost:8089`

### 4. Open the Web Client

#### Option A: Local Testing
Open `ignition-client.html` in your browser directly

#### Option B: GitHub Pages Deployment
1. Copy `ignition-client.html` to your GitHub Pages repository
2. Rename to `index.html` if you want it as the main page
3. Push to GitHub
4. Access at `https://yourusername.github.io/your-repo/`

## How It Works

### Bridge Server (`bridge-server.js`)

The bridge server acts as a middleware between your static GitHub Pages site and the Ignition gateway:

1. **WebSocket Server**: Provides real-time bidirectional communication
2. **REST API**: HTTP endpoints for tag operations
3. **CORS Headers**: Allows connections from GitHub Pages
4. **API Translation**: Converts web requests to Ignition API calls

### Web Client (`ignition-client.html`)

A single-page application that:
- Connects to the bridge server via WebSocket
- Provides UI for tag operations
- Displays real-time data updates
- Charts historical data

## API Endpoints

### REST API

- `GET /api/status` - Get gateway status
- `GET /api/tags/read/:tagPath` - Read single tag
- `POST /api/tags/write` - Write tag value
- `POST /api/tags/read-bulk` - Read multiple tags
- `GET /api/config` - Get server configuration

### WebSocket Messages

#### Client → Server
```javascript
// Subscribe to tag
{ type: 'subscribe', payload: { tagPath: '[default]Tag', interval: 1000 } }

// Read tag once
{ type: 'read', payload: { tagPath: '[default]Tag' } }

// Write tag
{ type: 'write', payload: { tagPath: '[default]Tag', value: 100 } }

// Unsubscribe
{ type: 'unsubscribe', payload: { tagPath: '[default]Tag' } }
```

#### Server → Client
```javascript
// Connection confirmed
{ type: 'connected', id: 'client-id', timestamp: '...' }

// Tag update
{ type: 'update', tagPath: '[default]Tag', data: { value: 100, quality: 'Good', timestamp: '...' } }

// Single read response
{ type: 'data', tagPath: '[default]Tag', data: { value: 100, quality: 'Good' } }
```

## Deployment Options

### Local Development
Perfect for testing and development:
```bash
node bridge-server.js
```
Then open `ignition-client.html` in your browser.

### Production Deployment

#### Option 1: Local Bridge + GitHub Pages
1. Run bridge server on a machine that can access Ignition
2. Deploy `ignition-client.html` to GitHub Pages
3. Configure client to connect to your bridge server IP

#### Option 2: Cloud Bridge (Advanced)
1. Deploy bridge server to a cloud service (Heroku, AWS, etc.)
2. Set up secure tunnel to your Ignition gateway (VPN, ngrok, etc.)
3. Update GitHub Pages to connect to cloud bridge

#### Option 3: Reverse Proxy
1. Set up nginx/Apache as reverse proxy
2. Configure SSL certificates
3. Expose bridge server through HTTPS

## Security Considerations

⚠️ **Important Security Notes:**

1. **Authentication**: The current setup uses API keys. In production:
   - Implement proper user authentication
   - Use HTTPS for all connections
   - Rotate API keys regularly

2. **Network Security**:
   - Don't expose Ignition directly to the internet
   - Use the bridge server as a security layer
   - Implement rate limiting and request validation

3. **CORS Configuration**:
   - Currently allows all GitHub Pages sites
   - Restrict to your specific domain in production

4. **Data Validation**:
   - Validate all tag paths and values
   - Implement access control lists
   - Log all operations for auditing

## Customization

### Adding Custom Endpoints

Edit `bridge-server.js` to add new endpoints:

```javascript
// Add custom endpoint
app.get('/api/custom/data', async (req, res) => {
    const data = await ignitionClient.customOperation();
    res.json(data);
});
```

### Modifying the UI

Edit `ignition-client.html` to customize:
- Colors and styling
- Add new features
- Integrate with other services

### Tag Path Examples

Common Ignition tag path formats:
- `[default]Folder/Tag` - Standard tag
- `[default]_Meta:Folder/Tag` - Meta tag
- `[MyProvider]Path/To/Tag` - Custom provider
- `[System]Gateway/Performance/CPU Usage` - System tags

## Troubleshooting

### Bridge Server Won't Start
- Check if port 8089 is already in use
- Verify Node.js is installed: `node --version`
- Install dependencies: `npm install`

### Can't Connect from GitHub Pages
- Check browser console for CORS errors
- Verify bridge server is running
- Try accessing bridge directly: `http://localhost:8089/health`

### No Data from Ignition
- Verify Ignition is accessible: `curl http://pred:8088/StatusPing`
- Check API key is valid
- Review bridge server logs for errors

### WebSocket Connection Fails
- Check firewall settings
- Verify WebSocket port (8089) is open
- Try REST API endpoints first

## Testing

### Test Ignition Connection
```bash
npm test
```

### Test API Discovery
```bash
npm run test-api
```

### Manual Testing
1. Open browser developer console
2. Check Network tab for WebSocket connection
3. Monitor Console for errors

## Next Steps

1. **Add Authentication**: Implement user login system
2. **Historical Data**: Add endpoints for historical queries
3. **Alarm Management**: Subscribe to alarm events
4. **Perspective Integration**: Embed Perspective views
5. **Mobile App**: Create React Native app using same bridge

## Support

- Check the logs in browser console
- Bridge server logs to terminal
- Ignition Gateway logs for API errors
- Network tab in browser DevTools

## License

MIT - Free to use and modify

---

Ready to bridge your Ignition system to the web! 🌐