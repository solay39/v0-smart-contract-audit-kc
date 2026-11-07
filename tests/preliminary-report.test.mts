import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PreliminaryAuditReport } from "../components/preliminary-audit-report"
import { findingReviewQuestion, preliminaryMarkdown, preliminaryModel, recordIssues, safeReportUrl } from "../lib/preliminary-report"
import type { PortfolioProject } from "../lib/solay39-constants"
import { PRELIMINARY_REPORT_STYLE } from "../lib/preliminary-report-style"
import { ReportTokenLogo } from "../components/report-token-logo"

const record = {
  id: "tagger-fixture", name: "Tagger", ticker: "TAG", network: "BSC",
  score: 100, rating: "AAA", date: "2026-10-28",
  architectureOverview: "Declared proxy architecture",
  scopeTable: [{ contract: "Tagger.sol", language: "Solidity", linesOfCode: 961, commit: `0x${"1".repeat(40)}` }],
  engagement: { engineeringHours: 98765, securityEngineersInvolved: 88888, repositoryUrl: "https://bscscan.com/address/0x1#code" },
  codeMetrics: { upgradeabilityPattern: "Proxy (detected in code)" },
  contractUncertainty: [{ label: "Mint Function", value: true }],
  exploitSimulation: { vectors: [{ description: "Contract is immutable (no proxy/upgrade pattern)" }] },
  testingMethodology: { fuzzingApplied: true, unitTestReview: { output: "FAKE_EXECUTION_LOG_SENTINEL" } },
  testCoverage: { fuzzTesting: { status: "NOT_RUN" } },
  findings: [
    { title: "Delegatecall Usage", severity: "HIGH", description: "Submitted issue", location: "Proxy.sol",
      foundryPoC: "vm.prank(proxyAdmin);", remediationExample: "require(approved[target]);", cvss: { baseScore: 8.5 } },
    { title: "Fixed Supply (Constructor-Only Mint)", severity: "INFO", description: "Fixed supply" },
    { title: "Initial Supply Concentration", severity: "INFO", description: "Economic observation" },
  ],
} as unknown as PortfolioProject

