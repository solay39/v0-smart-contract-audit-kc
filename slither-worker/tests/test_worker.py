"""Integration tests: run real Slither + solc. Requires slither, solc-select and the bundled libs."""

import os
import shutil

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SLITHER_WORKER_API_KEY", "test-key")

import app as worker  # noqa: E402

pytestmark = pytest.mark.skipif(shutil.which("slither") is None, reason="slither not installed")

client = TestClient(worker.app)
AUTH = {"x-api-key": os.environ["SLITHER_WORKER_API_KEY"]}

REENTRANT = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Bank {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}
"""

SAFE = REENTRANT.replace(
    """        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] = 0;""",
    """        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);""",
)

OZ5 = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
contract Owned is Ownable {
    uint256 public x;
    constructor() Ownable(msg.sender) {}
    function set(uint256 v) external onlyOwner { x = v; }
}
"""

OZ4 = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Guarded is ReentrancyGuard, Ownable {
    function ping() external nonReentrant onlyOwner {}
}
"""

OLD = """// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
contract Old {
    address owner;
    function kill() external { selfdestruct(payable(msg.sender)); }
}
"""


def post(body, headers=AUTH):
    return client.post("/v1/analyze", json=body, headers=headers)


def checks(res):
    return {f["check"] for f in res["findings"]}


def test_requires_api_key():
    assert post({"code": SAFE}, headers={}).status_code == 401
    assert post({"code": SAFE}, headers={"x-api-key": "wrong"}).status_code == 401


def test_detects_reentrancy_with_location():
    r = post({"code": REENTRANT, "contractName": "Bank"}).json()
    assert r["status"] == "ok", r
    hit = next(f for f in r["findings"] if f["check"] == "reentrancy-eth")
    assert hit["function"] == "withdraw"
    assert hit["contract"] == "Bank"
    assert hit["file"] == "Bank.sol"
    assert hit["startLine"] == 6
    assert "msg.sender.call" in hit["snippet"]
    assert hit["recommendation"]
    assert r["detectorsRun"] > 80
    assert len(r["sourceSha256"]) == 64
    assert r["solcVersion"].startswith("0.8.")


def test_cei_compliant_contract_has_no_reentrancy():
    r = post({"code": SAFE, "contractName": "Bank"}).json()
    assert r["status"] == "ok", r
    assert not {"reentrancy-eth", "reentrancy-no-eth"} & checks(r)


def test_resolves_openzeppelin_v5_imports():
    r = post({"code": OZ5, "contractName": "Owned"}).json()
    assert r["status"] == "ok", r
    assert r["remappings"] == ["@openzeppelin/contracts/"]
    assert all(not f["file"].startswith("/") for f in r["findings"])  # no library findings


def test_falls_back_to_openzeppelin_v4():
    r = post({"code": OZ4, "contractName": "Guarded"}).json()
    assert r["status"] == "ok", r
    assert "oz4" not in str(r["findings"])  # library code is filtered out


def test_picks_compiler_from_pragma():
    r = post({"code": OLD, "contractName": "Old"}).json()
    assert r["status"] == "ok", r
    assert r["solcVersion"] == "0.7.6"
    assert "suicidal" in checks(r)


def test_multi_file_sources():
    sources = {
        "src/IVault.sol": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ninterface IVault { function withdraw() external; }\n",
        "src/Bank.sol": REENTRANT.replace("contract Bank {", 'import "./IVault.sol";\ncontract Bank is IVault {').replace(
            "function withdraw() external {", "function withdraw() external override {"
        ),
    }
    r = post({"sources": sources}).json()
    assert r["status"] == "ok", r
    hit = next(f for f in r["findings"] if f["check"] == "reentrancy-eth")
    assert hit["file"] == "src/Bank.sol"
    assert all(f["file"] != worker.ENTRY_FILE for f in r["findings"])


def test_compile_error_is_reported_not_hidden():
    r = post({"code": "pragma solidity ^0.8.20; contract X { function f( }", "contractName": "X"}).json()
    assert r["status"] in ("compile_error", "error")
    assert r["findings"] == []
    assert r["error"]


def test_rejects_path_traversal():
    assert post({"sources": {"../../etc/x.sol": SAFE}}).status_code == 400
    assert post({"sources": {"/abs.sol": SAFE}}).status_code in (200, 400)  # leading slash is stripped


def test_health():
    h = client.get("/health").json()
    assert h["ok"] and h["detectors"] > 80


def test_semver_matcher():
    v = worker._parse_version
    assert worker._satisfies(v("0.8.26"), "^0.8.20")
    assert not worker._satisfies(v("0.9.0"), "^0.8.20")
    assert worker._satisfies(v("0.7.6"), ">=0.6.0 <0.8.0")
    assert not worker._satisfies(v("0.8.0"), ">=0.6.0 <0.8.0")
    assert worker._satisfies(v("0.6.12"), "~0.6.2")
    assert worker._satisfies(v("0.4.24"), "0.4.24")
    assert worker._satisfies(v("0.8.1"), "^0.7.0 || ^0.8.0")


def test_run_job_cli(tmp_path, monkeypatch):
    """GitHub Actions entrypoint: base64(gzip(json)) in, result.json out."""
    import base64, gzip, json, subprocess, sys
    from pathlib import Path
    payload = base64.b64encode(gzip.compress(json.dumps({"code": REENTRANT, "contractName": "Bank"}).encode())).decode()
    out = tmp_path / "result.json"
    env = {**os.environ, "SLITHER_JOB_PAYLOAD": payload, "SLITHER_JOB_ID": "job-1", "SLITHER_RESULT_PATH": str(out)}
    proc = subprocess.run([sys.executable, "run_job.py"], cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert "contract" not in proc.stdout.lower()  # no source code in the public log
    result = json.loads(out.read_text())
    assert result["status"] == "ok" and result["jobId"] == "job-1"
    assert any(f["check"] == "reentrancy-eth" for f in result["findings"])


def test_run_job_cli_bad_payload(tmp_path):
    import json, subprocess, sys
    from pathlib import Path
    out = tmp_path / "result.json"
    env = {**os.environ, "SLITHER_JOB_PAYLOAD": "not-base64!", "SLITHER_RESULT_PATH": str(out)}
    subprocess.run([sys.executable, "run_job.py"], cwd=Path(__file__).resolve().parents[1], env=env, check=True, capture_output=True)
    assert json.loads(out.read_text())["status"] == "error"
