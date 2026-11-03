"""HEARTH data prep: raw NASA files (read-only) -> data/processed/.

Writes
  data/processed/tests.json        one clean record per test (model in CLAUDE.md + `flags`, `extra`)
  data/processed/chunks.json       page-aware PDF text chunks (~800 chars, 100 overlap)
  data/processed/pdf_tables.json   tables found by pdfplumber
  data/processed/ingest_report.md  rows, empty rates, ranges, failed checks

Every mapping decision is documented in docs/DATA_NOTES.md.
Usage: python scripts/ingest/ingest.py
"""
from __future__ import annotations

import os
import sys

# scripts/ingest/inspect.py shadows the stdlib "inspect" module (numpy imports it),
# so this folder must not be on the import path.
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:] = [p for p in sys.path if os.path.abspath(p or os.getcwd()) != _HERE]

import json  # noqa: E402
import math  # noqa: E402
import re  # noqa: E402
from pathlib import Path  # noqa: E402
from typing import Any  # noqa: E402

import pandas as pd  # noqa: E402

ROOT = Path(_HERE).parents[1]
RAW = ROOT / "Pseudo_DataKeep"
OUT = ROOT / "data" / "processed"

BAR_TO_PSI = 14.5038
ATM_TO_PSI = 14.6959
KPA_TO_PSI = 0.145038

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


