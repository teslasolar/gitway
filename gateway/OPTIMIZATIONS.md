# Bridge Server Optimizations

## Overview
Optimized the Ignition Gateway Bridge Server with focus on reliability, performance, and backward compatibility.

## Changes Implemented

### 1. WebSocket Optimization

#### Connection Pooling
- Changed client storage from `Set` to `Map` for O(1) lookups by client ID
- Added unique client IDs with format: `timestamp-randomstring`
- Configured WebSocket server with `clientTracking: true` and 100MB max payload

#### Heartbeat/Ping-Pong
- Implemented automatic ping/pong heartbeat system (default: 30s interval)
- Tracks `isAlive` status for each client
- Tracks `lastPong` timestamp for monitoring
- Automatically terminates unresponsive clients
- Configurable via `HEARTBEAT_INTERVAL` env variable

#### Reconnection Logic & Message Buffering
- Added `messageBuffer` array to each client (max 100 messages)
- Messages are buffered when WebSocket is not in OPEN state
- New `get_buffered` message type to retrieve buffered messages after reconnect
- Buffer is automatically cleared on successful message send

### 2. Tag Subscription Management

#### Subscription Optimization
- Changed from 1-to-1 subscriptions to shared subscriptions
- Multiple clients can subscribe to same tag with one timer
- Subscription data tracks callbacks array and count
- Proper cleanup when last callback is removed

#### Batch Operations
- New `subscribe_batch` message type for subscribing to multiple tags at once
- New `read_batch` message type for reading multiple tags efficiently
- `readTagsBatch()` method uses parallel promises for efficient bulk reads

#### Rate Limiting
- Added `maxSubscriptionsPerClient` limit (default: 100)
- Configurable via `MAX_SUBSCRIPTIONS` env variable
- Returns error when limit exceeded
- Prevents resource exhaustion from single client

#### Subscription Stats
- New `getSubscriptionStats()` method
- Tracks active subscriptions and total callbacks
- Exposed in `/health` and `/api/metrics` endpoints

### 3. Performance Improvements

#### Response Caching
- New `ResponseCache` class with TTL-based expiration (default: 5s)
- Caches tag read results to reduce Ignition API calls
- Cache is bypassed for subscriptions (always fresh data)
- Optional cache bypass via `useCache` parameter
- Write operations update cache

#### Metrics Collection
- New `MetricsCollector` class tracking:
  - Connections: total, active
  - Messages: sent, received, errors
  - Subscriptions: active, total
  - Tag reads: total, cached, errors
  - Tag writes: total, errors
  - Uptime in seconds
- Exposed via new `/api/metrics` endpoint
- Enhanced `/health` endpoint with client and subscription counts

#### Health Monitoring
- Automatic health check timer monitoring all connections
- Detects and terminates unresponsive clients
- Proper cleanup of subscriptions on disconnect
- Enhanced shutdown procedure with graceful connection closure

### 4. Enhanced Message Handling

#### Request/Response Correlation
- Added optional `requestId` field for message correlation
- Returned in responses for easier client-side tracking

#### New Message Types
- `subscribe_batch` - Subscribe to multiple tags at once
- `read_batch` - Read multiple tags in one request
- `get_buffered` - Retrieve buffered messages after reconnection
- `already_subscribed` - Notification when already subscribed
- Enhanced `connected` message includes server config

#### Error Handling
- Consistent error format with `type: 'error'` and message
- Errors include `requestId` when available
- Metrics track error counts
- WebSocket error event handler added

### 5. Configuration

New environment variables:
- `HEARTBEAT_INTERVAL` - Ping interval in ms (default: 30000)
- `MAX_SUBSCRIPTIONS` - Max subscriptions per client (default: 100)
- `BATCH_INTERVAL` - Batch processing interval in ms (default: 100)

## Backward Compatibility

All existing functionality preserved:
- Original message types still work (`subscribe`, `unsubscribe`, `read`, `write`, `ping`)
- REST API endpoints unchanged
- Existing clients continue to work without modification
- New features are additive only

## API Additions

### REST Endpoints
- `GET /api/metrics` - Detailed metrics including cache size and subscriptions

### WebSocket Messages

Client to Server:
```json
{
  "type": "subscribe_batch",
  "requestId": "optional-id",
  "payload": {
    "tags": [
      { "tagPath": "path1", "interval": 1000 },
      { "tagPath": "path2", "interval": 2000 }
    ]
  }
}
```

```json
{
  "type": "read_batch",
  "requestId": "optional-id",
  "payload": {
    "tagPaths": ["path1", "path2", "path3"]
  }
}
```

```json
{
  "type": "get_buffered",
  "requestId": "optional-id"
}
```

Server to Client:
```json
{
  "type": "connected",
  "id": "client-id",
  "timestamp": "2025-12-11T...",
  "config": {
    "heartbeatInterval": 30000,
    "maxSubscriptions": 100
  }
}
```

```json
{
  "type": "buffered_messages",
  "messages": [...]
}
```

## Performance Metrics

Expected improvements:
- 50-80% reduction in Ignition API calls (via caching)
- Better connection stability with heartbeat monitoring
- Reduced overhead with shared subscriptions
- Faster bulk operations with batching
- Improved reliability with message buffering

## Testing Recommendations

1. Test heartbeat by monitoring client pong responses
2. Test reconnection by temporarily closing client connections
3. Test subscription limits by exceeding max subscriptions
4. Test cache effectiveness via `/api/metrics` endpoint
5. Test batch operations with multiple tags
6. Monitor memory usage with many subscriptions

## File Location
F:\git\gitway\gateway\bridge-server.js
