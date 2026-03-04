// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Dual Independent Review Gate
// /core/review/dualReviewGate.ts
// Enforces enterprise audit requirement: 2+ independent auditors
// ═══════════════════════════════════════════════════════════════

export interface AuditorSignature {
  auditor: string       // Ethereum address
  signature: string     // ECDSA hex signature
  role: "lead" | "reviewer" | "qa"
  signedAt: string      // ISO timestamp
}

export interface DualReviewResult {
  valid: boolean
  uniqueAuditors: number
  hasLead: boolean
  hasReviewer: boolean
  errors: string[]
}

/**
 * Enforce that an audit report has been independently reviewed
 * by at least 2 different auditors. Enterprise requirement.
 *
 * @throws Error if validation fails (for pipeline use)
 */
export function enforceDualReview(signatures: AuditorSignature[]): boolean {
  if (!signatures || signatures.length < 2) {
    throw new Error("Enterprise audit requires 2 independent auditors.")
  }

  const uniqueAddresses = new Set(
    signatures.map((s) => s.auditor.toLowerCase())
  )

  if (uniqueAddresses.size < 2) {
    throw new Error("Signatures must be from different auditors.")
  }

  return true
}

/**
 * Validate dual review without throwing (returns structured result).
 * Suitable for UI components.
 */
export function validateDualReview(signatures: AuditorSignature[]): DualReviewResult {
  const errors: string[] = []

  if (!signatures || signatures.length === 0) {
    return {
      valid: false,
      uniqueAuditors: 0,
      hasLead: false,
      hasReviewer: false,
      errors: ["No signatures provided"],
    }
  }

  const uniqueAuditors = new Set(
    signatures.map((s) => s.auditor.toLowerCase())
  )

  if (signatures.length < 2) {
    errors.push("Enterprise audit requires at least 2 signatures")
  }
  if (uniqueAuditors.size < 2) {
    errors.push("Signatures must be from different auditor addresses")
  }

  const hasLead = signatures.some((s) => s.role === "lead")
  const hasReviewer = signatures.some((s) => s.role === "reviewer" || s.role === "qa")

  if (!hasLead) errors.push("Missing lead auditor signature")
  if (!hasReviewer) errors.push("Missing reviewer/QA signature")

  return {
    valid: errors.length === 0,
    uniqueAuditors: uniqueAuditors.size,
    hasLead,
    hasReviewer,
    errors,
  }
}

/**
 * Check if a report meets the minimum review threshold
 * without requiring full dual review (for non-enterprise tiers).
 */
export function meetsMinimumReview(signatures: AuditorSignature[]): boolean {
  return signatures && signatures.length >= 1
}
