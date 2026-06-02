#!/usr/bin/env python3
"""
Download NCES CCD public school directory data and import verified high schools.

Official source: https://nces.ed.gov/ccd/
"""

from __future__ import annotations

import csv
import html
import re
import sqlite3
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
DB_PATH = ROOT / "data" / "db" / "prelude_public_data.sqlite"

NCES_FILES_PAGE = "https://nces.ed.gov/ccd/files.asp"
NCES_SCHOOL_ZIP_FALLBACK = "https://nces.ed.gov/ccd/Data/zip/ccd_sch_029_2324_w_0a_050824.zip"
SOURCE_LABEL = "NCES Common Core of Data — U.S. Department of Education"
USER_AGENT = "Mozilla/5.0 PreludeDatasetKit/1.0"

OUTPUT_COLUMNS = [
    "nces_school_id",
    "school_name",
    "street_address",
    "city",
    "state",
    "zip",
    "phone",
    "district_name",
    "lowest_grade",
    "highest_grade",
    "school_status",
    "source",
]


def request_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode("utf-8", errors="replace")


def request_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as response:
        return response.read()


def discover_school_zip_url() -> str:
    pages = [
        "https://nces.ed.gov/ccd/psu_rev.asp",
        NCES_FILES_PAGE,
    ]
    pattern = re.compile(r"ccd_sch_029_(\d{4})_w_[^\"']+?\.zip", re.I)

    for page_url in pages:
        print(f"Checking NCES page: {page_url}")
        try:
            page = html.unescape(request_text(page_url))
            matches = pattern.findall(page)
            if not matches:
                continue
            latest_year = max(int(year) for year in matches)
            for match in pattern.finditer(page):
                if int(match.group(1)) == latest_year:
                    return f"https://nces.ed.gov/ccd/Data/zip/{match.group(0)}"
        except Exception as exc:
            print(f"  Could not read {page_url} ({exc})")

    print("  Using checked fallback URL.")
    return NCES_SCHOOL_ZIP_FALLBACK


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        print(f"Using existing file: {destination.relative_to(ROOT)}")
        return destination

    print(f"Downloading: {url}")
    destination.write_bytes(request_bytes(url))
    print(f"  Saved {destination.stat().st_size:,} bytes")
    return destination


def first_value(row: Dict[str, str], *candidates: str) -> str:
    for candidate in candidates:
        for key, value in row.items():
            if key.strip().upper() == candidate.upper():
                cleaned = str(value or "").strip()
                if cleaned:
                    return cleaned
        direct = row.get(candidate, "")
        if str(direct).strip():
            return str(direct).strip()
    return ""


def grade_code(value: str) -> Optional[int]:
    text = str(value or "").strip().upper()
    if not text:
        return None
    mapping = {
        "PK": -1,
        "KG": 0,
        "KN": 0,
        "K": 0,
        "01": 1,
        "02": 2,
        "03": 3,
        "04": 4,
        "05": 5,
        "06": 6,
        "07": 7,
        "08": 8,
        "09": 9,
        "10": 10,
        "11": 11,
        "12": 12,
        "13": 13,
        "UG": 14,
    }
    if text in mapping:
        return mapping[text]
    if text.isdigit():
        return int(text)
    return None


def is_public_high_school(row: Dict[str, str]) -> bool:
    status = first_value(row, "SY_STATUS", "SY_STATUS_TEXT", "STATUS").lower()
    if status and status not in {"1", "open", "active"}:
        return False

    low = grade_code(first_value(row, "GSLO", "LOW_GRADE", "LOWGRADE"))
    high = grade_code(first_value(row, "GSHI", "HIGH_GRADE", "HIGHGRADE"))

    if low is not None and high is not None:
        return high >= 12 and low <= 12 and low >= 7

    offered = []
    for grade in ("09", "10", "11", "12"):
        value = first_value(row, f"G_{grade}_OFFERED", f"G{grade}_OFFERED")
        if value in {"1", "Yes", "YES", "Y"}:
            offered.append(grade)
    return len(offered) >= 2


