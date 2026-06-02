# Prelude Dataset Kit

This folder is designed to be copied directly into your Prelude repository and opened in Cursor.

It downloads and prepares official public datasets for:

- college search and school comparison
- cost and affordability context
- major and program exploration
- career and occupation exploration
- retrieval-augmented generation (RAG)

The package does **not** train a new AI model. It creates structured files and a SQLite database that your application can query and retrieve from.

## Data sources

1. **College Scorecard — institution-level data**
   - Official source: U.S. Department of Education
   - Output: `data/processed/colleges.csv`

2. **College Scorecard — field-of-study data**
   - Official source: U.S. Department of Education
   - Output: `data/processed/fields_of_study.csv`

3. **O*NET database**
   - Official source: U.S. Department of Labor, Employment and Training Administration
   - Output: occupation, skills, task, and career-related CSV files

4. **IPEDS**
   - Not downloaded automatically.
   - Add it later only when you need additional variables not already covered by College Scorecard.
   - IPEDS complete files are chosen by survey and year through the official NCES interface.

## Run this in Cursor on your MacBook

Copy this folder into your repository. Then open Cursor's Terminal and run:

```bash
cd prelude_dataset_kit
bash scripts/setup_datasets.sh
```

The downloader uses only Python's standard library, so you do not need to install Python packages.

## Files created after setup

```text
data/
  raw/                     # official downloaded ZIP archives and extracted files
  processed/
    colleges.csv
    fields_of_study.csv
    onet_occupations.csv
    onet_essential_skills.csv
    onet_transferable_skills.csv
    onet_job_zones.csv
    onet_task_statements.csv
    onet_related_occupations.csv
    onet_software_skills.csv
  db/
    prelude_public_data.sqlite
  rag/
    prelude_rag_documents.jsonl
```

## Test the generated SQLite database

```bash
python3 scripts/query_example.py
```

You can also search for a specific topic:

```bash
python3 scripts/query_example.py "computer science"
python3 scripts/query_example.py "software developer"
python3 scripts/query_example.py "Georgia"
```

## Important implementation note

Do not load the full CSV files into the browser. Query the SQLite database from a backend or import the files into a hosted database such as PostgreSQL or Supabase.

Use retrieval:

```text
user question
  -> backend searches relevant rows
  -> backend sends a small result set to the AI
  -> AI summarizes the result and cites the official source
```

## Included Prelude knowledge files

The `knowledge/` folder includes:

- `PRELUDE_SYSTEM_PROMPT.md`
- `AGENT_KNOWLEDGE.md`

Keep these as curated behavioral and factual guidance. Use the dataset database separately for school and career lookup.

## O*NET attribution

This package prepares files derived from the O*NET database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. This package modifies the original files by converting selected tab-delimited files into CSV files and building a SQLite database.
