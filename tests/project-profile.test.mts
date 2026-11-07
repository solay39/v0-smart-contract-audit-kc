import { test } from "node:test"
import assert from "node:assert/strict"
import {
  projectProfileModel,
  publicProfileSnapshot,
} from "../lib/project-profile"
import { preliminaryMarkdown } from "../lib/preliminary-report"
import type { PortfolioProject } from "../lib/solay39-constants"

const record = (value: Record<string, unknown> = {}) =>
  ({
    id: "test-token-1",
    name: "Example",
    network: "BSC",
    ticker: "EX",
    date: "2026-11-07",
    findings: [],
    ...value,
  }) as unknown as PortfolioProject

test("Profile never converts legacy score, serialized approval or resolved flag into assurance", () => {
  const p = projectProfileModel(
    record({
      score: 100,
      rating: "AAA",
      status: "APPROVED_UNPUBLISHED",
      findings: [
        { title: "Example finding", severity: "HIGH", status: "RESOLVED" },
      ],
      auditorSignatures: [{ signed: true }],
    })
  )
  assert.equal(p.score, null)
  assert.equal(p.status, "Preliminary")
  assert.equal(p.findings.length, 1)
  assert.equal(p.distribution.find((r) => r.severity === "HIGH")?.count, 1)
})
test("Distribution recomputes submitted counts, including unclassified declarations", () => {
  const p = projectProfileModel(
    record({
      criticals: 90,
      findings: [
        { title: "A", severity: "LOW" },
        { title: "B", severity: "ODD" },
        { title: "C", severity: "HIGH" },
        null,
        {},
        { title: 42 },
      ],
    })
  )
  assert.equal(p.findings.length, 3)
  assert.equal(
    p.distribution.reduce((n, r) => n + r.count, 0),
    3
  )
  assert.equal(
    p.distribution.find((r) => r.severity === "UNCLASSIFIED")?.count,
    1
  )
  assert.equal(p.findings[1].displayId, "F-02")
})
test("Missing findings and empty findings have different evidence semantics", () => {
  assert.equal(
    projectProfileModel(record({ findings: undefined })).findingsSupplied,
    false
  )
  assert.equal(projectProfileModel(record()).findingsSupplied, true)
})
test("No ID-derived dates, unsafe logo, invented network, hash or source URL", () => {
  const p = projectProfileModel(
    record({
      id: "audit-1794012604049",
      date: "2026-02-30",
      name: null,
      network: "",
      logoUrl: "javascript:alert(1)",
      reportIntegrity: { sourceSha256: "bad" },
      engagement: { repositoryUrl: "https://user:pass@evil.test/source" },
    })
  )
  assert.equal(p.declaredAt, null)
  assert.equal(p.name, "Unnamed project")
  assert.equal(p.network, "Not disclosed")
  assert.equal(p.logoUrl, undefined)
  assert.equal(p.sourceHash, undefined)
  assert.equal(p.sourceUrl, undefined)
})
test("Source-bound linkage requires matching metadata and still issues no score", () => {
  const hash = "a".repeat(64)
  const p = record({
    reportIntegrity: { sourceSha256: hash },
    ciAnalysis: {
      jobId: "12345678-1234-1234-1234-123456789012",
      runUrl: "https://github.com/solay39/test/actions/runs/1",
      result: { evidenceManifest: { source_sha256: "b".repeat(64) } },
    },
  })
  assert.equal(projectProfileModel(p).ciLinked, false)
  ;(p.ciAnalysis!.result as any).evidenceManifest.source_sha256 = hash
  assert.equal(projectProfileModel(p).ciLinked, true)
  assert.equal(projectProfileModel(p).score, null)
})
test("Preview snapshot does not mirror approval/signature/identity secrets", () => {
  const p = record({
    founderKey: "do-not-copy",
    approval: { private: true },
    auditorSignatures: [{ value: "private-signature" }],
    manualReview: { reviewer: "private-person" },
    engagement: {
      repositoryUrl: "https://github.com/solay39/test",
      reviewTeam: { secret: "private-review" },
    },
    reportIntegrity: {
      sourceSha256: "a".repeat(64),
      founderSignature: "private-signature",
    },
  })
  const snapshot = JSON.stringify(publicProfileSnapshot(p))
  for (const value of [
    "do-not-copy",
    "private-signature",
    "private-person",
    "private-review",
  ])
    assert.equal(snapshot.includes(value), false)
  assert.ok(snapshot.includes("https://github.com/solay39/test"))
})
test("Preview preserves technical Markdown and declaration consistency for a public record", () => {
  const p = record({
    scopeTable: [
      {
        contract: "Token.sol",
        language: "Solidity",
        linesOfCode: 40,
        commit: "abc1234",
      },
    ],
    findings: [
      {
        title: "Floating pragma",
        severity: "LOW",
        location: "Token.sol:1",
        description: "Example",
        recommendation: "Lock compiler",
        proofOfConcept: "assert(true);",
      },
    ],
    engagement: {
      repositoryUrl: "https://github.com/solay39/test",
      commitHash: "abc1234",
    },
  })
  assert.equal(
    preliminaryMarkdown(publicProfileSnapshot(p)),
    preliminaryMarkdown(p)
  )
})
