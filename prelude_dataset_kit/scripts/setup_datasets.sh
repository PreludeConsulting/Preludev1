#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Preparing Prelude public datasets..."
python3 scripts/download_and_prepare.py

echo
echo "Preparing verified public high schools (NCES CCD)..."
python3 scripts/prepare_public_high_schools.py

echo
echo "Running a quick database check..."
python3 scripts/query_example.py "computer science"

echo
echo "Finished. Read README.md and CURSOR_SETUP_PROMPT.md for integration steps."
