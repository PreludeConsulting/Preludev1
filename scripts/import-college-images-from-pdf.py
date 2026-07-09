#!/usr/bin/env python3
"""Import college campus card images from a PDF into public/media/campuses/."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

try:
    import fitz
except ImportError as exc:
    raise SystemExit("Install PyMuPDF first: pip3 install pymupdf") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "media" / "campuses"
DEFAULT_PDF = Path.home() / "Downloads" / "College _ Images.pdf"


def load_college_ids() -> list[str]:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", "import { EXPLORE_COLLEGES } from './src/dashboard/data/collegeExploreData.js'; console.log(JSON.stringify(EXPLORE_COLLEGES.map((c) => c.id)));"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout.strip())


def extract_images(pdf_path: Path, college_ids: list[str]) -> int:
    doc = fitz.open(pdf_path)
    images: list[int] = []
    for page_index in range(doc.page_count):
        for image in doc[page_index].get_images(full=True):
            images.append(image[0])

    if len(images) != len(college_ids):
        raise SystemExit(f"Expected {len(college_ids)} images, found {len(images)} in {pdf_path}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, xref in enumerate(images):
        college_id = college_ids[index]
        pixmap = fitz.Pixmap(doc, xref)
        if pixmap.n - pixmap.alpha > 3:
            pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
        pixmap.save(str(OUT_DIR / f"{college_id}.jpg"), jpg_quality=90)

    doc.close()
    return len(college_ids)


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    college_ids = load_college_ids()
    count = extract_images(pdf_path, college_ids)
    print(f"Imported {count} campus images into {OUT_DIR}")


if __name__ == "__main__":
    main()
