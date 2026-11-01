#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import Ajv from "ajv/dist/2020.js"
import addFormats from "ajv-formats"
import yaml from "js-yaml"

export function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")) }
export function parseReportFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8")
  const extension = path.extname(filePath).toLowerCase()
  if (extension === ".json") return JSON.parse(text)
  if (extension === ".yaml" || extension === ".yml") return yaml.load(text)
  if (extension === ".md") {
    const match = text.match(/```(?:json|yaml|yml)\s*([\s\S]*?)```/i)
    if (!match) return null
    try { return JSON.parse(match[1]) } catch { return yaml.load(match[1]) }
  }
  throw new Error(`Unsupported file type: ${filePath}`)
}
export function validateSchema(report, schemaPath) {
  const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true })
  addFormats(ajv)
  const validate = ajv.compile(readJson(schemaPath))
  if (validate(report)) return []
  return (validate.errors || []).map((error) => `schema: ${error.message} at ${error.instancePath || "/"}`)
}
export function validateSemantics(report) {
  const errors = []
  const status = String(report.report_status ?? "").toUpperCase()
  const review = String(report.manual_review_status ?? "").toUpperCase()
  const productionReady = report.production_ready === true
  const evidence = report.evidence || {}
  const reviewers = Array.isArray(report.reviewer_names) ? report.reviewer_names : []
  if (!["DRAFT", "PRELIMINARY", "PUBLISHED"].includes(status)) errors.push("report_status must be one of: DRAFT, PRELIMINARY, PUBLISHED")
  if (!["NOT_PERFORMED", "PARTIAL", "FULL"].includes(review)) errors.push("manual_review_status must be one of: NOT_PERFORMED, PARTIAL, FULL")
  if (review === "FULL") {
    if (!reviewers.length) errors.push("manual_review_status=FULL requires reviewer_names")
    if (!report.review_scope?.trim()) errors.push("manual_review_status=FULL requires review_scope")
    if (!report.manual_review_evidence || !Object.keys(report.manual_review_evidence).length) errors.push("manual_review_status=FULL requires manual_review_evidence")
  }
  if (productionReady) {
    if (status !== "PUBLISHED") errors.push("production_ready requires report_status=PUBLISHED")
    if (review !== "FULL") errors.push("production_ready requires manual_review_status=FULL")
    if (!reviewers.length) errors.push("production_ready requires reviewer_names")
    if (!Array.isArray(evidence.ci_artifacts) || !evidence.ci_artifacts.length) errors.push("production_ready requires evidence.ci_artifacts")
  }
  if (evidence.tests && (evidence.tests.passed != null || evidence.tests.total != null)) {
    if (!Array.isArray(evidence.test_logs) || !evidence.test_logs.length) errors.push("test metrics present but evidence.test_logs missing")
    if (!Array.isArray(evidence.ci_artifacts) || !evidence.ci_artifacts.length) errors.push("test metrics present but evidence.ci_artifacts missing")
  }
  const summary = `${report.summary ?? ""} ${report.executive_summary ?? ""}`.toLowerCase()
  if (summary.includes("manual review full") && review !== "FULL") errors.push("summary says manual review full but report status does not match")
  if (summary.includes("production ready") && !productionReady) errors.push("summary says production ready but production_ready is false")
  if (summary.includes("not recommended") && productionReady) errors.push("summary says not recommended but production_ready is true")
  if (summary.includes("96/96") && (!Array.isArray(evidence.test_logs) || !evidence.test_logs.length)) errors.push("96/96-style claim detected without evidence.test_logs")
  for (const [index, finding] of (Array.isArray(report.findings) ? report.findings : []).entries()) {
    const severity = String(finding.severity ?? "").toUpperCase()
    if (["HIGH", "CRITICAL"].includes(severity)) {
      if (!finding.proof?.trigger?.trim()) errors.push(`Finding ${index}: ${severity} finding missing proof.trigger`)
      if (!finding.proof?.artifact && !finding.proof?.fork_result) errors.push(`Finding ${index}: ${severity} finding missing proof.artifact or proof.fork_result`)
    }
  }
  return errors
}
export function validateReport(report, schemaPath) { return [...validateSchema(report, schemaPath), ...validateSemantics(report)] }

if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = path.resolve(process.argv[2] || "report.json")
  const schemaPath = path.resolve("schema/security-report.schema.json")
  if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1) }
  let report
  try { report = parseReportFile(filePath) } catch (error) { console.error(`Invalid report: ${error.message}`); process.exit(1) }
  const errors = validateReport(report, schemaPath)
  if (errors.length) { console.error("Report validation failed:"); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1) }
  console.log("Report validation passed.")
}
