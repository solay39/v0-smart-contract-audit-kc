"""
Formal Verification Backend
Supports: Coq (via coqc), K Framework (via kevm prove)

Deploy on Railway alongside the existing security-backend.
Set FORMAL_VERIFY_BACKEND_URL=https://<this-service>.railway.app in Vercel.

Requirements:
  - coq (apt: coq)
  - kevm (pip: kevm-pyk or via K Framework docker image)
"""

import subprocess
import tempfile
import os
import json
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

# ─── Coq runner ───────────────────────────────────────────────────────────────

def run_coq(property_spec: str) -> dict:
    """
    Compile and check a Coq proof using coqc.
    Returns {status, proof, error}.
    """
    with tempfile.NamedTemporaryFile(suffix=".v", mode="w", delete=False) as f:
        f.write(property_spec)
        fname = f.name

    start = time.time()
    try:
        result = subprocess.run(
            ["coqc", fname],
            capture_output=True, text=True, timeout=120
        )
        elapsed = round((time.time() - start) * 1000)

        if result.returncode == 0:
            return {"status": "VERIFIED", "proof": property_spec, "time": elapsed}
        else:
            stderr = result.stderr or result.stdout
            # Distinguish admitted proofs from real errors
            if "Admitted" in property_spec:
                return {
                    "status": "UNKNOWN",
                    "error": "Proof contains Admitted placeholders — not fully proven.",
                    "time": elapsed
                }
            return {"status": "ERROR", "error": stderr[:1000], "time": elapsed}
    except subprocess.TimeoutExpired:
        return {"status": "TIMEOUT", "error": "Coq proof search timed out (120s)", "time": 120000}
    except FileNotFoundError:
        return {"status": "ERROR", "error": "coqc not found. Install with: apt install coq"}
    finally:
        os.unlink(fname)


# ─── K Framework / KEVM runner ───────────────────────────────────────────────

def run_kframework(contract_source: str, property_spec: str, property_id: str) -> dict:
    """
    Run KEVM symbolic execution on a property spec.
    Requires kevm-pyk or kevm CLI installed.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write contract
        contract_file = os.path.join(tmpdir, "Contract.sol")
        with open(contract_file, "w") as f:
            f.write(contract_source)

        # Write spec
        spec_file = os.path.join(tmpdir, f"{property_id}-spec.k")
        with open(spec_file, "w") as f:
            f.write(property_spec)

        start = time.time()
        try:
            # Try kevm-pyk first, fall back to kevm
            cmd = ["kevm", "prove", spec_file, "--backend", "haskell", "--timeout", "180"]
            result = subprocess.run(
                cmd,
                capture_output=True, text=True,
                timeout=200, cwd=tmpdir
            )
            elapsed = round((time.time() - start) * 1000)

            if result.returncode == 0 and "#True" in result.stdout:
                return {"status": "VERIFIED", "proof": result.stdout[:2000], "time": elapsed}
            elif result.returncode == 0 and "#False" in result.stdout:
                return {
                    "status": "VIOLATED",
                    "counterexample": result.stdout[:2000],
                    "time": elapsed
                }
            elif result.returncode != 0:
                return {"status": "ERROR", "error": (result.stderr or result.stdout)[:1000], "time": elapsed}
            else:
                return {"status": "UNKNOWN", "error": result.stdout[:500], "time": elapsed}

        except subprocess.TimeoutExpired:
            return {"status": "TIMEOUT", "error": "KEVM proof timed out (180s)"}
        except FileNotFoundError:
            return {
                "status": "ERROR",
                "error": (
                    "kevm not found. "
                    "Install via: pip install kevm-pyk  "
                    "or use docker: runtimeverification/kevm"
                )
            }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/verify", methods=["POST"])
def verify():
    data = request.get_json()
    tool: str = data.get("tool", "")
    contract_source: str = data.get("contractSource", "")
    property_spec: str = data.get("propertySpec", "")
    property_id: str = data.get("propertyId", "unknown")

    if tool == "coq":
        result = run_coq(property_spec)
    elif tool == "kframework":
        result = run_kframework(contract_source, property_spec, property_id)
    else:
        result = {"status": "ERROR", "error": f"Unknown tool: {tool}"}

    return jsonify(result)


@app.route("/health", methods=["GET"])
def health():
    tools = {}

    # Check coqc
    try:
        r = subprocess.run(["coqc", "--version"], capture_output=True, text=True, timeout=5)
        tools["coq"] = r.stdout.strip() or "available"
    except Exception as e:
        tools["coq"] = f"unavailable: {e}"

    # Check kevm
    try:
        r = subprocess.run(["kevm", "version"], capture_output=True, text=True, timeout=5)
        tools["kframework"] = r.stdout.strip() or "available"
    except Exception as e:
        tools["kframework"] = f"unavailable: {e}"

    return jsonify({"status": "ok", "tools": tools})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    app.run(host="0.0.0.0", port=port)
