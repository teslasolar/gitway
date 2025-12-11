# Kaleidoscope Templates - Atomic Design

## Structure
```
templates/
├── atoms/      # Ignition components (exact replicas)
├── molecules/  # Compound components (2-5 atoms)
└── organisms/  # Full page templates (complete UIs)
```

## Atoms (52 components)
Direct ports of Ignition Perspective components.
**These ARE Ignition components** - exact property/behavior match.

- **charts/** - 7 types (XY, Pie, Power, Time Series, etc.)
- **containers/** - 9 types (Tab, Split, Coordinate, etc.)
- **displays/** - 20 types (Gauge, Label, LED, Progress, etc.)
- **docks/** - 5 layouts (N/S/E/W + main)
- **industrial/** - 6 symbols (Pump, Valve, Motor, Tank, etc.)
- **inputs/** - 5 controls (Button, Slider, Toggle, etc.)

## Molecules
GitWay patterns combining atoms:
- **gitdb-manager** - Database CRUD interface
- **repo-control** - Git operations panel
- **metric-card** - KPI with trend sparkline
- **equipment-panel** - Status + control group

## Organisms
Full production pages:
- **oee-dashboard** - Complete OEE monitoring
- **industry-page** - Universal production template
- **maintenance-view** - Equipment & work orders
- **quality-control** - SPC & inspection

## Usage
```json
{
  "template": "industry-page",
  "params": {
    "title": "Line 1",
    "metrics": [...],
    "tagPrefix": "[default]Production/L1"
  }
}
```

**All templates <250 tokens. Pure parameters. No hardcoding.**