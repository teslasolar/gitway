/**
 * Kaleidoscope to Perspective Exporter
 * Converts Kaleidoscope projects to Ignition Perspective project format
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

class PerspectiveExporter {
    constructor() {
        this.componentMapping = {
            // Kaleidoscope -> Perspective component mapping
            'container': 'ia.container.flex',
            'flex': 'ia.container.flex',
            'grid': 'ia.container.flex',
            'card': 'ia.container.flex',
            'label': 'ia.display.label',
            'button': 'ia.input.button',
            'gauge': 'ia.display.gauge',
            'numeric-field': 'ia.input.numeric-entry-field',
            'dropdown': 'ia.input.dropdown',
            'table': 'ia.display.table',
            'time-series-chart': 'ia.chart.time-series',
            'bar-chart': 'ia.chart.xy',
            'pie-chart': 'ia.chart.pie',
            'metric-card': 'ia.container.flex', // Custom, will expand
            'toggle': 'ia.input.toggle-switch',
            'slider': 'ia.input.slider',
            'progress-bar': 'ia.display.progress',
            'led': 'ia.display.led',
            'tank': 'ia.display.cylindrical-tank',
            'pump': 'ia.display.symbol',
            'valve': 'ia.display.symbol',
            'motor': 'ia.display.symbol',
            'map': 'ia.display.map',
            'tabs': 'ia.container.tab',
            'accordion': 'ia.container.accordion',
            'coordinate': 'ia.container.coord',
            'split': 'ia.container.split',
            'alarm-table': 'ia.display.alarm-status-table',
            'date-picker': 'ia.input.date-time-picker',
            'header': 'ia.container.flex',
            'equipment-panel': 'ia.container.flex',
            'alarm-banner': 'ia.container.flex',
            'text-field': 'ia.input.text-field',
            'text-area': 'ia.input.text-area',
            'checkbox': 'ia.input.checkbox',
            'radio': 'ia.input.radio-group',
            'icon': 'ia.display.icon',
            'image': 'ia.display.image',
            'pdf-viewer': 'ia.display.pdf-viewer',
            'iframe': 'ia.display.iframe',
            'breakpoint': 'ia.container.breakpoint',
            'carousel': 'ia.container.carousel',
            'column': 'ia.container.column',
            'row': 'ia.container.row'
        };
    }

    /**
     * Export Kaleidoscope project to Perspective format
     */
    async exportProject(projectName = 'GitWay', outputPath = 'gitway-perspective.zip') {
        console.log('🔄 Starting Kaleidoscope to Perspective export...\n');

        // Create temporary directory structure
        const tempDir = path.join(__dirname, 'temp-export');
        this.createProjectStructure(tempDir, projectName);

        // Convert views
        await this.convertViews(tempDir);

        // Create project metadata
        this.createProjectMetadata(tempDir, projectName);

        // Create zip archive
        await this.createZipArchive(tempDir, outputPath);

        // Cleanup temp directory
        this.cleanup(tempDir);

        console.log(`\n✅ Export complete: ${outputPath}`);
        return outputPath;
    }

    /**
     * Create Perspective project directory structure
     */
    createProjectStructure(tempDir, projectName) {
        const dirs = [
            tempDir,
            path.join(tempDir, 'ignition'),
            path.join(tempDir, 'ignition', 'global-props'),
            path.join(tempDir, 'com.inductiveautomation.perspective'),
            path.join(tempDir, 'com.inductiveautomation.perspective', 'views'),
            path.join(tempDir, 'com.inductiveautomation.perspective', 'styles'),
            path.join(tempDir, 'com.inductiveautomation.perspective', 'session-props'),
            path.join(tempDir, 'com.inductiveautomation.perspective', 'page-config')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Convert Kaleidoscope views to Perspective format
     */
    async convertViews(tempDir) {
        const viewsPath = path.join(__dirname, 'projects', 'views');
        const views = fs.readdirSync(viewsPath);

        console.log(`📊 Converting ${views.length} views...`);

        for (const viewName of views) {
            const kaleidoscopeView = JSON.parse(
                fs.readFileSync(path.join(viewsPath, viewName, 'view.json'), 'utf8')
            );

            const perspectiveView = this.convertView(kaleidoscopeView);

            // Create double-nested view directory structure (Perspective requirement)
            // Structure: views/[ViewName]/[ViewName]/view.json
            const viewParentDir = path.join(tempDir, 'com.inductiveautomation.perspective', 'views', viewName);
            const viewDir = path.join(viewParentDir, viewName);
            fs.mkdirSync(viewDir, { recursive: true });

            // Write view.json
            fs.writeFileSync(
                path.join(viewDir, 'view.json'),
                JSON.stringify(perspectiveView, null, 2)
            );

            // Write resource.json at the parent level
            this.writeResourceJson(viewParentDir, viewName, 'view');

            console.log(`   ✅ ${viewName}`);
        }
    }

    /**
     * Convert a Kaleidoscope view to Perspective format
     */
    convertView(kaleidoscopeView) {
        return {
            "custom": {},
            "params": {},
            "props": {
                "defaultSize": {
                    "width": 1920,
                    "height": 1080
                }
            },
            "root": this.convertComponent(kaleidoscopeView.view)
        };
    }

    /**
     * Convert a Kaleidoscope component to Perspective format
     */
    convertComponent(component) {
        if (!component) return null;

        const perspectiveType = this.componentMapping[component.type] || 'ia.container.flex';

        const perspectiveComponent = {
            "type": perspectiveType,
            "meta": {
                "name": component.props?.name || component.type
            },
            "position": {},
            "custom": {},
            "props": this.convertProps(component.type, component.props || {}),
            "children": []
        };

        // Convert children recursively
        if (component.children && Array.isArray(component.children)) {
            perspectiveComponent.children = component.children
                .map(child => this.convertComponent(child))
                .filter(child => child !== null);
        }

        return perspectiveComponent;
    }

    /**
     * Convert Kaleidoscope props to Perspective props
     */
    convertProps(type, props) {
        const perspectiveProps = {};

        switch(type) {
            case 'label':
                perspectiveProps.text = props.text || '';
                if (props.style) {
                    perspectiveProps.style = this.convertStyle(props.style);
                }
                break;

            case 'button':
                perspectiveProps.text = props.text || '';
                perspectiveProps.primary = props.variant === 'primary';
                if (props.icon) {
                    perspectiveProps.icon = {
                        path: props.icon,
                        color: props.style?.color || ''
                    };
                }
                break;

            case 'gauge':
                perspectiveProps.value = props.value || 0;
                perspectiveProps.min = props.min || 0;
                perspectiveProps.max = props.max || 100;
                perspectiveProps.label = props.label || '';
                break;

            case 'table':
                if (props.columns) {
                    perspectiveProps.columns = props.columns.map(col => ({
                        field: col.field,
                        header: col.header || col.field,
                        editable: false,
                        resizable: true,
                        sortable: true
                    }));
                }
                if (props.data) {
                    perspectiveProps.data = props.data;
                }
                break;

            case 'container':
            case 'flex':
                perspectiveProps.direction = props.direction || 'column';
                perspectiveProps.justify = props.justify || 'flex-start';
                perspectiveProps.alignItems = props.align || 'stretch';
                if (props.gap) {
                    perspectiveProps.style = { gap: props.gap };
                }
                break;

            case 'grid':
                perspectiveProps.direction = 'row';
                perspectiveProps.wrap = 'wrap';
                if (props.columns && props.gap) {
                    perspectiveProps.style = {
                        display: 'grid',
                        gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
                        gap: props.gap
                    };
                }
                break;

            case 'tabs':
                if (props.tabs) {
                    perspectiveProps.tabs = props.tabs.map(tab => ({
                        name: tab.label,
                        text: tab.label,
                        icon: tab.icon ? { path: tab.icon } : null
                    }));
                }
                break;

            case 'metric-card':
                // Custom component - expand to flex container with children
                perspectiveProps.direction = 'column';
                perspectiveProps.style = {
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: props.style?.background || 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                };
                break;

            default:
                // Pass through any unhandled props
                Object.assign(perspectiveProps, props);
        }

        // Always convert style if present
        if (props.style && !perspectiveProps.style) {
            perspectiveProps.style = this.convertStyle(props.style);
        }

        return perspectiveProps;
    }

    /**
     * Convert CSS style object
     */
    convertStyle(style) {
        const perspectiveStyle = {};

        // Direct mappings
        const directMappings = [
            'background', 'backgroundColor', 'color', 'fontSize',
            'fontWeight', 'padding', 'margin', 'border', 'borderRadius',
            'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
            'display', 'position', 'top', 'left', 'right', 'bottom',
            'flex', 'gap', 'overflow', 'opacity', 'zIndex'
        ];

        directMappings.forEach(prop => {
            if (style[prop] !== undefined) {
                perspectiveStyle[prop] = style[prop];
            }
        });

        // Special conversions
        if (style.marginBottom) perspectiveStyle.marginBottom = style.marginBottom;
        if (style.marginTop) perspectiveStyle.marginTop = style.marginTop;
        if (style.paddingLeft) perspectiveStyle.paddingLeft = style.paddingLeft;
        if (style.paddingRight) perspectiveStyle.paddingRight = style.paddingRight;

        return perspectiveStyle;
    }

    /**
     * Create project metadata files
     */
    createProjectMetadata(tempDir, projectName) {
        // project.json
        const projectJson = {
            "format": 2,
            "title": projectName,
            "description": "Kaleidoscope project exported to Perspective",
            "parent": "",
            "enabled": true,
            "inheritable": true
        };

        fs.writeFileSync(
            path.join(tempDir, 'project.json'),
            JSON.stringify(projectJson, null, 2)
        );

        // Global props
        const globalProps = {
            "resource": {
                "version": 1,
                "scope": "G",
                "restricted": false,
                "overridable": true,
                "files": ["data.bin"]
            }
        };

        fs.writeFileSync(
            path.join(tempDir, 'ignition', 'global-props', 'resource.json'),
            JSON.stringify(globalProps, null, 2)
        );

        fs.writeFileSync(
            path.join(tempDir, 'ignition', 'global-props', 'data.bin'),
            '{}'
        );

        // Page configuration (double-nested structure)
        const pageConfig = {
            "pages": {
                "/": {
                    "viewPath": "Dashboard",
                    "title": "Dashboard"
                },
                "/production": {
                    "viewPath": "Production",
                    "title": "Production"
                },
                "/maintenance": {
                    "viewPath": "Maintenance",
                    "title": "Maintenance"
                },
                "/alarms": {
                    "viewPath": "Alarms",
                    "title": "Alarms"
                },
                "/reports": {
                    "viewPath": "Reports",
                    "title": "Reports"
                },
                "/energy": {
                    "viewPath": "Energy",
                    "title": "Energy"
                },
                "/gateway": {
                    "viewPath": "Gateway",
                    "title": "Gateway"
                },
                "/tags": {
                    "viewPath": "Tags",
                    "title": "Tags"
                },
                "/gitdb": {
                    "viewPath": "GitDB",
                    "title": "GitDB"
                }
            }
        };

        const pageConfigParentDir = path.join(tempDir, 'com.inductiveautomation.perspective', 'page-config');
        const pageConfigDir = path.join(pageConfigParentDir, 'config');
        fs.mkdirSync(pageConfigDir, { recursive: true });

        fs.writeFileSync(
            path.join(pageConfigDir, 'config.json'),
            JSON.stringify(pageConfig, null, 2)
        );

        this.writePageConfigResourceJson(pageConfigParentDir);
    }

    /**
     * Write resource.json for a view resource
     */
    writeResourceJson(dir, name, type) {
        const resourceJson = {
            "resource": {
                "version": 1,
                "scope": "A",
                "restricted": false,
                "overridable": true,
                "files": [name + "/view.json"],
                "attributes": {
                    "lastModification": {
                        "actor": "Kaleidoscope Export",
                        "timestamp": new Date().toISOString()
                    },
                    "lastModificationSignature": "00000000000000000000000000000000"
                }
            }
        };

        fs.writeFileSync(
            path.join(dir, 'resource.json'),
            JSON.stringify(resourceJson, null, 2)
        );
    }

    /**
     * Write resource.json for page config
     */
    writePageConfigResourceJson(dir) {
        const resourceJson = {
            "resource": {
                "version": 1,
                "scope": "A",
                "restricted": false,
                "overridable": true,
                "files": ["config/config.json"],
                "attributes": {
                    "lastModification": {
                        "actor": "Kaleidoscope Export",
                        "timestamp": new Date().toISOString()
                    },
                    "lastModificationSignature": "00000000000000000000000000000000"
                }
            }
        };

        fs.writeFileSync(
            path.join(dir, 'resource.json'),
            JSON.stringify(resourceJson, null, 2)
        );
    }

    /**
     * Create zip archive
     */
    async createZipArchive(tempDir, outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(path.join(__dirname, '..', outputPath));
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`📦 Archive created: ${archive.pointer()} bytes`);
                resolve();
            });

            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(tempDir, false);
            archive.finalize();
        });
    }

    /**
     * Cleanup temporary directory
     */
    cleanup(tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

// Export tags to Ignition format
class TagExporter {
    async exportTags(outputPath = 'gitway-tags.json') {
        console.log('🏷️  Exporting tags to Ignition format...');

        const tags = {
            "tags": [
                {
                    "name": "GitWay",
                    "tagType": "Folder",
                    "tags": [
                        {
                            "name": "Production",
                            "tagType": "Folder",
                            "tags": [
                                {
                                    "name": "OEE",
                                    "tagType": "AtomicTag",
                                    "valueSource": "memory",
                                    "value": 85,
                                    "dataType": "Float8"
                                },
                                {
                                    "name": "Count",
                                    "tagType": "AtomicTag",
                                    "valueSource": "memory",
                                    "value": 1250,
                                    "dataType": "Int4"
                                }
                            ]
                        },
                        {
                            "name": "Energy",
                            "tagType": "Folder",
                            "tags": [
                                {
                                    "name": "Power",
                                    "tagType": "Folder",
                                    "tags": [
                                        {
                                            "name": "Current",
                                            "tagType": "AtomicTag",
                                            "valueSource": "memory",
                                            "value": 450.5,
                                            "dataType": "Float8",
                                            "engUnit": "kW"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        fs.writeFileSync(
            path.join(__dirname, '..', outputPath),
            JSON.stringify(tags, null, 2)
        );

        console.log(`✅ Tags exported: ${outputPath}`);
        return outputPath;
    }
}

// Main export function
async function main() {
    const exporter = new PerspectiveExporter();
    const tagExporter = new TagExporter();

    // Check if archiver is installed
    try {
        require.resolve('archiver');
    } catch(e) {
        console.log('📦 Installing archiver package...');
        require('child_process').execSync('npm install archiver', { cwd: __dirname });
    }

    // Export project
    await exporter.exportProject('GitWay', 'gitway-perspective.zip');

    // Export tags
    await tagExporter.exportTags('gitway-tags.json');

    console.log('\n🎉 Export complete! Files created:');
    console.log('   - gitway-perspective.zip (Perspective project)');
    console.log('   - gitway-tags.json (Tag configuration)');
    console.log('\nImport these into your Ignition gateway:');
    console.log('   1. Go to Config > Projects > Import Project');
    console.log('   2. Upload gitway-perspective.zip');
    console.log('   3. Go to Config > Tags > Import/Export');
    console.log('   4. Import gitway-tags.json');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PerspectiveExporter, TagExporter };