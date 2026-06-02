# Prelude RAG and public datasets

Prelude AI uses a server-side retrieval layer over official U.S. public datasets, then sends only a small structured context block to the language model along with Prelude behavioral instructions.

## Start locally

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and set:

- `AI_PROVIDER` — `openai` (production default) or `ollama` (local dev)
- `OPENAI_API_KEY` — required when `AI_PROVIDER=openai` (never use a `VITE_` prefix)
- `OPENAI_MODEL` — optional (defaults to `gpt-4o-mini`)
- `OLLAMA_MODEL` — local model name when using Ollama (default `gemma3`)
- `OLLAMA_BASE_URL` — optional (default `http://localhost:11434`)
- `PRELUDE_DATA_DB_PATH` — optional override for the SQLite file

**Ollama setup (local only):**

```bash
ollama serve
ollama pull gemma3
```

```env
AI_PROVIDER=ollama
OLLAMA_MODEL=gemma3
```

Auth and billing variables in `.env.example` are only needed if you use those features.

### 3. Generate datasets (if needed)

```bash
bash prelude_dataset_kit/scripts/setup_datasets.sh
```

This creates:

- `prelude_dataset_kit/data/db/prelude_public_data.sqlite`
- processed CSV files under `prelude_dataset_kit/data/processed/`
- `prelude_dataset_kit/data/rag/prelude_rag_documents.jsonl` (reserved for future semantic search)

### 4. Start locally

**Single process (recommended):**

```bash
npm run dev
```

**Separate API server:**

```bash
npm run server          # http://localhost:3001
PRELUDE_STANDALONE_API=1 npm run dev   # frontend at :5173, proxies /api → :3001
# or: npm run dev:all
```

API handlers live in `server/`. In the default `npm run dev` mode, Vite mounts them as middleware on port `5173`. With `npm run server`, they run as a standalone Node HTTP server. On Vercel, the same logic is exposed via `api/` serverless functions.

## API routes

| Route | Description |
|-------|-------------|
| `GET /api/colleges/search` | College search (`q`, `state`, `maxNetPrice`, `major`, `limit`) |
| `GET /api/colleges/:unitid` | College profile + related programs |
| `GET /api/programs/search` | Program search (`q`, `state`, `limit`) |
| `GET /api/careers/search` | O*NET career search (`q`, `limit`) |
| `POST /api/chat` | RAG chat (`message`, `conversationHistory`) |

### Example tests

```bash
curl "http://localhost:5173/api/colleges/search?state=GA&major=computer%20science&limit=5"
curl "http://localhost:5173/api/programs/search?q=computer%20science&state=GA&limit=5"
curl "http://localhost:5173/api/careers/search?q=software%20developer&limit=5"
curl -X POST "http://localhost:5173/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"What are affordable computer science schools in Georgia?","conversationHistory":[]}'
```

## Official datasets used

| Data | Source label |
|------|----------------|
| Colleges, programs, outcomes | College Scorecard — U.S. Department of Education |
| Careers, tasks | O*NET database — U.S. Department of Labor, Employment and Training Administration |

Curated admissions guidance (no live policy scraping):

- `prelude_dataset_kit/knowledge/PRELUDE_SYSTEM_PROMPT.md`
- `prelude_dataset_kit/knowledge/AGENT_KNOWLEDGE.md`

## Files not to commit

Large or generated artifacts are gitignored under `prelude_dataset_kit/`:

- `prelude_dataset_kit/data/raw/*`
- `prelude_dataset_kit/data/processed/*`
- `prelude_dataset_kit/data/db/*.sqlite`
- `prelude_dataset_kit/data/rag/*.jsonl`

Keep `.gitkeep` placeholders only.

Never commit `.env` or real API keys.

## Regenerate datasets

```bash
bash prelude_dataset_kit/scripts/setup_datasets.sh
```

See `prelude_dataset_kit/README.md` and `prelude_dataset_kit/SOURCE_NOTES.md` for source URLs and optional IPEDS expansion.

## Future work

- Semantic search with embeddings over `prelude_rag_documents.jsonl`
- Vector database for document retrieval
- Automated dataset refresh jobs
- IPEDS expansion
- Verified official school-page ingestion for current deadlines and essay supplements
- User accounts and saved college lists (product DB is separate from public SQLite)
- Personalized roadmap tasks
- Mentor matching
- Common App workflow organization
- Scholarship-source integration
