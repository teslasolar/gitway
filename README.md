# 🏭 KONOMI Gitway

**Ignition 8.3-style SCADA Gateway for GitHub Repositories**

Transform your GitHub repository into an industrial factory dashboard with real-time monitoring, OPC-UA-style tags, and AI-powered anomaly detection.

## 🚀 Quick Start

### Deploy to GitHub Pages
```bash
# Fork this repo
# Enable GitHub Pages in Settings → Pages
# Set source to "GitHub Actions"
# Push to main branch
```

### Local Development
```bash
# Serve locally
python -m http.server 8000
# Open: http://localhost:8000?repo=owner/name
```

## 📊 Features

### 🏗️ Repository as Factory
- **Production Rate**: Commits per hour
- **Quality Control**: Open PRs and merge rate
- **Defects**: Open issues and severity
- **Workers**: Active contributors
- **Equipment**: CI/CD action status
- **Inventory**: Repository size and files

### 🏷️ OPC-UA Style Tags
```
[Repo]/Production/CommitRate     → commits/hr
[Repo]/Quality/OpenPRs           → count
[Repo]/Defects/OpenIssues        → count
[Repo]/Workers/Contributors      → count
[Repo]/Equipment/Actions         → pass/fail
[Repo]/Inventory/Size            → MB
```

### 🤖 AI Anomaly Detection
- Z-score statistical analysis
- Real-time trend detection
- Configurable alert rules
- Severity classification (WARN/CRIT)

### 🎨 Ignition 8.3 Theme
- Dark professional interface
- Designer-style layout
- Tab navigation
- Widget-based dashboards
- Real-time status indicators

## 📁 Architecture

### Modular Design (Each file <250 tokens)
```
gitway/
├── index.html           # Shell (minimal)
├── konomi.json          # Configuration
├── gateway.js           # Core engine
├── tags.js              # Tag system
├── ai.js                # Anomaly detector
├── ui.js                # UI renderer
├── theme.css            # Ignition theme
└── screens/             # JSON screen defs
    ├── dashboard.json
    ├── tags.json
    └── analytics.json
```

## ⚙️ Configuration

Edit `konomi.json` to customize:

```json
{
  "gateway": {
    "poll_rate": 60000  // Poll every 60s
  },
  "ai": {
    "threshold": 2.5    // Z-score threshold
  },
  "alerts": [
    {
      "tag": "Production/CommitRate",
      "op": "<",
      "val": 5,
      "severity": "WARN"
    }
  ]
}
```

## 🎯 Usage

### Default Repo
```
https://yourname.github.io/gitway/
# Defaults to anthropics/claude-code
```

### Custom Repo
```
https://yourname.github.io/gitway/?repo=owner/name
```

### Screens
- **Dashboard**: Real-time metrics widgets
- **Tag Browser**: Hierarchical tag tree
- **Analytics**: AI insights and alerts

## 🔧 Development

### Add New Tag
1. Edit `konomi.json` → `devices[0].tags`
2. Add tag path and GitHub API endpoint
3. Gateway auto-discovers on next poll

### Add Screen
1. Create `screens/yourscreen.json`
2. Define components and layout
3. Add tab in `ui.js`

### Customize Theme
Edit `theme.css` for colors, fonts, layout

## 📦 Deployment

### GitHub Pages (Automated)
Push to `main` → Auto-deploys via Actions

### Manual
Copy all files to any static host

## 🎨 Screen Format

JSON-based declarative screens:

```json
{
  "screen": "dashboard",
  "layout": "grid",
  "components": [{
    "type": "numeric_display",
    "tag": "[Repo]/Production/CommitRate",
    "label": "Production Rate",
    "format": "0.00"
  }]
}
```

## 🔐 API Limits

GitHub API: 60 requests/hour (unauthenticated)

For higher limits, add token to `konomi.json`:
```json
"providers": [{
  "headers": {
    "Authorization": "token YOUR_TOKEN"
  }
}]
```

## 📊 Example Output

```
KONOMI Gateway - ONLINE
├─ Production Rate: 12.5 commits/hr [GOOD]
├─ Quality Control: 8 PRs [GOOD]
├─ Open Defects: 23 issues [WARN]
└─ AI Alert: Unusual commit rate spike (z=3.2)
```

## 🏗️ Built With
- Pure JavaScript (ES6+)
- Zero dependencies
- GitHub REST API v3
- Statistical ML (Z-score)

## 📜 License
MIT

## 🎯 Dense Build Spec
```
BUILD[Gitway]
├─ FE→HTML+JS@ZERO_DEP
├─ DATA→GH_API[REST]@60s
├─ TAGS→OPC_Style[Hierarchical]
├─ AI→ZScore[Anomaly]@CPU
├─ UI→Ignition_8.3[Dark]
└─ DEPLOY→Pages@SINGLE

FILES[<250tok each]
MODULAR[JSON+JS+CSS]
THEME[Professional SCADA]
```

---

**Status**: Production Ready ✅
**Demo**: [View Live](https://yourname.github.io/gitway)
