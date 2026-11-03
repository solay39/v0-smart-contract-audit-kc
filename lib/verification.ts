import type { AuditEvidence, VerificationStatus } from "@/lib/types"

export type { AuditEvidence, VerificationStatus }

export function hasEnoughEvidence(evidence: AuditEvidence | null | undefined): boolean {
  if (!evidence) return false

  const hasText = (value: string | undefined) => Boolean(value?.trim())
  const hasNonEmptyItems = (items: string[] | undefined) => Boolean(items?.some((item) => item.trim()))
  const attestationCount = Number(evidence.attestationCount ?? 0)

  return (
    hasText(evidence.reportHash) &&
    hasNonEmptyItems(evidence.reviewerNames) &&
    hasNonEmptyItems(evidence.ciArtifacts) &&
    hasText(evidence.commitHash) &&
    Number.isInteger(attestationCount) &&
    attestationCount >= 2
  )
}

// This checks metadata completeness only. It does not cryptographically verify
// signatures, report hashes, artifact contents, or reviewer identities.
export function getVerificationStatus(evidence: AuditEvidence | null | undefined): VerificationStatus {
  return hasEnoughEvidence(evidence) ? "VERIFIED" : "PENDING"
}
