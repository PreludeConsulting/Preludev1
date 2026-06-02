# Prelude

College admissions guidance website (Vite + React) with server-side Prelude AI backed by official U.S. public datasets.

## Quick start

```bash
npm install
cp .env.example .env
# Configure AI (see "AI providers" below)

# Generate public datasets if needed
bash prelude_dataset_kit/scripts/setup_datasets.sh
```

### Option A — one command (simplest)

Runs the React app and all `/api/*` routes on the same dev port:

```bash
npm run dev
```

Open [http://localhost:5173/Preludev1/](http://localhost:5173/Preludev1/)

### Option B — separate API process

**Terminal 1 — backend** (port `3001` by default):

```bash
npm run server
```

**Terminal 2 — frontend** (proxies `/api` to the backend):

```bash
PRELUDE_STANDALONE_API=1 npm run dev
```

Or start both from one command:

```bash
npm run dev:all
```

Override the API port with `PRELUDE_API_PORT` in `.env` if needed.

## AI providers

All AI configuration is **server-side only** (never use a `VITE_` prefix).

### Production — OpenAI (default)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Local development — Ollama

Use a free local model without an OpenAI key:

```bash
# Install Ollama: https://ollama.com
ollama serve
ollama pull gemma3
```

```env
AI_PROVIDER=ollama
OLLAMA_MODEL=gemma3
# OLLAMA_BASE_URL=http://localhost:11434
```

Restart `npm run server` or `npm run dev` after changing `.env`. If Ollama is not running or the model is missing, `/api/chat` returns a clear error message.

## Documentation

| Topic | Location |
|-------|----------|
| RAG, datasets, API routes, testing | [docs/rag-and-datasets.md](docs/rag-and-datasets.md) |
| Dataset kit setup | [prelude_dataset_kit/README.md](prelude_dataset_kit/README.md) |
| Auth & security | [docs/auth-security.md](docs/auth-security.md) |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend + embedded API middleware (single port) |
| `npm run server` | Standalone API server on port 3001 |
| `npm run dev:all` | Standalone API + frontend with proxy |
| `npm run build` | Production build |
| `npm test` | Agent tests, dataset/RAG tests, API smoke tests |
| `npm run train:agent` | Rule-based agent training checks |

## Prelude AI (summary)

- **Search** colleges, programs, and careers via `/api/colleges/*`, `/api/programs/search`, `/api/careers/search`
- **Chat** via `POST /api/chat` with retrieval over SQLite — only a small relevant context is sent to the model
- **Same AI** for all plans; plans differ by roadmap tools and mentor access only

Never commit `.env`, API keys, or generated files under `prelude_dataset_kit/data/` (see kit `.gitignore`).
