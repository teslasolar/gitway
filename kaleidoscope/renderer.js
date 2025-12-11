/**
 * Kaleidoscope Renderer
 * Renders project views from JSON definitions
 */

class KaleidoscopeRenderer {
    constructor() {
        this.projectPath = 'kaleidoscope/projects';
        this.templatesPath = 'kaleidoscope/templates';
        this.currentView = null;
        this.viewCache = new Map();
        this.systemMonitor = null;
        this.bindings = new Map();
        this.updateInterval = null;
    }

    async initialize() {
        // Load project configuration
        await this.loadProject();

        // Initialize system monitor
        if (typeof SystemMonitor !== 'undefined') {
            this.systemMonitor = new SystemMonitor();
            await this.systemMonitor.start();

            // Listen for system metrics updates
            window.addEventListener('systemMetricsUpdate', (event) => {
                this.updateSystemBindings(event.detail);
            });
        }

        // Get view from URL or default
        const params = new URLSearchParams(window.location.search);
        const viewName = params.get('view') || 'Dashboard';

        // Load and render the view
        await this.loadView(viewName);

        return true;
    }

    async loadProject() {
        try {
            const response = await fetch(`${this.projectPath}/project.json`);
            this.project = await response.json();
            console.log('Loaded Kaleidoscope project:', this.project.name);
        } catch (error) {
            console.error('Failed to load project:', error);
            this.project = { name: 'Default', views: {} };
        }
    }

    async loadView(viewName) {
        // Try to load from cache first
        if (this.viewCache.has(viewName)) {
            this.renderView(this.viewCache.get(viewName));
            return;
        }

        try {
            // Load view definition
            const response = await fetch(`${this.projectPath}/views/${viewName}/view.json`);
            const viewData = await response.json();

            // Cache the view
            this.viewCache.set(viewName, viewData);

            // Render the view
            this.renderView(viewData);
        } catch (error) {
            console.error(`Failed to load view ${viewName}:`, error);

            // Try to load default dashboard
            if (viewName !== 'Dashboard') {
                await this.loadView('Dashboard');
            } else {
                this.renderErrorView('View not found: ' + viewName);
            }
        }
    }

    renderView(viewData) {
        this.currentView = viewData;
        const app = document.getElementById('app') || document.body;

        // Clear existing content
        app.innerHTML = '';

        // Create view container
        const container = document.createElement('div');
        container.className = 'kaleidoscope-view';
        container.style.cssText = `
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        `;

        // Render header
        const header = this.renderHeader(viewData);
        container.appendChild(header);

        // Render main content
        const content = this.renderComponent(viewData);
        content.style.flex = '1';
        container.appendChild(content);

        app.appendChild(container);

        // Start data updates
        this.startDataUpdates();
    }

    renderHeader(viewData) {
        const header = document.createElement('div');
        header.className = 'kaleidoscope-header';
        header.style.cssText = `
            background: white;
            padding: 15px 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // Logo and title
        const titleSection = document.createElement('div');
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 20px;';

        const logo = document.createElement('div');
        logo.innerHTML = '🎨 Kaleidoscope';
        logo.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        `;
        titleSection.appendChild(logo);

        const viewTitle = document.createElement('div');
        viewTitle.innerHTML = viewData.title || viewData.name;
        viewTitle.style.cssText = 'font-size: 18px; color: #333;';
        titleSection.appendChild(viewTitle);

        header.appendChild(titleSection);

        // View selector
        const viewSelector = this.createViewSelector();
        header.appendChild(viewSelector);

        return header;
    }

    createViewSelector() {
        const selector = document.createElement('div');
        selector.style.cssText = 'display: flex; gap: 10px; align-items: center;';

        const label = document.createElement('span');
        label.textContent = 'View:';
        label.style.cssText = 'font-size: 14px; color: #666;';
        selector.appendChild(label);

        const select = document.createElement('select');
        select.style.cssText = `
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
        `;

        // Add available views
        const views = ['Dashboard', 'Production', 'Maintenance', 'Alarms', 'Reports', 'Energy', 'Gateway', 'Tags', 'GitDB', 'Integration'];
        views.forEach(view => {
            const option = document.createElement('option');
            option.value = view;
            option.textContent = view;
            if (view === (this.currentView?.name || 'Dashboard')) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            const newView = e.target.value;
            window.location.search = `?view=${newView}`;
        });

        selector.appendChild(select);
        return selector;
    }