def normalize_row(row: Dict[str, str]) -> Dict[str, str]:
    street = first_value(row, "LSTREET1", "STREET", "MAILSTREET1", "MSTREET1")
    street2 = first_value(row, "LSTREET2", "MAILSTREET2", "MSTREET2")
    if street2:
        street = f"{street}, {street2}".strip(", ")

    return {
        "nces_school_id": first_value(row, "NCESSCH", "NCESID", "SCHID", "SCHOOLID"),
        "school_name": first_value(row, "SCH_NAME", "SCHNAM", "SCHOOL_NAME"),
        "street_address": street,
        "city": first_value(row, "LCITY", "MCITY", "CITY"),
        "state": first_value(row, "LSTATE", "MSTATE", "STATE", "ST"),
        "zip": first_value(row, "LZIP", "MZIP", "ZIP"),
        "phone": first_value(row, "PHONE", "SCH_PHONE"),
        "district_name": first_value(row, "LEA_NAME", "DISTRICT", "LEANM"),
        "lowest_grade": first_value(row, "GSLO", "LOW_GRADE", "LOWGRADE"),
        "highest_grade": first_value(row, "GSHI", "HIGH_GRADE", "HIGHGRADE"),
        "school_status": first_value(row, "SY_STATUS_TEXT", "SY_STATUS", "STATUS"),
        "source": SOURCE_LABEL,
    }


def find_csv_in_zip(zip_path: Path, extract_dir: Path) -> Path:
    if extract_dir.exists():
        for path in extract_dir.rglob("*.csv"):
            if "sch" in path.name.lower():
                return path
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract_dir)
    for path in extract_dir.rglob("*.csv"):
        if "sch" in path.name.lower():
            return path
    csv_files = list(extract_dir.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV found in {zip_path}")
    return csv_files[0]


def prepare_csv(source_csv: Path) -> Path:
    output = PROCESSED / "public_high_schools.csv"
    count = 0

    with source_csv.open("r", newline="", encoding="utf-8-sig", errors="replace") as src, output.open(
        "w", newline="", encoding="utf-8"
    ) as dest:
        reader = csv.DictReader(src)
        writer = csv.DictWriter(dest, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()

        for row in reader:
            if not is_public_high_school(row):
                continue
            normalized = normalize_row(row)
            if not normalized["school_name"] or not normalized["nces_school_id"]:
                continue
            writer.writerow(normalized)
            count += 1

    print(f"  Wrote {count:,} high schools -> {output.relative_to(ROOT)}")
    return output


def import_to_sqlite(csv_path: Path) -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Run scripts/download_and_prepare.py first."
        )

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute('DROP TABLE IF EXISTS "public_high_schools"')
        conn.execute(
            """
            CREATE TABLE public_high_schools (
              nces_school_id TEXT,
              school_name TEXT,
              street_address TEXT,
              city TEXT,
              state TEXT,
              zip TEXT,
              phone TEXT,
              district_name TEXT,
              lowest_grade TEXT,
              highest_grade TEXT,
              school_status TEXT,
              source TEXT
            )
            """
        )

        with csv_path.open("r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            batch: List[List[str]] = []
            insert_sql = f'INSERT INTO public_high_schools VALUES ({", ".join("?" for _ in OUTPUT_COLUMNS)})'
            for row in reader:
                batch.append([row[column] for column in OUTPUT_COLUMNS])
                if len(batch) >= 2000:
                    conn.executemany(insert_sql, batch)
                    batch.clear()
            if batch:
                conn.executemany(insert_sql, batch)

        for statement in [
            "CREATE INDEX IF NOT EXISTS idx_hs_name ON public_high_schools(school_name)",
            "CREATE INDEX IF NOT EXISTS idx_hs_state ON public_high_schools(state)",
            "CREATE INDEX IF NOT EXISTS idx_hs_city ON public_high_schools(city)",
            "CREATE INDEX IF NOT EXISTS idx_hs_zip ON public_high_schools(zip)",
            "CREATE INDEX IF NOT EXISTS idx_hs_nces_id ON public_high_schools(nces_school_id)",
        ]:
            conn.execute(statement)

        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM public_high_schools").fetchone()[0]
        print(f"  Imported {total:,} rows into public_high_schools")
    finally:
        conn.close()


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)

    zip_url = discover_school_zip_url()
    zip_path = download(zip_url, RAW / "nces_ccd_school_directory.zip")
    source_csv = find_csv_in_zip(zip_path, RAW / "nces_ccd_school_directory")
    processed_csv = prepare_csv(source_csv)
    import_to_sqlite(processed_csv)

    print("\nDone.")
    print(f"Processed CSV: {processed_csv.relative_to(ROOT)}")
    print(f"Database: {DB_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
