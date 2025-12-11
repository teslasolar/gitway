# Ignition Gateway API Connector

A comprehensive, flexible, and parameterized API connector for Ignition 8.3 SCADA Gateway with no hardcoding.

## Features

- **Fully Parameterized**: All configuration via JSON files and environment variables
- **Multiple Authentication Methods**: Basic, Bearer, OAuth2, API Key, Certificate
- **Template-Based API Calls**: Reusable templates for common operations
- **Data Transformation**: Automatic conversion between Ignition and standard formats
- **Real-time Monitoring**: Subscribe to tag changes with configurable polling
- **Batch Operations**: Execute multiple operations efficiently
- **Caching Support**: Reduce API calls with intelligent caching
- **Queue Management**: Handle concurrent requests with automatic queuing

## Installation

1. Clone the repository to your gitway folder
2. Copy `.env.example` to `.env` and configure your settings
3. Install dependencies (if using Node.js):

```bash
npm install dotenv
```

## Quick Start

```javascript
const IgnitionGatewayConnector = require('./ignition-gateway-connector');

// Create connector with your configuration
const gateway = new IgnitionGatewayConnector({
    connection: {
        host: 'localhost',
        port: 8088
    },
    authentication: {
        username: 'your-username',
        password: 'your-password'
    }
});

// Connect and use
async function main() {
    await gateway.connect();

    // Read a tag
    const value = await gateway.readTags('[default]Path/To/Tag');
    console.log(value);

    gateway.disconnect();
}

main();
```

## Configuration

### Configuration Files

#### `ignition-config.json`
Main configuration file with all gateway settings:

```json
{
    "connection": {
        "protocol": "https",
        "host": "localhost",
        "port": 8088,
        "gatewayContext": "main"
    },
    "authentication": {
        "type": "basic",
        "username": "",
        "password": ""
    }
}
```

#### `.env` File
Environment variables for sensitive data:

```env
IGNITION_HOST=your-server.com
IGNITION_PORT=8088
IGNITION_USERNAME=admin
IGNITION_PASSWORD=secret
```

### Authentication Methods

#### Basic Authentication
```javascript
{
    "authentication": {
        "type": "basic",
        "username": "admin",
        "password": "password"
    }
}
```

#### API Key Authentication
```javascript
{
    "authentication": {
        "type": "api-key",
        "apiKey": "your-api-key",
        "headerName": "X-API-Key"
    }
}
```

#### OAuth2 Authentication
```javascript
{
    "authentication": {
        "type": "oauth2",
        "oauth2": {
            "authorizationUrl": "https://server/oauth/authorize",
            "tokenUrl": "https://server/oauth/token",
            "clientId": "your-client-id",
            "clientSecret": "your-client-secret",
            "redirectUri": "http://localhost:3000/callback",
            "scope": "api"
        }
    }
}
```

## API Operations

### Tag Operations

#### Read Tags
```javascript
// Read single tag
const value = await gateway.readTags('[default]Path/To/Tag');

// Read multiple tags
const values = await gateway.readTags([
    '[default]Tag1',
    '[default]Tag2'
]);

// Read with options
const result = await gateway.readTags(tags, {
    provider: 'default',
    transform: true  // Apply automatic transformation
});
```

#### Write Tags
```javascript
// Write single tag
await gateway.writeTags({
    path: '[default]Path/To/Tag',
    value: 100,
    dataType: 'Float4'
});

// Write multiple tags
await gateway.writeTags([
    { path: '[default]Tag1', value: true },
    { path: '[default]Tag2', value: 42 }
]);
```

#### Browse Tags
```javascript
const tags = await gateway.api.browseTags('[default]Folder', {
    recursive: true
});
```

### History Operations

#### Query History
```javascript
const history = await gateway.queryHistory(
    '[default]Path/To/Tag',
    new Date('2024-01-01'),
    new Date(),
    {
        format: 'timeseries',  // or 'table', 'csv', 'json'
        aggregationMode: 'Average',
        intervalHours: 1
    }
);
```

### Alarm Operations

#### Get Active Alarms
```javascript
const alarms = await gateway.getActiveAlarms({
    priority: [3, 4],  // High and Critical
    displayPath: 'Area/Equipment/*'
});
```

#### Acknowledge Alarms
```javascript
await gateway.api.acknowledgeAlarms(
    ['alarm-id-1', 'alarm-id-2'],
    'Acknowledged by operator'
);
```

### Database Operations

#### Execute Named Query
```javascript
const result = await gateway.executeNamedQuery(
    'getProductionData',
    {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        area: 'Line1'
    }
);
```

### Real-time Monitoring

```javascript
// Monitor tags with callback
const monitor = await gateway.monitorTags(
    ['[default]Tag1', '[default]Tag2'],
    (error, values) => {
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Values:', values);
        }
    },
    5000  // Poll interval in ms
);

// Stop monitoring
monitor.stop();
```

## Template System

### Using Templates

```javascript
// Use predefined template
const result = await gateway.executeTemplate(
    'tags.read.multiple',
    ['[default]Tag1', '[default]Tag2'],
    'default'  // provider
);

// Available templates:
// - tags.read.single
// - tags.read.multiple
// - tags.write.single
// - history.query.raw
// - history.query.aggregated
// - alarms.query.active
// - database.named_query.execute
```

