export type ScannerStatus = "success" | "failed" | "skipped" | "timeout"

export interface ScannerRun {
  name: "slither" | "mythril"
  status: ScannerStatus
  exitCode: number | null
  artifactPresent: boolean
  analyzedCommit: string | null
}

export interface AuditEvidence {
  findingId: string
  artifactPath: string
  sha256: string
}

export interface AuditGateInput {
  targetCommit: string
  scopeComplete: boolean
  reportHashMatches: boolean
  scanners: ScannerRun[]
  evidence: AuditEvidence[]
  requiredFindingIds: string[]
}

export interface AuditGateResult {
  status: "READY_FOR_REVIEW" | "INCOMPLETE"
  publishable: false
  blockers: string[]
}

const REQUIRED_SCANNERS = ["slither", "mythril"] as const
const SHA256_RE = /^[a-f0-9]{64}$/i

export function evaluateAuditGate(input: AuditGateInput): AuditGateResult {
  const blockers: string[] = []
  if (!input.targetCommit.trim()) blockers.push("targetCommit is missing.")
  if (!input.scopeComplete) blockers.push("Analysis scope is not marked complete.")
  if (!input.reportHashMatches) blockers.push("Report integrity/hash check failed.")

  for (const name of REQUIRED_SCANNERS) {
    const matches = input.scanners.filter((scanner) => scanner.name === name)
    if (matches.length !== 1) {
      blockers.push(`Expected exactly one ${name} run; found ${matches.length}.`)
      continue
    }
    const scanner = matches[0]
    if (scanner.status !== "success") blockers.push(`${name} status is "${scanner.status}", not "success".`)
    if (scanner.exitCode !== 0) blockers.push(`${name} exit code is not 0.`)
    if (!scanner.artifactPresent) blockers.push(`${name} output artifact is missing.`)
    if (!scanner.analyzedCommit || scanner.analyzedCommit !== input.targetCommit) blockers.push(`${name} analyzed commit does not match targetCommit.`)
  }

  const seen = new Set<string>()
  for (const evidence of input.evidence) {
    if (!evidence.findingId.trim()) blockers.push("Evidence contains an empty findingId.")
    if (!evidence.artifactPath.trim()) blockers.push(`Evidence for "${evidence.findingId}" has no artifactPath.`)
    if (!SHA256_RE.test(evidence.sha256)) blockers.push(`Evidence for "${evidence.findingId}" has an invalid SHA-256.`)
    if (seen.has(evidence.findingId)) blockers.push(`Duplicate evidence findingId "${evidence.findingId}".`)
    seen.add(evidence.findingId)
  }
  for (const findingId of input.requiredFindingIds) {
    if (!seen.has(findingId)) blockers.push(`Required finding "${findingId}" has no attached evidence.`)
  }

  return { status: blockers.length ? "INCOMPLETE" : "READY_FOR_REVIEW", publishable: false, blockers }
}
