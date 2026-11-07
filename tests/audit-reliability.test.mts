import { test } from "node:test"
import assert from "node:assert/strict"
import { strToU8, zipSync } from "fflate"
import { createHash } from "node:crypto"
import { interpretFoundryTests, runExploitTest, simulateExploitTest } from "../core/poc/foundryRunner.ts"
import { runEnterprisePipeline, generateFindingJSON } from "../core/pipeline/enterprisePipeline.ts"
import { evaluateInvariants, DEFI_INVARIANTS, extractInvariantsFromCode } from "../core/formal/invariantEngine.ts"
import { parseArtifact, verifyCiArtifact, unpackCiArchive, dispatchStaticAnalysis } from "../lib/github-analysis-runner.ts"
import { ciFindingsForWorkspace } from "../lib/ci-workspace.ts"
import { ciEvidenceFixture } from "./fixtures/ci-evidence.ts"
import { preliminaryAutomatedAssessment } from "../lib/automated-assessment.ts"
import { readFileSync } from "node:fs"

test("primary AI and fallback routes cannot sign, publish or assert synthetic formal proofs", () => {
  const output = preliminaryAutomatedAssessment({
    findings: [{ title: "Candidate" }], formalVerification: {
      allPassed: true, invariantsTested: [{ invariant: "supply conservation", result: "PASS", method: "50,000 Echidna runs" }],
    }, signedReport: { signature: "fake" }, ipfsRecord: { cid: "fake" },
    aiEngagement: { engineeringHours: 100, numberOfAuditors: 4 },
    testingMethodology: { manualReviewHours: 100, fuzzingApplied: true },
    exploitSimulation: { vectors: [{ attackType: "reentrancy", gasUsed: 12345, confidence: 99, status: "SAFE" }] },
  })
  assert.equal(output.publicationStatus, "PRELIMINARY")
  for (const key of ["formalVerification", "signedReport", "ipfsRecord", "exploitSimulation"]) assert.equal(output[key], null)
  assert.deepEqual(output.verificationSuggestions, [{ property: "supply conservation", status: "NOT_RUN" }])
  assert.equal((output.aiEngagement as { engineeringHours: number }).engineeringHours, 0)
  assert.equal((output.testingMethodology as { fuzzingApplied: boolean }).fuzzingApplied, false)
  assert.equal((output.findings as unknown[]).length, 1)
  const route = readFileSync(new URL("../app/api/skynet/route.ts", import.meta.url), "utf8")
  assert.equal((route.match(/Response\.json\(preliminaryAutomatedAssessment\(/g) || []).length, 2)
  assert.doesNotMatch(route, /await signReport\(|await pinReportToIPFS\(|fetch\(baseUrl \+ "\/api\/registry"/)
})

test("severity and generated templates never fabricate exploit outcomes", () => {
  for (const severity of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]) {
    const result = simulateExploitTest("SOL-1", severity)
    assert.equal(result.exploit_result, "SKIPPED")
    assert.equal(result.execution_status, "NOT_RUN")
    assert.equal(result.tests_executed, 0)
    assert.equal(result.poc_generated, false)
  }
  assert.throws(() => runExploitTest("../arbitrary"), /Invalid finding/)
  assert.equal(runExploitTest("nonexistent-reliability-fixture").execution_status, "NOT_RUN")
})

test("passing and failing Forge assertions remain unverified exploit interpretations", () => {
  for (const status of ["Success", "Failure"]) {
    const result = interpretFoundryTests(JSON.stringify({ "PoC.t.sol:PoC": { test_results: { "testExample()": { status } } } }))
    assert.equal(result.exploit_result, "UNVERIFIED")
    assert.equal(result.tests_executed, 1)
    assert.equal(result.execution_status, status === "Success" ? "PASSED" : "FAILED")
  }
  assert.equal(interpretFoundryTests("{}").execution_status, "NOT_RUN")
  assert.throws(() => interpretFoundryTests("FAIL compilation error"))
  assert.throws(() => interpretFoundryTests("null"))
})

test("pipeline does not manufacture completed scans, manual review, exploits or approval", () => {
  const pipeline = runEnterprisePipeline("Fixture", [{
    id: "SOL-1", title: "Reentrancy", severity: "HIGH", contractName: "Fixture", status: "OPEN",
  }], [
    { auditor: "0x1", signature: "fake", role: "lead", signedAt: "2026-11-07" },
    { auditor: "0x2", signature: "fake", role: "reviewer", signedAt: "2026-11-07" },
  ])
  for (const prefix of ["1.", "2.", "5.", "7.", "8.", "9.", "10."]) {
    assert.notEqual(pipeline.pipelineSteps.find(step => step.step.startsWith(prefix))?.status, "pass")
  }
  assert.equal(pipeline.dualReview.valid, false)
  assert.equal(pipeline.findings[0].exploitResult.execution_status, "NOT_RUN")
  assert.equal((generateFindingJSON(pipeline.findings[0]) as { tests_executed: number }).tests_executed, 0)
})

test("zero-valued supply, balances and reserves are checked instead of skipped", () => {
  const results = evaluateInvariants({
    maxSupply: 0n, totalSupply: 1n, allBalances: [0n], balance: -1n,
    reserve0: 0n, reserve1: 2n, kLast: 1n, totalDebt: 1n, totalCollateral: 0n, maxLTV: 0,
  }, DEFI_INVARIANTS)
  for (const name of ["totalSupply <= maxSupply", "balance >= 0", "sum(balances) == totalSupply",
    "reserves > 0", "k = x * y (constant product)", "totalDebt <= totalCollateral * LTV"]) {
    assert.equal(results.find(result => result.invariant === name)?.status, "FAILED", name)
  }
  assert.equal(evaluateInvariants({ totalSupply: 0n, allBalances: [1n] })
    .find(result => result.invariant === "sum(balances) == totalSupply")?.status, "FAILED")
})

test("missing state, unexecuted expressions and evaluation failures are never passed proofs", () => {
  assert.ok(evaluateInvariants({}).every(result => result.status === "NOT_APPLICABLE"))
  const candidates = extractInvariantsFromCode("require(balance >= 0, 'balance');")
  assert.equal(evaluateInvariants({}, candidates).at(-1)?.status, "NOT_RUN")
  const checks = evaluateInvariants({}, [{
    name: "broken evaluator", condition: () => { throw new Error("broken") },
    description: "Fixture", severity: "HIGH",
  }])
  assert.equal(checks.at(-1)?.status, "ERROR")
  const decimal = evaluateInvariants({ totalDebt: 1n, totalCollateral: 100n, maxLTV: 12.34 }, DEFI_INVARIANTS)
  assert.equal(decimal.find(result => result.invariant === "totalDebt <= totalCollateral * LTV")?.status, "PASSED")
})

const context = { runId: 33, headSha: "d".repeat(40), runAttempt: 1, repository: "solay39/v0-smart-contract-audit-kc" }

test("v2 evidence binds source bytes, every consumed artifact, run, attempt and revision", () => {
  const { files } = ciEvidenceFixture("job")
  assert.doesNotThrow(() => verifyCiArtifact(files, "job", context))
  for (const changed of [{ ...context, runId: 34 }, { ...context, runAttempt: 2 },
    { ...context, headSha: "e".repeat(40) }, { ...context, repository: "other/repo" }]) {
    assert.throws(() => verifyCiArtifact(files, "job", changed), /GitHub run/)
  }
  assert.throws(() => verifyCiArtifact({ ...files, "source.sol": strToU8("changed") }, "job"), /integrity/)
  assert.throws(() => verifyCiArtifact({ ...files, "extra.json": strToU8("{}") }, "job"), /unhashed/)
})

test("missing hashes, legacy artifacts, forged source digest and false execution claims fail closed", () => {
  for (const kind of ["missing-hash", "legacy", "wrong-source", "fake-review", "fake-tool", "missing-status"]) {
    const { files, manifest } = ciEvidenceFixture("job")
    if (kind === "missing-hash") delete manifest.artifacts["slither.json"]
    if (kind === "legacy") manifest.schema_version = 1
    if (kind === "wrong-source") manifest.source_sha256 = "a".repeat(64)
    if (kind === "fake-review") manifest.claims.manual_review = true
    if (kind === "fake-tool") manifest.claims.mythril = false
    if (kind === "missing-status") manifest.tools.mythril.status = ""
    files["evidence-manifest.json"] = strToU8(JSON.stringify(manifest))
    assert.throws(() => verifyCiArtifact(files, "job"), undefined, kind)
  }
})

test("ZIP extraction rejects oversized, nested and duplicate artifact names", () => {
  assert.throws(() => unpackCiArchive(new Uint8Array(16 * 1024 * 1024 + 1)), /size limit/)
  assert.throws(() => unpackCiArchive(zipSync({ "nested/slither.json": strToU8("{}") })), /unsafe/)
  assert.throws(() => unpackCiArchive(zipSync({ "huge.log": new Uint8Array(8 * 1024 * 1024 + 1) })), /extraction/)
  const duplicate = Buffer.from(zipSync({ "a.txt": strToU8("a"), "b.txt": strToU8("b") }))
  for (let offset = duplicate.indexOf("b.txt"); offset !== -1; offset = duplicate.indexOf("b.txt", offset + 5)) {
    duplicate.write("a.txt", offset)
  }
  assert.throws(() => unpackCiArchive(duplicate), /ambiguous/)
})

test("malformed output is unsuccessful and compilation cannot attest tests or fuzzing", () => {
  for (const malformed of ["null", "[]", "7", '{"success":true,"results":{"detectors":"bad"},"issues":"bad","findings":"bad"}']) {
    const bytes = strToU8(malformed)
    const result = parseArtifact({ "slither.json": bytes, "mythril.json": bytes, "custom.json": bytes })
    assert.equal(result.slither.success, false)
    assert.equal(result.mythril.success, false)
    assert.equal(result.custom.success, false)
  }
  const result = parseArtifact({ "foundry.json": strToU8(JSON.stringify({
    success: true, mode: "submitted-contract-compilation", tests_executed: true, fuzzing_executed: true,
  })) })
  assert.equal(result.foundry.success, false)
  assert.equal(result.foundry.tests_executed, false)
  assert.equal(result.foundry.fuzzing_executed, false)
})

test("custom source checks reach the workspace as candidates, not reproduced exploits", () => {
  const { files } = ciEvidenceFixture("job")
  files["custom.json"] = strToU8(JSON.stringify({ success: true, findings: [{
    title: "tx.origin", severity: "HIGH", file: "Vault.sol", line: 8, proof_of_concept: "source line",
  }] }))
  const findings = ciFindingsForWorkspace(parseArtifact(files))
  assert.equal(findings.length, 1)
  assert.equal(findings[0].location, "Vault.sol:8")
  assert.match(findings[0].description, /not an executed exploit/)
})

test("public source dispatch requires consent; oversize source is rejected before networking", async () => {
  const previousFetch = globalThis.fetch
  const previousToken = process.env.GITHUB_TOKEN
  const previousPat = process.env.GITHUB_FINE_GRAINED_PAT
  const calls: string[] = []
  try {
    process.env.GITHUB_TOKEN = "test-fixture-not-a-credential"
    delete process.env.GITHUB_FINE_GRAINED_PAT
    globalThis.fetch = async (input, init) => {
      calls.push(String(input))
      if (init?.method === "POST") return new Response(null, { status: 204 })
      return Response.json({ private: false })
    }
    await assert.rejects(() => dispatchStaticAnalysis("pragma solidity ^0.8.20; contract Test {}", "Test"), /pubblico/)
    assert.equal(calls.length, 1)
    assert.ok(await dispatchStaticAnalysis("pragma solidity ^0.8.20; contract Test {}", "Test", true))
    assert.equal(calls.length, 3)
    await assert.rejects(() => dispatchStaticAnalysis("a".repeat(2 * 1024 * 1024 + 1), "Test", true), /2 MiB/)
    assert.equal(calls.length, 3)
  } finally {
    globalThis.fetch = previousFetch
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previousToken
    if (previousPat === undefined) delete process.env.GITHUB_FINE_GRAINED_PAT
    else process.env.GITHUB_FINE_GRAINED_PAT = previousPat
  }
})
