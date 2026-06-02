# Paste this prompt into Cursor after copying the folder

Use the `prelude_dataset_kit` folder already added to this repository.

1. Run:
   ```bash
   cd prelude_dataset_kit
   bash scripts/setup_datasets.sh
   ```

2. Verify that the following database exists:
   ```text
   prelude_dataset_kit/data/db/prelude_public_data.sqlite
   ```

3. Add a backend data-access layer for Prelude. Do not load the full CSV files into the Vite frontend. Query the SQLite database from the server side.

4. Implement these read-only endpoints:
   - `GET /api/colleges/search?q=&state=&limit=`
   - `GET /api/colleges/:unitid`
   - `GET /api/programs/search?q=&state=&limit=`
   - `GET /api/careers/search?q=&limit=`

5. Keep query results small. Default to 10 results and cap responses at 25 results.

6. When generating AI answers, retrieve only relevant rows and include source labels:
   - `College Scorecard — U.S. Department of Education`
   - `O*NET database — USDOL/ETA`

7. Keep the existing Prelude AI system rules in:
   ```text
   prelude_dataset_kit/knowledge/PRELUDE_SYSTEM_PROMPT.md
   ```

8. Use:
   ```text
   prelude_dataset_kit/knowledge/AGENT_KNOWLEDGE.md
   ```
   as curated baseline guidance. Do not replace this file with raw dataset rows.
