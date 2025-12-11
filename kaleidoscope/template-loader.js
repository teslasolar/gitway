/**
 * Template Loader for Kaleidoscope
 * Loads templates from both root and ignition subdirectories
 */
class TemplateLoader {
    constructor() {
        this.templateCache = new Map();
        this.templatePaths = [
            '/kaleidoscope/templates/',
            '/kaleidoscope/templates/ignition/containers/',
            '/kaleidoscope/templates/ignition/charts/',
            '/kaleidoscope/templates/ignition/inputs/',
            '/kaleidoscope/templates/ignition/displays/',
            '/kaleidoscope/templates/ignition/docks/',
            '/kaleidoscope/templates/ignition/industrial/'
        ];
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        console.log('Initializing Template Loader...');
        await this.loadTemplateIndex();
        this.initialized = true;
    }

    async loadTemplateIndex() {
        // Load template index - attempt to discover all available templates
        const templates = [];

        // Custom templates in root
        const customTemplates = [
            'gitdb-manager',
            'repo-control'
        ];

        // Ignition templates by category
        const ignitionTemplates = {
            containers: [
                'accordion', 'breakpoint-container', 'carousel', 'coordinate-container',
                'embedded-view', 'flex-repeater', 'iframe', 'split-container', 'tab-container'
            ],
            charts: [
                'pie-chart', 'power-chart', 'range-selector', 'sparkline',
                'time-series-chart', 'xy-chart', 'moving-analog'
            ],
            inputs: [
                'button', 'dropdown', 'numeric-input', 'slider', 'toggle-switch'
            ],
            displays: [
                'alarm-display', 'alarm-journal-table', 'alarm-status-table', 'gauge',
                'icon', 'image', 'indicator', 'label', 'led-display', 'level-indicator',
                'linear-scale', 'map', 'markdown', 'pdf-viewer', 'progress-bar',
                'report-viewer', 'symbol', 'table', 'thermometer', 'video-player'
            ],
            docks: [
                'dock-layout', 'header-dock', 'navigation-dock', 'properties-dock', 'status-dock'
            ],
            industrial: [
                'cylindrical-tank', 'equipment-schedule', 'motor-control', 'pump',
                'tank-monitor', 'valve'
            ]
        };

        // Register custom templates
        customTemplates.forEach(template => {
            this.templateCache.set(template, {
                id: template,
                path: `/kaleidoscope/templates/${template}.json`,
                category: 'custom'
            });
        });

        // Register Ignition templates
        Object.entries(ignitionTemplates).forEach(([category, templates]) => {
            templates.forEach(template => {
                this.templateCache.set(template, {
                    id: template,
                    path: `/kaleidoscope/templates/ignition/${category}/${template}.json`,
                    category: category
                });
            });
        });

        console.log(`Loaded ${this.templateCache.size} template references`);
    }

    async loadTemplate(templateId) {
        // Check cache first
        const cachedInfo = this.templateCache.get(templateId);
        if (!cachedInfo) {
            console.error(`Template not found: ${templateId}`);
            return null;
        }

        try {
            // Fetch the template from the correct path
            const response = await fetch(cachedInfo.path);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }

            const template = await response.json();

            // Cache the full template data
            cachedInfo.data = template;

            return template;
        } catch (error) {
            console.error(`Error loading template ${templateId}:`, error);

            // Try alternate paths if primary fails
            for (const basePath of this.templatePaths) {
                try {
                    const altPath = `${basePath}${templateId}.json`;
                    const response = await fetch(altPath);
                    if (response.ok) {
                        const template = await response.json();
                        // Update cache with successful path
                        this.templateCache.set(templateId, {
                            id: templateId,
                            path: altPath,
                            data: template
                        });
                        return template;
                    }
                } catch (altError) {
                    // Continue to next path
                }
            }

            return null;
        }
    }

    async renderTemplate(templateId, parameters = {}) {
        const template = await this.loadTemplate(templateId);
        if (!template) {
            console.error(`Cannot render template: ${templateId}`);
            return null;
        }

        // Apply parameters to template
        const rendered = this.applyParameters(template.view, parameters);
        return rendered;
    }

    applyParameters(view, params) {
        // Deep clone the view
        const rendered = JSON.parse(JSON.stringify(view));

        // Replace parameter placeholders
        const processValue = (value) => {
            if (typeof value === 'string' && value.includes('{{')) {
                // Simple parameter replacement
                return value.replace(/\{\{params\.(\w+)\}\}/g, (match, key) => {
                    return params[key] !== undefined ? params[key] : match;
                });
            }
            return value;
        };

        // Recursively process the view tree
        const processNode = (node) => {
            if (Array.isArray(node)) {
                return node.map(processNode);
            }
            if (typeof node === 'object' && node !== null) {
                const processed = {};
                for (const [key, value] of Object.entries(node)) {
                    if (key === 'children' && Array.isArray(value)) {
                        processed[key] = value.map(processNode);
                    } else if (typeof value === 'object' && value !== null) {
                        processed[key] = processNode(value);
                    } else {
                        processed[key] = processValue(value);
                    }
                }
                return processed;
            }
            return processValue(node);
        };

        return processNode(rendered);
    }

    getTemplatesByCategory(category) {
        const templates = [];
        for (const [id, info] of this.templateCache.entries()) {
            if (info.category === category) {
                templates.push({ id, ...info });
            }
        }
        return templates;
    }

    getAllTemplates() {
        const templates = {};
        for (const [id, info] of this.templateCache.entries()) {
            if (!templates[info.category]) {
                templates[info.category] = [];
            }
            templates[info.category].push({ id, ...info });
        }
        return templates;
    }

    async createTemplateInstance(templateId, parameters = {}, container) {
        const template = await this.loadTemplate(templateId);
        if (!template) {
            console.error(`Failed to create instance of template: ${templateId}`);
            return null;
        }

        // Apply parameters
        const view = this.applyParameters(template.view, parameters);

        // Create DOM element from view
        const element = this.viewToElement(view);

        if (container) {
            container.appendChild(element);
        }

        return element;
    }

    viewToElement(view) {
        if (!view || typeof view !== 'object') {
            return document.createElement('div');
        }

        const element = document.createElement('div');

        // Apply type-specific rendering
        if (view.type) {
            element.className = `kaleidoscope-${view.type}`;
            element.setAttribute('data-component-type', view.type);
        }

        // Apply props
        if (view.props) {
            if (view.props.style) {
                Object.assign(element.style, view.props.style);
            }
            if (view.props.className) {
                element.className += ` ${view.props.className}`;
            }
            if (view.props.text) {
                element.textContent = view.props.text;
            }
        }

        // Render children
        if (view.children && Array.isArray(view.children)) {
            view.children.forEach(child => {
                const childElement = this.viewToElement(child);
                element.appendChild(childElement);
            });
        }

        return element;
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemplateLoader;
} else {
    window.TemplateLoader = TemplateLoader;
}