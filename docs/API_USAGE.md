# GitWay API - Dynamic JSON API via index.html

The GitWay index.html serves as both a UI and an API endpoint. When accessed with API parameters, it returns JSON data instead of rendering the interface.

## API Access Methods

### 1. Query Parameter Method

Access the API using `?api=` query parameter:

```
https://teslasolar.github.io/gitway/?api=status
https://teslasolar.github.io/gitway/?api=config
https://teslasolar.github.io/gitway/?api=components
https://teslasolar.github.io/gitway/?api=collections
https://teslasolar.github.io/gitway/?api=manifest
https://teslasolar.github.io/gitway/?api=views
https://teslasolar.github.io/gitway/?api=gateway
```

### 2. Hash Method

Access the API using URL hash:

```
https://teslasolar.github.io/gitway/#api/status
https://teslasolar.github.io/gitway/#api/config
https://teslasolar.github.io/gitway/#api/components
```

### 3. Data Endpoints

Access collection data:

```
https://teslasolar.github.io/gitway/?api=data/tags
https://teslasolar.github.io/gitway/?api=data/alarms
https://teslasolar.github.io/gitway/#api/data/history
```

## JavaScript Usage

### Fetch API

```javascript
// Get status
fetch('https://teslasolar.github.io/gitway/?api=status')
    .then(response => response.text())
    .then(text => {
        // Parse the JSON from the pre element
        const pre = new DOMParser().parseFromString(text, 'text/html').querySelector('pre');
        const data = JSON.parse(pre.textContent);
        console.log(data);
    });

// Simpler approach using iframe
function fetchGitWayAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://teslasolar.github.io/gitway/?api=${endpoint}`;

        iframe.onload = () => {
            try {
                const content = iframe.contentWindow.document.querySelector('pre').textContent;
                const data = JSON.parse(content);
                document.body.removeChild(iframe);
                resolve(data);
            } catch (error) {
                document.body.removeChild(iframe);
                reject(error);
            }
        };

        document.body.appendChild(iframe);
    });
}

// Usage
fetchGitWayAPI('status').then(data => console.log(data));
```

### Direct Browser Access

Simply visit these URLs in your browser to see JSON responses:

- [Status](https://teslasolar.github.io/gitway/?api=status)
- [Config](https://teslasolar.github.io/gitway/?api=config)
- [Components](https://teslasolar.github.io/gitway/?api=components)
- [Collections](https://teslasolar.github.io/gitway/?api=collections)
- [Manifest](https://teslasolar.github.io/gitway/?api=manifest)
- [Views](https://teslasolar.github.io/gitway/?api=views)
- [Gateway Status](https://teslasolar.github.io/gitway/?api=gateway)

## Available Endpoints

### `/api/status`
Returns the current API and gateway status.

```json
{
  "status": "online",
  "version": "1.0.0",
  "name": "GitWay API",
  "timestamp": "2024-12-10T23:00:00.000Z",
  "gateway": {
    "connected": false,
    "host": "pred",
    "port": 8088
  }
}
```

### `/api/config`
Returns configuration settings.

```json
{
  "gateway": {
    "host": "pred",
    "port": 8088,
    "protocol": "http"
  },
  "bridge": {
    "url": "http://localhost:3001",
    "websocket": "ws://localhost:3001"
  },
  "github": {
    "owner": "teslasolar",
    "repo": "gitway",
    "pages": "https://teslasolar.github.io/gitway"
  }
}
```

### `/api/components`
Returns available components.

```json
{
  "components": [
    {
      "id": "tag-monitor",
      "name": "Tag Monitor",
      "type": "monitor",
      "version": "1.0.0"
    },
    ...
  ]
}
```

### `/api/collections`
Returns data collection schemas.

```json
{
  "collections": {
    "tags": {
      "name": "Tags",
      "count": 0,
      "schema": {...}
    },
    ...
  }
}
```

### `/api/views`
Returns the complete UI configuration with views, sidebar, and theme.

### `/api/gateway`
Returns real-time gateway connection status.

### `/api/data/{collection}`
Returns data for a specific collection (tags, alarms, history, config).

## Advanced Usage

### Create a GitWay API Client

```javascript
class GitWayAPIClient {
    constructor(baseUrl = 'https://teslasolar.github.io/gitway') {
        this.baseUrl = baseUrl;
    }

