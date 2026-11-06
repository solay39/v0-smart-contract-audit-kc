"""Regenerates tests/fixtures/slither-results.json from real Slither runs.

Usage (from slither-worker/):  SLITHER_WORKER_API_KEY=x SLITHER_LIBS_DIR=... python scripts/record_fixtures.py
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app  # noqa: E402
from tests.test_worker import OLD, OZ5, REENTRANT, SAFE  # noqa: E402

CASES = [("reentrant", REENTRANT, "Bank"), ("safe", SAFE, "Bank"), ("old", OLD, "Old"), ("oz5", OZ5, "Owned")]

out = {"_note": "Real output of slither-worker. Regenerate with slither-worker/scripts/record_fixtures.py"}
for name, code, contract in CASES:
    result = asyncio.run(app.analyze_sources(app.AnalyzeRequest(code=code, contractName=contract)))
    out[name] = {"code": code, "contractName": contract, "result": result}

target = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "slither-results.json"
target.write_text(json.dumps(out, indent=1))
print(f"wrote {target}")
