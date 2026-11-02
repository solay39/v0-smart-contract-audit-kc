import Link from "next/link"
import type { AuditProject } from "@/lib/types"
import { ScoreBadge } from "@/components/ScoreBadge"
import { hasEnoughEvidence } from "@/lib/verification"

export function PortfolioGrid({ audits }: { audits: AuditProject[] }) {
  return <div className="space-y-4">{audits.map((audit) => { const verified = hasEnoughEvidence(audit.evidence); return <Link key={audit.id} href={`/audit/${audit.id}`} className="group block rounded-2xl border border-s39-border bg-s39-bg1/60 p-4 transition hover:border-s39-green/40"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-s39-green to-s39-cyan text-xl font-black text-s39-bg0">{audit.ticker.slice(0, 2)}</div><div><div className="text-2xl font-black">{audit.name}</div><div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-s39-dim">{audit.network} · {audit.category}</div></div></div><div className="flex items-center gap-4"><div className="text-right"><div className="text-[10px] uppercase tracking-[0.24em] text-s39-dim">Security score</div><div className="mt-1 text-3xl font-black text-s39-white">{verified && audit.score != null ? audit.score : "PENDING"}</div></div><ScoreBadge score={verified ? audit.score : null} rating={verified ? audit.rating : "PENDING"} evidence={audit.evidence} /></div></div></Link>})}</div>
}
