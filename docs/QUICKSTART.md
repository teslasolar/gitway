# 🚀 Quickstart Guide

## Deploy in 60 Seconds

### 1. Fork Repository
```bash
# Click "Fork" button on GitHub
```

### 2. Enable Pages
```
Settings → Pages → Source: "GitHub Actions"
```

### 3. Deploy
```bash
git push origin main
# Auto-deploys via Actions
```

### 4. Access
```
https://USERNAME.github.io/gitway/
```

## Use Custom Repo

Add `?repo=owner/name` to URL:
```
https://USERNAME.github.io/gitway/?repo=anthropics/claude-code
```

## File Structure

```
gitway/
├── index.html          # App shell (51 words)
├── konomi.json         # Config (100 words)
├── gateway.js          # Core (103 words)
├── tags.js             # Tag system (157 words)
├── ai.js               # Anomaly detection (194 words)
├── ui.js               # Interface (219 words)
├── theme.css           # Ignition theme (79 words)
└── screens/            # JSON definitions
    ├── dashboard.json  # Main view (89 words)
    ├── tags.json       # Tag browser (55 words)
    └── analytics.json  # AI analytics (68 words)
```

**Total: ~1,115 words (~1,500 tokens)**
**All files <250 tokens ✅**

## Customization

### Change Poll Rate
Edit `konomi.json`:
```json
"poll_rate": 30000  // 30 seconds
```

### Add Alert Rule
Edit `konomi.json` → `alerts`:
```json
{
  "tag": "Quality/OpenPRs",
  "op": ">",
  "val": 10,
  "severity": "WARN",
  "msg": "Too many PRs"
}
```

### Add GitHub Token
Edit `konomi.json` → `providers[0].headers`:
```json
"Authorization": "token ghp_YOUR_TOKEN"
```

## Local Development

```bash
# Serve locally
python -m http.server 8000

# Or use any static server
npx serve .
```

## Features

- ✅ Real-time GitHub API polling
- ✅ OPC-UA style hierarchical tags
- ✅ Statistical anomaly detection (Z-score)
- ✅ Ignition 8.3 dark theme
- ✅ Zero dependencies
- ✅ Single page application
- ✅ Mobile responsive

## Troubleshooting

**No data showing?**
- Check browser console for API errors
- Verify repo name is correct
- GitHub API limit: 60/hour (add token for 5000/hour)

**Slow updates?**
- Default poll rate: 60s
- Reduce in konomi.json (be mindful of rate limits)

**Styling issues?**
- Clear browser cache
- Check theme.css loaded correctly

## Next Steps

1. Read [README.md](README.md) for details
2. Explore [DBPS.md](DBPS.md) for Dense Build Prompt System
3. Customize screens in `/screens/*.json`
4. Add more tags in `konomi.json`

---

**Built with Dense Build Prompt System**
**Each file optimized to <250 tokens**
