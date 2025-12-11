/**
 * Dynamic Component Builder for Ignition Gateway
 * Builds UI components based on discovered gateway capabilities
 */

const fs = require('fs');
const path = require('path');

class DynamicComponentBuilder {
    constructor() {
        this.config = this.loadConfiguration();
        this.components = [];
    }

    loadConfiguration() {
        const configPath = path.join(__dirname, 'gateway-components.json');

        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        // Default configuration if discovery hasn't run
        return {
            features: {},
            components: {},
            apiEndpoints: {}
        };
    }

    buildComponents() {
        console.log('🏗️  Building dynamic components...\n');

        // Build components based on available features
        if (this.config.features.tags) {
            this.buildTagComponents();
        }

        if (this.config.features.alarms) {
            this.buildAlarmComponents();
        }

        if (this.config.features.database) {
            this.buildDatabaseComponents();
        }

        if (this.config.features.history) {
            this.buildHistoryComponents();
        }

        if (this.config.features.perspective) {
            this.buildPerspectiveComponents();
        }

        // Add gateway status component (always available)
        this.buildStatusComponent();

        return this.components;
    }

    buildTagComponents() {
        console.log('  📊 Building tag components...');

        const tagProviders = this.config.components.tagProviders || [];

        this.components.push({
            id: 'tag-reader',
            type: 'tag-operation',
            name: 'Tag Reader',
            icon: '📖',
            config: {
                providers: tagProviders,
                operations: ['read', 'subscribe'],
                endpoint: this.config.tagConfig?.operations?.read
            },
            ui: {
                type: 'card',
                inputs: [
                    {
                        name: 'tagPath',
                        type: 'text',
                        label: 'Tag Path',
                        placeholder: '[default]Path/To/Tag'
                    },
                    {
                        name: 'provider',
                        type: 'select',
                        label: 'Provider',
                        options: tagProviders.map(p => ({ value: p.name, label: p.name }))
                    }
                ],
                buttons: [
                    {
                        name: 'read',
                        label: 'Read Tag',
                        action: 'readTag'
                    },
                    {
                        name: 'subscribe',
                        label: 'Subscribe',
                        action: 'subscribeTag'
                    }
                ],
                display: {
                    type: 'value',
                    fields: ['value', 'quality', 'timestamp']
                }
            }
        });

        this.components.push({
            id: 'tag-writer',
            type: 'tag-operation',
            name: 'Tag Writer',
            icon: '✏️',
            config: {
                providers: tagProviders,
                operations: ['write'],
                endpoint: this.config.tagConfig?.operations?.write
            },
            ui: {
                type: 'card',
                inputs: [
                    {
                        name: 'tagPath',
                        type: 'text',
                        label: 'Tag Path',
                        placeholder: '[default]Path/To/Tag'
                    },
                    {
                        name: 'value',
                        type: 'text',
                        label: 'Value',
                        placeholder: 'Enter value'
                    }
                ],
                buttons: [
                    {
                        name: 'write',
                        label: 'Write Tag',
                        action: 'writeTag'
                    }
                ]
            }
        });

        if (this.config.tagConfig?.operations?.browse) {
            this.components.push({
                id: 'tag-browser',
                type: 'tag-operation',
                name: 'Tag Browser',
                icon: '🔍',
                config: {
                    providers: tagProviders,
                    operations: ['browse'],
                    endpoint: this.config.tagConfig.operations.browse
                },
                ui: {
                    type: 'tree',
                    inputs: [
                        {
                            name: 'path',
                            type: 'text',
                            label: 'Folder Path',
                            placeholder: '[default]Folder'
                        }
                    ],
                    display: {
                        type: 'tree',
                        expandable: true
                    }
                }
            });
        }
    }

    buildAlarmComponents() {
        console.log('  🚨 Building alarm components...');

        const alarmJournals = this.config.components.alarmJournals || [];

        this.components.push({
            id: 'alarm-viewer',
            type: 'alarm-operation',
            name: 'Active Alarms',
            icon: '🚨',
            config: {
                journals: alarmJournals,
                operations: ['query', 'acknowledge'],
                endpoint: this.config.alarmConfig?.operations?.query
            },
            ui: {
                type: 'table',
                inputs: [
                    {
                        name: 'journal',
                        type: 'select',
                        label: 'Alarm Journal',
                        options: alarmJournals.map(j => ({ value: j.name, label: j.name }))
                    },
                    {
                        name: 'priority',
                        type: 'multiselect',
                        label: 'Priority Filter',
                        options: [
                            { value: 1, label: 'Low' },
                            { value: 2, label: 'Medium' },
                            { value: 3, label: 'High' },
                            { value: 4, label: 'Critical' }
                        ]
                    }
                ],
                display: {
                    type: 'table',
                    columns: ['displayPath', 'priority', 'state', 'activeTime', 'notes'],
                    actions: ['acknowledge', 'shelve']
                },
                autoRefresh: 5000
            }
        });
    }

