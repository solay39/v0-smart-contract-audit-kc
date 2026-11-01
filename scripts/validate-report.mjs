#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const file = process.argv[2] || "report.json"
const reportPath = path.resolve(file)
if (!fs.existsSync(reportPath)) {
  console.error(`File not found: ${reportPath}`)
  process.exit(1)
}

let report
try { report = JSON.parse(fs.readFileSync(reportPath, "utf8")) } catch (error) {
  console.error(`Invalid JSON: ${error.message}`)
  process.exit(1)
}

const errors = []
const status = String(report.report_status || "").toUpperCase()
const review = String(report.manual_review_status || "").toUpperCase()
const evidence = report.evidence || {}
const reviewers = Array.isArray(report.reviewer_names) ? report.reviewer_names : []

if (!["DRAFT", "PRELIMINARY", "PUBLISHED"].includes(status)) errors.push("report_status must be DRAFT, PRELIMINARY, or PUBLISHED")
if (!["NOT_PERFORMED", "PARTIAL", "FULL"].includes(review)) errors.push("manual_review_status must be NOT_PERFORMED, PARTIAL, or FULL")
if (review === "FULL" && reviewers.length === 0) errors.push("manual_review_status=FULL requires reviewer_names")
if (review === "FULL" && !report.review_scope) errors.push("manual_review_status=FULL requires review_scope")
if (review === "FULL" && !report.manual_review_evidence) errors.push("manual_review_status=FULL requires manual_review_evidence")
if (report.production_ready === true) {
  if (status !== "PUBLISHED") errors.push("production_ready requires report_status=PUBLISHED")
  if (review !== "FULL") errors.push("production_ready requires manual_review_status=FULL")
  if (!Array.isArray(evidence.ci_artifacts) || evidence.ci_artifacts.length === 0) errors.push("production_ready requires evidence.ci_artifacts")
}
if (evidence.tests && (!Array.isArray(evidence.test_logs) || evidence.test_logs.length === 0)) errors.push("test metrics require evidence.test_logs")
const summary = `${report.summary || ""} ${report.executive_summary || ""}`.toLowerCase()
if (summary.includes("96/96") && (!Array.isArray(evidence.test_logs) || evidence.test_logs.length === 0)) errors.push("96/96 claim requires evidence.test_logs")
if (summary.includes("production ready") && report.production_ready !== true) errors.push("summary claims production ready but production_ready is false")
for (const [index, finding] of (Array.isArray(report.findings) ? report.findings : []).entries()) {
  const severity = String(finding.severity || "").toUpperCase()
  if (["HIGH", "CRITICAL"].includes(severity)) {
    if (!finding.proof?.trigger) errors.push(`Finding ${index}: ${severity} finding requires proof.trigger`)
    if (!finding.proof?.artifact && !finding.proof?.fork_result) errors.push(`Finding ${index}: ${severity} finding requires proof.artifact or proof.fork_result`)
  }
}
if (errors.length) {
  console.error("Report validation failed:")
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}
console.log("Report validation passed.")
