# Bridge Server Quick Reference

## Environment Variables

```bash
# Heartbeat interval (ms) - how often to ping clients
HEARTBEAT_INTERVAL=30000

# Maximum subscriptions per client
MAX_SUBSCRIPTIONS=100

# Batch processing interval (ms)
BATCH_INTERVAL=100

# Existing variables
IGNITION_HOST=pred
IGNITION_PORT=8088
IGNITION_PROTOCOL=http
IGNITION_API_KEY=your-key-here
BRIDGE_PORT=8089
```

## REST API Endpoints

### Health & Metrics
```bash
# Basic health check with connection info
GET /health
Response: {
  "status": "healthy",
  "timestamp": "2025-12-11T...",
  "clients": 5,
  "subscriptions": {
    "activeSubscriptions": 12,
    "totalCallbacks": 15
  }
}

# Detailed metrics
GET /api/metrics
Response: {
  "connections": { "total": 100, "active": 5 },
  "messages": { "sent": 1000, "received": 800, "errors": 2 },
  "subscriptions": { "active": 12, "total": 50 },
  "tagReads": { "total": 500, "cached": 350, "errors": 1 },
  "tagWrites": { "total": 20, "errors": 0 },
  "uptimeSeconds": 3600,
  "cacheSize": 45
}
```

### Tag Operations
```bash
# Read single tag (with optional cache bypass)
GET /api/tags/read/:tagPath?cache=false

# Write tag
POST /api/tags/write
Body: { "tagPath": "path/to/tag", "value": 123 }

# Batch read
POST /api/tags/read-bulk
Body: { "tagPaths": ["tag1", "tag2", "tag3"] }

# Gateway status
GET /api/status

# Server config
GET /api/config
```

## WebSocket Messages

### Connection
```javascript
// Client connects
ws = new WebSocket('ws://localhost:8089');

// Server responds
{
  "type": "connected",
  "id": "1234567890-abcdef",
  "timestamp": "2025-12-11T...",
  "config": {
    "heartbeatInterval": 30000,
    "maxSubscriptions": 100
  }
}
```

### Heartbeat
```javascript
// Client sends ping
{ "type": "ping" }

// Server responds
{ "type": "pong", "timestamp": 1234567890 }
```

### Single Tag Operations
```javascript
// Subscribe to tag updates
{
  "type": "subscribe",
  "requestId": "req-1",  // optional
  "payload": {
    "tagPath": "System/Time/CurrentTime",
    "interval": 1000  // milliseconds
  }
}

// Server confirms
{ "type": "subscribed", "tagPath": "...", "interval": 1000 }

// Server sends updates
{
  "type": "update",
  "tagPath": "System/Time/CurrentTime",
  "data": {
    "tagPath": "...",
    "value": 1234567890,
    "quality": "Good",
    "timestamp": "2025-12-11T..."
  }
}

// Unsubscribe
{
  "type": "unsubscribe",
  "payload": { "tagPath": "System/Time/CurrentTime" }
}

// Server confirms
{ "type": "unsubscribed", "tagPath": "..." }
```

### Batch Operations (NEW)
```javascript
// Subscribe to multiple tags at once
{
  "type": "subscribe_batch",
  "requestId": "req-2",
  "payload": {
    "tags": [
      { "tagPath": "tag1", "interval": 1000 },
      { "tagPath": "tag2", "interval": 2000 },
      { "tagPath": "tag3", "interval": 1000 }
    ]
  }
}

// Server confirms
{
  "type": "subscribe_batch_result",
  "requestId": "req-2",
  "success": true,
  "count": 3
}

// Read multiple tags at once
{
  "type": "read_batch",
  "requestId": "req-3",
  "payload": {
    "tagPaths": ["tag1", "tag2", "tag3"]
  }
}

// Server responds
{
  "type": "read_batch_result",
  "requestId": "req-3",
  "data": [
    { "tagPath": "tag1", "value": 123, "quality": "Good", ... },
    { "tagPath": "tag2", "value": 456, "quality": "Good", ... },
    { "tagPath": "tag3", "value": 789, "quality": "Good", ... }
  ]
}
```

