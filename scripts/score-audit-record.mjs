#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createScorecard, formatValidationErrors, sha256File, validateAuditRecord } from "./audit-record-utils.mjs"

const [recordPath, outputPath] = process.argv.slice(2)
if (!recordPath || !outputPath) {
  console.error("Usage: node scripts/score-audit-record.mjs <audit-record.json> <scorecard.json>")
  process.exit(2)
}

try {
  const absoluteRecord = path.resolve(recordPath)
  const record = JSON.parse(await readFile(absoluteRecord, "utf8"))
  const errors = validateAuditRecord(record)
  if (errors.length) throw new Error(`Invalid audit record:\n${formatValidationErrors(errors)}`)
  const reportSha256 = await sha256File(absoluteRecord)
  const scorecard = createScorecard(record, reportSha256)
  await writeFile(path.resolve(outputPath), `${JSON.stringify(scorecard, null, 2)}\n`, { flag: "wx" })
  console.log(`Scorecard written. score=${scorecard.score}, input sha256=${reportSha256}`)
} catch (error) {
  console.error(`Scorecard generation failed: ${error.message}`)
  process.exit(1)
}
