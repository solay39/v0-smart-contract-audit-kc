#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { globSync } from "glob"
import { parseReportFile, validateReport } from "./validate-report.mjs"

function parseFile(file) {
  const text = fs.readFileSync(file, "utf8")
  return parseReportFile(file)
}
function severityCounts(findings) {
  const counts = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
  for (const finding of findings || []) { const severity = String(finding?.severity || "").toUpperCase(); if (severity in counts) counts[severity]++ }
  return counts
}
const args = process.argv.slice(2)
const inputDir = path.resolve(args[0] || "./reports")
const output = args.includes("--output") ? args[args.indexOf("--output") + 1] : "validation-summary.json"
const summaryOutput = args.includes("--summary-output") ? args[args.indexOf("--summary-output") + 1] : "report-summary.json"
const markdownOutput = args.includes("--markdown-output") ? args[args.indexOf("--markdown-output") + 1] : "report-summary.md"
const schemaPath = path.resolve("schema/security-report.schema.json")
if (!fs.existsSync(inputDir)) { console.error(`Directory not found: ${inputDir}`); process.exit(1) }
const files = globSync("**/*.{json,md}", { cwd: inputDir, absolute: true, nodir: true, ignore: ["**/node_modules/**", "**/.git/**"] })
const results = files.map((file) => {
  const entry = { file, status: "invalid", findingCount: 0, severityCounts: severityCounts([]), errors: [] }
  try {
    const report = parseFile(file)
    if (!report) entry.errors.push("No JSON content found in file")
    else {
      entry.errors = validateReport(report, schemaPath)
      entry.status = entry.errors.length ? "invalid" : "valid"
      entry.findingCount = Array.isArray(report.findings) ? report.findings.length : 0
      entry.severityCounts = severityCounts(report.findings)
    }
  } catch (error) { entry.errors.push(`Parse error: ${error.message}`) }
  return entry
})
const totals = results.reduce((acc, result) => {
  acc.totalFindings += result.findingCount
  for (const severity of Object.keys(acc.summaryBySeverity)) acc.summaryBySeverity[severity] += result.severityCounts[severity]
  return acc
}, { totalFindings: 0, summaryBySeverity: { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } })
const summary = { generatedAt: new Date().toISOString(), totalFiles: results.length, validFiles: results.filter((r) => r.status === "valid").length, invalidFiles: results.filter((r) => r.status === "invalid").length, totalFindings: totals.totalFindings, summaryBySeverity: totals.summaryBySeverity, files: results }
fs.writeFileSync(output, JSON.stringify(summary, null, 2))
fs.writeFileSync(summaryOutput, JSON.stringify({ generatedAt: summary.generatedAt, totalFiles: summary.totalFiles, validFiles: summary.validFiles, invalidFiles: summary.invalidFiles, totalFindings: summary.totalFindings, summaryBySeverity: summary.summaryBySeverity }, null, 2))
fs.writeFileSync(markdownOutput, [`# Security Report Validation Summary`, ``, `- Total files: ${summary.totalFiles}`, `- Valid files: ${summary.validFiles}`, `- Invalid files: ${summary.invalidFiles}`, `- Total findings: ${summary.totalFindings}`, ``, `## Severity breakdown`, ``, ...Object.entries(summary.summaryBySeverity).map(([severity, count]) => `- ${severity}: ${count}`), ``, `## Files`, ``, ...summary.files.flatMap((file) => [`### ${file.file}`, `- Status: ${file.status}`, `- Findings: ${file.findingCount}`, ...(file.errors.length ? [`- Errors:`, ...file.errors.map((error) => `  - ${error}`)] : []), ``])].join("\\n"))
console.log(JSON.stringify({ inputDir, output, summaryOutput, markdownOutput, totalFiles: summary.totalFiles, validFiles: summary.validFiles, invalidFiles: summary.invalidFiles, totalFindings: summary.totalFindings, summaryBySeverity: summary.summaryBySeverity }, null, 2))
process.exit(summary.invalidFiles ? 1 : 0)
