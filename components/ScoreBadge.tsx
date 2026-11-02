import { hasEnoughEvidence, type AuditEvidence } from "@/lib/verification"

type ScoreBadgeProps = {
  score?: number | null
  rating?: string | null
  evidence: AuditEvidence | null | undefined
}

export function ScoreBadge({ score, rating, evidence }: ScoreBadgeProps) {
  if (!hasEnoughEvidence(evidence)) {
    return <div className="inline-flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.22em] text-amber-300">PENDING</div>
  }

  return <div className="inline-flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-[0.22em] text-emerald-300">{rating ?? "A"} · {score ?? 0}/100</div>
}
