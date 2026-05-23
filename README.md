# ✈ migration-pilot

**Automated Language/Framework Migration Assistant**

Migrate entire codebases from JavaScript to TypeScript, React class components to hooks, and more — automatically, safely, and incrementally.

## The Problem

Migrations take **weeks to months**. Companies spend **$100K+** on them. Developers dread them. The process is:
- Manual, tedious, and error-prone
- Risky — one wrong change can break everything  
- Hard to track progress across hundreds of files

## The Solution

`migration-pilot` scans your codebase, builds a dependency graph, creates a migration plan, and executes it **file by file in dependency order** — with automatic rollback if tests fail.

```
$ migration-pilot migrate js-to-ts -d ./my-project

  ╔═══════════════════════════════════════════════╗
  ║  ✈  migration-pilot                           ║
  ║  Automated Language/Framework Migration        ║
  ╚═══════════════════════════════════════════════╝

  ██████████████████████████████ 100%

  ✓ Migrated:       347 / 347
  ✗ Failed:            0 / 347

  Status: COMPLETE ✓    Duration: 4m 32s
```

## Features

- **Smart Dependency Analysis** — Builds a full import graph and migrates files in the correct order (leaves first)
- **Incremental Batching** — Migrates N files at a time, runs tests after each batch
- **Automatic Rollback** — If tests fail after a batch, it rolls back that batch and flags files for manual review
- **JS → TypeScript** — Converts `require` to `import`, `module.exports` to `export`, adds type annotations, converts PropTypes to interfaces
- **React Class → Hooks** — Converts class components to functional components with `useState`, `useEffect`, `useCallback`
- **AI-Powered Type Inference** — Optional Ollama integration for intelligent type inference (not just `any` everywhere)
- **Progress Dashboard** — Real-time progress bar, ETA, batch status
- **Detailed Reports** — JSON report saved after every migration

## Installation

```bash
# Clone the repo
git clone https://github.com/your-username/migration-pilot.git
cd migration-pilot

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Usage

### Scan a codebase (preview only)

```bash
migration-pilot scan js-to-ts -d ./your-project/src
```

Shows the dependency graph and migration order without changing any files.

### Dry run (see the plan)

```bash
migration-pilot migrate js-to-ts -d ./your-project/src --dry-run
```

### Execute migration

```bash
# Basic migration
migration-pilot migrate js-to-ts -d ./your-project/src

# With custom batch size and test command
migration-pilot migrate js-to-ts -d ./src -b 5 -t "npm test"

# With AI-assisted type inference (requires Ollama running locally)
migration-pilot migrate js-to-ts -d ./src --ai --ai-model codellama

# React class to hooks migration
migration-pilot migrate class-to-hooks -d ./src/components
```

### View last report

```bash
migration-pilot report -d ./your-project/src
```

## Supported Migrations

| Migration | Command | What It Does |
|---|---|---|
| **JS → TypeScript** | `js-to-ts` | Renames files, converts imports/exports, adds types, converts PropTypes |
| **React Class → Hooks** | `class-to-hooks` | Converts class components to functional components with hooks |

## How It Works

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│   SCAN      │───▶│    PLAN      │───▶│   EXECUTE   │───▶│  REPORT  │
│             │    │              │    │             │    │          │
│ Find files  │    │ Build order  │    │ Transform   │    │ Summary  │
│ Parse deps  │    │ Create       │    │ Batch by    │    │ Failures │
│ Build graph │    │ batches      │    │ batch       │    │ Manual   │
│             │    │ Estimate     │    │ Test each   │    │ review   │
│             │    │ time         │    │ Rollback    │    │ list     │
│             │    │              │    │ if failed   │    │          │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
```

### Phase 1: Scan
- Discovers all relevant files (`.js`, `.jsx` for JS→TS)
- Parses every `import`/`require` statement
- Builds a complete dependency graph

### Phase 2: Plan
- Topologically sorts files (leaves first — so dependencies are migrated before dependents)
- Splits into batches of configurable size
- Estimates total migration time

### Phase 3: Execute  
- Transforms each file using AST-based rules
- For JS→TS: converts `require` → `import`, adds types, fixes extensions
- Runs tests after each batch
- If tests fail → **rolls back the entire batch**
- Commits each successful batch to git (if in a git repo)

### Phase 4: Report
- Shows final statistics: migrated, failed, rolled back
- Lists files needing manual review
- Saves detailed JSON report

## AI-Powered Type Inference (Optional)

By default, `migration-pilot` uses rule-based type inference (analyzing default values, usage patterns, and JSDoc comments). For smarter types, enable AI:

```bash
# Start Ollama with CodeLlama
ollama pull codellama
ollama serve

# Run migration with AI
migration-pilot migrate js-to-ts -d ./src --ai
```

The AI will:
- Infer meaningful types instead of `any`
- Generate interfaces from object usage patterns
- Respect confidence thresholds (only applies high-confidence inferences)

## CLI Options

| Option | Description | Default |
|---|---|---|
| `-d, --dir <path>` | Target directory | `.` |
| `-b, --batch-size <n>` | Files per batch | `10` |
| `-t, --test-command <cmd>` | Test command | Auto-detected |
| `--no-tests` | Skip tests | `false` |
| `--dry-run` | Preview only | `false` |
| `--ai` | Enable Ollama AI | `false` |
| `--ai-model <model>` | Ollama model | `codellama` |
| `--ai-url <url>` | Ollama API URL | `http://localhost:11434` |

## Tech Stack

- **TypeScript** — The tool itself is written in TypeScript
- **Commander.js** — CLI framework
- **chalk + ora** — Beautiful terminal output
- **glob** — File discovery
- **Ollama** — Optional local AI for type inference

## License

MIT