test("saved declaration contradictions are visible without auditing the contract", () => {
  assert.deepEqual(recordIssues(record).map(x => x.id), ["supply-conflict", "proxy-conflict", "test-conflict", "commit-conflict"])
  assert.equal(recordIssues({ id: "minimal" } as PortfolioProject).length, 0)
})
test("counts derive from submitted findings, never stale summary fields or scores", () => {
  const m = preliminaryModel({ ...record, highs: 99, criticals: 99 })
  assert.equal(m.counts.HIGH, 1)
  assert.equal(m.counts.INFO, 2)
  assert.equal(m.counts.CRITICAL, 0)
  assert.equal(m.pocCount, 1)
  assert.match(findingReviewQuestion("Delegatecall Usage"), /unprivileged actor/)
})
test("the original token logo is restored from report metadata without a security rating", () => {
  const logoUrl = "https://coin-images.coingecko.com/coins/images/53206/large/IMG_3196.png?1735664645"
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: { ...record, logoUrl } }))
  assert.ok(html.includes(`src="${logoUrl}"`))
  assert.ok(html.includes('alt="Tagger logo"'))
  assert.ok(html.includes('width="48" height="48"'))
  assert.ok(html.includes('data-logo-state="image"'))
  assert.ok(html.includes("Awaiting founder review"))
  assert.ok(!html.includes("AAA"))
})
test("missing and unsafe token logos use a neutral identity fallback", () => {
  for (const logoUrl of [undefined, "", "javascript:alert(1)", "data:image/svg+xml,bad", "https://user:password@example.test/logo.png"]) {
    const html = renderToStaticMarkup(React.createElement(ReportTokenLogo, { name: "Tagger", logoUrl }))
    assert.ok(html.includes('data-logo-state="fallback"'))
    assert.ok(html.includes('aria-label="Tagger logo unavailable"'))
    assert.ok(!html.includes("<img"))
    assert.ok(!html.includes("score"))
  }
})
test("report hash and run links cannot substitute for source-bound evidence", () => {
  const project = { ...record, reportIntegrity: { sha256: "a".repeat(64) } } as PortfolioProject
  assert.equal(preliminaryModel(project).sourceHash, undefined)
  const ci = { jobId: "7eece949-1e36-4a37-9cec-034f14011999",
    runUrl: "https://github.com/owner/repo/actions/runs/33",
    result: { evidenceManifest: { source_sha256: "a".repeat(64) } } } as PortfolioProject["ciAnalysis"]
  assert.equal(preliminaryModel({ ...project, ciAnalysis: ci }).ciLinked, false)
  const matching = { ...project, ciAnalysis: ci, reportIntegrity: { ...project.reportIntegrity!, sourceSha256: "a".repeat(64) } }
  assert.equal(preliminaryModel(matching).ciLinked, true)
  assert.equal(preliminaryModel({ ...matching, reportIntegrity: { ...matching.reportIntegrity, sourceSha256: "b".repeat(64) } }).ciLinked, false)
})
test("rich report retains technical details but never promotes legacy metrics or logs", () => {
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: record }))
  for (const text of ["Executive overview", "Submitted architecture", "Tagger.sol", "Conflicting supply claims", "vm.prank(proxyAdmin)", "require(approved[target])", "Founder review question", "Declared CVSS", "Download technical report"]) assert.ok(html.includes(text), text)
  for (const text of ["AAA", "98765", "88888", "FAKE_EXECUTION_LOG_SENTINEL"]) assert.ok(!html.includes(text), text)
  assert.ok(html.includes("SUBMITTED, NOT VALIDATED"))
})
test("classic presentation restores the original palette and single-column report without dropping evidence controls", () => {
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: record }))
  assert.ok(html.includes('data-report-appearance="classic"'))
  assert.ok(html.includes('class="r-ticker">TAG</span>'))
  assert.ok(html.includes('aria-label="Report sections"'))
  for (const text of ["Execution &amp; evidence", "Awaiting founder review", "Conflicting test execution claims", "Founder review question", "Inspect submitted PoC code", "Download technical report"]) assert.ok(html.includes(text), text)
  assert.ok(PRELIMINARY_REPORT_STYLE.includes("--s39-bg0,#030608"))
  assert.ok(PRELIMINARY_REPORT_STYLE.includes("--s39-green,#00ff88"))
  assert.ok(PRELIMINARY_REPORT_STYLE.includes("--s39-cyan,#00e5ff"))
  assert.ok(PRELIMINARY_REPORT_STYLE.includes("max-width:1060px"))
  assert.ok(PRELIMINARY_REPORT_STYLE.includes(".r-layout{display:block}"))
  assert.ok(!PRELIMINARY_REPORT_STYLE.includes("grid-template-columns:190px"))
})
test("unmodified saved declarations are checked even when execution claims were sanitized", () => {
  const sanitized = { ...record, testingMethodology: { ...record.testingMethodology!, fuzzingApplied: false } }
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: sanitized, declaredRecord: record }))
  assert.ok(html.includes("Conflicting test execution claims"))
})
test("untrusted markup and active URL schemes cannot become live report content", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "http://unsafe.test", "https://user:password@example.test"]) assert.equal(safeReportUrl(url), undefined)
  const unsafe = { ...record, name: "<script>alert(1)</script>", engagement: { repositoryUrl: "javascript:alert(1)" },
    findings: [{ title: "Unsafe", severity: "HIGH", description: "<img src=x onerror=alert(1)>", cwe: { id: "fake", url: "https://evil.test" } }],
  } as unknown as PortfolioProject
  const html = renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: unsafe }))
  assert.ok(!html.includes("<script>"))
  assert.ok(!html.includes("<img"))
  assert.ok(!html.includes('href="javascript:'))
  assert.ok(!html.includes('href="https://evil.test'))
})
test("Markdown download preserves remediation and code, not unverifiable executions", () => {
  const markdown = preliminaryMarkdown(record)
  for (const text of ["Tagger", "awaiting founder review", "Conflicting supply claims", "vm.prank(proxyAdmin)", "require(approved[target])", "Founder approval: pending"]) assert.ok(markdown.includes(text))
  for (const text of ["AAA", "98765", "88888", "FAKE_EXECUTION_LOG_SENTINEL"]) assert.ok(!markdown.includes(text))
})
test("malformed optional legacy collections do not crash the public report", () => {
  const malformed = { ...record, contractUncertainty: "bad", attackSurface: {}, scopeTable: [null],
    trustModel: "bad", exploitSimulation: { vectors: "bad" } } as unknown as PortfolioProject
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(PreliminaryAuditReport, { project: malformed })))
})
