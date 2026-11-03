import { hasEnoughEvidence, type AuditEvidence } from "@/lib/verification"

type ScoreBadgeProps = {
  score?: number | null
  rating?: string | null
  evidence: AuditEvidence | null | undefined
}

export function ScoreBadge({ score, rating, evidence }: ScoreBadgeProps) {
  if (!hasEnoughEvidence(evidence) || score == null || !Number.isFinite(score) || score < 0 || score > 100) {
    return (
      <span className="inline-flex items-center border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] text-amber-200">
        PENDING
      </span>
    )
  }

  return (
    <span className="inline-flex items-center border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-emerald-300">
      Evidence fields complete · {rating ?? "—"} · {score}/100
    </span>
  )
}
