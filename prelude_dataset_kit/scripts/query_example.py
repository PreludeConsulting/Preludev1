#!/usr/bin/env python3
"""Small CLI example for searching the generated Prelude SQLite database."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "db" / "prelude_public_data.sqlite"


def main() -> int:
    if not DB.exists():
        print("Database does not exist yet.")
        print("Run: bash scripts/setup_datasets.sh")
        return 1

    query = " ".join(sys.argv[1:]).strip() or "computer science"
    like = f"%{query}%"

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        print(f"\nCollege matches for: {query!r}")
        colleges = conn.execute(
            """
            SELECT unitid, name, city, state, average_net_price, admission_rate
            FROM colleges
            WHERE name LIKE ? OR city LIKE ? OR state LIKE ?
            ORDER BY name
            LIMIT 8
            """,
            (like, like, like),
        ).fetchall()
        if colleges:
            for row in colleges:
                print(dict(row))
        else:
            print("  No direct college-name/location matches.")

        print(f"\nProgram matches for: {query!r}")
        programs = conn.execute(
            """
            SELECT unitid, institution_name, cip_description, credential_description
            FROM fields_of_study
            WHERE cip_description LIKE ? OR institution_name LIKE ?
            ORDER BY institution_name
            LIMIT 8
            """,
            (like, like),
        ).fetchall()
        if programs:
            for row in programs:
                print(dict(row))
        else:
            print("  No direct program matches.")

        tables = {
            row["name"] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "onet_occupations" in tables:
            print(f"\nCareer matches for: {query!r}")
            careers = conn.execute(
                """
                SELECT *
                FROM onet_occupations
                WHERE title LIKE ? OR description LIKE ?
                ORDER BY title
                LIMIT 8
                """,
                (like, like),
            ).fetchall()
            if careers:
                for row in careers:
                    result = dict(row)
                    print({
                        "code": result.get("o_net_soc_code", ""),
                        "title": result.get("title", ""),
                        "description": result.get("description", ""),
                    })
            else:
                print("  No direct career matches.")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