    buildDatabaseComponents() {
        console.log('  💾 Building database components...');

        const databases = this.config.components.databases || [];

        if (this.config.databaseConfig?.operations?.query) {
            this.components.push({
                id: 'database-query',
                type: 'database-operation',
                name: 'Database Query',
                icon: '🔍',
                config: {
                    connections: databases,
                    operations: ['query'],
                    endpoint: this.config.databaseConfig.operations.query
                },
                ui: {
                    type: 'card',
                    inputs: [
                        {
                            name: 'connection',
                            type: 'select',
                            label: 'Database',
                            options: databases.map(d => ({ value: d.name, label: d.name }))
                        },
                        {
                            name: 'query',
                            type: 'textarea',
                            label: 'SQL Query',
                            placeholder: 'SELECT * FROM table_name'
                        }
                    ],
                    buttons: [
                        {
                            name: 'execute',
                            label: 'Execute Query',
                            action: 'executeQuery'
                        }
                    ],
                    display: {
                        type: 'table',
                        paginated: true
                    }
                }
            });
        }

        if (this.config.databaseConfig?.operations?.namedQuery) {
            this.components.push({
                id: 'named-query',
                type: 'database-operation',
                name: 'Named Queries',
                icon: '📋',
                config: {
                    operations: ['namedQuery'],
                    endpoint: this.config.databaseConfig.operations.namedQuery
                },
                ui: {
                    type: 'card',
                    inputs: [
                        {
                            name: 'queryPath',
                            type: 'text',
                            label: 'Query Path',
                            placeholder: 'folder/queryName'
                        },
                        {
                            name: 'parameters',
                            type: 'json',
                            label: 'Parameters',
                            placeholder: '{"param1": "value1"}'
                        }
                    ],
                    buttons: [
                        {
                            name: 'execute',
                            label: 'Execute',
                            action: 'executeNamedQuery'
                        }
                    ]
                }
            });
        }
    }

    buildHistoryComponents() {
        console.log('  📈 Building history components...');

        this.components.push({
            id: 'history-viewer',
            type: 'history-operation',
            name: 'Tag History',
            icon: '📈',
            config: {
                operations: ['query'],
                endpoint: this.config.apiEndpoints['history-data']
            },
            ui: {
                type: 'chart',
                inputs: [
                    {
                        name: 'tagPaths',
                        type: 'text',
                        label: 'Tag Paths (comma separated)',
                        placeholder: '[default]Tag1, [default]Tag2'
                    },
                    {
                        name: 'startDate',
                        type: 'datetime',
                        label: 'Start Date'
                    },
                    {
                        name: 'endDate',
                        type: 'datetime',
                        label: 'End Date'
                    },
                    {
                        name: 'aggregation',
                        type: 'select',
                        label: 'Aggregation',
                        options: [
                            { value: 'raw', label: 'Raw' },
                            { value: 'average', label: 'Average' },
                            { value: 'min', label: 'Minimum' },
                            { value: 'max', label: 'Maximum' }
                        ]
                    }
                ],
                display: {
                    type: 'chart',
                    chartType: 'line'
                }
            }
        });
    }

    buildPerspectiveComponents() {
        console.log('  📱 Building Perspective components...');

        this.components.push({
            id: 'perspective-sessions',
            type: 'perspective-operation',
            name: 'Perspective Sessions',
            icon: '📱',
            config: {
                operations: ['list', 'message'],
                endpoint: '/system/perspective/sessions'
            },
            ui: {
                type: 'table',
                display: {
                    type: 'table',
                    columns: ['id', 'user', 'project', 'startTime', 'lastActivity'],
                    actions: ['sendMessage', 'disconnect']
                },
                autoRefresh: 10000
            }
        });
    }

    buildStatusComponent() {
        console.log('  💚 Building status component...');

        this.components.push({
            id: 'gateway-status',
            type: 'system',
            name: 'Gateway Status',
            icon: '💚',
            config: {
                endpoint: '/StatusPing',
                alwaysAvailable: true
            },
            ui: {
                type: 'status',
                display: {
                    type: 'badge',
                    fields: ['state', 'uptime', 'version']
                },
                autoRefresh: 5000
            }
        });
    }

