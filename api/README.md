# GitWay API

A JSON-based REST API served via GitHub Pages for accessing GitWay configuration and data.

## Base URL

```
https://teslasolar.github.io/gitway
```

## Quick Start

### Using the JavaScript Client

```html
<script src="https://teslasolar.github.io/gitway/api/gitway-client.js"></script>
<script>
const client = new GitWayClient();
const status = await client.getStatus();
console.log(status);
</script>
```

### Direct API Access

```javascript
fetch('https://teslasolar.github.io/gitway/api/v1/status.json')
    .then(response => response.json())
    .then(data => console.log(data));
```

## Available Endpoints

All endpoints return JSON data and are accessible via GET requests.

### Core Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/status.json` | API status and gateway connection info |
| `/api/v1/config.json` | Configuration settings |
| `/api/v1/components.json` | Available GitWay components |
| `/api/v1/collections.json` | Data collection schemas |
| `/api/v1/manifest.json` | Complete API manifest |

### Configuration Endpoints

| Endpoint | Description |
|----------|-------------|
| `/views.json` | UI view configurations |
| `/gateway-components.json` | Discovered gateway components |

### Data Endpoints (when available)

| Endpoint | Description |
|----------|-------------|
| `/api/v1/data/tags/list.json` | List of tags |
| `/api/v1/data/tags/latest.json` | Latest tag values |
| `/api/v1/data/alarms/active.json` | Active alarms |
| `/api/v1/data/alarms/history.json` | Alarm history |

## JavaScript Client

The GitWay JavaScript client provides convenient methods for accessing the API.

### Installation

```html
<script src="https://teslasolar.github.io/gitway/api/gitway-client.js"></script>
```

Or via npm (when published):
```bash
npm install gitway-client
```

### Client Methods

```javascript
const client = new GitWayClient({
    baseUrl: 'https://teslasolar.github.io/gitway',
    version: 'v1',
    cacheTimeout: 60000
});

// Get API status
await client.getStatus();

// Get configuration
await client.getConfig();

// Get components
await client.getComponents();

// Get collections
await client.getCollections();

// Get manifest
await client.getManifest();

// Get UI views
await client.getViews();

// Poll for updates
const pollId = client.pollEndpoint('status.json', (err, data) => {
    console.log('Updated:', data);
}, 5000);

// Stop polling
client.stopPolling(pollId);

// Clear cache
client.clearCache();
```

## Auto-Initialize with HTML

```html
<div data-gitway-api="https://teslasolar.github.io/gitway"
     data-gitway-version="v1"
     data-gitway-cache-timeout="60000"
     data-gitway-container="app">
</div>
```

## CORS Support

The API is CORS-enabled and can be accessed from any domain.

```javascript
// From any website
fetch('https://teslasolar.github.io/gitway/api/v1/status.json')
    .then(response => response.json())
    .then(data => console.log(data));
```

## Response Format

All endpoints return JSON with this general structure:

```json
{
    "name": "Resource Name",
    "description": "Resource description",
    "data": { ... },
    "timestamp": "2024-12-10T22:00:00Z"
}
```

## Error Handling

```javascript
try {
    const data = await client.getStatus();
    console.log(data);
} catch (error) {
    console.error('API Error:', error.message);
}
```

## Examples

### Get All Components

```javascript
const client = new GitWayClient();
const components = await client.getComponents();

components.components.forEach(comp => {
    console.log(`${comp.name}: ${comp.description}`);
    console.log(`  Capabilities: ${comp.capabilities.join(', ')}`);
});
```

### Monitor Status

```javascript
const client = new GitWayClient();

// Poll status every 10 seconds
client.pollEndpoint('status.json', (error, status) => {
    if (error) {
        console.error('Poll error:', error);
        return;
    }

    console.log('Gateway status:', status.gateway.connected ? 'Connected' : 'Disconnected');
}, 10000);
```

### Build Dynamic Interface

```javascript
const client = new GitWayClient();

// Get view configuration and build UI
const views = await client.getViews();

Object.values(views.views).forEach(view => {
    console.log(`View: ${view.title} (${view.icon})`);
    console.log(`  Components: ${view.components.length}`);
});
```

## WebSocket Support

For real-time updates, connect to the bridge server WebSocket:

```javascript
const client = new GitWayClient();

// Connect to WebSocket bridge
await client.connectWebSocket('ws://localhost:3001');

// Listen for updates
client.on('update', (data) => {
    console.log('Real-time update:', data);
});
```

## Rate Limiting

The API has no rate limiting as it serves static JSON files via GitHub Pages.

## Authentication

Currently, the API requires no authentication. It serves public, read-only data.

## Caching

The JavaScript client implements automatic caching:
- Default cache timeout: 60 seconds
- Can be configured per client instance
- Use `noCache: true` option to bypass cache

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Internet Explorer 11+ (with polyfills)
- Node.js 12+

## Try It

Open the example page to test the API:
[https://teslasolar.github.io/gitway/api/example.html](https://teslasolar.github.io/gitway/api/example.html)

## License

MIT

## Support

For issues or questions, visit:
https://github.com/teslasolar/gitway/issues