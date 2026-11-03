import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const schemaPath = new URL("../schemas/audit-record.schema.json", import.meta.url)
const schema = JSON.parse(await readFile(schemaPath, "utf8"))
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateSchema = ajv.compile(schema)

export const SCORE_METHOD = "SOLAY39-SEVERITY-PENALTY-1.0"
export const SEVERITY_PENALTIES = Object.freeze({ CRITICAL: 25, HIGH: 10, MEDIUM: 3, LOW: 1, INFO: 0 })

export function validateAuditRecord(record) {
  const errors = []
  if (!validateSchema(record)) {
    for (const error of validateSchema.errors ?? []) errors.push(`${error.instancePath || "/"} ${error.message}`)
  }
  if (!record || typeof record !== "object") return errors

  const artifacts = Array.isArray(record.evidence?.artifacts) ? record.evidence.artifacts : []
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id))
  for (const finding of record.findings ?? []) {
    for (const artifactId of finding.evidenceArtifactIds ?? []) {
      if (!artifactIds.has(artifactId)) errors.push(`finding ${finding.id} references unknown artifact ${artifactId}`)
    }
  }

  const review = record.review
  const audit = record.audit
  if (review?.status === "FULL" && (!review.reviewers?.length || !audit?.scope?.trim())) {
    errors.push("FULL review requires at least one named reviewer and a non-empty audit scope")
  }
  if (audit?.status === "MANUAL_REVIEWED" || audit?.status === "PUBLISHED") {
    if (review?.status !== "FULL") errors.push(`${audit.status} requires review.status=FULL`)
  }
  if (audit?.status === "PUBLISHED" && !audit?.completedAt) errors.push("PUBLISHED requires audit.completedAt")

  return errors
}

export function createScorecard(record, reportSha256) {
  if (record.review.status !== "FULL" || !["MANUAL_REVIEWED", "PUBLISHED"].includes(record.audit.status)) {
    throw new Error("A scorecard can only be generated after a FULL manual review")
  }
  const deductions = record.findings
    .filter((finding) => ["OPEN", "ACCEPTED_RISK"].includes(finding.status))
    .map((finding) => ({
      findingId: finding.id,
      severity: finding.severity,
      status: finding.status,
      points: SEVERITY_PENALTIES[finding.severity],
    }))
  const totalPenalty = deductions.reduce((total, item) => total + item.points, 0)

  return {
    schemaVersion: "1.0",
    methodology: SCORE_METHOD,
    interpretation: "A deterministic severity-penalty index for this reviewed record; not a probability of safety and not comparable to other providers' scores.",
    auditId: record.auditId,
    reportSha256,
    sourceCommit: record.audit.sourceCommit,
    score: Math.max(0, 100 - totalPenalty),
    maximumScore: 100,
    totalPenalty: Math.min(100, totalPenalty),
    deductions,
  }
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex")
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

export function formatValidationErrors(errors) {
  return errors.map((error) => `- ${error}`).join("\n")
}

export function resolveInside(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath)) {
    throw new Error(`Artifact path must be a non-empty relative path: ${relativePath}`)
  }
  const resolvedRoot = path.resolve(root)
  const resolvedPath = path.resolve(resolvedRoot, relativePath)
  const relative = path.relative(resolvedRoot, resolvedPath)
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === "..") {
    throw new Error(`Artifact path must stay inside repository root: ${relativePath}`)
  }
  return resolvedPath
}
