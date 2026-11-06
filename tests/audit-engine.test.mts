// Regression tests for core/engine/auditEngine.ts
// Run with: pnpm test:engine
import { test } from "node:test"
import assert from "node:assert/strict"
import { runAuditEngine } from "../core/engine/auditEngine.ts"

const SAFE_CEI = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
contract SafeVault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "bal");
        balances[msg.sender] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "fail");
        uint256 localAfterCall = 1;
        localAfterCall;
    }
}`

// Imports ReentrancyGuard but forgets nonReentrant on withdraw()
const REENTRANT_WITH_GUARD_IMPORT = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract Vault is ReentrancyGuard {
    mapping(address => uint256) public balances;
    function protectedFn() external nonReentrant {}
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}`

const GUARDED = REENTRANT_WITH_GUARD_IMPORT.replace("function withdraw() external {", "function withdraw() external nonReentrant {")

const reentrancy = (r: Awaited<ReturnType<typeof runAuditEngine>>) =>
  r.staticAnalysis.findings.filter((f) => f.id.startsWith("REENTRANCY"))

test("engine runs end-to-end without throwing", async () => {
  const r = await runAuditEngine(SAFE_CEI, { contractName: "SafeVault", network: "ethereum" })
  assert.ok(Array.isArray(r.staticAnalysis.findings))
  assert.equal(r.metadata.chainConfig?.id, "ethereum")
})

test("no hard-coded coverage or check counts", async () => {
  const r = await runAuditEngine(SAFE_CEI, { contractName: "SafeVault" })
  assert.equal(r.staticAnalysis.coverage, null)
  assert.equal(r.summary.totalChecks, r.staticAnalysis.checksRun)
  assert.ok(r.summary.passedChecks <= r.summary.totalChecks)
  assert.ok(!("reputation" in r)) // sample track-record data must never leak into a report
})

test("CEI-compliant withdraw is not flagged as reentrancy", async () => {
  const r = await runAuditEngine(SAFE_CEI, { contractName: "SafeVault" })
  assert.equal(reentrancy(r).length, 0)
})

test("reentrancy is detected even when ReentrancyGuard is imported elsewhere", async () => {
  const r = await runAuditEngine(REENTRANT_WITH_GUARD_IMPORT, { contractName: "Vault" })
  const hits = reentrancy(r)
  assert.equal(hits.length, 1)
  assert.match(hits[0].location, /withdraw\(\)/)
})

test("nonReentrant on the function suppresses the reentrancy finding", async () => {
  const r = await runAuditEngine(GUARDED, { contractName: "Vault" })
  assert.equal(reentrancy(r).length, 0)
})

test("signature matches are grouped per signature", async () => {
  const r = await runAuditEngine(REENTRANT_WITH_GUARD_IMPORT, { contractName: "Vault" })
  const ids = r.signatureMatches.map((m) => m.signatureId)
  assert.equal(new Set(ids).size, ids.length)
})
