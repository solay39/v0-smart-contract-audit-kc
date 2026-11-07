export const REVIEW_CHECKS = [
  ["target", "Rete, indirizzo e scope verificati"],
  ["source", "Sorgente, build e runtime confrontati"],
  ["authority", "Ruoli privilegiati e dipendenze revisionati"],
  ["execution", "Test e limiti delle esecuzioni revisionati"],
  ["triage", "Finding storici e candidati statici decisi"],
  ["limitations", "Lacune e rischi residui dichiarati"],
  ["conclusion", "Conclusione coerente con le evidenze"],
] as const
export type ReviewCheck = typeof REVIEW_CHECKS[number][0]
export type ReviewDecision = "pending" | "false_positive" | "confirmed_open" | "resolved" | "accepted_risk" | "verified_observation"
export type ReviewSeverity = "UNRATED" | "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export interface ReviewFinding {
  id: string; kind: "historical" | "slither" | "observation"; title: string
  declaredSeverity: string; description: string; sourceTarget: string
}
export interface EvidenceRef { sha256: string; label: string }
export interface ReviewSnapshot {
  schema: "solay39-historical-review-v1"
  auditId: string; name: string; network: string; address: string | null
  originalReportHash: string
  sourceDigests: Array<{ target: string; sha256: string }>
  evidenceHash: string; evidence: unknown; refs: EvidenceRef[]; findings: ReviewFinding[]
  technicalBlockers: string[]; limitations: string[]; testFixture: boolean
}
export interface ReviewDraft {
  scope: string; conclusion: string; residualRisks: string
  checks: Record<ReviewCheck, { status: "pending" | "pass" | "fail"; note: string }>
  decisions: Record<string, { decision: ReviewDecision; severity: ReviewSeverity; rationale: string; evidenceRefs: string[] }>
  acknowledgements: { limitsReviewed: boolean; noPublication: boolean; noSafetyGuarantee: boolean }
}
export interface ReviewChallenge {
  nonce: string; wallet: string; issuedAt: string; expiresAt: string; draftHash: string; payloadHash: string; message: string
}
export interface ReviewApproval {
  id: string; nonce: string; wallet: string; signature: string; message: string
  payloadHash: string; snapshotHash: string; approvedAt: string
  publication: "UNPUBLISHED"; assertion: "FOUNDER_REVIEW_OF_DECLARED_SCOPE"
  challenge: ReviewChallenge
}
export interface ReviewState {
  reviewKey: string; auditId: string; snapshotHash: string; version: number
  draft: ReviewDraft; challenge: ReviewChallenge | null; approval: ReviewApproval | null
}
export interface ReviewView {
  snapshot: ReviewSnapshot; snapshotHash: string; reviewKey: string; state: ReviewState
  blockers: string[]; walletReady: boolean; localOnly: boolean; readOnly: boolean
}
export interface ReviewQueueItem {
  auditId: string; name: string; network: string; address: string | null; reviewKey: string
  technicalBlockers: string[]; findings: number; status: "NOT_STARTED" | "DRAFT" | "APPROVED_UNPUBLISHED"
}
