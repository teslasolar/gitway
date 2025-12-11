# Plan Directory - Self-Organizing Task System

## 🎯 Purpose
Auto-managing task system with self-destructing completed items.

## 📁 Structure
```
plan/
├── plan.md           # Master plan overview
├── atoms/plan.md     # Atomic component tasks
├── molecules/plan.md # Molecular component tasks
├── organisms/plan.md # Page template tasks
├── system/plan.md    # System infrastructure tasks
├── integrations/     # External integration tasks
├── archive/          # Auto-archived completed tasks
└── task-manager.js   # Self-destruct engine
```

## 🔄 Auto-Management

### Task States
```markdown
- [ ] TODO task
- [ ] `HIGH` Priority task
- [x] DONE task (auto-deletes in 24h)
```

### Self-Destruct Rules
1. Tasks marked `[x]` are removed after 24 hours
2. Removed tasks archived to `/archive/[area]-[date].md`
3. Progress stats updated in master plan
4. Timestamps auto-updated

## 🚀 Usage

### Run Task Cleanup
```bash
node plan/task-manager.js
```

### Add to Cron/Scheduler
```bash
# Daily at midnight
0 0 * * * cd /path/to/gitway && node plan/task-manager.js
```

### Task Format
```markdown
- [ ] `PRIORITY` Task description
  - HIGH = Critical path
  - MED = Important
  - LOW = Nice to have
```

## 📊 Metrics
- Total tasks tracked across all plans
- Completion percentage auto-calculated
- Archive maintains history
- Daily cleanup keeps plans clean

## 🎮 Commands

### Manual Cleanup
```bash
npm run plan:clean
```

### View Progress
```bash
npm run plan:status
```

### Archive Old Tasks
```bash
npm run plan:archive
```

---
**Self-organizing. Self-cleaning. Always current.**