import { hasEnoughEvidence, type AuditEvidence } from "@/lib/verification"

const scoreGradientId = "security-score-ring-gradient"

type SecurityScoreRingProps = {
  score?: number | null
  evidence?: AuditEvidence | null
  size?: number
}

export function SecurityScoreRing({ score, evidence, size = 184 }: SecurityScoreRingProps) {
  if (!hasEnoughEvidence(evidence) || score == null || !Number.isFinite(score) || score < 0 || score > 100) {
    return (
      <div className="flex min-h-[150px] w-full max-w-[240px] flex-col items-center justify-center px-4 py-8 text-center" role="status" aria-label="Security score pending evidence">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300">Score pending</div>
        <p className="text-[10px] leading-relaxed text-slate-500">No score is published until required evidence fields are present.</p>
      </div>
    )
  }

  const strokeWidth = Math.max(8, size * 0.075)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Evidence-gated security score ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={scoreGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${scoreGradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-semibold tracking-tight text-slate-100">{score}</span>
        <span className="mt-1 text-[8px] uppercase tracking-[0.24em] text-emerald-300">Evidence gated</span>
        <span className="mt-1 text-[8px] text-slate-500">out of 100</span>
      </div>
    </div>
  )
}
