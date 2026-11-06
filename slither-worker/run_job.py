"""Runs one Slither analysis inside GitHub Actions (no HTTP server).

Input : env SLITHER_JOB_PAYLOAD = base64(gzip(JSON AnalyzeRequest))
Output: result.json in the current directory (same shape as POST /v1/analyze)
"""
import asyncio
import base64
import gzip
import json
import os
import sys
from pathlib import Path

from fastapi import HTTPException

import app


def main() -> int:
    out = Path(os.environ.get("SLITHER_RESULT_PATH", "result.json"))
    try:
        raw = gzip.decompress(base64.b64decode(os.environ["SLITHER_JOB_PAYLOAD"]))
        req = app.AnalyzeRequest(**json.loads(raw))
        result = asyncio.run(app.analyze_sources(req))
    except HTTPException as exc:
        result = {"tool": "slither", "status": "compile_error" if exc.status_code == 422 else "error",
                  "findings": [], "error": str(exc.detail)}
    except Exception as exc:  # noqa: BLE001 - always produce a result file
        result = {"tool": "slither", "status": "error", "findings": [], "error": f"{type(exc).__name__}: {exc}"}
    result["jobId"] = os.environ.get("SLITHER_JOB_ID", "")
    out.write_text(json.dumps(result))
    # Only non-sensitive metadata in the public log.
    print(json.dumps({k: result.get(k) for k in ("status", "slitherVersion", "solcVersion", "detectorsRun", "durationMs")}
                     | {"findings": len(result.get("findings", []))}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
