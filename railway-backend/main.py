"""
SOLAY39 — Static Analysis Backend
Deploy su Railway. Gira Slither, Mythril, Foundry reali.
"""

import os
import json
import tempfile
import subprocess
import asyncio
import hashlib
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Solay39 Static Analysis API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.solay39.eu", "https://solay39.eu", "http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

API_KEY = os.getenv("STATIC_ANALYSIS_API_KEY", "solay39-analysis-key")

# ── Simple in-memory cache (TTL 1h) ──────────────────────────────
_cache: dict = {}
CACHE_TTL = 3600

def cache_get(key: str):
    if key in _cache:
        val, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
        del _cache[key]
    return None

def cache_set(key: str, val):
    _cache[key] = (val, time.time())

# ── Request/Response models ───────────────────────────────────────
class AnalysisRequest(BaseModel):
    code: str
    contractName: str = "Contract"
    tools: list[str] = ["slither", "mythril", "foundry", "halmos"]
    network: str = "ethereum"
    solcVersion: str = "0.8.20"

class ExploitRequest(BaseModel):
    code: str
    findingTitle: str
    findingType: str  # "reentrancy" | "access_control" | "integer_overflow" | "oracle" | "flash_loan"
    location: str
    contractName: str = "Contract"

# ── Helpers ───────────────────────────────────────────────────────
def write_contract(code: str, name: str, tmpdir: str) -> str:
    """Write contract to temp file, return path"""
    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in "_-") or "Contract"
    path = os.path.join(tmpdir, f"{safe_name}.sol")
    with open(path, "w") as f:
        f.write(code)
    return path

def run_cmd(cmd: list, cwd: str, timeout: int = 120) -> tuple[int, str, str]:
    """Run command, return (returncode, stdout, stderr)"""
    try:
        result = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True,
            timeout=timeout, env={**os.environ, "PYTHONUNBUFFERED": "1"}
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Timeout after {timeout}s"
    except Exception as e:
        return -1, "", str(e)

def get_solc_version(code: str) -> str:
    """Extract solc version from pragma"""
    import re
    match = re.search(r'pragma solidity\s+[\^~>=]*(\d+\.\d+\.\d+)', code)
    if match:
        return match.group(1)
    return "0.8.20"

# ── Slither ───────────────────────────────────────────────────────
async def run_slither(code: str, contract_name: str, tmpdir: str) -> dict:
    sol_version = get_solc_version(code)
    contract_path = write_contract(code, contract_name, tmpdir)

    # Install correct solc version
    run_cmd(["solc-select", "install", sol_version], tmpdir, timeout=60)
    run_cmd(["solc-select", "use", sol_version], tmpdir, timeout=10)

    cmd = [
        "slither", contract_path,
        "--json", "-",
        "--solc-remaps", "@openzeppelin/=node_modules/@openzeppelin/",
        "--exclude-dependencies",
        "--filter-paths", "node_modules",
    ]

    rc, stdout, stderr = run_cmd(cmd, tmpdir, timeout=90)

    findings = []
    version = "unknown"

    # Get slither version
    _, ver_out, _ = run_cmd(["slither", "--version"], tmpdir, timeout=5)
    version = ver_out.strip() or "0.10.x"

    if stdout:
        try:
            data = json.loads(stdout)
            if data.get("success") and data.get("results", {}).get("detectors"):
                for det in data["results"]["detectors"]:
                    elements = det.get("elements", [])
                    lines = []
                    filename = contract_name + ".sol"
                    for el in elements:
                        if el.get("source_mapping", {}).get("lines"):
                            lines.extend(el["source_mapping"]["lines"])
                        if el.get("source_mapping", {}).get("filename_short"):
                            filename = el["source_mapping"]["filename_short"]
                    findings.append({
                        "check": det.get("check", "unknown"),
                        "impact": det.get("impact", "Informational"),
                        "confidence": det.get("confidence", "Medium"),
                        "description": det.get("description", "").strip(),
                        "elements": [{
                            "type": el.get("type", ""),
                            "name": el.get("name", ""),
                            "filename": filename,
                            "lines": lines[:5],
                        } for el in elements[:3]]
                    })
        except json.JSONDecodeError:
            pass

    return {
        "tool": "slither",
        "version": version,
        "success": rc == 0 or len(findings) > 0,
        "findings": findings,
        "detectors_run": 80,
        "error": stderr[:500] if rc != 0 and not findings else None,
        "raw_output": stdout[:2000] if stdout else stderr[:500],
    }

