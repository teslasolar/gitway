# Kaleidoscope Templates - Ignition Perspective Components

This directory contains templates that match Ignition Perspective components, providing a comprehensive set of industrial SCADA components for GitWay's Kaleidoscope rendering system.

## 📊 Chart Components

### 1. **Gauge** (`gauge.json`)
- **Description**: Perspective-style gauge showing real-time values in a configurable range
- **Features**: Color zones, needle indicator, scale labels, min/max configuration
- **Use Case**: Displaying pressure, temperature, or any analog value with visual ranges

### 2. **Time Series Chart** (`time-series-chart.json`)
- **Description**: Multi-pen time series chart with real-time updates
- **Features**: Multiple chart types (line, area, bar, scatter), configurable time ranges, pen management
- **Use Case**: Historical trending, real-time data visualization, process monitoring

## 🏭 Industrial Symbols

### 3. **Cylindrical Tank** (`cylindrical-tank.json`)
- **Description**: Animated tank/vessel component with level display
- **Features**: Fill animation, agitator control, level alarms, capacity display
- **Use Case**: Tank farm monitoring, liquid storage visualization

### 4. **Pump** (`pump.json`)
- **Description**: Animated pump symbol with control interface
- **Features**: Start/stop control, status indication, flow rate display, fault handling
- **Use Case**: Pump station control, water treatment, process control

### 5. **Valve** (`valve.json`)
- **Description**: Valve symbol with position control and animation
- **Features**: Multiple valve types (ball, gate, butterfly), position slider, open/close animation
- **Use Case**: Flow control, pipeline management, process automation

### 6. **Motor Control** (`motor-control.json`)
- **Description**: Comprehensive motor control panel with safety interlocks
- **Features**: Speed control, start/stop/reset, interlock monitoring, runtime tracking
- **Use Case**: Motor control centers, conveyor systems, industrial machinery

## 📈 Display Components

### 7. **LED Display** (`led-display.json`)
- **Description**: Seven-segment LED display for numeric values
- **Features**: Configurable colors, digital font, background customization
- **Use Case**: Temperature displays, counters, digital readouts

### 8. **Linear Scale** (`linear-scale.json`)
- **Description**: Linear scale indicator with configurable ranges
- **Features**: Vertical/horizontal orientation, color zones, major/minor ticks
- **Use Case**: Level indicators, linear measurements, analog displays

## 🎛️ Control Components

### 9. **Tank Monitor** (`tank-monitor.json`)
- **Description**: Complete tank monitoring interface with controls
- **Features**: Level gauge, temperature, flow rate, trend display
- **Use Case**: Storage tank monitoring, process vessels, liquid management

## 🔧 System Components

### 10. **Alarm Display** (`alarm-display.json`)
- **Description**: Comprehensive alarm management interface
- **Features**: Severity filtering, acknowledgment, sound alerts, export capability
- **Use Case**: Alarm monitoring, event management, system notifications

### 11. **Repository Control** (`repo-control.json`)
- **Description**: Git repository management interface
- **Features**: Commit management, branch operations, GitHub integration
- **Use Case**: Version control, code deployment, configuration management

### 12. **GitDB Manager** (`gitdb-manager.json`)
- **Description**: Database management using Git as storage
- **Features**: CRUD operations, SQL queries, multi-driver support
- **Use Case**: Configuration storage, historical data, audit trails

## 🚀 Usage

Each template follows a standard structure:

```json
{
  "id": "component-id",
  "name": "Component Name",
  "category": "Component Category",
  "parameters": {
    // Configurable parameters
  },
  "view": {
    // Component structure
  }
}
```

### Instantiating a Template

Templates can be instantiated with custom parameters:

```javascript
const tankInstance = {
  template: "cylindrical-tank",
  params: {
    tagPath: "[default]Tanks/Tank1/Level",
    name: "Storage Tank 1",
    capacity: 50000,
    units: "gallons",
    alarmHigh: 85,
    alarmLow: 15
  }
}
```

### Parameter Types

- **tagPath**: Links to Ignition tags for real-time data
- **Numeric**: Min/max values, thresholds, sizes
- **Boolean**: Feature toggles (showLabels, enableControl)
- **String**: Labels, units, display formats
- **Array**: Multiple items (pens, zones, interlocks)

## 🎨 Component Categories

Templates are organized by Perspective component categories:

- **Chart**: Data visualization components
- **Symbols**: Industrial equipment symbols
- **Display**: Value display components
- **Control**: User input and control components
- **Container**: Layout and organization components

## 🔌 Integration with Ignition

These templates are designed to work with:
- Ignition tag paths using `[provider]path/to/tag` format
- Real-time WebSocket updates through the bridge server
- Tag history for trending and analysis
- Ignition scripting actions

## 📝 Template Development

To create new templates:

1. Study the Ignition Perspective component
2. Define configurable parameters
3. Create the view structure using Kaleidoscope components
4. Add data bindings using `{{params.xxx}}` and `{{tags.xxx}}`
5. Include actions for user interactions
6. Test with real tag data

## 🔄 Real-time Updates

Templates support real-time updates through:
- Tag bindings: `{{tags.[params.tagPath]}}`
- Parameter references: `{{params.paramName}}`
- Calculated values: `{{expression}}`
- Conditional rendering: `{{condition ? true : false}}`

## 📚 Additional Resources

- [Ignition User Manual - Perspective Components](https://docs.inductiveautomation.com/docs/8.1/ignition-modules/perspective)
- [GitWay Documentation](https://github.com/teslasolar/gitway)
- [Kaleidoscope Renderer Documentation](../renderer.js)

## 🤝 Contributing

To contribute new templates:
1. Follow the existing template structure
2. Ensure parameters are well-documented
3. Test with various parameter combinations
4. Submit PR with example usage

---

## Template List Summary

| Template | Category | Ignition Equivalent | Primary Use Case |
|----------|----------|-------------------|------------------|
| gauge | Chart | Gauge | Analog value display with ranges |
| time-series-chart | Chart | Time Series Chart | Historical trending |
| cylindrical-tank | Symbols | Cylindrical Tank | Tank level monitoring |
| pump | Symbols | Pump | Pump control and status |
| valve | Symbols | Valve | Valve position control |
| motor-control | Control | Motor | Motor control panel |
| led-display | Display | LED Display | Digital numeric display |
| linear-scale | Display | Linear Scale | Linear measurement display |
| tank-monitor | Container | Custom | Complete tank interface |
| alarm-display | System | Alarm Status Table | Alarm management |
| repo-control | System | Custom | Git operations |
| gitdb-manager | System | Custom | Database management |

These templates provide a foundation for building Ignition-style SCADA applications using GitWay's Kaleidoscope rendering system.