import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PUBLIC_EXECUTION_SUMMARY as summary, executionCounts, historicalExecutionFor, historicalExecutionMarkdown } from "../lib/historical-execution"
import { HistoricalExecutionSummary } from "../components/historical-execution-summary"
import { PreliminaryAuditReport } from "../components/preliminary-audit-report"
import { preliminaryMarkdown } from "../lib/preliminary-report"
import type { PortfolioProject } from "../lib/solay39-constants"

const aero = {
  id: "aerodrome-1772654966787", name: "Aerodrome", ticker: "AERO",
  network: "Base", contractAddress: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
  findings: [], score: 0, rating: "PENDING",
} as unknown as PortfolioProject
const tag = {
  ...aero, id: "tagger-1793148483876", name: "Tagger", ticker: "TAG",
  network: "BSC", contractAddress: "0x208bF3E7dA9639f1Eaefa2DE78c23396B0682025",
}

test("public projection contains no private catalog, raw log or approval fields", () => {
  assert.deepEqual(Object.keys(summary).sort(), ["schema", "capturedOn", "assurance", "evidenceIndexSha256", "specificBatch", "targets"].sort())
  const allowedTarget = new Set(["chainId", "address", "batch", "sourceManifestSha256", "sourceFileSha256", "executionOutputSha256", "tests"])
  const allowedTest = new Set(["name", "category", "status", "runs", "calls"])
  for (const row of summary.targets) {
    assert.ok(Object.keys(row).every(key => allowedTarget.has(key)))
    assert.match(row.address, /^0x[a-f0-9]{40}$/)
    assert.match(row.sourceManifestSha256, /^[a-f0-9]{64}$/)
    assert.match(row.executionOutputSha256, /^[a-f0-9]{64}$/)
    assert.equal(new Set(row.tests.map(t => t.name)).size, row.tests.length)
    for (const property of row.tests) {
      assert.ok(Object.keys(property).every(key => allowedTest.has(key)))
      assert.equal(property.status, "passed")
    }
  }
  assert.equal(new Set(summary.targets.map(t => `${t.chainId}-${t.address}`)).size, summary.targets.length)
})

test("new-batch aggregates reconcile to its individual recorded properties, excluding AERO/TAG", () => {
  const rows = summary.targets.filter(t => t.batch === "historical-specific")
  assert.equal(rows.length, summary.specificBatch.targets)
  assert.equal(rows.reduce((n, row) => n + row.tests.length, 0), 757)
  assert.equal(rows.reduce((n, row) => n + executionCounts(row).fuzzCases, 0), 39936)
  assert.equal(rows.reduce((n, row) => n + executionCounts(row).statefulCalls, 0), 133120)
  assert.equal(rows.flatMap(row => row.tests).filter(t => t.category === "invariant").length, 65)
  assert.equal(summary.specificBatch.testResults, 757)
  assert.equal(summary.specificBatch.fuzzCases, 39936)
  assert.equal(summary.specificBatch.statefulCalls, 133120)
  assert.equal(summary.specificBatch.invariantCampaigns, 65)
  assert.equal(summary.evidenceIndexSha256, "0b4d459f00c398702185418938551d97930249c9c221a887663ed0bd4bfe98c9")
  assert.equal(summary.targets.length, 93)
})

test("matching requires network and address; neither token name nor report ID is sufficient", () => {
  assert.equal(historicalExecutionFor(aero)?.tests.length, 8)
  assert.equal(historicalExecutionFor(tag)?.tests.length, 12)
  for (const project of [
    { ...aero, network: "Ethereum" },
    { ...aero, network: "unrecognized" },
    { ...aero, contractAddress: undefined },
    { ...aero, contractAddress: "0x" + "1".repeat(40) },
    { ...aero, contractAddress: aero.contractAddress + " " },
  ]) assert.equal(historicalExecutionFor(project), undefined)
  assert.equal(historicalExecutionFor({ ...aero, network: " base " })?.tests.length, 8)
  assert.equal(historicalExecutionFor({ ...aero, name: "Not a token name" } as PortfolioProject)?.tests.length, 8)
})

test("AERO shows only eight older properties, captured source digest and pending approval", () => {
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: aero }))
  for (const text of ["View 8 executed properties", "Historical execution results", "8/8", "256", "Awaiting founder review", "not a verified match", "not on the current production deployment", "Formal verification was not run"]) {
    assert.ok(html.includes(text), text)
  }
  assert.ok(!html.includes("757"))
  const md = preliminaryMarkdown(aero)
  assert.ok(md.includes("Passed properties: 8/8"))
  assert.ok(md.includes("552a43d10b27089cc1847a012217a103ee98896132cc9e128797eaff2dc4c01c") === false, "AERO source-file digest is not substituted for manifest")
  assert.ok(md.includes("Founder approval: pending"))
  assert.ok(md.includes("current deployed bytecode"))
})

test("TAG retains mocks, missing live integration checks and property details", () => {
  const html = renderToStaticMarkup(React.createElement(HistoricalExecutionSummary, { project: tag }))
  assert.ok(html.includes("12/12"))
  assert.ok(html.includes("mocked DEX dependencies"))
  assert.ok(html.includes("BSC locker behavior and live signer integration were not tested"))
  assert.ok(html.includes("Inspect executed properties (12)"))
  assert.ok(historicalExecutionMarkdown(tag).includes("mocked DEX"))
})

test("unknown target has no execution block or inferred export claims", () => {
  const unknown = { ...aero, network: "Solana" }
  assert.equal(renderToStaticMarkup(React.createElement(HistoricalExecutionSummary, { project: unknown })), "")
  assert.equal(historicalExecutionMarkdown(unknown), "")
})
