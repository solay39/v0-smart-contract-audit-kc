#!/usr/bin/env node
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  createScorecard,
  formatValidationErrors,
  resolveInside,
  sha256Bytes,
  validateAuditRecord,
} from "./audit-record-utils.mjs"

const execFileAsync = promisify(execFile)
const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}

const recordPath = option("--record")
const repoRoot = path.resolve(option("--repo-root", "."))
const outputDir = path.resolve(option("--out-dir", "audit-evidence-bundle"))
if (!recordPath) {
  console.error("Usage: node scripts/build-audit-evidence-bundle.mjs --record <record.json> [--repo-root .] [--out-dir audit-evidence-bundle]")
  process.exit(2)
}

try {
  const rootReal = await realpath(repoRoot)
  const sourceRecord = resolveInside(rootReal, path.relative(rootReal, path.resolve(recordPath)))
  const recordReal = await realpath(sourceRecord)
  if (!recordReal.startsWith(`${rootReal}${path.sep}`)) throw new Error("Audit record must be inside repository root")
  const recordBytes = await readFile(recordReal)
  const record = JSON.parse(recordBytes.toString("utf8"))
  const errors = validateAuditRecord(record)
  if (errors.length) throw new Error(`Invalid audit record:\n${formatValidationErrors(errors)}`)

  const commit = record.audit.sourceCommit.sha.toLowerCase()
  const { stdout: resolvedCommit } = await execFileAsync("git", ["-C", rootReal, "rev-parse", "--verify", `${commit}^{commit}`])
  if (resolvedCommit.trim().toLowerCase() !== commit) throw new Error("sourceCommit must resolve to the exact full Git commit SHA")

  const outReal = path.resolve(outputDir)
  await mkdir(outReal, { recursive: false })
  const artifactOutputDir = path.join(outReal, "artifacts")
  await mkdir(artifactOutputDir)
  const recordOutput = path.join(outReal, "audit-record.json")
  await copyFile(recordReal, recordOutput)

  const artifacts = []
  for (const artifact of record.evidence.artifacts) {
    const sourcePath = resolveInside(rootReal, artifact.path)
    const sourceReal = await realpath(sourcePath)
    if (!sourceReal.startsWith(`${rootReal}${path.sep}`)) throw new Error(`Artifact resolves outside repository root: ${artifact.path}`)
    const sourceStat = await stat(sourceReal)
    if (!sourceStat.isFile()) throw new Error(`Evidence artifact is not a regular file: ${artifact.path}`)

    const bytes = await readFile(sourceReal)
    const bundleRelativePath = path.posix.join("artifacts", artifact.id, path.basename(artifact.path))
    const target = path.join(outReal, ...bundleRelativePath.split("/"))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, bytes, { flag: "wx" })
    artifacts.push({
      id: artifact.id,
      path: bundleRelativePath,
      mediaType: artifact.mediaType,
      sha256: sha256Bytes(bytes),
      sizeBytes: bytes.length,
    })
  }

  const recordSha256 = sha256Bytes(recordBytes)
  let scorecard = null
  if (record.review.status === "FULL" && ["MANUAL_REVIEWED", "PUBLISHED"].includes(record.audit.status)) {
    scorecard = createScorecard(record, recordSha256)
    await writeFile(path.join(outReal, "scorecard.json"), `${JSON.stringify(scorecard, null, 2)}\n`, { flag: "wx" })
  }

  const manifest = {
    schemaVersion: "1.0",
    auditId: record.auditId,
    createdAt: new Date().toISOString(),
    sourceCommit: record.audit.sourceCommit,
    auditRecord: { path: "audit-record.json", sha256: recordSha256, sizeBytes: recordBytes.length },
    artifacts,
    scorecard: scorecard ? { path: "scorecard.json", sha256: sha256Bytes(Buffer.from(`${JSON.stringify(scorecard, null, 2)}\n`)) } : null,
  }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(path.join(outReal, "manifest.json"), manifestBytes, { flag: "wx" })
  const manifestHash = sha256Bytes(manifestBytes)
  await writeFile(path.join(outReal, "manifest.sha256"), `${manifestHash}  manifest.json\n`, { flag: "wx" })
  console.log(`Evidence bundle created at ${outReal}; manifest sha256=${manifestHash}`)
} catch (error) {
  console.error(`Evidence bundle failed: ${error.message}`)
  process.exit(1)
}