    renderComponent(component) {
        if (!component) return document.createElement('div');

        const element = document.createElement('div');

        // Apply component styles
        if (component.props?.style) {
            Object.assign(element.style, component.props.style);
        }

        // Handle different component types
        switch (component.type) {
            case 'flex':
                return this.renderFlex(component);
            case 'grid':
                return this.renderGrid(component);
            case 'card':
                return this.renderCard(component);
            case 'metric-card':
                return this.renderMetricCard(component);
            case 'label':
                return this.renderLabel(component);
            case 'button':
                return this.renderButton(component);
            case 'tabs':
                return this.renderTabs(component);
            default:
                // Render children if any
                if (component.children) {
                    component.children.forEach(child => {
                        element.appendChild(this.renderComponent(child));
                    });
                }
                return element;
        }
    }

    renderFlex(component) {
        const flex = document.createElement('div');
        flex.style.cssText = `
            display: flex;
            ${component.props?.direction ? `flex-direction: ${component.props.direction};` : ''}
            ${component.props?.gap ? `gap: ${component.props.gap};` : ''}
            ${component.props?.wrap ? 'flex-wrap: wrap;' : ''}
        `;

        if (component.props?.style) {
            Object.assign(flex.style, component.props.style);
        }

        if (component.children) {
            component.children.forEach(child => {
                flex.appendChild(this.renderComponent(child));
            });
        }

        return flex;
    }

    renderGrid(component) {
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
        `;

        if (component.props?.style) {
            Object.assign(grid.style, component.props.style);
        }

        if (component.children) {
            component.children.forEach(child => {
                grid.appendChild(this.renderComponent(child));
            });
        }

        return grid;
    }

    renderCard(component) {
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        `;

        if (component.props?.style) {
            Object.assign(card.style, component.props.style);
        }

        if (component.props?.title) {
            const title = document.createElement('h3');
            title.style.cssText = 'margin: 0 0 15px 0; color: #333; font-size: 16px;';
            title.innerHTML = `${component.props.icon || ''} ${component.props.title}`;
            card.appendChild(title);
        }

        if (component.children) {
            component.children.forEach(child => {
                card.appendChild(this.renderComponent(child));
            });
        }

        return card;
    }

