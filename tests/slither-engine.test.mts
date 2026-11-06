// Slither integration tests for core/engine. Uses real Slither output recorded
// from slither-worker (tests/fixtures/slither-results.json), so no network is needed.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runAuditEngine } from "../core/engine/auditEngine.ts"
import { slitherSeverity, slitherToFindings } from "../core/engine/slitherMapper.ts"
import type { SlitherRunResult } from "../lib/slither-client.ts"

type Fixture = { code: string; contractName: string; result: SlitherRunResult }
const fx = JSON.parse(readFileSync(new URL("./fixtures/slither-results.json", import.meta.url), "utf8")) as Record<string, Fixture>

const run = (name: string) =>
  runAuditEngine(fx[name].code, { contractName: fx[name].contractName, slither: fx[name].result })

const reentrancyFindings = (r: Awaited<ReturnType<typeof runAuditEngine>>) =>
  r.staticAnalysis.findings.filter((f) => /reentran/i.test(f.title) || f.id.startsWith("REENTRANCY"))

test("Slither is the primary engine when it ran", async () => {
  const r = await run("reentrant")
  assert.equal(r.toolchain.mode, "slither")
  assert.equal(r.toolchain.slither.slitherVersion, "0.11.6")
  assert.match(r.toolchain.slither.sourceSha256 ?? "", /^[0-9a-f]{64}$/)
  assert.ok((r.toolchain.slither.detectorsRun ?? 0) > 80)
})

test("real reentrancy: one CRITICAL Slither finding with location and evidence", async () => {
  const r = await run("reentrant")
  const hits = reentrancyFindings(r)
  assert.equal(hits.length, 1)
  const [hit] = hits
  assert.equal(hit.source, "slither")
  assert.equal(hit.detector, "reentrancy-eth")
  assert.equal(hit.severity, "CRITICAL")
  assert.equal(hit.swcId, "SWC-107")
  assert.match(hit.location, /Bank\.withdraw\(\) L6-L11/)
  assert.match(hit.codeEvidence ?? "", /msg\.sender\.call/)
  assert.ok(hit.recommendation.length > 10)
})

test("CEI-compliant vault: no reentrancy and no CRITICAL/HIGH false positives", async () => {
  const withSlither = await run("safe")
  assert.equal(reentrancyFindings(withSlither).length, 0)
  assert.ok(withSlither.toolchain.heuristicFindingsDropped > 0)
  // A correct CEI vault must not get CRITICAL/HIGH findings
  assert.deepEqual(
    withSlither.staticAnalysis.findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").map((f) => f.title),
    []
  )
})

test("unprotected selfdestruct on solc 0.7.6 is CRITICAL", async () => {
  const r = await run("old")
  const hit = r.staticAnalysis.findings.find((f) => f.detector === "suicidal")
  assert.equal(hit?.severity, "CRITICAL")
  assert.equal(r.toolchain.slither.solcVersion, "0.7.6")
})

test("OpenZeppelin library code produces no findings", async () => {
  const r = await run("oz5")
  assert.equal(r.toolchain.mode, "slither")
  assert.ok(r.staticAnalysis.findings.every((f) => !/node_modules|solidity-libs/.test(f.location)))
})

test("falls back to heuristics, clearly labelled, when Slither is unavailable", async () => {
  const r = await runAuditEngine(fx.reentrant.code, { contractName: "Bank" }) // worker not configured in tests
  assert.equal(r.toolchain.mode, "heuristic-only")
  assert.equal(r.toolchain.slither.status, "unavailable")
  assert.ok(r.staticAnalysis.findings.every((f) => f.source !== "slither"))
})

test("compile errors are surfaced, not silently replaced", async () => {
  const failed: SlitherRunResult = { tool: "slither", status: "compile_error", findings: [], error: "ParserError: Expected ';'" }
  const r = await runAuditEngine(fx.reentrant.code, { contractName: "Bank", slither: failed })
  assert.equal(r.toolchain.mode, "heuristic-only")
  assert.equal(r.toolchain.slither.error, "ParserError: Expected ';'")
  assert.deepEqual(slitherToFindings(failed), [])
})

test("severity matrix", () => {
  assert.equal(slitherSeverity({ check: "reentrancy-eth", impact: "High", confidence: "Medium" }), "CRITICAL")
  assert.equal(slitherSeverity({ check: "reentrancy-eth", impact: "High", confidence: "Low" }), "MEDIUM")
  assert.equal(slitherSeverity({ check: "uninitialized-state", impact: "High", confidence: "High" }), "HIGH")
  assert.equal(slitherSeverity({ check: "tx-origin", impact: "Medium", confidence: "Medium" }), "MEDIUM")
  assert.equal(slitherSeverity({ check: "solc-version", impact: "Informational", confidence: "High" }), "INFO")
})