    async fetch(endpoint) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `${this.baseUrl}/?api=${endpoint}`;

        return new Promise((resolve, reject) => {
            iframe.onload = () => {
                try {
                    const content = iframe.contentWindow.document.querySelector('pre').textContent;
                    const data = JSON.parse(content);
                    document.body.removeChild(iframe);
                    resolve(data);
                } catch (error) {
                    document.body.removeChild(iframe);
                    reject(error);
                }
            };

            iframe.onerror = () => {
                document.body.removeChild(iframe);
                reject(new Error('Failed to load API'));
            };

            document.body.appendChild(iframe);
        });
    }

    async getStatus() {
        return this.fetch('status');
    }

    async getConfig() {
        return this.fetch('config');
    }

    async getComponents() {
        return this.fetch('components');
    }

    async getCollections() {
        return this.fetch('collections');
    }

    async getViews() {
        return this.fetch('views');
    }

    async getGatewayStatus() {
        return this.fetch('gateway');
    }

    async getCollectionData(collection) {
        return this.fetch(`data/${collection}`);
    }
}

// Usage
const api = new GitWayAPIClient();
api.getStatus().then(status => {
    console.log('API Status:', status);
});
```

### Bookmarklet

Create a bookmarklet to quickly access GitWay API from any page:

```javascript
javascript:(function(){
    window.open('https://teslasolar.github.io/gitway/?api=status', 'GitWayAPI', 'width=600,height=400');
})();
```

### Chrome Extension

Access GitWay API from a Chrome extension:

```javascript
// manifest.json
{
  "permissions": ["https://teslasolar.github.io/*"],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["gitway-api.js"]
  }]
}

// gitway-api.js
chrome.runtime.sendMessage({
    action: 'fetchGitWayAPI',
    endpoint: 'status'
}, response => {
    console.log('GitWay Status:', response);
});
```

## Testing the API

### Browser Console Test

Open browser console and run:

```javascript
// Quick test
window.open('https://teslasolar.github.io/gitway/?api=status', '_blank');

// Or fetch and parse
fetch('https://teslasolar.github.io/gitway/?api=manifest')
    .then(r => r.text())
    .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const pre = doc.querySelector('pre');
        if (pre) {
            const data = JSON.parse(pre.textContent);
            console.log('Manifest:', data);
        }
    });
```

### cURL (Limited)

Note: cURL will receive HTML with embedded JSON, not pure JSON:

```bash
curl "https://teslasolar.github.io/gitway/?api=status"
# Parse the pre element content for JSON
```

### Python

```python
import requests
from bs4 import BeautifulSoup
import json

def get_gitway_api(endpoint):
    url = f"https://teslasolar.github.io/gitway/?api={endpoint}"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    pre = soup.find('pre')
    if pre:
        return json.loads(pre.text)
    return None

# Usage
status = get_gitway_api('status')
print(status)
```

## Benefits

1. **Single Entry Point**: Everything goes through index.html
2. **No Additional Files**: API is embedded in the main application
3. **Always Available**: If the UI works, the API works
4. **Self-Documenting**: Access `/api/manifest` for API documentation
5. **Real-Time Data**: When bridge server is connected
6. **Static Fallback**: Returns configuration even when offline

## Limitations

1. **HTML Wrapper**: Responses are HTML documents with JSON in pre tags
2. **CORS**: Limited CORS control with GitHub Pages
3. **Methods**: Only GET requests supported
4. **Authentication**: No authentication mechanism

## Workarounds

For pure JSON responses, consider:
1. Using the static JSON files in `/api/v1/` directory
2. Setting up a proxy server
3. Using the bridge server for dynamic data

## Live Examples

Try these links directly:
- [API Status](https://teslasolar.github.io/gitway/?api=status)
- [Configuration](https://teslasolar.github.io/gitway/?api=config)
- [Components List](https://teslasolar.github.io/gitway/?api=components)
- [API Manifest](https://teslasolar.github.io/gitway/?api=manifest)