import test from "node:test"
import assert from "node:assert/strict"
import { createScorecard, validateAuditRecord } from "./audit-record-utils.mjs"

function record(overrides = {}) {
  return {
    schemaVersion: "1.0",
    auditId: "demo-audit-001",
    project: { name: "Example", network: "local" },
    audit: {
      status: "MANUAL_REVIEWED",
      scope: "contracts/Example.sol at pinned revision",
      methodologyVersion: "1.0",
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-02T00:00:00Z",
      sourceCommit: { repository: "https://example.invalid/repo", sha: "a".repeat(40) },
    },
    review: { status: "FULL", reviewers: [{ name: "Reviewer One", role: "Manual reviewer" }] },
    findings: [
      { id: "F-001", severity: "HIGH", title: "High finding", description: "Example", status: "OPEN", location: { file: "contracts/Example.sol", startLine: 10 }, evidenceArtifactIds: ["poc"] },
      { id: "F-002", severity: "MEDIUM", title: "Mitigated finding", description: "Example", status: "MITIGATED", location: { file: "contracts/Example.sol" }, evidenceArtifactIds: [] },
      { id: "F-003", severity: "LOW", title: "Accepted risk", description: "Example", status: "ACCEPTED_RISK", location: { file: "contracts/Example.sol" }, evidenceArtifactIds: [] },
    ],
    evidence: { artifacts: [{ id: "poc", path: "reports/poc.txt", mediaType: "text/plain" }] },
    ...overrides,
  }
}

test("validates a complete manually reviewed record", () => {
  assert.deepEqual(validateAuditRecord(record()), [])
})

test("rejects findings that reference missing evidence artifacts", () => {
  const data = record()
  data.findings[0].evidenceArtifactIds = ["missing"]
  assert.ok(validateAuditRecord(data).some((error) => error.includes("unknown artifact missing")))
})

test("rejects a published audit without full manual review", () => {
  const data = record({ audit: { ...record().audit, status: "PUBLISHED" }, review: { status: "PARTIAL", reviewers: [] } })
  assert.ok(validateAuditRecord(data).some((error) => error.includes("requires review.status=FULL")))
})

test("scorecard is traceable and only deducts unresolved/accepted findings", () => {
  const scorecard = createScorecard(record(), "b".repeat(64))
  assert.equal(scorecard.score, 89)
  assert.equal(scorecard.totalPenalty, 11)
  assert.deepEqual(scorecard.deductions.map((item) => item.findingId), ["F-001", "F-003"])
  assert.equal(scorecard.reportSha256, "b".repeat(64))
  assert.equal(scorecard.sourceCommit.sha, "a".repeat(40))
})

test("does not score draft or automated-only records", () => {
  const data = record({ audit: { ...record().audit, status: "AUTOMATED_PRELIMINARY" }, review: { status: "PARTIAL", reviewers: [] } })
  assert.throws(() => createScorecard(data, "b".repeat(64)), /FULL manual review/)
})