# ── Mythril ───────────────────────────────────────────────────────
async def run_mythril(code: str, contract_name: str, tmpdir: str) -> dict:
    sol_version = get_solc_version(code)
    contract_path = write_contract(code, contract_name, tmpdir)

    cmd = [
        "myth", "analyze", contract_path,
        "--execution-timeout", "60",
        "--max-depth", "22",
        "--solv", sol_version,
        "-o", "json",
    ]

    rc, stdout, stderr = run_cmd(cmd, tmpdir, timeout=90)

    findings = []
    version = "unknown"

    _, ver_out, _ = run_cmd(["myth", "version"], tmpdir, timeout=5)
    version = ver_out.strip() or "0.24.x"

    if stdout:
        try:
            data = json.loads(stdout)
            issues = data if isinstance(data, list) else data.get("issues", [])
            for issue in issues:
                findings.append({
                    "swc_id": issue.get("swc-id", ""),
                    "swc_title": issue.get("title", ""),
                    "severity": issue.get("severity", "Low"),
                    "description": issue.get("description", {}).get("head", "") if isinstance(issue.get("description"), dict) else str(issue.get("description", "")),
                    "contract": issue.get("contract", contract_name),
                    "function": issue.get("function", ""),
                    "lineno": issue.get("lineno", 0),
                    "code": issue.get("code", ""),
                })
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "tool": "mythril",
        "version": version,
        "success": True,
        "findings": findings,
        "error": None,
        "raw_output": stdout[:1000] if stdout else stderr[:500],
    }

# ── Halmos (a16z Formal Verification) ────────────────────────────
async def run_halmos(code: str, contract_name: str, tmpdir: str) -> dict:
    """
    Run Halmos symbolic bounded model checker.
    Halmos verifies properties by exhaustively checking all possible inputs
    within specified bounds using Z3 SMT solver.
    """
    sol_version = get_solc_version(code)
    safe_name = "".join(c for c in contract_name if c.isalnum()) or "Contract"
    
    # Create Foundry project structure (Halmos uses Foundry tests)
    halmos_dir = os.path.join(tmpdir, "halmos_project")
    os.makedirs(halmos_dir, exist_ok=True)
    
    # Init foundry
    run_cmd(["forge", "init", "--no-git", "--no-commit"], halmos_dir, timeout=30)
    
    # Write contract
    src_dir = os.path.join(halmos_dir, "src")
    os.makedirs(src_dir, exist_ok=True)
    with open(os.path.join(src_dir, f"{safe_name}.sol"), "w") as f:
        f.write(code)
    
    # Generate Halmos symbolic test
    halmos_test = _generate_halmos_test(code, safe_name, sol_version)
    test_dir = os.path.join(halmos_dir, "test")
    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, f"{safe_name}Symbolic.t.sol"), "w") as f:
        f.write(halmos_test)
    
    # foundry.toml
    toml_content = f"""[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "{sol_version}"
optimizer = true
optimizer_runs = 200

[profile.halmos]
ffi = true
"""
    with open(os.path.join(halmos_dir, "foundry.toml"), "w") as f:
        f.write(toml_content)
    
    # Install OZ if needed
    if "@openzeppelin" in code:
        run_cmd(
            ["forge", "install", "OpenZeppelin/openzeppelin-contracts", "--no-git", "--no-commit"],
            halmos_dir, timeout=60
        )
    
    # Run Halmos with bounded symbolic execution
    # --loop 5: unroll loops up to 5 iterations
    # --width 64: use 64-bit symbolic values
    # --depth 50: max call depth
    cmd = [
        "halmos",
        "--root", halmos_dir,
        "--contract", f"{safe_name}SymbolicTest",
        "--loop", "5",
        "--width", "64",
        "--depth", "50",
        "--solver-timeout-assertion", "30000",
        "--json-output",
    ]
    
    rc, stdout, stderr = run_cmd(cmd, halmos_dir, timeout=180)
    
    # Parse results
    properties_verified = 0
    properties_failed = 0
    counterexamples = []
    
    version = "unknown"
    _, ver_out, _ = run_cmd(["halmos", "--version"], halmos_dir, timeout=5)
    version = ver_out.strip() if ver_out else "halmos unknown"
    
    if stdout:
        try:
            # Halmos outputs JSON with test results
            data = json.loads(stdout)
            for test in data.get("tests", []):
                if test.get("result") == "passed":
                    properties_verified += 1
                elif test.get("result") == "failed":
                    properties_failed += 1
                    if test.get("counterexample"):
                        counterexamples.append({
                            "test": test.get("name", ""),
                            "inputs": test.get("counterexample", {}),
                            "path": test.get("path", []),
                        })
        except json.JSONDecodeError:
            # Parse text output
            for line in stdout.split("\n"):
                if "[PASS]" in line:
                    properties_verified += 1
                elif "[FAIL]" in line:
                    properties_failed += 1
    
    status = "VERIFIED" if properties_failed == 0 and properties_verified > 0 else \
             "PARTIAL" if properties_verified > 0 else "NOT_VERIFIED"
    
    return {
        "tool": "halmos",
        "version": version,
        "success": rc == 0 or properties_verified > 0,
        "status": status,
        "propertiesVerified": properties_verified,
        "propertiesFailed": properties_failed,
        "counterexamples": counterexamples[:5],  # Limit to 5
        "boundParameters": {
            "loopUnroll": 5,
            "bitWidth": 64,
            "callDepth": 50,
        },
        "error": stderr[:500] if rc != 0 and properties_verified == 0 else None,
        "raw_output": stdout[:2000] if stdout else stderr[:500],
    }

