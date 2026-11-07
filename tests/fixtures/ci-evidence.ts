import { createHash } from "node:crypto"
import { strToU8 } from "fflate"

export const evidenceSource = "pragma solidity ^0.8.20;\ncontract EvidenceFixture {}\n"
export const evidenceSourceHash = createHash("sha256").update(evidenceSource).digest("hex")

export function ciEvidenceFixture(jobId: string, failedSlither = false) {
  const json = (value: unknown) => strToU8(JSON.stringify(value))
  const files: Record<string, Uint8Array> = {
    "source.sol": strToU8(evidenceSource),
    "source-layout.json": json({ source_sha256: evidenceSourceHash, entry: "Contract.sol", sources: { "Contract.sol": evidenceSourceHash } }),
    "slither.json": json(failedSlither
      ? { success: false, error: "fixture compilation failed", results: {} }
      : { success: true, results: { detectors: [] } }),
    "mythril.json": json({ success: true, issues: [] }),
    "custom.json": json({ success: true, findings: [], checks: {}, version: "test-fixture" }),
    "foundry.json": json({
      success: true, mode: "submitted-contract-compilation", tests_executed: false, fuzzing_executed: false, invariants: 0,
    }),
    "meta.json": json({ solc: "0.8.20" }),
    "slither-version.txt": strToU8("fixture"),
    "mythril-version.txt": strToU8("fixture"),
    "foundry-version.txt": strToU8("fixture"),
    "pip-freeze.txt": strToU8("fixture==1.0"),
  }
  const manifest = {
    schema_version: 2, job_id: jobId, source_sha256: evidenceSourceHash,
    github: { repository: "solay39/v0-smart-contract-audit-kc", run_id: "33", workflow_sha: "d".repeat(40), run_attempt: "1" },
    tools: {
      slither: { status: failedSlither ? "FAILED" : "COMPLETED" },
      mythril: { status: "COMPLETED" }, custom: { status: "COMPLETED" }, foundry: { status: "COMPLETED" },
    },
    claims: {
      slither: !failedSlither, mythril: true, custom_regression: true, foundry_compile: true,
      protocol_fuzzing: false, invariants: false, manual_review: false,
    },
    artifacts: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [
      name, createHash("sha256").update(bytes).digest("hex"),
    ])),
  }
  files["evidence-manifest.json"] = json(manifest)
  return { files, manifest }
}
