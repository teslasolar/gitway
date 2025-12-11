# Ignition 8.3 REST API Documentation

## Overview

Ignition 8.3 introduces a comprehensive REST API that allows external systems to interact with the Gateway programmatically. This API provides endpoints for configuration management, project operations, tag management, and more.

## API Access

### Base URL
```
http://<gateway-host>:<port>/data/api/v1/
```
Default: `http://localhost:8088/data/api/v1/`

### OpenAPI Documentation
Access the interactive API documentation at:
```
http://<gateway-host>:<port>/openapi
```

## Authentication

### API Key Authentication
All API requests require authentication via API tokens.

1. **Create API Key:**
   - Navigate to: Gateway → Platform → Security → API Keys
   - Create new API key with appropriate permissions

2. **Using API Key:**
   ```http
   X-Ignition-API-Token: <your-api-token>
   ```

### Basic Authentication (Alternative)
```http
Authorization: Basic <base64(username:password)>
```

## Core Endpoints

### 1. Gateway Information

#### Get Gateway Status
```http
GET /data/api/v1/gateway/status
```

Response:
```json
{
  "version": "8.3.0",
  "uptime": 123456,
  "licenseMode": "trial",
  "modules": [...]
}
```

### 2. Project Management

#### List Projects
```http
GET /data/api/v1/projects
```

#### Get Project Details
```http
GET /data/api/v1/projects/{projectName}
```

#### Export Project
```http
GET /data/api/v1/projects/{projectName}/export
```
Returns project as .zip file

#### Import Project
```http
POST /data/api/v1/projects/import
Content-Type: multipart/form-data

FormData:
- file: project.zip
- overwrite: true/false
```

#### Create Project
```http
POST /data/api/v1/projects
Content-Type: application/json

{
  "name": "NewProject",
  "title": "New Project",
  "description": "Project description",
  "enabled": true,
  "inheritable": false
}
```

#### Update Project
```http
PUT /data/api/v1/projects/{projectName}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### Delete Project
```http
DELETE /data/api/v1/projects/{projectName}
```

### 3. Tag Management

#### Read Tags
```http
POST /data/api/v1/tags/read
Content-Type: application/json

{
  "tagPaths": [
    "[default]Path/To/Tag1",
    "[default]Path/To/Tag2"
  ]
}
```

#### Write Tags
```http
POST /data/api/v1/tags/write
Content-Type: application/json

{
  "tagWrites": [
    {
      "tagPath": "[default]Path/To/Tag",
      "value": 123.45
    }
  ]
}
```

#### Browse Tags
```http
POST /data/api/v1/tags/browse
Content-Type: application/json

{
  "path": "[default]",
  "recursive": false
}
```

#### Import Tags (JSON)
```http
POST /data/api/v1/tags/import
Content-Type: application/json

{
  "provider": "default",
  "basePath": "",
  "collisionPolicy": "overwrite",
  "tags": [
    {
      "name": "MyTag",
      "tagType": "AtomicTag",
      "valueSource": "memory",
      "value": 0,
      "dataType": "Int4"
    }
  ]
}
```

#### Export Tags
```http
POST /data/api/v1/tags/export
Content-Type: application/json

{
  "provider": "default",
  "paths": ["Path/To/Export"],
  "recursive": true
}
```

### 4. UDT Management

#### Import UDTs
```http
POST /data/api/v1/tags/udts/import
Content-Type: application/json

{
  "provider": "default",
  "udts": [
    {
      "name": "Motor",
      "tagType": "UdtType",
      "tags": [...],
      "parameters": {...}
    }
  ]
}
```

#### Get UDT Definitions
```http
GET /data/api/v1/tags/udts/{udtName}
```

### 5. Perspective Resources

#### Get View
```http
GET /data/api/v1/perspective/views/{projectName}/{viewPath}
```

#### Update View
```http
PUT /data/api/v1/perspective/views/{projectName}/{viewPath}
Content-Type: application/json

{
  "root": {...},
  "params": {...},
  "custom": {...}
}
```

#### Create View
```http
POST /data/api/v1/perspective/views/{projectName}
Content-Type: application/json

{
  "path": "NewView",
  "root": {
    "type": "ia.container.flex",
    "props": {...}
  }
}
```

### 6. Named Queries

#### List Named Queries
```http
GET /data/api/v1/named-queries/{projectName}
```

#### Execute Named Query
```http
POST /data/api/v1/named-queries/{projectName}/{queryPath}/execute
Content-Type: application/json

{
  "parameters": {
    "param1": "value1"
  }
}
```

### 7. Database Connections

#### List Connections
```http
GET /data/api/v1/database/connections
```

#### Test Connection
```http
POST /data/api/v1/database/connections/{name}/test
```

### 8. Module Management

#### List Modules
```http
GET /data/api/v1/modules
```

#### Install Module
```http
POST /data/api/v1/modules/install
Content-Type: multipart/form-data

FormData:
- file: module.modl
```

#### Uninstall Module
```http
DELETE /data/api/v1/modules/{moduleId}
```

### 9. Backup & Restore

#### Create Backup
```http
POST /data/api/v1/gateway/backup
Content-Type: application/json

{
  "includeProjects": true,
  "includeTags": true,
  "includeGatewayConfig": true
}
```

Returns backup .gwbk file

#### Restore Backup
```http
POST /data/api/v1/gateway/restore
Content-Type: multipart/form-data

