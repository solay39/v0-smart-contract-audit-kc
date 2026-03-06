// app/leaderboard/page.tsx
// Serve: solay39.eu/leaderboard

import { list } from "@vercel/blob"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Security Leaderboard | Solay39",
  description: "Top audited projects ranked by security score. Independent smart contract security audits.",
}

interface AuditData {
  id: string
  name: string
  symbol?: string
  logoUrl?: string
  score?: number
  securityScore?: number
  rating?: string
  findings?: { severity: string }[]
}

async function getAllAudits(): Promise<AuditData[]> {
  try {
    const { blobs } = await list({ prefix: "audits/" })
    const audits = await Promise.all(
      blobs
        .filter((b) => b.pathname.endsWith(".json"))
        .map(async (b) => {
          try {
            const res = await fetch(b.url)
            if (!res.ok) return null
            return await res.json()
          } catch { return null }
        })
    )
    return audits
      .filter((a): a is AuditData => a !== null)
      .sort((a, b) => (b.securityScore ?? b.score ?? 0) - (a.securityScore ?? a.score ?? 0))
  } catch { return [] }
}

export default async function LeaderboardPage() {
  const audits = await getAllAudits()

  const ratingColor = (r: string) =>
    r === "AAA" ? "#22c55e" :
    r === "AA"  ? "#84cc16" :
    r === "A"   ? "#6366f1" :
    r === "BBB" ? "#f59e0b" : "#ef4444"

  return (
    <div className="min-h-screen bg-s39-bg0 text-s39-white font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-block px-4 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-widest mb-3">
            SOLAY39 SECURITY
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">
            Security Leaderboard
          </h1>
          <p className="text-s39-dim text-sm">
            Top audited projects ranked by security score
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Projects Audited", value: audits.length },
            { label: "AAA Rated", value: audits.filter((a) => a.rating === "AAA").length },
            { label: "0 Critical Found", value: audits.filter((a) => {
              const findings = a.findings ?? []
              return findings.filter((f) => f.severity === "CRITICAL").length === 0
            }).length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-s39-bg1 rounded-xl p-5 text-center border border-s39-border">
              <div className="text-3xl sm:text-4xl font-bold text-indigo-400">{value}</div>
              <div className="text-xs text-s39-dim mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Leaderboard table */}
        <div className="bg-s39-bg1 rounded-xl overflow-hidden border border-s39-border">
          {/* Header row */}
          <div className="grid grid-cols-[48px_48px_1fr_80px_80px_80px] px-5 py-3 border-b border-s39-border text-[10px] font-semibold text-s39-dim tracking-widest">
            <span>#</span>
            <span></span>
            <span>PROJECT</span>
            <span className="text-center">SCORE</span>
            <span className="text-center">RATING</span>
            <span className="text-center">FINDINGS</span>
          </div>

          {audits.length === 0 && (
            <div className="px-5 py-8 text-center text-s39-dim text-sm">
              No audits published yet
            </div>
          )}

          {audits.map((audit, i) => {
            const score = audit.securityScore ?? audit.score ?? 89
            const rating = audit.rating ?? "A"
            const findings = audit.findings ?? []
            const critical = findings.filter((f) => f.severity === "CRITICAL").length
            const high = findings.filter((f) => f.severity === "HIGH").length

            return (
              <Link
                key={audit.id}
                href={`/audit/${audit.id}`}
                className="block no-underline text-inherit"
              >
                <div className={`grid grid-cols-[48px_48px_1fr_80px_80px_80px] px-5 py-3.5 items-center border-b border-s39-bg2 hover:bg-s39-bg2/50 transition-colors cursor-pointer ${
                  i % 2 === 0 ? "" : "bg-s39-bg0/30"
                }`}>
                  {/* Rank */}
                  <span className={`text-sm font-bold ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-s39-dim"
                  }`}>
                    {i === 0 ? "1" : i === 1 ? "2" : i === 2 ? "3" : `#${i + 1}`}
                  </span>

                  {/* Logo */}
                  <span>
                    {audit.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={audit.logoUrl} width={28} height={28}
                        className="rounded-lg" alt={audit.name} />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-s39-bg2 flex items-center justify-center text-xs text-s39-dim">
                        {(audit.symbol ?? "?")[0]}
                      </div>
                    )}
                  </span>

                  {/* Name */}
                  <div>
                    <div className="font-semibold text-sm">{audit.name}</div>
                    <div className="text-[11px] text-s39-dim">{audit.symbol}</div>
                  </div>

                  {/* Score */}
                  <div className="text-center text-lg font-bold" style={{ color: ratingColor(rating) }}>
                    {score}
                  </div>

                  {/* Rating */}
                  <div className="text-center">
                    <span className="px-2.5 py-1 rounded text-xs font-bold"
                      style={{ 
                        color: ratingColor(rating),
                        backgroundColor: `${ratingColor(rating)}22`
                      }}>
                      {rating}
                    </span>
                  </div>

                  {/* Findings */}
                  <div className="text-center text-xs">
                    {critical > 0 ? (
                      <span className="text-red-400">{critical}C </span>
                    ) : null}
                    {high > 0 ? (
                      <span className="text-orange-400">{high}H</span>
                    ) : (
                      <span className="text-emerald-400">Clean</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-s39-dim text-xs">
          Solay39 — Independent Smart Contract Security ·{" "}
          <Link href="/" className="text-indigo-400 hover:underline">solay39.eu</Link>
        </div>

      </div>
    </div>
  )
}
