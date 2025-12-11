# Molecules - Compound Components

**Molecules combine atoms into functional units**

## Components
- **gitdb-manager** - Database UI with CRUD
- **repo-control** - Git operations panel
- **metric-card** - KPI display with trend
- **equipment-panel** - Status + controls
- **alarm-banner** - Active alarm strip

## Example
```json
{
  "type": "metric-card",
  "atoms": ["label", "gauge", "sparkline"],
  "props": {"title": "OEE", "value": 85}
}
```

Molecules are reusable patterns built from atoms.