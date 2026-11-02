import type { AuditEvidence, VerificationStatus } from "@/lib/types"

export type { AuditEvidence, VerificationStatus }

export function hasEnoughEvidence(evidence: AuditEvidence | null | undefined): boolean {
  if (!evidence) return false

  return Boolean(
    evidence.reportHash &&
    evidence.reviewerNames?.length &&
    evidence.ciArtifacts?.length &&
    evidence.commitHash &&
    Number(evidence.attestationCount ?? 0) >= 2,
  )
}

export function getVerificationStatus(evidence: AuditEvidence | null | undefined): VerificationStatus {
  return hasEnoughEvidence(evidence) ? "VERIFIED" : "PENDING"
}