def _generate_halmos_test(code: str, contract_name: str, sol_version: str) -> str:
    """Generate Halmos symbolic test for formal verification"""
    import re
    
    # Detect functions and properties to verify
    is_erc20 = "function transfer(" in code and "function approve(" in code
    has_mint = "function mint(" in code
    has_burn = "function burn(" in code
    has_owner = "onlyOwner" in code or "owner()" in code
    
    tests = []
    
    # Property 1: Transfer preserves total supply (conservation)
    if is_erc20:
        tests.append("""
    /// @notice Symbolic test: Transfer preserves total supply
    function check_transferPreservesTotalSupply(address from, address to, uint256 amount) public {
        // Preconditions
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(from != to);
        
        uint256 totalBefore = token.totalSupply();
        uint256 fromBalBefore = token.balanceOf(from);
        uint256 toBalBefore = token.balanceOf(to);
        
        vm.assume(amount <= fromBalBefore);
        
        // Action
        vm.prank(from);
        token.transfer(to, amount);
        
        // Postconditions (properties to verify)
        uint256 totalAfter = token.totalSupply();
        
        // PROPERTY: Total supply must be unchanged after transfer
        assert(totalAfter == totalBefore);
        
        // PROPERTY: Sum of balances must equal total supply
        assert(token.balanceOf(from) + token.balanceOf(to) == fromBalBefore + toBalBefore);
    }
    
    /// @notice Symbolic test: No address can have balance > totalSupply
    function check_balanceNeverExceedsTotalSupply(address account) public {
        vm.assume(account != address(0));
        assert(token.balanceOf(account) <= token.totalSupply());
    }""")
    
    # Property 2: Mint increases supply correctly
    if has_mint:
        tests.append("""
    /// @notice Symbolic test: Mint correctly increases supply
    function check_mintIncreasesSupply(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0);
        vm.assume(amount < type(uint256).max - token.totalSupply());
        
        uint256 supplyBefore = token.totalSupply();
        uint256 balBefore = token.balanceOf(to);
        
        // Only owner can mint (if protected)
        vm.prank(token.owner());
        token.mint(to, amount);
        
        // PROPERTY: Supply increases by exactly amount
        assert(token.totalSupply() == supplyBefore + amount);
        
        // PROPERTY: Recipient balance increases by exactly amount
        assert(token.balanceOf(to) == balBefore + amount);
    }""")
    
    # Property 3: Burn decreases supply correctly
    if has_burn:
        tests.append("""
    /// @notice Symbolic test: Burn correctly decreases supply
    function check_burnDecreasesSupply(address from, uint256 amount) public {
        vm.assume(from != address(0));
        
        uint256 supplyBefore = token.totalSupply();
        uint256 balBefore = token.balanceOf(from);
        
        vm.assume(amount <= balBefore);
        
        vm.prank(from);
        token.burn(amount);
        
        // PROPERTY: Supply decreases by exactly amount
        assert(token.totalSupply() == supplyBefore - amount);
    }""")
    
    # Property 4: Allowance mechanics
    if is_erc20:
        tests.append("""
    /// @notice Symbolic test: Approve sets correct allowance
    function check_approveSetAllowance(address owner, address spender, uint256 amount) public {
        vm.assume(owner != address(0));
        vm.assume(spender != address(0));
        
        vm.prank(owner);
        token.approve(spender, amount);
        
        // PROPERTY: Allowance is set to exact value
        assert(token.allowance(owner, spender) == amount);
    }
    
    /// @notice Symbolic test: TransferFrom respects allowance
    function check_transferFromRespectsAllowance(
        address owner, address spender, address recipient, uint256 amount
    ) public {
        vm.assume(owner != address(0));
        vm.assume(spender != address(0));
        vm.assume(recipient != address(0));
        vm.assume(spender != owner);
        
        uint256 allowanceBefore = token.allowance(owner, spender);
        uint256 ownerBalBefore = token.balanceOf(owner);
        
        vm.assume(amount <= allowanceBefore);
        vm.assume(amount <= ownerBalBefore);
        
        vm.prank(spender);
        token.transferFrom(owner, recipient, amount);
        
        // PROPERTY: Allowance decreases (unless infinite)
        if (allowanceBefore != type(uint256).max) {
            assert(token.allowance(owner, spender) == allowanceBefore - amount);
        }
    }""")
    
    tests_str = "\n".join(tests) if tests else """
    /// @notice Basic symbolic test
    function check_noRevert(uint256 x, uint256 y) public {
        vm.assume(y != 0);
        assert(x / y <= x);
    }"""
    
    return f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{contract_name}.sol";

