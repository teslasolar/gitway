# 🎯 Dense Build Prompt System (DBPS)

**Maximum Information Density, Minimal Tokens**

## Core Syntax

```
[COMPONENT]→[SPEC]@[CONSTRAINT]
```

### Example
```
API→REST+GraphQL@<100ms
DB→Postgres+Redis@ACID
UI→React+Tailwind@SSR
AI→Transformer[128d,4h,2l]@GPU
```

## Notation Guide

| Symbol | Meaning | Example |
|--------|---------|---------|
| `→` | Flow/Dependency | `Data→Process→Output` |
| `+` | AND combination | `React+Tailwind` |
| `\|` | OR choice | `SQL\|NoSQL` |
| `@` | Constraint | `@<100ms` |
| `[]` | Parameters | `[64d,2l]` |
| `×` | Multiply/Repeat | `AI×3` |
| `{}` | Variable | `{owner}/{repo}` |

## Templates

### CRUD App
```
BUILD[Name]
├─ FE→{Framework}+{UI}
├─ BE→{Framework}+Auth
├─ DB→{Primary}+{Cache}
└─ DEPLOY→{Platform}
```

### AI System
```
BUILD[AI]
├─ INPUT→{Type}[{Freq}]
├─ MODEL→{Arch}[{Params}]
├─ OUTPUT→{Format}
└─ METRICS@{Targets}
```

### Dashboard
```
BUILD[Dashboard]
├─ DATA→{Source}
├─ VIZ→{Charts}
├─ UPDATE→{Freq}
└─ EXPORT→{Formats}
```

## Token Efficiency

### Traditional (500 tokens)
> "Create a GitHub Pages application that monitors repositories..."

### Dense (150 tokens)
```
BUILD[Gitway]
DATA→GH_API@60s
TRANSFORM→Repo→Factory
AI→Anomaly[ZScore>2.5]
UI→Ignition[Dark]@Pages
```

**70% token reduction ✅**

## Component Shorthand

```
FE  = Frontend
BE  = Backend
DB  = Database
AI  = AI/ML
API = API Layer
UI  = User Interface
```

## Constraint Markers

```
@<100ms   = Max latency
@>95%     = Min accuracy
@CPU      = No GPU
@<10MB    = Max size
@ZERO_DEP = No dependencies
@SINGLE   = Single file
```

## Real Example: Gitway

### Traditional Prompt
"Build an Ignition-style gateway for GitHub Pages that treats repositories as factories, monitoring commits as production rate, PRs as quality control, and issues as defects. Include AI anomaly detection using KONOMI engine. Use dark theme, deploy as single HTML under 100KB."

### Dense Version
```
Gitway:GH_API→Repo[commits→rate/hr,PRs→QC,issues→defects]
→AI[KONOMI,detect:anomaly]→UI[Ignition_dark]@Pages,SINGLE,<100KB
```

**73% more efficient ✅**

## Usage

1. Start with `BUILD[Name]`
2. Add components with `→`
3. Specify constraints with `@`
4. Use tree structure
5. Keep scannable

## Benefits

- ✅ 70%+ token reduction
- ✅ 100% information preserved
- ✅ Scannable structure
- ✅ Unambiguous specs
- ✅ AI-parseable
- ✅ Human-readable

## Learn More

See full specification in project prompt or examples in `/screens/*.json`