    renderMetricCard(component) {
        const card = document.createElement('div');
        card.id = component.id;
        card.className = 'metric-card';
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            transition: transform 0.3s ease;
        `;

        card.onmouseover = () => card.style.transform = 'translateY(-2px)';
        card.onmouseout = () => card.style.transform = 'translateY(0)';

        // Title
        const title = document.createElement('div');
        title.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 10px;';
        title.innerHTML = `
            <span style="font-size: 20px;">${component.props?.icon || '📊'}</span>
            <span style="font-size: 14px; color: #666; font-weight: bold;">${component.props?.title || 'Metric'}</span>
        `;
        card.appendChild(title);

        // Value
        const value = document.createElement('div');
        value.className = 'metric-value';
        value.style.cssText = 'font-size: 32px; font-weight: bold; color: #667eea; margin: 10px 0;';
        value.textContent = '--';
        card.appendChild(value);

        // Subtitle
        if (component.props?.subtitle) {
            const subtitle = document.createElement('div');
            subtitle.className = 'metric-subtitle';
            subtitle.style.cssText = 'font-size: 12px; color: #999;';
            subtitle.textContent = '--';
            card.appendChild(subtitle);
        }

        // Sparkline container
        if (component.props?.sparkline) {
            const sparkline = document.createElement('canvas');
            sparkline.className = 'metric-sparkline';
            sparkline.width = 200;
            sparkline.height = 40;
            sparkline.style.cssText = 'width: 100%; height: 40px; margin-top: 10px;';
            card.appendChild(sparkline);
        }

        // Register binding
        if (component.props?.dataSource) {
            this.bindings.set(component.id, {
                element: card,
                dataSource: component.props.dataSource,
                format: component.props.format,
                subtitle: component.props.subtitle
            });
        }

        return card;
    }

    renderLabel(component) {
        const label = document.createElement('div');
        label.textContent = component.props?.text || '';
        if (component.props?.style) {
            Object.assign(label.style, component.props.style);
        }
        return label;
    }

    renderButton(component) {
        const button = document.createElement('button');
        button.textContent = component.props?.text || 'Button';
        button.style.cssText = `
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.3s ease;
        `;

        button.onmouseover = () => button.style.background = '#5568d3';
        button.onmouseout = () => button.style.background = '#667eea';

        if (component.props?.onClick) {
            button.onclick = () => this.handleAction(component.props.onClick);
        }

        return button;
    }

    renderTabs(component) {
        const container = document.createElement('div');
        // Implementation for tabs component
        return container;
    }

    startDataUpdates() {
        // Update every second
        this.updateInterval = setInterval(() => {
            this.updateBindings();
        }, 1000);

        // Initial update
        this.updateBindings();
    }

    updateBindings() {
        if (!this.systemMonitor) return;

        const metrics = this.systemMonitor.metrics;
        this.updateSystemBindings(metrics);
    }

    updateSystemBindings(metrics) {
        this.bindings.forEach((binding, id) => {
            const value = this.getNestedValue(metrics, binding.dataSource.replace('system.', ''));
            const element = binding.element;
            const valueEl = element.querySelector('.metric-value');
            const subtitleEl = element.querySelector('.metric-subtitle');

            if (valueEl && value !== undefined) {
                valueEl.textContent = this.formatValue(value, binding.format);
            }

            if (subtitleEl && binding.subtitle) {
                const subtitleValue = this.getNestedValue(metrics, binding.subtitle.replace('system.', ''));
                if (subtitleValue !== undefined) {
                    subtitleEl.textContent = this.formatValue(subtitleValue, 'auto');
                }
            }

            // Update sparkline if present
            if (binding.element.querySelector('.metric-sparkline')) {
                this.updateSparkline(binding.element.querySelector('.metric-sparkline'), id);
            }
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    formatValue(value, format) {
        switch (format) {
            case 'percent':
                return `${Math.round(value)}%`;
            case 'bandwidth':
                return this.systemMonitor?.formatBandwidth(value) || value;
            case 'temperature':
                return `${value}°C`;
            case 'status':
                return value ? '🟢 Connected' : '🔴 Disconnected';
            case 'number':
                return Math.round(value).toString();
            case 'text':
                return value.toString();
            default:
                return value?.toString() || '--';
        }
    }

    updateSparkline(canvas, metricId) {
        const ctx = canvas.getContext('2d');
        const history = this.systemMonitor?.history;

        if (!history) return;

        let data = [];
        if (metricId === 'cpu-usage') {
            data = history.cpu.map(d => d.value);
        } else if (metricId === 'fps-monitor') {
            data = history.fps.map(d => d.value);
        }

        if (data.length === 0) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw sparkline
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const max = Math.max(...data, 100);
        const min = Math.min(...data, 0);
        const range = max - min || 1;

        data.forEach((value, index) => {
            const x = (index / (data.length - 1)) * canvas.width;
            const y = canvas.height - ((value - min) / range) * canvas.height;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    handleAction(action) {
        console.log('Action:', action);
        // Handle actions based on type
    }

    renderErrorView(message) {
        const app = document.getElementById('app') || document.body;
        app.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #667eea, #764ba2);">
                <div style="background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                    <h1 style="color: #333; margin-bottom: 20px;">⚠️ Error</h1>
                    <p style="color: #666;">${message}</p>
                    <button onclick="location.href='?view=Dashboard'" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.systemMonitor) {
            this.systemMonitor.stop();
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KaleidoscopeRenderer;
}