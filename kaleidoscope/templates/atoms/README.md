# Atoms - Ignition Components

**Most atoms are exact recreations of Ignition Perspective components**
**Some are enhanced versions with additional features (marked)**

## Categories
- **charts/** - XY, Pie, Power Chart, Time Series
- **containers/** - Tab, Accordion, Split, Coordinate
- **displays/** - Gauge, Label, LED, Progress Bar
  - Table *(Enhanced: export functionality)*
  - Map *(Enhanced: geofencing, asset tracking, heatmaps)*
- **docks/** - Layout frames (N/S/E/W)
- **industrial/** - Pump, Valve, Motor, Tank
- **inputs/** - Button, Dropdown, Slider, Toggle

## Enhanced Components
Components with `"enhanced": true` have features beyond standard Ignition:
- **table.json** - Added CSV/Excel/PDF export
- **map.json** - Added geofencing, asset tracking, heatmaps, clustering

## Usage
```json
{"type": "button", "props": {"text": "Start", "tagPath": "[default]cmd"}}
```

Standard atoms match Ignition's exact property names & behavior.
Enhanced atoms are supersets with additional features.