# ---------------------------------------------------------------- helpers
def num(v: Any) -> float | None:
    """Parse a number; '-', '', NaN and text -> None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and math.isnan(v)) else float(v)
    s = str(v).strip()
    if s in {"", "-", "nan", "NaN"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def text(v: Any) -> str | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = re.sub(r"\s+", " ", str(v)).strip()
    return s or None


def rnd(v: float | None, nd: int = 4) -> float | None:
    return None if v is None else round(v, nd)


def frac_to_pct(v: float | None) -> float | None:
    return None if v is None else round(v * 100, 3)


def parse_atm(v: Any) -> float | None:
    m = re.search(r"([\d.]+)\s*atm", str(v or ""), re.I)
    return float(m.group(1)) if m else None


def read_csv(inv: str) -> pd.DataFrame:
    path = RAW / inv / f"{inv}_Experimental_Table.csv"
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df.columns = [re.sub(r"\s+", " ", c).strip() for c in df.columns]
    # spreadsheet row number of each record (header = row 1)
    df["__row"] = range(2, len(df) + 2)
    blank = df.drop(columns="__row").apply(lambda r: all(str(x).strip() == "" for x in r), axis=1)
    return df[~blank].reset_index(drop=True)


def base_record(**kw: Any) -> dict[str, Any]:
    rec = {
        "test_id": None, "investigation": None, "campaign": None, "hardware": None, "fuel": None,
        "fuel_phase": None, "geometry": None, "size_mm": None, "o2_pct": None, "pressure_psi": None,
        "diluent": None, "flow_cm_s": None, "gravity": "ug", "measurements": [], "sensors": [],
        "outcome": None, "key_metric_name": None, "key_metric_value": None, "source_file": None,
        "source_row": None, "notes": "", "flags": [], "extra": {},
    }
    rec.update(kw)
    return rec


def mark_duplicates(records: list[dict[str, Any]], raw_keys: list[tuple]) -> None:
    seen: dict[tuple, dict[str, Any]] = {}
    for rec, key in zip(records, raw_keys):
        if key in seen:
            first = seen[key]
            rec["flags"].append("duplicate_row")
            rec["notes"] = (rec["notes"] + f" Exact duplicate of {first['test_id']} (row {first['source_row']}).").strip()
        else:
            seen[key] = rec


# ---------------------------------------------------------------- ACME (CFI-G)
def acme_fuel(raw: str) -> str:
    s = raw.strip().lower()
    m = re.match(r"(\d+)\s*%\s*(\w+)", s)
    name = {"butane": "n-butane"}.get(m.group(2) if m else s, m.group(2) if m else s)
    return f"{name} ({m.group(1)}% in N2)" if m else name


def adapt_acme() -> list[dict[str, Any]]:
    df = read_csv("ACME")
    cols = [c for c in df.columns if c != "__row"]
    out, keys = [], []
    for i, r in df.iterrows():
        v = [r[c] for c in cols]
        flame = text(v[0]).lower()
        inverse = flame == "inverse"
        extra: dict[str, Any] = {"test_label": text(v[3]), "day": num(v[1])}
        flags: list[str] = []
        notes: list[str] = []
        if inverse:
            # shifted layout, see DATA_NOTES.md
            flags.append("layout_shifted")
            o2 = frac_to_pct(num(v[7]))
            p_bar = num(v[6])
            extra.update({
                "chamber_fuel_fraction_before": num(v[4]),
                "chamber_fuel_fraction_after": num(v[5]),
                "pressure_bar": p_bar,
                "oxidizer_o2_fraction": num(v[7]),
                "flow_value_a_unlabelled": num(v[8]),
                "flow_value_b_unlabelled": num(v[9]),
            })
            cool = None
            notes.append("Inverse flame: N2+fuel chamber, O2/N2 from the burner; o2_pct is the oxidizer-stream O2. Row read with the shifted inverse layout.")
        else:
            o2 = frac_to_pct(num(v[5]))
            p_bar = num(v[7])
            extra.update({
                "xo2_before": num(v[5]),
                "xo2_after": num(v[6]),
                "pressure_bar": p_bar,
                "xf_fuel_fraction": num(v[8]),
                "fuel_flow_mg_s": num(v[9]),
            })
            cool = text(v[4])
        extra.update({"tad_k": num(v[11]), "zst": num(v[12]), "peak_burner_t_c": num(v[16])})
        tfp = (text(v[10]) or "").lower() == "yes"
        hot = (text(v[13]) or "").lower() or None
        burn = num(v[14])
        end = {"se": "self-extinguished", "ft": "flow terminated"}.get((text(v[15]) or "").lower())
        parts = []
        if hot:
            parts.append(f"hot ignition: {hot}")
        if cool:
            parts.append(f"cool flame: {cool}")
        if end:
            parts.append(f"ended: {end}")
        comment = text(v[17])
        if comment:
            notes.append(f"Comment: {comment.rstrip('.')}.")
        sensors = ["burner thermocouple", "radiometers", "cameras"]
        if tfp:
            sensors.append("thin-filament pyrometry (SiC fibres)")
        rec = base_record(
            investigation="ACME", campaign="CFI-G",
            hardware="CIR / ACME chamber, porous spherical burner",
            fuel=acme_fuel(text(v[2]) or ""), fuel_phase="gas",
            geometry=f"spherical diffusion flame, {'inverse' if inverse else 'normal'}",
            size_mm=6.35, o2_pct=o2, pressure_psi=rnd(p_bar * BAR_TO_PSI if p_bar is not None else None, 3),
            diluent="N2", flow_cm_s=None,
            measurements=["burn time", "ignition outcome", "extinction mode", "peak burner temperature", "cool-flame occurrence"],
            sensors=sensors, outcome="; ".join(parts) or None,
            key_metric_name="burn_time_s", key_metric_value=burn,
            source_file="Pseudo_DataKeep/ACME/ACME_Experimental_Table.csv", source_row=int(r["__row"]),
            notes=" ".join(notes + ["Burner diameter 6.35 mm from ACME_Report p8."]), flags=flags, extra=extra,
        )
        out.append(rec)
        keys.append(tuple(v))
    for n, rec in enumerate(out, 1):
        rec["test_id"] = f"ACME-CFIG-{n:03d}"
    mark_duplicates(out, keys)
    return out


# ---------------------------------------------------------------- CFI
def cfi_fuel(raw: str) -> tuple[str, str]:
    s = re.sub(r"\s+", " ", raw).strip()
    m = re.match(r"\[\.(\d+)\]/\[\.(\d+)\]\s*C12H26/iso-dodecane", s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return f"n-dodecane/iso-dodecane {a}/{b}", "n-dodecane/iso-dodecane"
    if s == "C12H26":
        return "n-dodecane", "n-dodecane"
    return s, s


def adapt_cfi() -> list[dict[str, Any]]:
    df = read_csv("CFI")
    out, keys = [], []
    for _, r in df.iterrows():
        flex = int(num(r["Flex Number"]))
        atm = parse_atm(r["Pressure"])
        o2f, n2, he = num(r["Oxygen"]), num(r["Nitrogen"]), num(r["Helium"])
        fiber = (text(r["Fiber"]) or "").lower()
        geometry = {
            "yes": "fiber-supported droplet (40 µm SiC)",
            "no": "free-floating droplet",
        }.get(fiber, "droplet (support not recorded)")
        dil = "N2" if not he else f"N2 {round(n2 * 100)}% + He {round(he * 100)}%"
        fuel, campaign = cfi_fuel(r["Fuel"])
        notes = [f"FLEX {flex}, CIR run {text(r['CIR'])}, {text(r['Test Date'])} {text(r['Local Time'])}.",
                 "Target initial droplet size about 4 mm (CFI_Report p6), not measured per row."]
        total = sum(x or 0 for x in (o2f, n2, he))
        if abs(total - 1) > 0.015:
            notes.append(f"Gas fractions sum to {total:.2f}, not 1.00.")
        rec = base_record(
            test_id=f"CFI-FLEX-{flex}", investigation="CFI", campaign=campaign,
            hardware="CIR / MDCA droplet apparatus", fuel=fuel, fuel_phase="liquid", geometry=geometry,
            size_mm=None, o2_pct=frac_to_pct(o2f), pressure_psi=rnd(atm * ATM_TO_PSI if atm is not None else None, 3),
            diluent=dil, flow_cm_s=None,
            measurements=["hot-flame burning", "radiative extinction", "cool-flame burning", "extinction diameter"],
            sensors=["color camera", "UV OH* camera", "backlit droplet camera", "chamber pressure & temperature"],
            outcome=None, key_metric_name=None, key_metric_value=None,
            source_file="Pseudo_DataKeep/CFI/CFI_Experimental_Table.csv", source_row=int(r["__row"]),
            notes=" ".join(notes), flags=[],
            extra={"flex_number": flex, "cir_run": text(r["CIR"]), "pressure_atm": atm, "n2_fraction": n2,
                   "he_fraction": he, "fiber": text(r["Fiber"]), "test_date": text(r["Test Date"])},
        )
        out.append(rec)
        keys.append(tuple(str(r[c]).strip() for c in df.columns if c != "__row"))
    mark_duplicates(out, keys)
    seen: set[str] = set()
    for rec in out:  # keep ids unique and stable
        if rec["test_id"] in seen:
            rec["test_id"] += "-DUP"
        seen.add(rec["test_id"])
    return out


# ---------------------------------------------------------------- SPICE
def spice_fuel(raw: str) -> str:
    s = re.sub(r"\s+", " ", raw).strip()
    m = re.match(r"(\d+)\s*%\s*(\w+)", s)
    return f"{m.group(2).lower()} ({m.group(1)}% in N2)" if m else s.lower()


def adapt_spice() -> list[dict[str, Any]]:
    df = read_csv("SPICE")
    out, keys = [], []
    for n, (_, r) in enumerate(df.iterrows(), 1):
        air = num(r["Air Rate (cm/s)"])
        rec = base_record(
            test_id=f"SPICE-{n:03d}", investigation="SPICE", campaign="SPICE (MSG 2009)",
            hardware="MSG / SPICE flow duct, round-jet nozzle", fuel=spice_fuel(r["Fuel"]), fuel_phase="gas",
            geometry="round-jet coflow diffusion flame", size_mm=num(r["Nozzle (mm)"]),
            o2_pct=21.0, pressure_psi=rnd(101 * KPA_TO_PSI, 3), diluent="N2 (cabin air)", flow_cm_s=air,
            measurements=["smoke point", "luminous flame length"], sensors=["still camera", "video camera"],
            outcome=None, key_metric_name="hc_fuel_rate_mg_s", key_metric_value=num(r["HC Fuel Rate (mg/s)"]),
            source_file="Pseudo_DataKeep/SPICE/SPICE_Experimental_Table.csv", source_row=int(r["__row"]),
            notes=(f"GMT day {text(r['GMT date'])} of 2009, ignition {text(r['GMT ignition'])}, flame off {text(r['GMT Flame Off'])}. "
                   "O2 21% and 101 kPa are the documented coflow conditions (SPICE_Report p20), not per-row measurements."),
            flags=["conditions_from_doc"],
            extra={"gmt_day_2009": num(r["GMT date"]), "fuel_rate_sccm": num(r["Fuel Rate (sccm)"]),
                   "fuel_rate_mg_s": num(r["Fuel Rate (mg/s)"]), "hc_fuel_rate_mg_s": num(r["HC Fuel Rate (mg/s)"]),
                   "nozzle_mm": num(r["Nozzle (mm)"])},
        )
        out.append(rec)
        keys.append(tuple(str(r[c]).strip() for c in df.columns if c != "__row"))
    mark_duplicates(out, keys)
    return out


# ---------------------------------------------------------------- checks
def run_checks(records: list[dict[str, Any]]) -> list[str]:
    failed = []
    for rec in records:
        problems = []
        o2, p, f = rec["o2_pct"], rec["pressure_psi"], rec["flow_cm_s"]
        if o2 is not None and not (0 <= o2 <= 100):
            problems.append("o2")
        if p is not None and not p > 0:
            problems.append("pressure")
        if f is not None and f < 0:
            problems.append("flow")
        for pr in problems:
            rec["flags"].append(f"range_check_failed:{pr}")
        if problems:
            rec["notes"] = (rec["notes"] + f" Failed range check: {', '.join(problems)} (row kept).").strip()
            failed.append(f"{rec['test_id']} (row {rec['source_row']}): {', '.join(problems)}")
    return failed


# ---------------------------------------------------------------- PDFs
def chunk_page(t: str) -> list[str]:
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{2,}", "\n", t).strip()
    if not t:
        return []
    chunks, start = [], 0
    while start < len(t):
        end = min(len(t), start + CHUNK_SIZE)
        if end < len(t):  # try to cut at a sentence / line end
            cut = max(t.rfind(". ", start + CHUNK_SIZE // 2, end), t.rfind("\n", start + CHUNK_SIZE // 2, end))
            if cut > start:
                end = cut + 1
        chunks.append(t[start:end].strip())
        if end >= len(t):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return [c for c in chunks if len(c) > 40]


def process_pdfs() -> tuple[list[dict], list[dict]]:
    import pdfplumber
    import pymupdf

    chunks, tables = [], []
    for inv in ["ACME", "CFI", "SPICE"]:
        for kind in ["Engineering_Doc", "Report"]:
            path = RAW / inv / f"{inv}_{kind}.pdf"
            rel = path.relative_to(ROOT).as_posix()
            doc = pymupdf.open(path)
            for pno, page in enumerate(doc, 1):
                for ci, c in enumerate(chunk_page(page.get_text()), 1):
                    chunks.append({"chunk_id": f"{inv}-{kind}-p{pno}-c{ci}", "investigation": inv,
                                   "source_file": rel, "page": pno, "text": c})
            with pdfplumber.open(path) as pdf:
                for pno, page in enumerate(pdf.pages, 1):
                    for ti, tb in enumerate(page.extract_tables() or [], 1):
                        rows = [[text(c) or "" for c in row] for row in tb if row and any(text(c) for c in row)]
                        if len(rows) >= 2:
                            tables.append({"table_id": f"{inv}-{kind}-p{pno}-t{ti}", "investigation": inv,
                                           "source_file": rel, "page": pno, "rows": rows})
    return chunks, tables


# ---------------------------------------------------------------- report
FIELDS = ["campaign", "fuel", "geometry", "size_mm", "o2_pct", "pressure_psi", "diluent", "flow_cm_s",
          "outcome", "key_metric_value"]


def report(records: list[dict], failed: list[str], chunks: list[dict], tables: list[dict]) -> str:
    lines = ["# Ingest report", "", "Generated by `scripts/ingest/ingest.py`. Do not edit by hand.", "",
             "## Rows per investigation", "", "| Investigation | Rows | Duplicates flagged | Range-check failures |",
             "|---|---|---|---|"]
    for inv in ["ACME", "CFI", "SPICE"]:
        rs = [r for r in records if r["investigation"] == inv]
        d = sum("duplicate_row" in r["flags"] for r in rs)
        f = sum(any(x.startswith("range_check_failed") for x in r["flags"]) for r in rs)
        lines.append(f"| {inv} | {len(rs)} | {d} | {f} |")
    lines += ["", f"Total: {len(records)} tests · {len(chunks)} text chunks · {len(tables)} PDF tables", "",
              "## Empty rate per field (%)", "", "| Field | ACME | CFI | SPICE |", "|---|---|---|---|"]
    for fld in FIELDS:
        row = [fld]
        for inv in ["ACME", "CFI", "SPICE"]:
            rs = [r for r in records if r["investigation"] == inv]
            row.append(f"{100 * sum(r[fld] is None for r in rs) / len(rs):.0f}")
        lines.append("| " + " | ".join(row) + " |")
    lines += ["", "## Value ranges", "", "| Investigation | Field | Min | Max |", "|---|---|---|---|"]
    for inv in ["ACME", "CFI", "SPICE"]:
        rs = [r for r in records if r["investigation"] == inv]
        for fld in ["o2_pct", "pressure_psi", "flow_cm_s", "size_mm", "key_metric_value"]:
            vals = [r[fld] for r in rs if r[fld] is not None]
            if vals:
                lines.append(f"| {inv} | {fld} | {min(vals):g} | {max(vals):g} |")
    lines += ["", "## Failed checks (O2 0–100, pressure > 0, flow ≥ 0)", ""]
    lines += [f"- {x}" for x in failed] or ["- none"]
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    records = adapt_acme() + adapt_cfi() + adapt_spice()
    ids = [r["test_id"] for r in records]
    assert len(ids) == len(set(ids)), "test_ids must be unique"
    failed = run_checks(records)
    chunks, tables = process_pdfs()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "tests.json").write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    (OUT / "pdf_tables.json").write_text(json.dumps(tables, ensure_ascii=False), encoding="utf-8")
    (OUT / "ingest_report.md").write_text(report(records, failed, chunks, tables), encoding="utf-8")
    print(f"tests={len(records)} chunks={len(chunks)} tables={len(tables)} failed_checks={len(failed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