### Creating Custom Templates

```javascript
gateway.templates.createTemplate('custom.myOperation', {
    endpoint: '/custom/endpoint',
    method: 'POST',
    body: (param1, param2) => ({
        parameter1: param1,
        parameter2: param2
    })
});

// Use custom template
const result = await gateway.executeTemplate(
    'custom.myOperation',
    'value1',
    'value2'
);
```

## Data Transformation

### Transform Formats

```javascript
// Transform history to different formats
const history = await gateway.queryHistory(
    tags,
    startDate,
    endDate,
    { format: 'csv' }  // Returns CSV string
);

// Transform for Perspective components
const tableData = gateway.transformer.transformForPerspective(
    data,
    'table'  // Component type
);
```

### Custom Transformers

```javascript
// Register custom transformer
gateway.transformer.registerTransformer('myTransform', (data, params) => {
    // Transform logic
    return transformedData;
});

// Use custom transformer
const result = gateway.transformer.applyCustomTransformer(data, {
    name: 'myTransform',
    params: { option: 'value' }
});
```

## Batch Operations

```javascript
// Execute multiple operations in parallel
const results = await gateway.bulk([
    {
        method: 'readTags',
        args: [['[default]Tag1', '[default]Tag2']]
    },
    {
        method: 'getActiveAlarms',
        args: [{ priority: [4] }]
    },
    {
        method: 'executeNamedQuery',
        args: ['getStatus', {}]
    }
]);

// Results include status and error handling
results.forEach(result => {
    if (result.status === 'fulfilled') {
        console.log('Success:', result.value);
    } else {
        console.error('Failed:', result.error);
    }
});
```

## Error Handling

```javascript
try {
    await gateway.connect();
    const value = await gateway.readTags('[default]InvalidTag');
} catch (error) {
    if (error.message.includes('404')) {
        console.error('Tag not found');
    } else if (error.message.includes('401')) {
        console.error('Authentication failed');
    } else {
        console.error('Error:', error.message);
    }
}
```

## Performance Optimization

### Caching
```javascript
// Configure caching
const gateway = new IgnitionGatewayConnector({
    cache: {
        enabled: true,
        ttl: 60000,  // 60 seconds
        maxSize: 100
    }
});

// Use cached named queries
const result = await gateway.executeNamedQuery(
    'expensiveQuery',
    params,
    true  // Use cache
);
```

### Request Queuing
```javascript
// Configure concurrent requests
gateway.api.maxConcurrentRequests = 10;

// Requests automatically queue when limit reached
const promises = [];
for (let i = 0; i < 50; i++) {
    promises.push(gateway.readTags(`[default]Tag${i}`));
}

const results = await Promise.all(promises);
```

## Testing Connection

```javascript
// Test gateway connection
const result = await gateway.api.testConnection();
if (result.connected) {
    console.log('Connected successfully');
    console.log('Gateway version:', result.status.version);
} else {
    console.error('Connection failed:', result.error);
}
```

## Advanced Usage

### Session Management
```javascript
// Create user session
const sessionId = gateway.auth.createSession('user123', {
    role: 'operator',
    area: 'Production'
});

// Validate session
const session = gateway.auth.validateSession(sessionId);

// Destroy session
gateway.auth.destroySession(sessionId);
```

### Custom Authentication
```javascript
// Add custom authentication method
gateway.auth.addCustomAuth('myAuth', async (params) => {
    // Custom authentication logic
    const token = await fetchTokenFromCustomService(params);
    return {
        'Authorization': `Custom ${token}`
    };
});

// Use custom authentication
const headers = await gateway.auth.executeCustomAuth('myAuth', {
    user: 'operator'
});
```

## Gateway Status Monitoring

```javascript
// Get comprehensive gateway information
const info = await gateway.getInfo();
console.log('Status:', info.status);
console.log('Performance:', info.performance);
console.log('Connection:', info.connection);

// Monitor gateway performance
setInterval(async () => {
    const metrics = await gateway.api.getPerformanceMetrics();
    console.log('CPU:', metrics.cpu);
    console.log('Memory:', metrics.memory);
    console.log('Active Sessions:', metrics.sessions);
}, 10000);
```

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use environment variables** for sensitive data
3. **Enable SSL verification** in production
4. **Rotate API keys** regularly
5. **Implement proper error handling** to avoid exposing sensitive information
6. **Use least privilege** - Only grant necessary permissions
7. **Monitor and log** all API access

## Troubleshooting

### Connection Issues
- Verify firewall settings allow connection to port 8088
- Check SSL certificate if using HTTPS
- Ensure gateway Web Dev module is installed and running
- Verify authentication credentials

### Performance Issues
- Enable caching for frequently accessed data
- Use batch operations for multiple requests
- Adjust polling intervals for monitoring
- Increase concurrent request limits if needed

### Data Issues
- Check tag paths are correct (including provider)
- Verify data types match expected formats
- Use transformation utilities for format conversion
- Check quality codes for tag read operations

## Support

For issues or questions:
1. Check the configuration files are correct
2. Verify Ignition Gateway is running and accessible
3. Enable debug logging by setting `LOG_LEVEL=debug` in `.env`
4. Review Ignition Gateway logs for server-side errors

## License

This connector is provided as-is for integration with Ignition 8.3 SCADA systems.