# migration-pilot

**Token-optimized migration assistant — source → destination only**

Reads your project from `--from`, writes the migrated result to `--to`. **Never modifies the source tree** and **never writes into this tool’s repository** (use paths outside this repo).

## Supported profiles

| Profile | Conversion |
|---------|------------|
| `js-to-ts` | JavaScript → TypeScript |
| `ts-to-js` | TypeScript → JavaScript |
| `class-to-hooks` | React class → hooks |
| `python-to-java` | Python → Java |
| `java-to-python` | Java → Python |

## Install

```bash
npm install
npm run build
```

## Usage

```bash
migration-pilot migrate <profile> --from <source-root> --to <destination-root> [options]
```

### Example

```bash
node dist/index.js migrate js-to-ts \
  --from E:/projects/my-app/src \
  --to E:/projects/my-app-ts/src \
  --no-tests
```

### Scan (read-only on source)

```bash
node dist/index.js scan js-to-ts \
  --from E:/projects/my-app/src \
  --to E:/tmp/my-app-ts-out
```

(`--to` is required for path validation; dry-run scan does not write files.)

### Report (read from destination)

```bash
node dist/index.js report --to E:/projects/my-app-ts/src
```

## LLM (OpenRouter / Groq / Ollama)

Copy `.env.example` → `.env`:

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key
```

```bash
node dist/index.js migrate python-to-java \
  --from E:/projects/python-app \
  --to E:/projects/java-app \
  --no-tests
```

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | `openrouter`, `groq`, `openai`, `ollama` |
| `OPENROUTER_API_KEY` / `GROQ_API_KEY` | API keys |
| `USE_MOCK_AI=true` | No API calls (testing only) |

## Common flags

| Flag | Description |
|------|-------------|
| `--from` | Source root (read only) |
| `--to` | Destination root (all output + `.migration-pilot/`) |
| `--no-ai` | Rules-only, no LLM |
| `--no-tests` | Skip validators and tests |
| `--clean` | Delete destination before run |
| `--git` | Git backup in **destination** only (off by default) |
| `--verbose` | Token / debug logging |

## Tests

Fixtures live under `test/fixtures/` (not migrated by normal CLI use).

```bash
npm run test:build
```

## License

MIT
