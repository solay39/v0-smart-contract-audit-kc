import { hasEnoughEvidence, type AuditEvidence } from "@/lib/verification"

export function enforceAuditPolicy(project: {
  score?: number | null
  rating?: string | null
  evidence?: AuditEvidence | null
}) {
  if (!hasEnoughEvidence(project.evidence)) {
    return {
      verified: false,
      reason: "missing evidence or insufficient attestation",
      score: null,
      rating: "PENDING",
    } as const
  }

  return {
    verified: true,
    reason: "verified",
    score: project.score ?? null,
    rating: project.rating ?? "PENDING",
  } as const
}
