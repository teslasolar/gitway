/**
 * GitWay Tag Monitor Component
 * Works in both Perspective and standalone web environments
 */

class GitWayTagMonitor {
    constructor(props) {
        this.props = props;
        this.isIgnition = this.detectEnvironment();
        this.subscriptions = new Map();
        this.ws = null;
        this.initialize();
    }

    detectEnvironment() {
        // Check if running in Ignition Perspective
        return typeof window.Perspective !== 'undefined' ||
               typeof system !== 'undefined';
    }

    initialize() {
        if (this.isIgnition) {
            this.initializeIgnition();
        } else {
            this.initializeWeb();
        }
    }

    initializeIgnition() {
        // Ignition Perspective environment
        this.element = this.props.element;
        this.session = this.props.session;

        // Create UI
        this.render();

        // Subscribe to tags using Perspective API
        if (this.props.tagPaths) {
            this.props.tagPaths.forEach(path => {
                this.subscribeToTag(path);
            });
        }
    }

    initializeWeb() {
        // Standalone web environment (GitHub Pages)
        this.element = document.getElementById(this.props.elementId);

        // Connect to bridge server
        this.connectWebSocket();

        // Create UI
        this.render();

        // Subscribe to tags via WebSocket
        if (this.props.tagPaths) {
            this.props.tagPaths.forEach(path => {
                this.subscribeViaWebSocket(path);
            });
        }
    }

    render() {
        const html = `
            <div class="gitway-tag-monitor">
                <div class="header">
                    <h3>${this.props.title || 'Tag Monitor'}</h3>
                    <span class="status ${this.isIgnition ? 'ignition' : 'web'}">
                        ${this.isIgnition ? 'Ignition' : 'Web'} Mode
                    </span>
                </div>
                <div class="tag-list" id="tag-list-${this.props.id}"></div>
                <div class="controls">
                    <input type="text" id="tag-input-${this.props.id}"
                           placeholder="Enter tag path">
                    <button onclick="gitway.addTag('${this.props.id}')">Add Tag</button>
                </div>
            </div>
        `;

        if (this.element) {
            this.element.innerHTML = html;
        }

        this.applyStyles();
    }

    applyStyles() {
        if (!document.getElementById('gitway-styles')) {
            const style = document.createElement('style');
            style.id = 'gitway-styles';
            style.textContent = `
                .gitway-tag-monitor {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }
                .gitway-tag-monitor .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .gitway-tag-monitor h3 {
                    margin: 0;
                    color: #333;
                }
                .gitway-tag-monitor .status {
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .gitway-tag-monitor .status.ignition {
                    background: #667eea;
                    color: white;
                }
                .gitway-tag-monitor .status.web {
                    background: #10b981;
                    color: white;
                }
                .gitway-tag-monitor .tag-list {
                    margin: 15px 0;
                }
                .gitway-tag-monitor .tag-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    background: #f3f4f6;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .gitway-tag-monitor .tag-path {
                    font-weight: bold;
                    color: #333;
                    font-size: 14px;
                }
                .gitway-tag-monitor .tag-value {
                    color: #667eea;
                    font-weight: bold;
                    font-size: 18px;
                }
                .gitway-tag-monitor .tag-quality {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    background: #10b981;
                    color: white;
                }
                .gitway-tag-monitor .controls {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                }
                .gitway-tag-monitor input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                }
                .gitway-tag-monitor button {
                    padding: 10px 20px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }
    }

    subscribeToTag(tagPath) {
        if (this.isIgnition) {
            // Use Perspective tag subscription
            try {
                const subscription = system.tag.subscribe(tagPath, (tagPath, value, quality) => {
                    this.updateTagDisplay(tagPath, value, quality);
                });
                this.subscriptions.set(tagPath, subscription);
            } catch (error) {
                console.error('Failed to subscribe to tag:', error);
            }
        } else {
            // Use WebSocket subscription
            this.subscribeViaWebSocket(tagPath);
        }
    }

    subscribeViaWebSocket(tagPath) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                payload: {
                    tagPath: tagPath,
                    interval: this.props.updateInterval || 1000
                }
            }));
            this.subscriptions.set(tagPath, { type: 'websocket' });
        }
    }

    connectWebSocket() {
        const wsUrl = this.props.websocketUrl || 'ws://localhost:3001';

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to GitWay bridge');
            this.updateConnectionStatus(true);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'update') {
                this.updateTagDisplay(data.tagPath, data.data.value, data.data.quality);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from GitWay bridge');
            this.updateConnectionStatus(false);
            // Attempt reconnection
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    updateTagDisplay(tagPath, value, quality) {
        const listElement = document.getElementById(`tag-list-${this.props.id}`);
        if (!listElement) return;

        let tagElement = document.getElementById(`tag-${this.props.id}-${tagPath.replace(/[^\w]/g, '_')}`);

        if (!tagElement) {
            // Create new tag display
            tagElement = document.createElement('div');
            tagElement.id = `tag-${this.props.id}-${tagPath.replace(/[^\w]/g, '_')}`;
            tagElement.className = 'tag-item';
            listElement.appendChild(tagElement);
        }

        // Update tag display
        tagElement.innerHTML = `
            <span class="tag-path">${tagPath}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="tag-value">${value}</span>
                <span class="tag-quality">${quality || 'Good'}</span>
            </div>
        `;
    }

    updateConnectionStatus(connected) {
        const statusElement = this.element?.querySelector('.status');
        if (statusElement) {
            statusElement.textContent = connected ?
                `${this.isIgnition ? 'Ignition' : 'Web'} Mode - Connected` :
                `${this.isIgnition ? 'Ignition' : 'Web'} Mode - Disconnected`;
            statusElement.style.background = connected ? '#10b981' : '#ef4444';
        }
    }

    addTag(tagPath) {
        if (!tagPath) {
            const input = document.getElementById(`tag-input-${this.props.id}`);
            tagPath = input?.value;
            if (input) input.value = '';
        }

        if (tagPath && !this.subscriptions.has(tagPath)) {
            this.subscribeToTag(tagPath);
        }
    }

    dispose() {
        // Clean up subscriptions
        if (this.isIgnition) {
            this.subscriptions.forEach((subscription, tagPath) => {
                try {
                    system.tag.unsubscribe(subscription);
                } catch (error) {
                    console.error('Failed to unsubscribe:', error);
                }
            });
        } else if (this.ws) {
            this.subscriptions.forEach((_, tagPath) => {
                this.ws.send(JSON.stringify({
                    type: 'unsubscribe',
                    payload: { tagPath }
                }));
            });
            this.ws.close();
        }

        this.subscriptions.clear();
    }
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitWayTagMonitor;
} else if (typeof Perspective !== 'undefined') {
    // Register as Perspective component
    Perspective.registerComponent('GitWayTagMonitor', GitWayTagMonitor);
} else {
    // Register globally for web use
    window.GitWayTagMonitor = GitWayTagMonitor;
    window.gitway = window.gitway || {};
    window.gitway.TagMonitor = GitWayTagMonitor;
}