FormData:
- file: backup.gwbk
- restoreProjects: true
- restoreTags: true
```

### 10. Audit & Logs

#### Get Audit Events
```http
GET /data/api/v1/audit/events?startDate=2024-01-01&endDate=2024-12-31
```

#### Get Gateway Logs
```http
GET /data/api/v1/logs/gateway?level=WARN&limit=100
```

## Resource Pattern

Most configuration resources follow this standardized pattern:

### List Resources
```http
GET /data/api/v1/resources/{moduleId}/{typeId}
```

### Get Resource
```http
GET /data/api/v1/resources/{moduleId}/{typeId}/{name}
```

### Create Resource
```http
POST /data/api/v1/resources/{moduleId}/{typeId}
Content-Type: application/json

{resource-data}
```

### Update Resource
```http
PUT /data/api/v1/resources/{moduleId}/{typeId}/{name}
Content-Type: application/json

{resource-data}
```

### Delete Resource
```http
DELETE /data/api/v1/resources/{moduleId}/{typeId}/{name}
```

## Error Responses

Standard HTTP status codes:
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request
- `401 Unauthorized`: Missing/invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {...}
  }
}
```

## Rate Limiting

The API implements rate limiting:
- Default: 1000 requests per minute
- Configurable in Gateway settings
- Headers returned:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## WebSocket Support

For real-time data:
```javascript
const ws = new WebSocket('ws://localhost:8088/data/ws');
ws.send(JSON.stringify({
  type: 'subscribe',
  tags: ['[default]Path/To/Tag']
}));
```

## Best Practices

1. **Use API Keys**: Never hardcode credentials
2. **Handle Errors**: Implement retry logic with exponential backoff
3. **Batch Operations**: Use bulk endpoints when available
4. **Monitor Rate Limits**: Respect rate limit headers
5. **Version Control**: Track API changes between Ignition versions
6. **Audit Logging**: Enable audit logs for API operations
7. **Secure Transport**: Use HTTPS in production
8. **Minimal Permissions**: Grant only necessary permissions to API keys

## Security Considerations

- API keys should be rotated regularly
- Use IP whitelisting when possible
- Enable audit logging for all API operations
- Implement request validation
- Use HTTPS/TLS for production environments
- Never expose API keys in client-side code

## Example Implementations

### Python Client Example
```python
import requests
import json

class IgnitionAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-Ignition-API-Token': api_key,
            'Content-Type': 'application/json'
        }

    def get_projects(self):
        response = requests.get(
            f"{self.base_url}/projects",
            headers=self.headers
        )
        return response.json()

    def import_project(self, zip_path, overwrite=False):
        with open(zip_path, 'rb') as f:
            files = {'file': f}
            data = {'overwrite': str(overwrite).lower()}
            response = requests.post(
                f"{self.base_url}/projects/import",
                headers={'X-Ignition-API-Token': self.headers['X-Ignition-API-Token']},
                files=files,
                data=data
            )
        return response.status_code == 200

    def read_tags(self, tag_paths):
        response = requests.post(
            f"{self.base_url}/tags/read",
            headers=self.headers,
            json={'tagPaths': tag_paths}
        )
        return response.json()
```

### JavaScript/Node.js Example
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class IgnitionAPI {
  constructor(baseUrl, apiKey) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-Ignition-API-Token': apiKey
      }
    });
  }

  async getProjects() {
    const response = await this.client.get('/projects');
    return response.data;
  }

  async importProject(zipPath, overwrite = false) {
    const form = new FormData();
    form.append('file', fs.createReadStream(zipPath));
    form.append('overwrite', overwrite.toString());

    const response = await this.client.post('/projects/import', form, {
      headers: form.getHeaders()
    });
    return response.status === 200;
  }

  async readTags(tagPaths) {
    const response = await this.client.post('/tags/read', {
      tagPaths: tagPaths
    });
    return response.data;
  }
}
```

## Automation Scripts

### Automated Project Import
```bash
#!/bin/bash
# import-project.sh

GATEWAY_URL="http://localhost:8088/data/api/v1"
API_KEY="your-api-key-here"
PROJECT_ZIP="gitway-perspective.zip"

curl -X POST "$GATEWAY_URL/projects/import" \
  -H "X-Ignition-API-Token: $API_KEY" \
  -F "file=@$PROJECT_ZIP" \
  -F "overwrite=true"
```

### Batch Tag Import
```bash
#!/bin/bash
# import-tags.sh

GATEWAY_URL="http://localhost:8088/data/api/v1"
API_KEY="your-api-key-here"
TAGS_JSON="gitway-tags.json"

curl -X POST "$GATEWAY_URL/tags/import" \
  -H "X-Ignition-API-Token: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TAGS_JSON"
```

## Version Differences

### 8.3.0+ Features
- Full REST API with OpenAPI documentation
- File-based configuration (JSON)
- API key authentication
- Resource standardization
- WebSocket support for real-time data

### Pre-8.3.0
- Limited API endpoints
- Database-based configuration
- Basic authentication only
- Custom endpoint patterns

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify API key is active
   - Check key permissions
   - Ensure correct header name

2. **Project Import Fails**
   - Check zip file integrity
   - Verify project structure
   - Review Gateway logs

3. **Tag Write Errors**
   - Confirm tag paths exist
   - Check data types match
   - Verify write permissions

4. **Rate Limit Exceeded**
   - Implement backoff strategy
   - Batch operations
   - Request limit increase

## Additional Resources

- [Official Ignition Documentation](https://docs.inductiveautomation.com/docs/8.3/)
- [OpenAPI Specification](http://localhost:8088/openapi)
- [Ignition Forum](https://forum.inductiveautomation.com/)
- [GitHub Examples](https://github.com/inductiveautomation)

---

*Note: Always test API operations in a development environment before production deployment.*