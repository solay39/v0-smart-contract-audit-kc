import { hasEnoughEvidence, type AuditEvidence } from "@/lib/verification"

type SecurityScoreRingProps = {
  score?: number | null
  evidence?: AuditEvidence | null
}

export function SecurityScoreRing({ score, evidence }: SecurityScoreRingProps) {
  if (!hasEnoughEvidence(evidence) || score == null) {
    return <div className="flex flex-col items-center justify-center w-full max-w-[320px] mx-auto py-12 text-center"><div className="text-[10px] uppercase tracking-[0.3em] text-amber-300 mb-4">PENDING</div><div className="text-sm text-slate-400">Score not available until evidence is published and multi-signer attestation is complete.</div></div>
  }

  return <div className="flex flex-col items-center"><div className="text-5xl font-bold text-emerald-400">{score}</div><div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mt-2">VERIFIED</div></div>
}