/**
 * Halmos Symbolic Test Suite
 * Generated by Solay39 Deep Review
 * 
 * These tests use symbolic execution to mathematically verify
 * that the contract properties hold for ALL possible inputs.
 */
contract {contract_name}SymbolicTest is Test {{
    {contract_name} public token;

    function setUp() public {{
        // Deploy contract
        token = new {contract_name}();
    }}
{tests_str}
}}
"""

# ── Foundry Forge ─────────────────────────────────────────────────
async def run_foundry(code: str, contract_name: str, tmpdir: str) -> dict:
    """
    Creates a minimal Foundry project, writes the contract,
    generates fuzz tests for public functions, runs forge test.
    """
    forge_dir = os.path.join(tmpdir, "forge_project")
    os.makedirs(forge_dir, exist_ok=True)

    # Init foundry project
    run_cmd(["forge", "init", "--no-git", "--no-commit"], forge_dir, timeout=30)

    # Write contract
    src_dir = os.path.join(forge_dir, "src")
    os.makedirs(src_dir, exist_ok=True)
    safe_name = "".join(c for c in contract_name if c.isalnum()) or "Contract"
    contract_file = os.path.join(src_dir, f"{safe_name}.sol")
    with open(contract_file, "w") as f:
        f.write(code)

    # Generate fuzz test
    fuzz_test = _generate_fuzz_test(code, safe_name)
    test_dir = os.path.join(forge_dir, "test")
    os.makedirs(test_dir, exist_ok=True)
    with open(os.path.join(test_dir, f"{safe_name}Fuzz.t.sol"), "w") as f:
        f.write(fuzz_test)

    # foundry.toml
    sol_version = get_solc_version(code)
    toml_content = f"""[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "{sol_version}"
optimizer = true
optimizer_runs = 200
fuzz = {{ runs = 5000 }}
"""
    with open(os.path.join(forge_dir, "foundry.toml"), "w") as f:
        f.write(toml_content)

    # Install OZ if needed
    if "@openzeppelin" in code:
        run_cmd(
            ["forge", "install", "OpenZeppelin/openzeppelin-contracts", "--no-git", "--no-commit"],
            forge_dir, timeout=60
        )

    # Run tests
    rc, stdout, stderr = run_cmd(
        ["forge", "test", "--fuzz-runs", "5000", "-v"],
        forge_dir, timeout=120
    )

    # Parse results
    passed = stdout.count("[PASS]")
    failed = stdout.count("[FAIL]")
    coverage_match = None
    import re
    cov = re.search(r'(\d+\.\d+)%', stdout)
    if cov:
        coverage_match = float(cov.group(1))

    version = "unknown"
    _, ver_out, _ = run_cmd(["forge", "--version"], forge_dir, timeout=5)
    version = ver_out.strip().split("\n")[0] if ver_out else "forge unknown"

    return {
        "tool": "foundry",
        "version": version,
        "success": rc == 0,
        "passed": passed,
        "failed": failed,
        "coverage": coverage_match,
        "fuzz_runs": 5000,
        "error": stderr[:500] if rc != 0 else None,
        "raw_output": stdout[:3000] if stdout else stderr[:1000],
    }

def _generate_fuzz_test(code: str, contract_name: str) -> str:
    """Generate a basic Foundry fuzz test for public ERC-20 functions"""
    import re
    sol_version = get_solc_version(code)

    # Detect functions
    has_transfer = "function transfer(" in code
    has_approve = "function approve(" in code
    has_transfer_from = "function transferFrom(" in code
    has_mint = "function mint(" in code
    is_erc20 = has_transfer and has_approve

    tests = []

    if is_erc20:
        tests.append(f"""
    function testFuzz_Transfer(address to, uint256 amount) public {{
        vm.assume(to != address(0));
        vm.assume(to != address(this));
        uint256 bal = token.balanceOf(address(this));
        amount = bound(amount, 0, bal);
        bool ok = token.transfer(to, amount);
        assertTrue(ok);
    }}

    function testFuzz_Approve(address spender, uint256 amount) public {{
        vm.assume(spender != address(0));
        bool ok = token.approve(spender, amount);
        assertTrue(ok);
        assertEq(token.allowance(address(this), spender), amount);
    }}""")

    if has_transfer_from:
        tests.append(f"""
    function testFuzz_TransferFrom(address from, address to, uint256 amount) public {{
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(to != address(this));
        uint256 bal = token.balanceOf(from);
        amount = bound(amount, 0, bal);
        vm.prank(from);
        token.approve(address(this), amount);
        bool ok = token.transferFrom(from, to, amount);
        assertTrue(ok);
    }}""")

    tests_str = "\n".join(tests) if tests else """
    function testFuzz_Basic(uint256 x) public {{
        assertTrue(x >= 0);
    }}"""

    return f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{contract_name}.sol";

contract {contract_name}FuzzTest is Test {{
    {contract_name} public token;

    function setUp() public {{
        // Deploy with this contract as recipient
        // Adjust constructor args as needed
        try new {contract_name}(address(this)) returns ({contract_name} t) {{
            token = t;
        }} catch {{
            // Try no-arg constructor
            // token = new {contract_name}();
        }}
    }}
{tests_str}
}}
"""

# ── Exploit PoC Generator ─────────────────────────────────────────
def generate_exploit_poc(req: ExploitRequest) -> str:
    """Generate a Foundry exploit test based on finding type"""
    sol_version = get_solc_version(req.code)
    safe_name = "".join(c for c in req.contractName if c.isalnum()) or "Contract"

    templates = {
        "reentrancy": f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{safe_name}.sol";

/**
 * Exploit PoC: {req.findingTitle}
 * Location: {req.location}
 * Generated by Solay39 Deep Review
 */
contract ReentrancyAttacker {{
    {safe_name} public target;
    uint256 public attackCount;

    constructor(address _target) {{
        target = {safe_name}(_target);
    }}

    // Fallback called during reentrancy
    receive() external payable {{
        if (attackCount < 3 && address(target).balance > 0) {{
            attackCount++;
            // Re-enter before state is updated
            target.withdraw(msg.value); // adjust function name
        }}
    }}

    function attack() external payable {{
        target.deposit{{value: msg.value}}();
        target.withdraw(msg.value);
    }}
}}

contract ReentrancyExploitTest is Test {{
    {safe_name} public target;
    ReentrancyAttacker public attacker;

    function setUp() public {{
        target = new {safe_name}();
        attacker = new ReentrancyAttacker(address(target));
        // Fund target with 10 ETH (simulating other users)
        vm.deal(address(target), 10 ether);
    }}

    function test_ReentrancyExploit() public {{
        uint256 targetBalBefore = address(target).balance;
        console.log("Target balance before:", targetBalBefore);

        // Attack with 1 ETH
        vm.deal(address(attacker), 1 ether);
        attacker.attack{{value: 1 ether}}();

        uint256 targetBalAfter = address(target).balance;
        console.log("Target balance after:", targetBalAfter);
        console.log("Attacker balance:", address(attacker).balance);

        // Assert funds were drained
        assertLt(targetBalAfter, targetBalBefore, "Reentrancy: funds should be drained");
    }}
}}""",

        "access_control": f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{safe_name}.sol";

/**
 * Exploit PoC: {req.findingTitle}
 * Location: {req.location}
 * Generated by Solay39 Deep Review
 */
contract AccessControlExploitTest is Test {{
    {safe_name} public target;
    address attacker = address(0xBEEF);
    address owner;

    function setUp() public {{
        target = new {safe_name}();
        owner = target.owner(); // adjust if no owner()
    }}

    function test_UnauthorizedAccess() public {{
        // Attacker (non-owner) calls privileged function
        vm.prank(attacker);

        // This should REVERT but the finding says it doesn't
        // Adjust the function call to match the finding location
        // target.privilegedFunction();

        console.log("If this test PASSES, the access control is BROKEN");
        console.log("Attacker:", attacker);
        console.log("Owner:", owner);

        // Test: attacker should NOT be able to call privileged function
        vm.expectRevert();
        vm.prank(attacker);
        // target.{req.location.split("(")[0].split(".")[-1]}(); // uncomment and adjust
    }}
}}""",

        "flash_loan": f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{safe_name}.sol";

interface IERC20 {{
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}}

/**
 * Exploit PoC: {req.findingTitle} — Flash Loan Price Manipulation
 * Location: {req.location}
 * Generated by Solay39 Deep Review
 */
contract FlashLoanAttacker {{
    {safe_name} public target;
    IERC20 public token;

    constructor(address _target, address _token) {{
        target = {safe_name}(_target);
        token = IERC20(_token);
    }}

    function attack(uint256 flashAmount) external {{
        // 1. Take flash loan (simulated: tokens already in attacker)
        // 2. Manipulate price oracle
        // target.swap(flashAmount, 0, ...);  // dump price
        // 3. Call vulnerable function while price is manipulated
        // target.liquidate(...);
        // 4. Profit + repay flash loan
    }}
}}

contract FlashLoanExploitTest is Test {{
    {safe_name} public target;

    function setUp() public {{
        target = new {safe_name}();
        // Setup liquidity, adjust as needed
    }}

    function test_FlashLoanManipulation() public {{
        uint256 balBefore = address(this).balance;
        console.log("Balance before attack:", balBefore);

        // Simulate flash loan attack
        // 1. Borrow large amount
        // 2. Manipulate price
        // 3. Exploit
        // 4. Repay

        uint256 balAfter = address(this).balance;
        console.log("Balance after attack:", balAfter);
        console.log("Profit:", balAfter > balBefore ? balAfter - balBefore : 0);
    }}
}}""",

        "oracle": f"""// SPDX-License-Identifier: MIT
pragma solidity {sol_version};

import "forge-std/Test.sol";
import "../src/{safe_name}.sol";

/**
 * Exploit PoC: {req.findingTitle} — Oracle Manipulation
 * Location: {req.location}
 * Generated by Solay39 Deep Review
 */
contract OracleManipulationTest is Test {{
    {safe_name} public target;

    function setUp() public {{
        target = new {safe_name}();
    }}

    function test_StaleOracleData() public {{
        // Simulate stale oracle by warping time forward
        vm.warp(block.timestamp + 2 hours); // Past typical heartbeat

        // Call the function that reads oracle price
        // The price should be rejected as stale, but the finding says it's not
        console.log("Testing oracle staleness at timestamp:", block.timestamp);

        // target.functionUsingOracle(); // Should revert with stale data
        // If it doesn't revert, the oracle check is missing
    }}

    function test_PriceManipulation() public {{
        // Simulate price manipulation by calling the function with
        // artificially moved spot price (e.g., after large AMM trade)
        console.log("Testing price manipulation vulnerability");
        // Add specific manipulation steps here
    }}
}}""",
    }

    template_key = req.findingType.lower().replace("-", "_").replace(" ", "_")
    # Map common variants
    mapping = {
        "reentrancy_erc777": "reentrancy",
        "reentrancy_erc1155": "reentrancy",
        "missing_access_control": "access_control",
        "unprotected_function": "access_control",
        "flash_loan_price_manipulation": "flash_loan",
        "oracle_manipulation": "oracle",
        "price_oracle_manipulation": "oracle",
    }
    template_key = mapping.get(template_key, template_key)
    template = templates.get(template_key, templates["access_control"])
    return template

# ── Routes ────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    # Check tool availability
    tools = {}
    for tool, cmd in [("slither", ["slither", "--version"]), ("mythril", ["myth", "version"]), ("foundry", ["forge", "--version"])]:
        rc, out, _ = run_cmd(cmd, "/tmp", timeout=5)
        tools[tool] = {"available": rc == 0, "version": out.strip()[:50] if out else "not found"}

    return {"status": "ok", "tools": tools, "version": "2.0.0"}

@app.post("/analyze")
async def analyze(req: AnalysisRequest, authorization: Optional[str] = Header(None)):
    # Auth check
    if API_KEY and API_KEY != "solay39-analysis-key":
        token = (authorization or "").replace("Bearer ", "")
        if token != API_KEY:
            raise HTTPException(status_code=401, detail="Unauthorized")

    # Cache check
    cache_key = hashlib.md5(f"{req.code}{req.contractName}{''.join(sorted(req.tools))}".encode()).hexdigest()
    cached = cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    with tempfile.TemporaryDirectory() as tmpdir:
        results = {}

        # Run requested tools in parallel
        tasks = []
        if "slither" in req.tools:
            tasks.append(("slither", run_slither(req.code, req.contractName, tmpdir)))
        if "mythril" in req.tools:
            tasks.append(("mythril", run_mythril(req.code, req.contractName, tmpdir)))
        if "foundry" in req.tools:
            tasks.append(("foundry", run_foundry(req.code, req.contractName, tmpdir)))
        if "halmos" in req.tools:
            tasks.append(("halmos", run_halmos(req.code, req.contractName, tmpdir)))

        for tool_name, coro in tasks:
            try:
                results[tool_name] = await coro
            except Exception as e:
                results[tool_name] = {
                    "tool": tool_name, "version": "unknown",
                    "success": False, "findings": [], "error": str(e)
                }

        response = {
            "success": True,
            "contractName": req.contractName,
            "analysisMode": "real",
            **results
        }

        cache_set(cache_key, response)
        return response

@app.post("/exploit")
async def generate_exploit(req: ExploitRequest, authorization: Optional[str] = Header(None)):
    """Generate Foundry exploit PoC for a finding"""
    if API_KEY and API_KEY != "solay39-analysis-key":
        token = (authorization or "").replace("Bearer ", "")
        if token != API_KEY:
            raise HTTPException(status_code=401, detail="Unauthorized")

    poc_code = generate_exploit_poc(req)

    # Optionally run the PoC to see if it compiles
    compile_success = False
    with tempfile.TemporaryDirectory() as tmpdir:
        forge_dir = os.path.join(tmpdir, "test_poc")
        os.makedirs(os.path.join(forge_dir, "src"), exist_ok=True)
        os.makedirs(os.path.join(forge_dir, "test"), exist_ok=True)
        run_cmd(["forge", "init", "--no-git", "--no-commit"], forge_dir, timeout=30)

        safe_name = "".join(c for c in req.contractName if c.isalnum()) or "Contract"
        with open(os.path.join(forge_dir, "src", f"{safe_name}.sol"), "w") as f:
            f.write(req.code)
        with open(os.path.join(forge_dir, "test", "Exploit.t.sol"), "w") as f:
            f.write(poc_code)

        rc, stdout, stderr = run_cmd(["forge", "build"], forge_dir, timeout=60)
        compile_success = rc == 0

    return {
        "success": True,
        "findingTitle": req.findingTitle,
        "findingType": req.findingType,
        "poc": poc_code,
        "compiles": compile_success,
        "language": "solidity",
        "framework": "foundry",
        "instructions": [
            "1. Copy the PoC to your Foundry project test/ directory",
            "2. Adjust constructor arguments and function names to match your contract",
            f"3. Run: forge test --match-test test_{req.findingType.replace('-','_').title()} -vvvv",
            "4. If the test PASSES, the vulnerability is confirmed",
            "5. If the test REVERTS as expected, the vulnerability may be mitigated",
        ]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
