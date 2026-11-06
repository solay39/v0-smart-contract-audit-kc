import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PreliminaryAuditReport } from "../components/preliminary-audit-report"
import type { PortfolioProject } from "../lib/solay39-constants"
import { exactAuditBlob, isPublicAuditId, lookupPublishedAudit, publicAuditIds, publicPublicationReceipt } from "../lib/published-audit-lookup.ts"

test("audit ids accept the ZIG slug but reject traversal, unsafe and oversized input", () => {
  assert.equal(isPublicAuditId("zig-coin-1793976984394"), true)
  for (const id of ["", "../zig", "zig/coin", "%2f", "a".repeat(201)]) {
    assert.equal(isPublicAuditId(id), false)
  }
})

test("explicit aliases do not cause duplicate database reads", () => {
  assert.deepEqual(publicAuditIds("zig-coin-1793976984394"), ["zig-coin-1793976984394"])
  assert.deepEqual(publicAuditIds("injective-token"), ["injective-token", "inj-token"])
})

test("Supabase-backed report is found even when no static or Blob report exists", async () => {
  const saved = { id: "zig-coin-1793976984394", name: "ZIG Coin", score: 12 }
  const calls: string[] = []
  const result = await lookupPublishedAudit(saved.id, [
    () => null,
    (id) => { calls.push(id); return saved },
    () => { throw new Error("Blob must not override the persisted record") },
  ])
  assert.deepEqual(result, saved)
  assert.deepEqual(calls, [saved.id])
})

test("an unrelated record is never substituted for the requested audit", async () => {
  const result = await lookupPublishedAudit("zig", [() => ({ id: "zig-other", score: 100 })])
  assert.equal(result, null)
})

test("Blob lookup requires the exact filename, not just a common prefix", () => {
  const adjacent = [
    { pathname: "audits/zig-other.json" },
    { pathname: "audits/zig.json.backup.json" },
  ]
  assert.equal(exactAuditBlob(adjacent, "zig"), undefined)
  assert.deepEqual(exactAuditBlob([...adjacent, { pathname: "audits/zig.json" }], "zig"), { pathname: "audits/zig.json" })
})

test("invalid id causes no storage reads and a genuinely missing report stays missing", async () => {
  let reads = 0
  assert.equal(await lookupPublishedAudit("../invalid", [() => { reads++; return null }]), null)
  assert.equal(reads, 0)
  assert.equal(await lookupPublishedAudit("missing", [() => null, () => null]), null)
})

test("public report client does not load or merge browser-local audit drafts", () => {
  const client = readFileSync(new URL("../app/audit/[id]/client.tsx", import.meta.url), "utf8")
  assert.ok(!client.includes("getPublishedAudits"))
  assert.ok(!client.includes("...local"))
  assert.ok(client.includes('cache: "no-store"'))
})

test("GitHub artifacts alone never produce a successful public publication", () => {
  const result = publicPublicationReceipt(false, "https://github.com/owner/repo/report.html")
  assert.equal(result.success, false)
  assert.equal(result.publicationStatus, "ARTIFACTS_ONLY")
  assert.equal(result.httpStatus, 503)
  assert.equal(publicPublicationReceipt(false).publicationStatus, "FAILED")
})

test("publication succeeds only after canonical server persistence", () => {
  assert.deepEqual(publicPublicationReceipt(true), {
    success: true, publicationStatus: "PUBLISHED", httpStatus: 200,
  })
})

test("pending report renders findings without promoting unverified template claims", () => {
  const html = renderToStaticMarkup(createElement(PreliminaryAuditReport, {
    project: {
      id: "pending", name: "Pending contract", network: "Ethereum",
      score: 100, rating: "AAA",
      engagement: { engineeringHours: 900 },
      findings: [{ id: 1, title: "Review this issue", severity: "HIGH", description: "Submitted description", location: "Vault.sol:12" }],
    } as unknown as PortfolioProject,
  }))
  assert.match(html, /PRELIMINARY REPORT/)
  assert.match(html, /Review this issue/)
  assert.match(html, /SUBMITTED, NOT VALIDATED/)
  assert.ok(!html.includes("AAA"))
  assert.ok(!html.includes("TIER-1"))
  assert.ok(!html.includes("900"))
})
