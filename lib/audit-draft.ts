import type { PortfolioProject } from "./solay39-constants"
import { isPublicAuditId } from "./published-audit-lookup"

/** A saved automated assessment is a preliminary record, never a sign-off. */
export function normalizeAuditDraft(value: unknown): PortfolioProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid audit")
  const audit = value as PortfolioProject
  if (!isPublicAuditId(audit.id) || typeof audit.name !== "string" || !audit.name.trim() || audit.name.length > 200) {
    throw new Error("A valid audit id and name are required")
  }
  if (audit.findings !== undefined && (!Array.isArray(audit.findings) || audit.findings.length > 1000 ||
    audit.findings.some(f => !f || typeof f.title !== "string" || typeof f.description !== "string" ||
      !["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(f.severity)))) {
    throw new Error("Invalid audit findings")
  }
  return {
    ...audit, name: audit.name.trim(), score: 0, rating: "PENDING",
    // Prevent this draft-only endpoint from promoting supplied signatures to approval.
    manualReview: undefined, auditorSignatures: undefined, formalVerification: undefined,
    engagement: audit.engagement ? {
      ...audit.engagement,
      numberOfAuditors: 0, engineeringHours: 0, securityEngineersInvolved: 0,
      reviewTeam: audit.engagement.reviewTeam ? {
        ...audit.engagement.reviewTeam,
        reviewStatus: "AUTOMATED_ANALYSIS_PENDING_MANUAL_REVIEW",
        leadAuditor: { ...audit.engagement.reviewTeam.leadAuditor, signedOff: false, signOffDate: undefined },
        secondReviewer: audit.engagement.reviewTeam.secondReviewer ? {
          ...audit.engagement.reviewTeam.secondReviewer, signedOff: false, signOffDate: undefined,
        } : undefined,
      } : undefined,
    } : undefined,
    testingMethodology: audit.testingMethodology ? {
      ...audit.testingMethodology, manualReviewHours: 0, fuzzingApplied: false, symbolicExecution: false,
    } : undefined,
  }
}

export interface DraftSaveReceipt {
  success: boolean
  publicationStatus?: string
  publicUrl?: string
  error?: string
}

/** HTTP success alone is insufficient: require an explicit canonical save receipt. */
export function assertDraftSaved(httpOk: boolean, receipt: DraftSaveReceipt): string {
  if (!httpOk || receipt.success !== true || receipt.publicationStatus !== "PRELIMINARY" ||
    typeof receipt.publicUrl !== "string" || !/^\/audit\/[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(receipt.publicUrl)) {
    throw new Error(receipt.error || "Audit not saved on the server. The browser backup is not a public report.")
  }
  return receipt.publicUrl
}
