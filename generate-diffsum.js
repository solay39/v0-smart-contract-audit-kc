#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import yaml from "js-yaml"

function parseFile(file) {
  const text = fs.readFileSync(file, "utf8")
  const ext = path.extname(file).toLowerCase()
  if (ext === ".json") return JSON.parse(text)
  if (ext === ".yaml" || ext === ".yml") return yaml.load(text)
  const match = text.match(/```(?:json|yaml|yml)\s*([\s\S]*?)```/i)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return yaml.load(match[1]) }
}
function counts(findings) { const result = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }; for (const item of findings || []) { const severity = String(item?.severity || "").toUpperCase(); if (severity in result) result[severity]++ } return result }
function diff(current, previous) { const currentFindings = current?.findings || []; const previousFindings = previous?.findings || []; const currentCounts = counts(currentFindings); const previousCounts = counts(previousFindings); return { current: { totalFindings: currentFindings.length, severityCounts: currentCounts }, previous: { totalFindings: previousFindings.length, severityCounts: previousCounts }, delta: { totalFindings: currentFindings.length - previousFindings.length, severityCounts: Object.fromEntries(Object.keys(currentCounts).map((key) => [key, currentCounts[key] - previousCounts[key]])) } } }
function markdown(result) { return ["# Report Diff Summary", "", `- Current findings: ${result.current.totalFindings}`, `- Previous findings: ${result.previous.totalFindings}`, `- Delta findings: ${result.delta.totalFindings}`, "", "## Severity deltas", "", ...Object.entries(result.delta.severityCounts).map(([key, value]) => `- ${key}: ${value}`), ""].join("\n") }
const [currentPath = "report.json", previousPath, ...args] = process.argv.slice(2)
const outputIndex = args.indexOf("--output")
const output = outputIndex >= 0 ? args[outputIndex + 1] : "report-diff.md"
if (!fs.existsSync(currentPath)) { console.error(`Current report file not found: ${currentPath}`); process.exit(1) }
const current = parseFile(currentPath); const previous = previousPath && fs.existsSync(previousPath) ? parseFile(previousPath) : null
if (!current) { console.error(`Could not parse current report: ${currentPath}`); process.exit(1) }
const result = diff(current, previous || { findings: [] }); fs.writeFileSync(output, markdown(result)); console.log(JSON.stringify({ current: currentPath, previous: previousPath || "none", output, diff: result }, null, 2))
