"""
Solay39 Slither worker.

A small, stateless HTTP service that compiles Solidity sources with the right
solc version and runs Slither on them. It is the primary static-analysis
engine of Solay39: the Next.js app sends sources here and maps the findings.

Design goals
  * Correct exit-code handling: Slither exits non-zero when it finds issues;
    success is read from the JSON report, not from the exit code.
  * Per-request compiler: the solc binary is passed with --solc, never switched
    globally, so concurrent analyses cannot interfere with each other.
  * Import resolution: multi-file sources are written to an isolated directory;
    @openzeppelin imports that are not provided are resolved to bundled
    OpenZeppelin releases (v4.9 and v5).
  * Reproducibility: every response carries the Slither and solc versions, the
    SHA-256 of the sources and the list of detectors that ran.

Environment
  SLITHER_WORKER_API_KEY   required, shared secret (header x-api-key or Bearer)
  SLITHER_MAX_CONCURRENCY  default 2
  SLITHER_TIMEOUT_SECONDS  default 120
  SLITHER_LIBS_DIR         default /opt/solidity-libs (bundled OpenZeppelin)
  SLITHER_ALLOW_SOLC_DOWNLOAD  default "1": install missing solc versions on demand
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
import time
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

API_KEY = os.environ.get("SLITHER_WORKER_API_KEY", "")
MAX_CONCURRENCY = int(os.environ.get("SLITHER_MAX_CONCURRENCY", "2"))
TIMEOUT_SECONDS = int(os.environ.get("SLITHER_TIMEOUT_SECONDS", "120"))
LIBS_DIR = Path(os.environ.get("SLITHER_LIBS_DIR", "/opt/solidity-libs"))
ALLOW_SOLC_DOWNLOAD = os.environ.get("SLITHER_ALLOW_SOLC_DOWNLOAD", "1") == "1"
MAX_TOTAL_BYTES = 3 * 1024 * 1024
MAX_FILES = 400
ENTRY_FILE = "__solay39_entry__.sol"

app = FastAPI(title="Solay39 Slither worker", version="1.0.0")
_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)


# ── Models ──────────────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    code: Optional[str] = None
    sources: Optional[dict[str, str]] = None
    contractName: Optional[str] = Field(default=None, max_length=128)
    solcVersion: Optional[str] = Field(default=None, pattern=r"^\d+\.\d+\.\d+$")
    excludeInformational: bool = False
    excludeOptimization: bool = True


# ── Auth ────────────────────────────────────────────────────────────────────


def _check_auth(x_api_key: Optional[str], authorization: Optional[str]) -> None:
    if not API_KEY:
        raise HTTPException(503, "Worker not configured: SLITHER_WORKER_API_KEY is missing")
    supplied = x_api_key or (authorization[7:] if authorization and authorization.startswith("Bearer ") else "")
    if not supplied or not hmac.compare_digest(supplied.encode(), API_KEY.encode()):
        raise HTTPException(401, "Unauthorized")


# ── Solidity version resolution ─────────────────────────────────────────────

PRAGMA_RE = re.compile(r"pragma\s+solidity\s+([^;]+);")


def _parse_version(v: str) -> tuple[int, int, int]:
    parts = [int(p) for p in re.findall(r"\d+", v)[:3]]
    while len(parts) < 3:
        parts.append(0)
    return parts[0], parts[1], parts[2]


def _satisfies(version: tuple[int, int, int], constraint: str) -> bool:
    """Minimal npm-style semver matcher for solidity pragmas (^, ~, >=, <=, >, <, =, ||, ranges)."""
    for alternative in constraint.split("||"):
        tokens = re.findall(r"(\^|~|>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})", alternative)
        if not tokens:
            continue
        ok = True
        for op, raw in tokens:
            target = _parse_version(raw)
            if op == "^":
                upper = (target[0], target[1] + 1, 0) if target[0] == 0 else (target[0] + 1, 0, 0)
                ok &= target <= version < upper
            elif op == "~":
                ok &= target <= version < (target[0], target[1] + 1, 0)
            elif op == ">=":
                ok &= version >= target
            elif op == "<=":
                ok &= version <= target
            elif op == ">":
                ok &= version > target
            elif op == "<":
                ok &= version < target
            else:
                ok &= version == target
        if ok:
            return True
    return False


@lru_cache(maxsize=1)
def _known_releases() -> list[str]:
    """All solc releases, newest first. Uses the official list, falls back to installed versions."""
    versions: set[str] = set(_installed_solc().keys())
    try:
        import urllib.request

        with urllib.request.urlopen("https://binaries.soliditylang.org/linux-amd64/list.json", timeout=10) as r:
            versions |= set(json.load(r)["releases"].keys())
    except Exception:
        pass
    return sorted(versions, key=_parse_version, reverse=True)


def _solc_artifacts_dir() -> Path:
    for candidate in [
        os.environ.get("VIRTUAL_ENV", "") and Path(os.environ["VIRTUAL_ENV"]) / ".solc-select" / "artifacts",
        Path.home() / ".solc-select" / "artifacts",
    ]:
        if candidate and Path(candidate).exists():
            return Path(candidate)
    return Path.home() / ".solc-select" / "artifacts"


def _installed_solc() -> dict[str, Path]:
    out: dict[str, Path] = {}
    base = _solc_artifacts_dir()
    if base.exists():
        for d in base.iterdir():
            binary = d / d.name
            if d.name.startswith("solc-") and binary.exists():
                out[d.name[5:]] = binary
    return out


def _pick_solc_version(sources: dict[str, str], requested: Optional[str]) -> str:
    if requested:
        return requested
    constraints = [m.group(1).strip() for code in sources.values() for m in PRAGMA_RE.finditer(code)]
    installed = sorted(_installed_solc().keys(), key=_parse_version, reverse=True)
    # Prefer an installed compiler, then any official release.
    for pool in (installed, _known_releases()):
        for v in pool:
            if all(_satisfies(_parse_version(v), c) for c in constraints):
                return v
    raise HTTPException(422, f"No solc release satisfies the pragmas: {sorted(set(constraints))}")


def _solc_binary(version: str) -> Path:
    installed = _installed_solc()
    if version in installed:
        return installed[version]
    if not ALLOW_SOLC_DOWNLOAD:
        raise HTTPException(422, f"solc {version} is not installed on this worker")
    subprocess.run(["solc-select", "install", version], check=False, capture_output=True, timeout=120)
    installed = _installed_solc()
    if version not in installed:
        raise HTTPException(422, f"Unable to install solc {version}")
    return installed[version]


# ── Sources and imports ─────────────────────────────────────────────────────

IMPORT_RE = re.compile(r"""import\s+(?:[^'"]*from\s+)?["']([^"']+)["']""")


def _safe_relpath(name: str) -> PurePosixPath:
    p = PurePosixPath(name.replace("\\", "/").lstrip("/"))
    if not p.parts or any(part in ("..", "") for part in p.parts) or p.suffix != ".sol":
        raise HTTPException(400, f"Invalid source path: {name!r}")
    return p


def _normalize_sources(req: AnalyzeRequest) -> dict[str, str]:
    if req.sources:
        sources = dict(req.sources)
    elif req.code:
        name = re.sub(r"[^A-Za-z0-9_]", "", req.contractName or "") or "Contract"
        sources = {f"{name}.sol": req.code}
    else:
        raise HTTPException(400, "Provide 'code' or 'sources'")
    if len(sources) > MAX_FILES:
        raise HTTPException(413, "Too many source files")
    if sum(len(v.encode()) for v in sources.values()) > MAX_TOTAL_BYTES:
        raise HTTPException(413, "Sources exceed size limit")
    return {str(_safe_relpath(k)): v for k, v in sources.items()}


def _oz_remapping_candidates(sources: dict[str, str]) -> list[list[str]]:
    """
    Remapping sets for unresolved @openzeppelin imports, most recent release first.
    A release qualifies only if it contains every imported file. The caller retries
    with the next candidate when compilation fails (e.g. v4-style code on v5).
    """
    provided = set(sources.keys())
    wanted: dict[str, set[str]] = {}
    for code in sources.values():
        for imp in IMPORT_RE.findall(code):
            if not imp.startswith("@openzeppelin/") or imp in provided:
                continue
            pkg = "/".join(imp.split("/")[:2])  # @openzeppelin/contracts or contracts-upgradeable
            wanted.setdefault(pkg, set()).add(imp[len(pkg) + 1:])
    if not wanted:
        return [[]]
    candidates: list[list[str]] = []
    for release in ("oz5", "oz4"):
        remaps = []
        for pkg, files in wanted.items():
            root = LIBS_DIR / release / "node_modules" / pkg
            if not (root.exists() and all((root / f).exists() for f in files)):
                break
            remaps.append(f"{pkg}/={root}/")
        else:
            candidates.append(remaps)
    return candidates or [[]]


# ── Slither ─────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _slither_version() -> str:
    r = subprocess.run(["slither", "--version"], capture_output=True, text=True, timeout=30)
    return (r.stdout or r.stderr).strip()


@lru_cache(maxsize=1)
def _detector_catalog() -> dict[str, dict[str, Any]]:
    r = subprocess.run(["slither", "--list-detectors-json"], capture_output=True, text=True, timeout=60)
    try:
        return {d["check"]: d for d in json.loads(r.stdout)}
    except Exception:
        return {}


async def _run(cmd: list[str], cwd: str, timeout: int) -> tuple[int, str, str, bool]:
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, start_new_session=True
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode or 0, out.decode(errors="replace"), err.decode(errors="replace"), False
    except asyncio.TimeoutError:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        await proc.wait()
        return -9, "", "", True


def _snippet(sources: dict[str, str], filename: str, lines: list[int]) -> str:
    code = sources.get(filename)
    if code is None or not lines:
        return ""
    all_lines = code.splitlines()
    start, end = max(1, min(lines)), min(len(all_lines), max(lines))
    if end - start > 14:
        end = start + 14
    return "\n".join(all_lines[start - 1:end])


def _parent_name(element: dict[str, Any], kind: str) -> Optional[str]:
    fields = element.get("type_specific_fields") or {}
    parent = fields.get("parent")
    while parent:
        if parent.get("type") == kind:
            return parent.get("name")
        parent = (parent.get("type_specific_fields") or {}).get("parent")
    return element.get("name") if element.get("type") == kind else None


def _map_detector(d: dict[str, Any], sources: dict[str, str], workdir: str) -> dict[str, Any]:
    catalog = _detector_catalog().get(d.get("check", ""), {})
    elements = d.get("elements") or []
    primary = next((e for e in elements if e.get("type") in ("function", "node")), elements[0] if elements else {})
    sm = primary.get("source_mapping") or {}
    filename = sm.get("filename_relative") or ""
    try:
        filename = str(PurePosixPath(os.path.relpath(sm.get("filename_absolute", filename), workdir)))
    except ValueError:
        pass
    lines = sm.get("lines") or []
    function = _parent_name(primary, "function")
    contract = _parent_name(primary, "contract")
    return {
        "id": d.get("id"),
        "check": d.get("check"),
        "impact": d.get("impact"),
        "confidence": d.get("confidence"),
        "title": catalog.get("title") or d.get("check"),
        "description": (d.get("description") or "").strip(),
        "markdown": (d.get("markdown") or "").strip(),
        "recommendation": catalog.get("recommendation"),
        "wikiUrl": catalog.get("wiki_url"),
        "file": filename,
        "contract": contract,
        "function": function,
        "lines": lines,
        "startLine": min(lines) if lines else None,
        "endLine": max(lines) if lines else None,
        "snippet": _snippet(sources, filename, lines),
        "fromLibrary": filename.startswith(str(LIBS_DIR)) or "/node_modules/" in filename,
    }


async def analyze_sources(req: AnalyzeRequest) -> dict[str, Any]:
    started = time.monotonic()
    sources = _normalize_sources(req)
    solc_version = _pick_solc_version(sources, req.solcVersion)
    solc = _solc_binary(solc_version)
    digest = hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()

    workdir = tempfile.mkdtemp(prefix="slither-")
    try:
        for rel, code in sources.items():
            path = Path(workdir, rel)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(code, encoding="utf-8")
        report = Path(workdir, "slither-report.json")

        # Single file: analyse it directly. Several files: a synthetic entry point
        # imports each one under its own namespace so solc compiles them together
        # without symbol clashes.
        if len(sources) == 1:
            target = next(iter(sources))
        else:
            target = ENTRY_FILE
            Path(workdir, target).write_text(
                "// SPDX-License-Identifier: UNLICENSED\n"
                + "".join(f'import "./{rel}" as S{i};\n' for i, rel in enumerate(sorted(sources)))
            )

        candidates = _oz_remapping_candidates(sources)
        for attempt, remaps in enumerate(candidates):
            report.unlink(missing_ok=True)
            cmd = [
                "slither", target,
                "--solc", str(solc),
                "--compile-force-framework", "solc",
                "--json", str(report),
                "--filter-paths", "node_modules|solidity-libs",
            ]
            excluded = []
            if req.excludeInformational:
                excluded.append("--exclude-informational")
            if req.excludeOptimization:
                excluded.append("--exclude-optimization")
            cmd += excluded
            if remaps:
                cmd += ["--solc-remaps", " ".join(remaps)]
            allow_paths = ",".join([workdir] + [str(LIBS_DIR)] if LIBS_DIR.exists() else [workdir])
            cmd += ["--solc-args", f"--allow-paths {allow_paths}"]

            async with _semaphore:
                code, out, err, timed_out = await _run(cmd, workdir, TIMEOUT_SECONDS)
            if timed_out or attempt == len(candidates) - 1:
                break
            # Retry with an older OpenZeppelin release only on compilation failure
            if report.exists() and report.stat().st_size and json.loads(report.read_text()).get("success"):
                break

        base = {
            "tool": "slither",
            "slitherVersion": _slither_version(),
            "solcVersion": solc_version,
            "sourceSha256": digest,
            "files": sorted(sources.keys()),
            "remappings": [r.split("=")[0] for r in remaps],
            "durationMs": int((time.monotonic() - started) * 1000),
        }
        if timed_out:
            return {**base, "status": "timeout", "findings": [], "error": f"Slither exceeded {TIMEOUT_SECONDS}s"}
        if not report.exists() or report.stat().st_size == 0:
            return {**base, "status": "error", "findings": [], "error": (err or out)[-4000:]}

        data = json.loads(report.read_text())
        if not data.get("success"):
            error = data.get("error") or (err or out)[-4000:]
            status = "compile_error" if re.search(r"compil|solc|Error:|ParserError|TypeError", str(error)) else "error"
            return {**base, "status": status, "findings": [], "error": str(error)[-4000:]}

        detectors = (data.get("results") or {}).get("detectors") or []
        findings = [_map_detector(d, sources, workdir) for d in detectors]
        findings = [f for f in findings if not f["fromLibrary"] and f["file"] != ENTRY_FILE]
        catalog = _detector_catalog()
        impacts_excluded = {"Informational"} if req.excludeInformational else set()
        if req.excludeOptimization:
            impacts_excluded.add("Optimization")
        detectors_run = [c for c, meta in catalog.items() if meta.get("impact") not in impacts_excluded]
        return {**base, "status": "ok", "detectorsRun": len(detectors_run), "findings": findings}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


# ── HTTP API ────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": shutil.which("slither") is not None,
        "slitherVersion": _slither_version() if shutil.which("slither") else None,
        "solcInstalled": sorted(_installed_solc().keys(), key=_parse_version, reverse=True),
        "detectors": len(_detector_catalog()),
        "openzeppelin": [p.name for p in LIBS_DIR.iterdir()] if LIBS_DIR.exists() else [],
        "configured": bool(API_KEY),
    }


@app.post("/v1/analyze")
async def analyze(
    req: AnalyzeRequest,
    x_api_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _check_auth(x_api_key, authorization)
    return await analyze_sources(req)