    generateHTML() {
        const components = this.buildComponents();

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ignition Gateway - Dynamic Interface</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }
        .component {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .component h3 {
            margin-bottom: 15px;
            color: #333;
        }
        .input-group {
            margin-bottom: 15px;
        }
        .input-group label {
            display: block;
            margin-bottom: 5px;
            color: #666;
            font-size: 14px;
        }
        .input-group input, .input-group select, .input-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            background: #667eea;
            color: white;
        }
        .btn:hover {
            background: #5a67d8;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .status-running { background: #10b981; color: white; }
        .status-stopped { background: #ef4444; color: white; }
        .feature-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        .feature {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            background: #f3f4f6;
            color: #666;
        }
        .feature.enabled {
            background: #10b981;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Ignition Gateway Interface</h1>
            <p style="color: #666; margin-bottom: 15px;">Dynamically Generated Components</p>
            <div>
                <span class="status-badge status-running">Connected</span>
                <span style="margin-left: 20px; color: #666;">
                    Gateway: ${this.config.gateway?.host || 'unknown'}:${this.config.gateway?.port || '8088'}
                </span>
            </div>
            <div class="feature-list">
                ${Object.entries(this.config.features || {}).map(([feature, enabled]) =>
                    `<span class="feature ${enabled ? 'enabled' : ''}">${feature}: ${enabled ? '✓' : '✗'}</span>`
                ).join('')}
            </div>
        </div>

        <div class="component-grid">
            ${components.map(comp => this.renderComponent(comp)).join('')}
        </div>
    </div>

    <script>
        const config = ${JSON.stringify(this.config, null, 2)};
        const components = ${JSON.stringify(components, null, 2)};
        const bridgeUrl = 'http://localhost:3001';

        // Component handlers
        async function executeAction(componentId, action, data) {
            const component = components.find(c => c.id === componentId);
            if (!component) return;

            const endpoint = component.config.endpoint || '/api/generic';

            try {
                const response = await fetch(bridgeUrl + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, data })
                });

                const result = await response.json();
                displayResult(componentId, result);
            } catch (error) {
                console.error('Action failed:', error);
            }
        }

        function displayResult(componentId, result) {
            const display = document.getElementById(componentId + '-display');
            if (display) {
                display.innerHTML = '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            }
        }

        // Auto-refresh components
        components.forEach(comp => {
            if (comp.ui?.autoRefresh) {
                setInterval(() => {
                    executeAction(comp.id, 'refresh', {});
                }, comp.ui.autoRefresh);
            }
        });
    </script>
</body>
</html>`;

        return html;
    }

    renderComponent(component) {
        const inputs = (component.ui?.inputs || []).map(input => `
            <div class="input-group">
                <label>${input.label}</label>
                ${this.renderInput(input, component.id)}
            </div>
        `).join('');

        const buttons = (component.ui?.buttons || []).map(button => `
            <button class="btn" onclick="executeAction('${component.id}', '${button.action}',
                ${this.gatherInputsCode(component.id)})">
                ${button.label}
            </button>
        `).join(' ');

        return `
            <div class="component">
                <h3>${component.icon} ${component.name}</h3>
                ${inputs}
                ${buttons}
                <div id="${component.id}-display" style="margin-top: 15px;"></div>
            </div>
        `;
    }

    renderInput(input, componentId) {
        switch (input.type) {
            case 'select':
                return `<select id="${componentId}-${input.name}">
                    ${(input.options || []).map(opt =>
                        `<option value="${opt.value}">${opt.label}</option>`
                    ).join('')}
                </select>`;

            case 'textarea':
                return `<textarea id="${componentId}-${input.name}" rows="4"
                    placeholder="${input.placeholder || ''}"></textarea>`;

            default:
                return `<input type="${input.type}" id="${componentId}-${input.name}"
                    placeholder="${input.placeholder || ''}">`;
        }
    }

    gatherInputsCode(componentId) {
        return `{
            ${this.components.find(c => c.id === componentId)?.ui?.inputs?.map(input =>
                `${input.name}: document.getElementById('${componentId}-${input.name}').value`
            ).join(', ') || ''}
        }`;
    }

    saveHTML(filename = 'ignition-dynamic.html') {
        const html = this.generateHTML();
        const filepath = path.join(__dirname, filename);
        fs.writeFileSync(filepath, html);
        console.log(`\n✅ Dynamic interface saved to ${filename}`);
        return filepath;
    }
}

// Run if called directly
if (require.main === module) {
    const builder = new DynamicComponentBuilder();
    const components = builder.buildComponents();

    console.log(`\n📦 Generated ${components.length} components`);
    components.forEach(comp => {
        console.log(`  - ${comp.icon} ${comp.name} (${comp.type})`);
    });

    builder.saveHTML();
}

module.exports = DynamicComponentBuilder;