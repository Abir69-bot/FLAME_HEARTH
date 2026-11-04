"""Record facts about the raw NASA files for the /dataset page: size, checksum, pages, rows, columns.

Run from the repo root (-I because this folder holds inspect.py, which shadows the stdlib module):
    python -I scripts/ingest/describe_sources.py
Reads Pseudo_DataKeep/ and data/processed/ only; writes data/processed/sources.json.
"""
import csv
import hashlib
import io
import json
from pathlib import Path

import pymupdf

RAW = Path("Pseudo_DataKeep")
OUT = Path("data/processed")
KINDS = {"Experimental_Table.csv": "table", "Report.pdf": "report", "Engineering_Doc.pdf": "engineering"}


def describe(path: Path, investigation: str, kind: str) -> dict:
    data = path.read_bytes()
    entry = {
        "investigation": investigation,
        "kind": kind,
        "file": path.as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    if path.suffix == ".pdf":
        with pymupdf.open(path) as doc:
            entry["pages"] = doc.page_count
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("latin-1")
        rows = list(csv.reader(io.StringIO(text)))
        body = rows[1:]
        filled = [r for r in body if any(c.strip() for c in r)]
        entry["columns"] = [c.strip() for c in rows[0]]
        entry["rows"] = len(filled)
        entry["blank_rows"] = len(body) - len(filled)
    return entry


def main() -> None:
    raw = []
    for inv in ("ACME", "CFI", "SPICE"):
        for suffix, kind in KINDS.items():
            raw.append(describe(RAW / inv / f"{inv}_{suffix}", inv, kind))
    processed = [
        {"file": (OUT / name).as_posix(), "bytes": (OUT / name).stat().st_size}
        for name in ("tests.json", "chunks.json", "pdf_tables.json", "ingest_report.md")
    ]
    (OUT / "sources.json").write_text(json.dumps({"raw": raw, "processed": processed}, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT / 'sources.json'}: {len(raw)} raw files")


if __name__ == "__main__":
    main()
