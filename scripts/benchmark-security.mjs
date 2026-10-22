#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { basename, join, resolve } from "node:path"

const apiUrl = process.env.SECURITY_API_URL
const apiKey = process.env.SECURITY_API_KEY
const datasetPath = resolve(process.env.BENCHMARK_DATASET || "benchmarks/security-cases.json")
const outputPath = resolve(process.env.BENCHMARK_OUTPUT || "benchmarks/results.json")

if (!apiUrl) throw new Error("SECURITY_API_URL is required")
if (!apiKey) throw new Error("SECURITY_API_KEY is required")

const cases = JSON.parse(await readFile(datasetPath, "utf8"))
const results = []

for (const item of cases) {
  const sourcePath = resolve(item.source)
  const code = await readFile(sourcePath, "utf8")
  const sourceSha256 = createHash("sha256").update(code).digest("hex")
  const startedAt = new Date().toISOString()
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ code, contractName: basename(sourcePath, ".sol"), tools: ["slither", "mythril"] }),
  })
  const body = await response.json().catch(() => ({ error: "invalid_json_response" }))
  const findings = Array.isArray(body.findings) ? body.findings : []
  const detectedCategories = new Set(findings.map((finding) => String(finding.category || finding.type || finding.check || "").toLowerCase()))
  const expected = item.expectedCategories.map((category) => category.toLowerCase())
  const detected = expected.filter((category) => [...detectedCategories].some((value) => value.includes(category)))

  results.push({
    id: item.id,
    source: item.source,
    sourceSha256,
    expectedCategories: item.expectedCategories,
    detectedCategories: detected,
    found: detected.length > 0,
    findingCount: findings.length,
    httpStatus: response.status,
    ok: response.ok,
    startedAt,
    raw: body,
  })
  console.log(`${item.id}: ${detected.length > 0 ? "FOUND" : "MISSED"} (${findings.length} findings)`)
}

const summary = {
  generatedAt: new Date().toISOString(),
  dataset: datasetPath,
  cases: results.length,
  found: results.filter((result) => result.found).length,
  missed: results.filter((result) => !result.found).length,
  detectionRate: results.length ? results.filter((result) => result.found).length / results.length : 0,
  results,
}
await mkdir(join(outputPath, ".."), { recursive: true })
await writeFile(outputPath, JSON.stringify(summary, null, 2) + "\n")
console.log(`Wrote ${outputPath}`)
