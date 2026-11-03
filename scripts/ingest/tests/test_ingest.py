"""Tests for scripts/ingest/ingest.py. Run: python -m pytest scripts/ingest"""
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("hearth_ingest", HERE / "ingest.py")
ing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ing)
PROCESSED = HERE.parents[1] / "data" / "processed"


def test_num_parsing():
    assert ing.num("-") is None
    assert ing.num(" 2.5 ") == 2.5
    assert ing.num(float("nan")) is None
    assert ing.num("abc") is None


def test_atm_and_fuel_parsing():
    assert ing.parse_atm("1.25 atm ") == 1.25
    assert ing.cfi_fuel("[.60]/[.40] C12H26/iso-dodecane ")[0] == "n-dodecane/iso-dodecane 60/40"
    assert ing.acme_fuel("30% butane") == "n-butane (30% in N2)"
    assert ing.spice_fuel("75 % Propylene") == "propylene (75% in N2)"


def test_chunks_have_overlap_and_size():
    text = "word " * 600
    chunks = ing.chunk_page(text)
    assert len(chunks) >= 3
    assert all(len(c) <= ing.CHUNK_SIZE for c in chunks)


def test_range_checks_flag_but_keep():
    recs = [ing.base_record(test_id="X-1", o2_pct=120.0, pressure_psi=0.0, flow_cm_s=-1.0, source_row=2)]
    failed = ing.run_checks(recs)
    assert len(failed) == 1
    assert set(recs[0]["flags"]) == {"range_check_failed:o2", "range_check_failed:pressure", "range_check_failed:flow"}


def test_acme_inverse_layout():
    recs = ing.adapt_acme()
    assert len(recs) == 333
    inv = [r for r in recs if "inverse" in r["geometry"]]
    assert len(inv) == 154 and all("layout_shifted" in r["flags"] for r in inv)
    assert all(0 < r["o2_pct"] <= 100 for r in recs)
    first = next(r for r in inv if r["source_row"] == 181)
    assert first["o2_pct"] == 21.0 and abs(first["pressure_psi"] - 1.1 * ing.BAR_TO_PSI) < 0.01


def test_processed_output_contract():
    tests = json.loads((PROCESSED / "tests.json").read_text(encoding="utf-8"))
    ids = [t["test_id"] for t in tests]
    assert len(ids) == len(set(ids))
    for t in tests:
        assert t["source_file"].startswith("Pseudo_DataKeep/") and isinstance(t["source_row"], int)
        assert t["investigation"] in {"ACME", "CFI", "SPICE"}
    chunks = json.loads((PROCESSED / "chunks.json").read_text(encoding="utf-8"))
    assert all({"chunk_id", "investigation", "source_file", "page", "text"} <= c.keys() for c in chunks)