### Read/Write Operations
```javascript
// Read single tag
{
  "type": "read",
  "requestId": "req-4",
  "payload": {
    "tagPath": "System/Memory/FreeMemory",
    "useCache": true  // optional, default true
  }
}

// Server responds
{
  "type": "data",
  "requestId": "req-4",
  "tagPath": "...",
  "data": { "value": 1024, "quality": "Good", ... }
}

// Write tag
{
  "type": "write",
  "requestId": "req-5",
  "payload": {
    "tagPath": "TestTag",
    "value": 42
  }
}

// Server responds
{
  "type": "write_result",
  "requestId": "req-5",
  "data": { "success": true, "tagPath": "...", "value": 42 }
}
```

### Reconnection Support (NEW)
```javascript
// After reconnection, request buffered messages
{ "type": "get_buffered" }

// Server sends buffered messages
{
  "type": "buffered_messages",
  "messages": [
    { "type": "update", "tagPath": "...", "data": {...} },
    { "type": "update", "tagPath": "...", "data": {...} }
  ]
}
```

### Error Handling
```javascript
// Server error response
{
  "type": "error",
  "requestId": "req-6",  // if provided in request
  "message": "Maximum subscriptions (100) reached"
}

// Other error messages
{
  "type": "error",
  "message": "Unknown message type: invalid"
}

{
  "type": "error",
  "message": "Not subscribed to System/Tag"
}
```

### Special Responses
```javascript
// Already subscribed
{
  "type": "already_subscribed",
  "tagPath": "System/Time/CurrentTime"
}
```

## Client Library (client-example.js)

### Basic Usage
```javascript
const BridgeClient = require('./client-example');

const client = new BridgeClient('ws://localhost:8089');
client.connect();

// Read tag
const value = await client.readTag('System/Time/CurrentTime');

// Read multiple tags
const values = await client.readTags([
  'System/Time/CurrentTime',
  'System/Memory/FreeMemory'
]);

// Write tag
await client.writeTag('TestTag', 42);

// Subscribe with callback
client.subscribe('System/CPU/Load', (data) => {
  console.log('CPU Load:', data.value);
}, 2000);

// Batch subscribe
client.subscribeBatch([
  {
    tagPath: 'tag1',
    interval: 1000,
    callback: (data) => console.log(data)
  },
  {
    tagPath: 'tag2',
    interval: 2000,
    callback: (data) => console.log(data)
  }
]);

// Unsubscribe
client.unsubscribe('System/CPU/Load');

// Disconnect
client.disconnect();
```

## Performance Tips

1. **Use caching for frequent reads**: Default 5s TTL reduces API calls by 50-80%
2. **Batch operations**: Use `read_batch` and `subscribe_batch` for multiple tags
3. **Monitor metrics**: Check `/api/metrics` to track cache hit rate
4. **Subscription limits**: Keep subscriptions under the limit (default 100/client)
5. **Heartbeat**: Client should respond to pings or send periodic pings
6. **Reconnection**: Use `get_buffered` after reconnection to retrieve missed messages

## Troubleshooting

### Client disconnects frequently
- Check heartbeat interval and ensure client responds to pings
- Check network stability
- Monitor `/api/metrics` for connection patterns

### High memory usage
- Check number of active subscriptions
- Monitor cache size in metrics
- Consider reducing cache TTL or subscription count

### Slow tag reads
- Check cache hit rate in metrics (should be >70%)
- Consider increasing cache TTL
- Use batch operations for multiple tags

### Missing subscription updates
- Check client subscriptions didn't hit max limit
- Verify WebSocket connection is open
- Use `get_buffered` after reconnection

## File Locations
- Server: `F:\git\gitway\gateway\bridge-server.js`
- Client: `F:\git\gitway\gateway\client-example.js`
- Full docs: `F:\git\gitway\gateway\OPTIMIZATIONS.md`
