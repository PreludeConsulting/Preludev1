#!/usr/bin/env python3
"""
Download and prepare public College Scorecard and O*NET datasets for Prelude.

Uses only the Python standard library.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
import shutil
import sqlite3
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
DB_DIR = ROOT / "data" / "db"
RAG_DIR = ROOT / "data" / "rag"
MANIFEST = ROOT / "config" / "datasets_manifest.json"

USER_AGENT = "Mozilla/5.0 PreludeDatasetKit/1.0"

SCORECARD_PAGE = "https://collegescorecard.ed.gov/data/"
ONET_PAGE = "https://www.onetcenter.org/database.html"

SCORECARD_INST_FALLBACK = (
    "https://ed-public-download.scorecard.network/downloads/"
    "Most-Recent-Cohorts-Institution_03232026.zip"
)
SCORECARD_FOS_FALLBACK = (
    "https://ed-public-download.scorecard.network/downloads/"
    "Most-Recent-Cohorts-Field-of-Study_03232026.zip"
)
ONET_TEXT_FALLBACK = "https://www.onetcenter.org/dl_files/database/db_30_3_text.zip"

SOURCE_SCORECARD = "College Scorecard — U.S. Department of Education"
SOURCE_ONET = "O*NET database — U.S. Department of Labor, Employment and Training Administration"


def request_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def request_text(url: str) -> str:
    return request_bytes(url).decode("utf-8", errors="replace")


def discover_url(page_url: str, pattern: str, fallback: str) -> str:
    print(f"Checking official page for current download URL: {page_url}")
    try:
        page = html.unescape(request_text(page_url))
        match = re.search(pattern, page)
        if match:
            return match.group(0)
    except Exception as exc:
        print(f"  Could not auto-discover URL ({exc}). Using checked fallback.")
    return fallback


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        print(f"Using existing file: {destination.relative_to(ROOT)}")
        return destination

    print(f"Downloading: {url}")
    data = request_bytes(url)
    destination.write_bytes(data)
    print(f"  Saved {destination.relative_to(ROOT)} ({destination.stat().st_size:,} bytes)")
    return destination


def extract_zip(zip_path: Path, target: Path) -> None:
    marker = target / ".extracted"
    if marker.exists():
        print(f"Using extracted folder: {target.relative_to(ROOT)}")
        return

    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)

    print(f"Extracting: {zip_path.relative_to(ROOT)}")
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(target)
    marker.write_text("ok\n", encoding="utf-8")


def find_file(folder: Path, candidates: Sequence[str], suffix: Optional[str] = None) -> Path:
    all_files = [p for p in folder.rglob("*") if p.is_file() and p.name != ".extracted"]
    lowered = {p.name.lower(): p for p in all_files}

    for candidate in candidates:
        found = lowered.get(candidate.lower())
        if found:
            return found

    for p in all_files:
        name = p.name.lower()
        if any(candidate.lower() in name for candidate in candidates):
            if suffix is None or name.endswith(suffix.lower()):
                return p

    raise FileNotFoundError(f"Could not find any of {candidates} inside {folder}")


def first_value(row: Dict[str, str], *candidates: str) -> str:
    for candidate in candidates:
        value = row.get(candidate, "")
        if value not in ("", None, "NULL", "PrivacySuppressed"):
            return str(value)
    return ""


def write_dict_rows(path: Path, fieldnames: Sequence[str], rows: Iterable[Dict[str, str]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})
            count += 1
    print(f"  Wrote {count:,} rows -> {path.relative_to(ROOT)}")
    return count


def prepare_colleges(csv_path: Path) -> Path:
    output = PROCESSED / "colleges.csv"
    fields = [
        "unitid", "name", "city", "state", "zip", "website",
        "ownership_code", "highest_degree_code", "admission_rate",
        "sat_average", "undergrad_size", "tuition_in_state",
        "tuition_out_of_state", "average_net_price", "completion_rate_4yr",
        "pell_share", "retention_rate_full_time", "median_debt",
        "median_earnings_10yr", "latitude", "longitude", "source"
    ]

    def rows():
        with csv_path.open("r", newline="", encoding="utf-8-sig", errors="replace") as file:
            reader = csv.DictReader(file)
            for raw in reader:
                control = first_value(raw, "CONTROL")
                avg_net_price = ""
                if control == "1":
                    avg_net_price = first_value(raw, "NPT4_PUB")
                elif control in ("2", "3"):
                    avg_net_price = first_value(raw, "NPT4_PRIV")
                if not avg_net_price:
                    avg_net_price = first_value(raw, "NPT4_PUB", "NPT4_PRIV")

                yield {
                    "unitid": first_value(raw, "UNITID"),
                    "name": first_value(raw, "INSTNM"),
                    "city": first_value(raw, "CITY"),
                    "state": first_value(raw, "STABBR"),
                    "zip": first_value(raw, "ZIP"),
                    "website": first_value(raw, "INSTURL"),
                    "ownership_code": control,
                    "highest_degree_code": first_value(raw, "HIGHDEG", "PREDDEG"),
                    "admission_rate": first_value(raw, "ADM_RATE"),
                    "sat_average": first_value(raw, "SAT_AVG"),
                    "undergrad_size": first_value(raw, "UGDS"),
                    "tuition_in_state": first_value(raw, "TUITIONFEE_IN"),
                    "tuition_out_of_state": first_value(raw, "TUITIONFEE_OUT"),
                    "average_net_price": avg_net_price,
                    "completion_rate_4yr": first_value(raw, "C150_4"),
                    "pell_share": first_value(raw, "PCTPELL"),
                    "retention_rate_full_time": first_value(raw, "RET_FT4"),
                    "median_debt": first_value(raw, "DEBT_MDN"),
                    "median_earnings_10yr": first_value(raw, "MD_EARN_WNE_P10"),
                    "latitude": first_value(raw, "LATITUDE"),
                    "longitude": first_value(raw, "LONGITUDE"),
                    "source": SOURCE_SCORECARD,
                }

    write_dict_rows(output, fields, rows())
    return output


def prepare_fields_of_study(csv_path: Path) -> Path:
    output = PROCESSED / "fields_of_study.csv"
    fields = [
        "unitid", "institution_name", "cip_code", "cip_description",
        "credential_level", "credential_description", "median_earnings_1yr",
        "median_debt", "source"
    ]

    def rows():
        with csv_path.open("r", newline="", encoding="utf-8-sig", errors="replace") as file:
            reader = csv.DictReader(file)
            for raw in reader:
                yield {
                    "unitid": first_value(raw, "UNITID"),
                    "institution_name": first_value(raw, "INSTNM"),
                    "cip_code": first_value(raw, "CIPCODE"),
                    "cip_description": first_value(raw, "CIPDESC"),
                    "credential_level": first_value(raw, "CREDLEV"),
                    "credential_description": first_value(raw, "CREDDESC"),
                    "median_earnings_1yr": first_value(
                        raw,
                        "EARN_MDN_HI_1YR",
                        "EARN_MDN_1YR",
                        "MD_EARN_WNE_1YR",
                    ),
                    "median_debt": first_value(
                        raw,
                        "DEBT_ALL_STGP_ANY_MDN",
                        "DEBT_ALL_STGP_EVAL_MDN",
                        "DEBT_MDN",
                    ),
                    "source": SOURCE_SCORECARD,
                }

    write_dict_rows(output, fields, rows())
    return output


def convert_tab_file(source: Path, destination: Path) -> Path:
    with source.open("r", newline="", encoding="utf-8-sig", errors="replace") as input_file:
        reader = csv.reader(input_file, delimiter="\t")
        with destination.open("w", newline="", encoding="utf-8") as output_file:
            writer = csv.writer(output_file)
            for row in reader:
                writer.writerow(row)
    print(f"  Converted -> {destination.relative_to(ROOT)}")
    return destination


def prepare_onet(extracted: Path) -> List[Path]:
    mappings: List[Tuple[Sequence[str], str]] = [
        (("Occupation Data.txt", "Occupation Data"), "onet_occupations.csv"),
        (("Essential Skills.txt", "Essential Skills"), "onet_essential_skills.csv"),
        (("Transferable Skills.txt", "Transferable Skills"), "onet_transferable_skills.csv"),
        (("Job Zones.txt", "Job Zones"), "onet_job_zones.csv"),
        (("Task Statements.txt", "Task Statements"), "onet_task_statements.csv"),
        (("Related Occupations.txt", "Related Occupations"), "onet_related_occupations.csv"),
        (("Software Skills.txt", "Software Skills"), "onet_software_skills.csv"),
    ]

    outputs: List[Path] = []
    for candidates, output_name in mappings:
        try:
            source = find_file(extracted, candidates, suffix=".txt")
        except FileNotFoundError:
            print(f"  Optional O*NET file not found: {candidates[0]}")
            continue
        destination = PROCESSED / output_name
        outputs.append(convert_tab_file(source, destination))
    return outputs


def sqlite_safe_name(name: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_]+", "_", name).strip("_").lower()
    if not name:
        name = "column"
    if name[0].isdigit():
        name = "c_" + name
    return name


def import_csv_table(conn: sqlite3.Connection, table_name: str, csv_path: Path) -> None:
    with csv_path.open("r", newline="", encoding="utf-8-sig", errors="replace") as file:
        reader = csv.reader(file)
        raw_headers = next(reader)
        headers: List[str] = []
        seen: Dict[str, int] = {}
        for raw in raw_headers:
            key = sqlite_safe_name(raw)
            seen[key] = seen.get(key, 0) + 1
            if seen[key] > 1:
                key = f"{key}_{seen[key]}"
            headers.append(key)

        conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        column_sql = ", ".join(f'"{header}" TEXT' for header in headers)
        conn.execute(f'CREATE TABLE "{table_name}" ({column_sql})')

        placeholders = ", ".join("?" for _ in headers)
        insert_sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
        batch: List[List[str]] = []

        for row in reader:
            if len(row) < len(headers):
                row += [""] * (len(headers) - len(row))
            elif len(row) > len(headers):
                row = row[:len(headers)]
            batch.append(row)
            if len(batch) >= 2000:
                conn.executemany(insert_sql, batch)
                batch.clear()
        if batch:
            conn.executemany(insert_sql, batch)

        conn.commit()


def build_database(csv_files: Sequence[Path]) -> Path:
    db_path = DB_DIR / "prelude_public_data.sqlite"
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    try:
        for csv_path in csv_files:
            table = csv_path.stem
            print(f"Importing table: {table}")
            import_csv_table(conn, table, csv_path)

        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(name)',
            'CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state)',
            'CREATE INDEX IF NOT EXISTS idx_fields_name ON fields_of_study(institution_name)',
            'CREATE INDEX IF NOT EXISTS idx_fields_cipdesc ON fields_of_study(cip_description)',
        ]
        for statement in indexes:
            try:
                conn.execute(statement)
            except sqlite3.OperationalError:
                pass

        # O*NET column names are normalized at import time.
        for statement in [
            'CREATE INDEX IF NOT EXISTS idx_onet_occupations_title ON onet_occupations(title)',
            'CREATE INDEX IF NOT EXISTS idx_onet_occupations_code ON onet_occupations(o_net_soc_code)',
        ]:
            try:
                conn.execute(statement)
            except sqlite3.OperationalError:
                pass

        conn.commit()
    finally:
        conn.close()

    print(f"  Built database -> {db_path.relative_to(ROOT)}")
    return db_path


def make_rag_documents(colleges_csv: Path, occupations_csv: Optional[Path]) -> Path:
    output = RAG_DIR / "prelude_rag_documents.jsonl"
    count = 0

    with output.open("w", encoding="utf-8") as out:
        with colleges_csv.open("r", newline="", encoding="utf-8") as file:
            for row in csv.DictReader(file):
                name = row.get("name", "")
                city = row.get("city", "")
                state = row.get("state", "")
                text = (
                    f"{name} is a college located in {city}, {state}. "
                    f"Undergraduate size: {row.get('undergrad_size', '')}. "
                    f"Admission rate: {row.get('admission_rate', '')}. "
                    f"Average net price: {row.get('average_net_price', '')}. "
                    f"In-state tuition: {row.get('tuition_in_state', '')}. "
                    f"Out-of-state tuition: {row.get('tuition_out_of_state', '')}. "
                    f"Four-year completion rate: {row.get('completion_rate_4yr', '')}."
                )
                document = {
                    "id": f"college:{row.get('unitid', '')}",
                    "type": "college",
                    "title": name,
                    "text": text,
                    "metadata": row,
                    "source": SOURCE_SCORECARD,
                }
                out.write(json.dumps(document, ensure_ascii=False) + "\n")
                count += 1

        if occupations_csv and occupations_csv.exists():
            with occupations_csv.open("r", newline="", encoding="utf-8-sig", errors="replace") as file:
                for row in csv.DictReader(file):
                    code = row.get("O*NET-SOC Code") or row.get("O_NET_SOC_Code") or row.get("O*NET-SOC Code ", "")
                    title = row.get("Title", "")
                    description = row.get("Description", "")
                    document = {
                        "id": f"occupation:{code}",
                        "type": "occupation",
                        "title": title,
                        "text": f"{title}. {description}",
                        "metadata": row,
                        "source": SOURCE_ONET,
                    }
                    out.write(json.dumps(document, ensure_ascii=False) + "\n")
                    count += 1

    print(f"  Wrote {count:,} RAG documents -> {output.relative_to(ROOT)}")
    return output


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    DB_DIR.mkdir(parents=True, exist_ok=True)
    RAG_DIR.mkdir(parents=True, exist_ok=True)

    inst_url = discover_url(
        SCORECARD_PAGE,
        r"https://ed-public-download\.scorecard\.network/downloads/Most-Recent-Cohorts-Institution_[0-9]+\.zip",
        SCORECARD_INST_FALLBACK,
    )
    fos_url = discover_url(
        SCORECARD_PAGE,
        r"https://ed-public-download\.scorecard\.network/downloads/Most-Recent-Cohorts-Field-of-Study_[0-9]+\.zip",
        SCORECARD_FOS_FALLBACK,
    )
    onet_url = discover_url(
        ONET_PAGE,
        r"https://www\.onetcenter\.org/dl_files/database/db_[0-9_]+_text\.zip",
        ONET_TEXT_FALLBACK,
    )

    inst_zip = download(inst_url, RAW / "scorecard_institution_latest.zip")
    fos_zip = download(fos_url, RAW / "scorecard_field_of_study_latest.zip")
    onet_zip = download(onet_url, RAW / "onet_text_latest.zip")

    inst_extract = RAW / "scorecard_institution"
    fos_extract = RAW / "scorecard_field_of_study"
    onet_extract = RAW / "onet"

    extract_zip(inst_zip, inst_extract)
    extract_zip(fos_zip, fos_extract)
    extract_zip(onet_zip, onet_extract)

    inst_csv = find_file(inst_extract, ("Most-Recent-Cohorts-Institution.csv", "Institution"), suffix=".csv")
    fos_csv = find_file(fos_extract, ("Most-Recent-Cohorts-Field-of-Study.csv", "Field-of-Study"), suffix=".csv")

    colleges_csv = prepare_colleges(inst_csv)
    fields_csv = prepare_fields_of_study(fos_csv)
    onet_csvs = prepare_onet(onet_extract)

    csvs = [colleges_csv, fields_csv] + onet_csvs
    build_database(csvs)

    occupations_csv = next((p for p in onet_csvs if p.name == "onet_occupations.csv"), None)
    make_rag_documents(colleges_csv, occupations_csv)

    print("\nDone.")
    print("Database: data/db/prelude_public_data.sqlite")
    print("RAG file:  data/rag/prelude_rag_documents.jsonl")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
