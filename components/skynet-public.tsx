"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  PUB_EMAIL,
  TG_URL,
  DEFAULT_PROJECTS,
  scoreColor,
  type PortfolioProject,
  type SeverityLevel,
  SEV_RAW_COLORS,
} from "@/lib/solay39-constants"
import { ScoreRing, S39Btn, SevBadge } from "@/components/solay39-ui"
import { getExplorer } from "@/lib/explorers"

// ── LocalStorage key for published audits ────────────────────────
const PORTFOLIO_KEY = "solay39_portfolio"

export function getPublishedAudits(): PortfolioProject[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function savePublishedAudit(project: PortfolioProject) {
  const existing = getPublishedAudits()
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const idx = existing.findIndex(
    (p) => p.id === project.id || norm(p.name) === norm(project.name)
  )
  if (idx >= 0) {
    // Merge: keep new data but preserve old fields that are missing in new
    const old = existing[idx]
    existing[idx] = {
      ...old,
      ...project,
      logoUrl: project.logoUrl || old.logoUrl,
      description: project.description || old.description,
      website: project.website || old.website,
      githubUrl: project.githubUrl || old.githubUrl,
      telegram: project.telegram || old.telegram,
      twitter: project.twitter || old.twitter,
      discord: project.discord || old.discord,
      tags: project.tags?.length ? project.tags : old.tags,
    }
  } else {
    existing.unshift(project)
  }
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(existing))
}

// ── Network Icon ─────────────────────────────────────────────────
function NetworkIcon({ network }: { network: string }) {
  const colors: Record<string, string> = {
    Ethereum: "#627EEA",
    Arbitrum: "#28A0F0",
    Optimism: "#FF0420",
    BSC: "#F0B90B",
    Polygon: "#8247E5",
    Solana: "#14F195",
    Avalanche: "#E84142",
    Base: "#0052FF",
  }
  const color = colors[network] || "#7a8c9e"

  return (
    <div
      className="w-5 h-5 flex items-center justify-center text-[8px] font-bold shrink-0"
      style={{ background: `${color}22`, color, border: `1px solid ${color}33` }}
    >
      {network.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Token Logo (real image from CoinGecko or fallback letter) ────
function TokenLogo({ name, score, logoUrl, size = 40 }: { name: string; score: number; logoUrl?: string; size?: number }) {
  const col = scoreColor(score)
  const [imgError, setImgError] = useState(false)

  if (logoUrl && !imgError) {
    return (
      <div
        className="shrink-0 overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: size > 32 ? 8 : 4,
          border: `1px solid ${col}33`,
          background: `${col}08`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          className="block object-cover"
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-center text-sm font-bold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? 8 : 4,
        background: `${col}11`,
        border: `1px solid ${col}33`,
        color: col,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Severity Mini Pill ───────────────────────────────────────────
function SevPill({ sev, count }: { sev: SeverityLevel; count: number }) {
  const color = SEV_RAW_COLORS[sev]
  if (count === 0) {
    return (
      <span className="text-[8px] text-s39-dim px-1.5 py-0.5" style={{ background: "#0c0f14" }}>
        {sev[0]}: 0
      </span>
    )
  }
  return (
    <span
      className="text-[8px] font-bold px-1.5 py-0.5"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {sev[0]}: {count}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT DETAIL PAGE — CertiK-inspired
// ═══════════════════════════════════════════════════════════════════

/* Score arc SVG */
function ScoreArc({ score, size = 160 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const dash = (score / 100) * arc
  const col = scoreColor(score)
  const rot = 135 // start from bottom-left
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2233" strokeWidth={8}
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
          transform={`rotate(${rot} ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(${rot} ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 8px ${col}66)`, transition: "stroke-dasharray 1.2s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: col }}>{score.toFixed(2)}</span>
        <span className="text-xs font-bold mt-0.5" style={{ color: col }}>
          {score >= 95 ? "AAA" : score >= 90 ? "AA" : score >= 80 ? "A" : score >= 70 ? "BBB" : score >= 60 ? "BB" : "B"}
        </span>
      </div>
    </div>
  )
}

/* Category score mini-bar */
function CategoryBar({ label, score: val, color }: { label: string; score: number; color: string }) {
  return (
    <div className="bg-s39-bg2 border border-s39-border p-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-s39-mid">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{val.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-s39-bg0 mt-2">
        <div className="h-full transition-[width] duration-1000 ease-out"
          style={{ width: `${val}%`, background: color, boxShadow: `0 0 4px ${color}44` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[7px] text-s39-dim">Poor</span>
        <span className="text-[7px] text-s39-dim">Excellent</span>
      </div>
    </div>
  )
}

/* Status check row */
function CheckRow({ label, value, danger }: { label: string; value: string | boolean; danger?: boolean }) {
  const isYes = value === true || value === "Yes"
  const isNo = value === false || value === "No"
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value
  const color = danger
    ? (isYes ? "#ff6b00" : "#00ff88")
    : (isNo ? "#00ff88" : isYes ? "#00ff88" : "#7a8c9e")
  return (
    <div className="flex justify-between items-center py-2 border-b border-s39-border last:border-0">
      <span className="text-[10px] text-s39-mid">{label}</span>
      <span className="text-[10px] font-bold" style={{ color }}>{display}</span>
    </div>
  )
}

// ── Share Button ────────────────────────────────────────────────
function ShareButton({ auditId, name }: { auditId: string; name: string }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/audit/${auditId}`
    : `https://www.solay39.eu/audit/${auditId}`

  const handleShare = async () => {
    // Try native share API (mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${name} Security Audit | Solay39`,
          text: `Check out the ${name} smart contract security audit by Solay39`,
          url: shareUrl,
        })
        return
      } catch {
        // User cancelled or share API not supported — fall through to clipboard
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Last resort
      const input = document.createElement("input")
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-[8px] text-s39-cyan bg-s39-cyan/5 border border-s39-cyan/20 px-2.5 py-1 tracking-wider hover:bg-s39-cyan/10 transition-colors cursor-pointer font-mono"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? "LINK COPIED!" : "SHARE AUDIT"}
    </button>
  )
}

export function ProjectDetail({ p, onBack, isLive, backHref }: { p: PortfolioProject; onBack?: () => void; isLive?: boolean; backHref?: string }) {
  const sc = scoreColor(p.score)
  const bd = p.scoreBreakdown
  const totalFindings = p.criticals + p.highs + p.mediums + p.lows + p.infos
  const resolvedCount = p.findings?.filter((f) => f.status === "RESOLVED").length ?? 0
  const openCount = p.findings?.filter((f) => f.status === "OPEN").length ?? 0
  const ackCount = p.findings?.filter((f) => f.status === "ACKNOWLEDGED").length ?? 0

  return (
    <div className="min-h-dvh bg-s39-bg0">
      {/* ── Top Header ── */}
      <div className="bg-s39-bg1 border-b border-s39-border">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-5">
          {backHref ? (
            <a href={backHref}
              className="text-s39-mid font-mono text-[10px] mb-5 tracking-widest hover:text-s39-green transition-colors block no-underline">
              {"<- BACK TO PORTFOLIO"}
            </a>
          ) : onBack ? (
            <button onClick={onBack}
              className="bg-transparent border-none text-s39-mid font-mono text-[10px] cursor-pointer mb-5 tracking-widest hover:text-s39-green transition-colors">
              {"<- BACK TO PORTFOLIO"}
            </button>
          ) : null}

          {/* Hero: Logo + Name + Badges + Score arc */}
          <div className="flex gap-6 sm:gap-10 items-start flex-col sm:flex-row">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <TokenLogo name={p.name} score={p.score} logoUrl={p.logoUrl} size={48} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-s39-white leading-tight">{p.name}</h1>
                    {p.ticker && (
                      <span className="text-[10px] text-s39-dim bg-s39-bg2 px-2 py-0.5">{p.ticker}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Badges row */}
              <div className="flex gap-2 flex-wrap mt-3 mb-4">
                <span className="flex items-center gap-1.5 text-[8px] text-s39-green bg-s39-green/5 border border-s39-green/20 px-2.5 py-1 tracking-wider">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#00ff88" strokeWidth="1"/><path d="M3 5l1.5 1.5L7 4" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  SOLAY39 AUDITED
                </span>
                <span className="text-[8px] border px-2.5 py-1 font-bold tracking-wider" style={{ color: sc, borderColor: `${sc}33`, background: `${sc}08` }}>
                  {p.rating}
                </span>
                {p.criticals === 0 && (
                  <span className="text-[8px] text-s39-green/80 border border-s39-green/15 px-2.5 py-1 bg-s39-green/5">
                    0 Critical
                  </span>
                )}
                {p.tags?.map((t) => (
                  <span key={t} className="text-[8px] text-s39-dim border border-s39-border px-2 py-1">{t}</span>
                ))}
                {/* Share Button */}
                <ShareButton auditId={p.id} name={p.name} />
              </div>

              {/* Price + Market Cap row */}
              {p.price && (
                <div className="flex gap-6 items-end flex-wrap mb-4">
                  <div>
                    <div className="text-[8px] text-s39-dim tracking-widest mb-0.5 flex items-center gap-2">
                      <span>Token Price ({p.ticker || p.name.slice(0, 3).toUpperCase()})</span>
                      {isLive && (
                        <span className="text-[6px] text-s39-green bg-s39-green/10 border border-s39-green/20 px-1.5 py-px tracking-wider animate-pulse">
                          LIVE
                        </span>
                      )}
                      <span className="text-s39-dim/60">24h</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-lg font-bold text-s39-white">{p.price}</span>
                      {p.change24h && (
                        <span className={`text-[10px] font-bold ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                          {p.change24h}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.tvl && (
                    <div>
                      <div className="text-[8px] text-s39-dim tracking-widest mb-0.5">
                        Market Cap
                        <span className="ml-2 text-s39-dim/60">24h</span>
                      </div>
                      <div className="text-lg font-bold text-s39-white">{p.tvl}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Score Arc + Sub-Score Breakdown */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="text-[8px] text-s39-dim tracking-[0.15em]">SOLAY39 SECURITY SCORE</div>
              <ScoreArc score={Math.min(p.score, 98)} size={160} />
              <div className="text-[7px] text-s39-dim italic mt-1">Max: 98/98</div>
            </div>
          </div>

          {/* Sub-Score Breakdown */}
          {p.scoreBreakdown && (
            <div className="mt-5 pt-5 border-t border-s39-border">
              <div className="text-[8px] text-s39-dim tracking-[0.15em] mb-3">SCORE BREAKDOWN</div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {([
                  ["Code Security", p.scoreBreakdown.codeSecurity, "#00ff88"],
                  ["Architecture", p.scoreBreakdown.architectureRisk, "#00e5ff"],
                  ["Governance", p.scoreBreakdown.governanceRisk, "#4488ff"],
                  ["Centralization", p.scoreBreakdown.centralization, "#ffd600"],
                  ["Testing", p.scoreBreakdown.testingCoverage, "#ff6b00"],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} className="bg-s39-bg2 border border-s39-border p-3">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[7px] text-s39-dim tracking-widest">{label.toUpperCase()}</span>
                      <span className="text-[11px] font-bold font-mono" style={{ color: val >= 90 ? "#00ff88" : val >= 70 ? "#ffd600" : "#ff2d55" }}>{val}</span>
                    </div>
                    <div className="h-1 bg-s39-bg0 w-full">
                      <div className="h-full transition-all duration-700" style={{ width: `${val}%`, background: color, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Project Info Bar ── */}
      <div className="bg-s39-bg1 border-b border-s39-border">
        <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-6 items-start flex-col sm:flex-row">
            {p.description && (
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-s39-green tracking-[0.12em] mb-2">
                  {p.name} Info
                </div>
                <p className="text-[10px] text-s39-mid leading-relaxed">{p.description}</p>
              </div>
            )}
            <div className="shrink-0 flex flex-col gap-1.5 text-[9px] min-w-[200px]">
              <div className="flex justify-between gap-4">
                <span className="text-s39-dim">Audits</span>
                <span className="text-s39-lite font-bold">1 Available</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-s39-dim">Listed Date</span>
                <span className="text-s39-lite">{p.date}</span>
              </div>
              {p.website && (
                <div className="flex justify-between gap-4">
                  <span className="text-s39-dim">Website</span>
                  <a href={p.website} target="_blank" rel="noreferrer" className="text-s39-cyan hover:underline truncate max-w-[140px]">
                    {p.website.replace(/https?:\/\//, "")}
                  </a>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-s39-dim">Network</span>
                <div className="flex items-center gap-1.5">
                  <NetworkIcon network={p.network} />
                  <span className="text-s39-lite">{p.network}</span>
                </div>
              </div>
              {p.contractAddress && (
                <div className="flex justify-between gap-4">
                  <span className="text-s39-dim">Contract</span>
                  <span className="text-s39-cyan font-mono truncate max-w-[140px]">{p.contractAddress.slice(0, 6)}...{p.contractAddress.slice(-6)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-6">
        {/* Category Scores Grid */}
        {bd && (
          <div className="mb-6">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">CATEGORY SCORES</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <CategoryBar label="Code Security" score={bd.codeSecurity} color="#00ff88" />
              <CategoryBar label="Architecture Risk" score={bd.architectureRisk} color="#00e5ff" />
              <CategoryBar label="Governance Risk" score={bd.governanceRisk} color="#4488ff" />
              <CategoryBar label="Centralization" score={bd.centralization} color="#ffd600" />
              <CategoryBar label="Testing Coverage" score={bd.testingCoverage} color="#7a8c9e" />
              <div className="bg-s39-bg2 border border-s39-border p-4 flex flex-col justify-center items-center">
                <div className="text-3xl font-bold" style={{ color: sc }}>{p.score}</div>
                <div className="text-[8px] text-s39-dim tracking-widest mt-1">OVERALL SCORE</div>
                <div className="text-xs font-bold mt-1" style={{ color: sc }}>{p.rating}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Code Audit Section ── */}
        <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#00ff88" strokeWidth="1"/><path d="M4 7l2 2 4-4" stroke="#00ff88" strokeWidth="1" strokeLinecap="round"/></svg>
            <span className="text-[9px] text-s39-green tracking-[0.15em]">CODE AUDIT</span>
          </div>

          {/* Audit entry */}
          <div className="bg-s39-bg2 border border-s39-border p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-s39-green/10 border border-s39-green/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3v8" stroke="#00ff88" strokeWidth="1" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className="text-[11px] text-s39-white font-bold">{p.name} Smart Contracts</div>
                  <div className="text-[8px] text-s39-dim mt-0.5">
                    Audited by {p.auditor || "Solay39 Founder"}
                  </div>
                </div>
              </div>
              {p.pdfUrl && (
                <a href={p.pdfUrl} target="_blank" rel="noreferrer">
                  <S39Btn primary small>View PDF</S39Btn>
                </a>
              )}
            </div>

            {/* Audit Timeline */}
            {p.auditTimeline && p.auditTimeline.length > 0 && (
              <div className="flex gap-4 mb-4 flex-wrap">
                <div className="text-[9px] text-s39-dim tracking-[0.1em]">AUDIT TIMELINE</div>
                {p.auditTimeline.map((t, i) => (
                  <div key={i} className="text-[9px]">
                    <span className="text-s39-mid">{t.label}</span>
                    <span className="text-s39-dim ml-1.5">{t.date}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Findings bar */}
            <div className="border-t border-s39-border pt-4">
              <div className="flex gap-4 items-center mb-3 flex-wrap">
                <span className="text-[9px] text-s39-mid tracking-[0.1em]">ALL FINDINGS</span>
                <span className="text-sm font-bold text-s39-white">{totalFindings}</span>
                <span className="text-[8px] text-s39-dim">|</span>
                <span className="text-[8px] text-s39-dim">{ackCount} Acknowledged</span>
                <span className="text-[8px] text-s39-dim">{resolvedCount} Resolved</span>
                <span className="text-[8px] text-s39-dim">{openCount} Open</span>
              </div>

              {/* Severity breakdown */}
              <div className="flex flex-col gap-2">
                {([
                  ["Critical", p.criticals, "#ff2d55"],
                  ["High", p.highs, "#ff6b00"],
                  ["Medium", p.mediums, "#ffd600"],
                  ["Low", p.lows, "#00e5ff"],
                  ["Informational", p.infos, "#00ff88"],
                ] as [string, number, string][]).map(([label, count, color]) => {
                  const forThisSev = p.findings?.filter(
                    (f) => f.severity === label.toUpperCase() || (label === "Informational" && f.severity === "INFO")
                  ) ?? []
                  const sevResolved = forThisSev.filter((f) => f.status === "RESOLVED").length
                  const sevOpen = forThisSev.filter((f) => f.status === "OPEN").length
                  return (
                    <div key={label} className="flex items-center gap-3 py-1.5 border-b border-s39-border last:border-0">
                      <div className="w-3 h-3 shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}40` }} />
                      <span className="text-[10px] w-20 shrink-0" style={{ color: count > 0 ? color : "#445566" }}>
                        {count} {label}
                      </span>
                      <div className="flex-1 h-1 bg-s39-bg0 relative">
                        {count > 0 && (
                          <div className="h-full" style={{ width: `${Math.min(100, count * 20)}%`, background: color, opacity: 0.6 }} />
                        )}
                      </div>
                      <span className="text-[8px] text-s39-dim shrink-0 w-28 text-right">
                        {sevResolved > 0 && `${sevResolved} Resolved`}
                        {sevResolved > 0 && sevOpen > 0 && ", "}
                        {sevOpen > 0 && `${sevOpen} Open`}
                        {count === 0 && "None"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Methods */}
          <div className="flex gap-6 flex-wrap text-[9px] text-s39-mid mb-3">
            <div>
              <span className="text-s39-dim tracking-widest">METHODS</span>
              {p.toolingUsed && p.toolingUsed.length > 0
                ? p.toolingUsed.slice(0, 4).map((t, i) => (
                    <span key={i} className="ml-2 text-s39-lite">{t}</span>
                  ))
                : <>
                    <span className="ml-2 text-s39-lite">Manual Review</span>
                    <span className="ml-2 text-s39-lite">Static Analysis</span>
                    <span className="ml-2 text-s39-lite">AI-Guided Verification</span>
                  </>
              }
            </div>
          </div>
        </div>

        {/* ══════════ HALBORN-STYLE TIER-1 SECTIONS ══════════ */}

        {/* ── 1. AUDIT ENGAGEMENT DETAILS ── */}
        {p.engagement && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="#00ff88" strokeWidth="1"/><path d="M5 5h4M5 7h4M5 9h2" stroke="#00ff88" strokeWidth="0.8" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">AUDIT ENGAGEMENT DETAILS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">HALBORN STANDARD</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">AUDIT DATE</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.auditDate}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">DURATION</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.auditDurationDays} days</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">AUDITORS</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.numberOfAuditors}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">LINES OF CODE</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.linesOfCode}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">LEAD AUDITOR</div>
                <div className="text-[10px] text-s39-cyan font-bold">{p.engagement.leadAuditor}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">COMPILER VERSION</div>
                <div className="text-[10px] text-s39-cyan font-mono">{p.engagement.compilerVersionUsed}</div>
              </div>
            </div>

            <div className="bg-s39-bg2 border border-s39-border p-3 mb-4">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">COMMIT / VERIFICATION</div>
              <div className="text-[9px] text-s39-mid font-mono break-all">{p.engagement.commitHash}</div>
              {p.engagement.repositoryUrl && (
                <a href={p.engagement.repositoryUrl} target="_blank" rel="noreferrer" className="text-[8px] text-s39-cyan hover:underline mt-1 inline-block">{p.engagement.repositoryUrl}</a>
              )}
            </div>

            {p.engagement.objectives && p.engagement.objectives.length > 0 && (
              <div>
                <div className="text-[7px] text-s39-dim tracking-widest mb-2">ENGAGEMENT OBJECTIVES</div>
                <div className="flex flex-col gap-1.5">
                  {p.engagement.objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-s39-green text-[9px] shrink-0 mt-0.5 font-mono">{i + 1}.</span>
                      <span className="text-[9px] text-s39-mid leading-relaxed">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. SCOPE TABLE ── */}
        {p.scopeTable && p.scopeTable.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1" stroke="#00e5ff" strokeWidth="1"/><path d="M1 6h12M5 6v5M9 6v5" stroke="#00e5ff" strokeWidth="0.7"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">SCOPE</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">CONTRACT</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ADDRESS</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">COMMIT</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LINES</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LANGUAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {p.scopeTable.map((s, i) => (
                    <tr key={i} className="border-b border-s39-border last:border-0">
                      <td className="px-3 py-2.5 text-s39-cyan font-bold font-mono">{s.contract}</td>
                      <td className="px-3 py-2.5 text-s39-mid font-mono text-[9px]">{s.address.slice(0, 8)}...{s.address.slice(-6)}</td>
                      <td className="px-3 py-2.5 text-s39-mid text-[9px]">{s.commit}</td>
                      <td className="px-3 py-2.5 text-s39-white font-bold font-mono">{s.linesOfCode}</td>
                      <td className="px-3 py-2.5 text-s39-mid text-[9px]">{s.language}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 3. RISK MODEL (Severity Matrix) ── */}
        {p.riskModel && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2L2 12h10L7 2z" stroke="#ffd600" strokeWidth="1" strokeLinejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="#ffd600" strokeWidth="1" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-yellow tracking-[0.15em]">RISK CLASSIFICATION MODEL</span>
            </div>
            <p className="text-[9px] text-s39-mid leading-relaxed mb-4">{p.riskModel.methodology}</p>
            <div className="flex flex-col gap-2 mb-4">
              {p.riskModel.severityMatrix.map((s, i) => {
                const col = s.level === "CRITICAL" ? "#ff2d55" : s.level === "HIGH" ? "#ff6b00" : s.level === "MEDIUM" ? "#ffd600" : s.level === "LOW" ? "#00e5ff" : "#00ff88"
                return (
                  <div key={i} className="flex items-start gap-3 bg-s39-bg2 border border-s39-border p-3" style={{ borderLeftColor: col, borderLeftWidth: 3 }}>
                    <div className="shrink-0 w-20">
                      <span className="text-[9px] font-bold font-mono" style={{ color: col }}>{s.level}</span>
                      <div className="text-[7px] text-s39-dim mt-0.5">{s.likelihood}</div>
                    </div>
                    <p className="text-[9px] text-s39-mid leading-relaxed flex-1">{s.description}</p>
                  </div>
                )
              })}
            </div>
            <p className="text-[8px] text-s39-dim italic">{p.riskModel.disclaimer}</p>
          </div>
        )}

        {/* ── 4. REMEDIATION STATUS ── */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 7l2 2 4-4" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="7" r="5.5" stroke="#00ff88" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">REMEDIATION STATUS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ID</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">FINDING</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">SEVERITY</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {p.findings.map((f, i) => {
                    const sevCol = f.severity === "CRITICAL" ? "#ff2d55" : f.severity === "HIGH" ? "#ff6b00" : f.severity === "MEDIUM" ? "#ffd600" : f.severity === "LOW" ? "#00e5ff" : "#00ff88"
                    const stCol = f.status === "RESOLVED" ? "#00ff88" : f.status === "ACKNOWLEDGED" ? "#ffd600" : f.status === "PARTIALLY_FIXED" ? "#ff6b00" : "#ff2d55"
                    const stIcon = f.status === "RESOLVED" ? "FIXED" : f.status === "ACKNOWLEDGED" ? "ACK" : f.status === "PARTIALLY_FIXED" ? "PARTIAL" : "OPEN"
                    const sevPfx = f.severity === "CRITICAL" ? "C" : f.severity === "HIGH" ? "H" : f.severity === "MEDIUM" ? "M" : f.severity === "LOW" ? "L" : "I"
                    return (
                      <tr key={i} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: sevCol }}>{sevPfx}-{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-3 py-2.5 text-s39-mid">{f.title}</td>
                        <td className="px-3 py-2.5"><span className="text-[8px] font-bold px-2 py-0.5 border" style={{ color: sevCol, borderColor: `${sevCol}40`, background: `${sevCol}10` }}>{f.severity}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[9px] font-bold" style={{ color: stCol }}>{stIcon}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Summary stats */}
            <div className="flex gap-4 mt-4 text-[9px]">
              <span className="text-s39-green font-bold">{p.findings.filter(f => f.status === "RESOLVED").length} Fixed</span>
              <span className="text-s39-yellow font-bold">{p.findings.filter(f => f.status === "ACKNOWLEDGED").length} Acknowledged</span>
              <span className="text-s39-red font-bold">{p.findings.filter(f => f.status === "OPEN").length} Open</span>
              <span className="text-s39-orange font-bold">{p.findings.filter(f => f.status === "PARTIALLY_FIXED").length} Partial</span>
            </div>
          </div>
        )}

        {/* ── TIER-1: Security Architecture ── */}
        {(p.privilegedRoles || p.trustAssumptions || p.architectureOverview || p.attackSurface) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 4v4l6 3 6-3V4L7 1z" stroke="#00e5ff" strokeWidth="1" strokeLinejoin="round"/><path d="M1 4l6 3m0 0l6-3M7 7v6" stroke="#00e5ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">SECURITY ARCHITECTURE</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>

            {/* Architecture Overview */}
            {p.architectureOverview && (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">ARCHITECTURE OVERVIEW</div>
                <div className="bg-s39-bg2 border border-s39-border p-4">
                  <p className="text-[10px] text-s39-mid leading-relaxed">{p.architectureOverview}</p>
                </div>
              </div>
            )}

            {/* Trust Assumptions -- BEFORE Privileged Roles (explicit trust model first) */}
            {p.trustAssumptions && p.trustAssumptions.length > 0 && (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">TRUST MODEL</div>
                <div className="flex flex-col gap-2">
                  {p.trustAssumptions.map((t, i) => (
                    <div key={i} className="bg-s39-bg2 border-l-2 border-s39-yellow px-4 py-3">
                      <p className="text-[10px] text-s39-mid leading-relaxed italic">{t.statement}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privileged Roles Table */}
            {p.privilegedRoles && p.privilegedRoles.length > 0 && (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">PRIVILEGED ROLES</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-s39-bg2">
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ROLE</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">CAPABILITIES</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">RISK IF COMPROMISED</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.privilegedRoles.map((r, i) => (
                        <tr key={i} className="border-b border-s39-border last:border-0">
                          <td className="px-3 py-2.5 text-s39-cyan font-bold font-mono whitespace-nowrap">{r.role}</td>
                          <td className="px-3 py-2.5 text-s39-mid">{r.capabilities}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] px-2 py-0.5 border ${
                              r.riskIfCompromised.toLowerCase().includes("critical") || r.riskIfCompromised.toLowerCase().includes("high")
                                ? "text-s39-red border-s39-red/30 bg-s39-red/5"
                                : r.riskIfCompromised.toLowerCase().includes("medium")
                                  ? "text-s39-yellow border-s39-yellow/30 bg-s39-yellow/5"
                                  : "text-s39-green border-s39-green/30 bg-s39-green/5"
                            }`}>
                              {r.riskIfCompromised}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Attack Surface */}
            {p.attackSurface && p.attackSurface.length > 0 && (
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">ATTACK SURFACE ANALYSIS</div>
                <div className="flex flex-col gap-2">
                  {p.attackSurface.map((a, i) => {
                    const typeColor = a.type === "fund-theft" ? "#ff2d55"
                      : a.type === "censorship" ? "#ff6b00"
                      : a.type === "state-corruption" ? "#ffd600"
                      : a.type === "governance" ? "#4488ff" : "#00e5ff"
                    const lColor = a.likelihood === "High" ? "text-s39-red" : a.likelihood === "Medium" ? "text-s39-yellow" : "text-s39-green"
                    return (
                      <div key={i} className="bg-s39-bg2 border border-s39-border p-3">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="w-1 h-4 shrink-0" style={{ background: typeColor }} />
                          <span className="text-[10px] text-s39-lite font-bold flex-1">{a.title}</span>
                          <span className="text-[7px] tracking-widest px-2 py-0.5 border" style={{ color: typeColor, borderColor: `${typeColor}40` }}>
                            {a.type.replace("-", " ").toUpperCase()}
                          </span>
                          <span className={`text-[8px] ${lColor} font-bold`}>
                            {a.likelihood} Likelihood
                          </span>
                          {a.mitigated && (
                            <span className="text-[7px] text-s39-green bg-s39-green/10 border border-s39-green/20 px-1.5 py-0.5 tracking-wider">
                              MITIGATED
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-s39-mid leading-relaxed pl-3">{a.description}</p>
                        {a.simulationResult && (
                          <div className="mt-2 ml-3 bg-s39-bg0 border-l-2 border-s39-cyan px-3 py-2">
                            <div className="text-[7px] text-s39-cyan tracking-widest mb-0.5">SIMULATION RESULT</div>
                            <pre className="text-[9px] text-s39-mid leading-relaxed font-mono whitespace-pre-wrap">{a.simulationResult}</pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIER-1: Tooling & On-Chain Validation (placed before findings) ── */}
        {(p.toolingUsed || p.onChainValidation) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {p.toolingUsed && p.toolingUsed.length > 0 && (
              <div className="bg-s39-bg1 border border-s39-border p-5">
                <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">TOOLING & METHODOLOGY</div>
                <div className="flex flex-col gap-2">
                  {p.toolingUsed.map((tool, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#00ff88" strokeWidth="1" /><path d="M3 5l1.5 1.5L7 4" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[10px] text-s39-mid">{tool}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.onChainValidation && p.onChainValidation.length > 0 && (
              <div className="bg-s39-bg1 border border-s39-border p-5">
                <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">ON-CHAIN VALIDATION</div>
                <div className="flex flex-col gap-2">
                  {p.onChainValidation.map((v, i) => {
                    const statusIcon = v.status === "pass" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#00ff88" strokeWidth="1" /><path d="M3.5 6l2 2L8.5 4.5" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : v.status === "fail" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#ff2d55" strokeWidth="1" /><path d="M4 4l4 4M8 4l-4 4" stroke="#ff2d55" strokeWidth="1" strokeLinecap="round" /></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#445566" strokeWidth="1" /><path d="M4 6h4" stroke="#445566" strokeWidth="1" strokeLinecap="round" /></svg>
                    )
                    return (
                      <div key={i} className="flex items-center gap-2 py-1">
                        {statusIcon}
                        <span className={`text-[10px] ${v.status === "pass" ? "text-s39-mid" : v.status === "fail" ? "text-s39-red" : "text-s39-dim"}`}>{v.label}</span>
                        {v.detail && <span className="text-[8px] text-s39-dim ml-auto">{v.detail}</span>}
                        <span className={`ml-auto text-[8px] font-bold ${v.status === "pass" ? "text-s39-green" : v.status === "fail" ? "text-s39-red" : "text-s39-dim"}`}>{v.status.toUpperCase()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIER-1: Testing Methodology & Code Coverage ── */}
        {p.testingMethodology && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#aa44ff" strokeWidth="1"/><path d="M4 7h6M7 4v6" stroke="#aa44ff" strokeWidth="1" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-[#aa44ff] tracking-[0.15em]">CODE COVERAGE & TESTING METHODOLOGY</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>

            {/* Review phases + hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">MANUAL REVIEW ({p.testingMethodology.manualReviewHours}h)</div>
                <div className="flex flex-col gap-1.5">
                  {p.testingMethodology.reviewPhases.map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] text-[#aa44ff] font-mono w-4 shrink-0">{i + 1}.</span>
                      <span className="text-[10px] text-s39-mid">{phase}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {/* Static Analysis Tools */}
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">STATIC ANALYSIS</div>
                <div className="flex flex-col gap-2 mb-3">
                  {p.testingMethodology.staticAnalysisTools.map((t, i) => (
                    <div key={i} className="bg-s39-bg2 border border-s39-border p-2.5">
                      <div className="text-[10px] text-s39-cyan font-bold font-mono">{t.tool}</div>
                      <div className="text-[9px] text-s39-mid mt-0.5">{t.findings}</div>
                      {t.configUsed && <div className="text-[8px] text-s39-dim mt-0.5">{t.configUsed}</div>}
                    </div>
                  ))}
                </div>

                {/* Dynamic Analysis Tools */}
                {p.testingMethodology.dynamicAnalysisTools && p.testingMethodology.dynamicAnalysisTools.length > 0 && (
                  <>
                    <div className="text-[8px] text-s39-dim tracking-widest mb-2">DYNAMIC ANALYSIS</div>
                    <div className="flex flex-col gap-2">
                      {p.testingMethodology.dynamicAnalysisTools.map((t, i) => (
                        <div key={i} className="bg-s39-bg2 border border-s39-border p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-s39-cyan font-bold font-mono">{t.tool}</span>
                            {t.executionTime && <span className="text-[8px] text-s39-dim ml-auto">{t.executionTime}</span>}
                          </div>
                          <div className="text-[9px] text-s39-mid mt-0.5">{t.findings}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fuzzing + Symbolic */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">FUZZING</div>
                <div className={`text-sm font-bold ${p.testingMethodology.fuzzingApplied ? "text-s39-green" : "text-s39-dim"}`}>
                  {p.testingMethodology.fuzzingApplied ? "APPLIED" : "N/A"}
                </div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">SYMBOLIC EXEC</div>
                <div className={`text-sm font-bold ${p.testingMethodology.symbolicExecution ? "text-s39-green" : "text-s39-dim"}`}>
                  {p.testingMethodology.symbolicExecution ? "APPLIED" : "N/A"}
                </div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center col-span-2">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">REVIEW DEPTH</div>
                <div className="text-sm font-bold text-[#aa44ff]">{p.testingMethodology.manualReviewHours}h MANUAL</div>
              </div>
            </div>

            {/* Assumptions & Limitations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">ASSUMPTIONS</div>
                <div className="flex flex-col gap-1.5">
                  {p.testingMethodology.assumptions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-s39-cyan text-[9px] shrink-0 mt-0.5">*</span>
                      <span className="text-[9px] text-s39-mid leading-relaxed">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">LIMITATIONS</div>
                <div className="flex flex-col gap-1.5">
                  {p.testingMethodology.limitations.map((l, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-s39-orange text-[9px] shrink-0 mt-0.5">!</span>
                      <span className="text-[9px] text-s39-mid leading-relaxed">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TIER-1: Governance Security ── */}
        {p.governanceSecurity && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l5 3v6l-5 3-5-3V4l5-3z" stroke="#4488ff" strokeWidth="1" strokeLinejoin="round"/><circle cx="7" cy="7" r="2" stroke="#4488ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-[#4488ff] tracking-[0.15em]">GOVERNANCE SECURITY</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">GOVERNANCE</div>
                <div className={`text-sm font-bold ${p.governanceSecurity.hasGovernance ? "text-[#4488ff]" : "text-s39-dim"}`}>
                  {p.governanceSecurity.hasGovernance ? "ACTIVE" : "NONE"}
                </div>
              </div>
              {p.governanceSecurity.timelockDelay && (
                <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">TIMELOCK</div>
                  <div className="text-sm font-bold text-s39-cyan">{p.governanceSecurity.timelockDelay}</div>
                </div>
              )}
              {p.governanceSecurity.quorumThreshold && (
                <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">QUORUM</div>
                  <div className="text-sm font-bold text-s39-mid">{p.governanceSecurity.quorumThreshold}</div>
                </div>
              )}
            </div>
            {p.governanceSecurity.votingRisks && p.governanceSecurity.votingRisks.length > 0 && (
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">VOTING RISKS</div>
                <div className="flex flex-col gap-2">
                  {p.governanceSecurity.votingRisks.map((risk, i) => (
                    <div key={i} className="flex items-center gap-2 bg-s39-bg2 border border-s39-border px-3 py-2">
                      <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#ff6b00" strokeWidth="1"/><path d="M5 3v2.5M5 7h.01" stroke="#ff6b00" strokeWidth="1" strokeLinecap="round"/></svg>
                      <span className="text-[10px] text-s39-mid">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIER-1: Upgradeability & Proxy ── */}
        {p.upgradeabilityAnalysis && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1" stroke="#ff6b00" strokeWidth="1"/><path d="M7 4v6M4 7h6" stroke="#ff6b00" strokeWidth="1" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-orange tracking-[0.15em]">UPGRADEABILITY & PROXY ANALYSIS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">UPGRADEABLE</div>
                <div className={`text-sm font-bold ${p.upgradeabilityAnalysis.isUpgradeable ? "text-s39-orange" : "text-s39-green"}`}>
                  {p.upgradeabilityAnalysis.isUpgradeable ? "YES" : "NO"}
                </div>
              </div>
              {p.upgradeabilityAnalysis.proxyPattern && p.upgradeabilityAnalysis.proxyPattern !== "none" && (
                <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">PROXY PATTERN</div>
                  <div className="text-[10px] font-bold text-s39-cyan font-mono">{p.upgradeabilityAnalysis.proxyPattern}</div>
                </div>
              )}
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">STORAGE COLLISION</div>
                <div className={`text-sm font-bold ${p.upgradeabilityAnalysis.storageCollisionRisk === "None" ? "text-s39-green" : p.upgradeabilityAnalysis.storageCollisionRisk === "Low" ? "text-s39-cyan" : p.upgradeabilityAnalysis.storageCollisionRisk === "Medium" ? "text-s39-yellow" : "text-s39-red"}`}>
                  {p.upgradeabilityAnalysis.storageCollisionRisk || "N/A"}
                </div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">INITIALIZER</div>
                <div className={`text-sm font-bold ${p.upgradeabilityAnalysis.initializerProtection ? "text-s39-green" : "text-s39-orange"}`}>
                  {p.upgradeabilityAnalysis.initializerProtection ? "PROTECTED" : "UNPROTECTED"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TIER-1: Economic & Game-Theory Risks ── */}
        {p.economicRisks && p.economicRisks.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M4 4l3-3 3 3M4 10l3 3 3-3" stroke="#ffd600" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-s39-yellow tracking-[0.15em]">ECONOMIC & GAME-THEORY RISKS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>
            <div className="flex flex-col gap-3">
              {p.economicRisks.map((e, i) => {
                const catColor = e.category === "vote-buying" ? "#4488ff" : e.category === "supply-concentration" ? "#ff6b00" : e.category === "treasury-drain" ? "#ff2d55" : e.category === "oracle-manipulation" ? "#ff2d55" : e.category === "mev" ? "#aa44ff" : "#ffd600"
                const sColor = e.severity === "High" ? "text-s39-red" : e.severity === "Medium" ? "text-s39-yellow" : "text-s39-green"
                return (
                  <div key={i} className="bg-s39-bg2 border border-s39-border p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="w-1 h-4 shrink-0" style={{ background: catColor }} />
                      <span className="text-[10px] text-s39-lite font-bold flex-1">{e.title}</span>
                      <span className="text-[7px] tracking-widest px-2 py-0.5 border" style={{ color: catColor, borderColor: `${catColor}40` }}>{e.category.replace(/-/g, " ").toUpperCase()}</span>
                      <span className={`text-[8px] ${sColor} font-bold`}>{e.severity}</span>
                    </div>
                    <p className="text-[9px] text-s39-mid leading-relaxed pl-3 mb-2">{e.description}</p>
                    {e.mitigation && (
                      <div className="bg-s39-bg0 border-l-2 border-s39-green px-3 py-2 ml-3">
                        <span className="text-[8px] text-s39-green tracking-widest mr-2">MITIGATION</span>
                        <span className="text-[9px] text-s39-mid">{e.mitigation}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TIER-1: Invariants Checked ── */}
        {p.invariantsChecked && p.invariantsChecked.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">INVARIANTS CHECKED</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>
            <div className="flex flex-col gap-2">
              {p.invariantsChecked.map((inv, i) => (
                <div key={i} className="bg-s39-bg2 border border-s39-border p-3">
                  <div className="flex items-start gap-2">
                    {inv.holds ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5"><circle cx="7" cy="7" r="6" stroke="#00ff88" strokeWidth="1"/><path d="M4 7l2 2 4-4" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5"><circle cx="7" cy="7" r="6" stroke="#ff2d55" strokeWidth="1"/><path d="M5 5l4 4M9 5l-4 4" stroke="#ff2d55" strokeWidth="1" strokeLinecap="round"/></svg>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-s39-lite font-bold">{inv.invariant}</span>
                        <span className={`ml-auto text-[8px] font-bold ${inv.holds ? "text-s39-green" : "text-s39-red"}`}>{inv.holds ? "HOLDS" : "VIOLATED"}</span>
                      </div>
                      {inv.evidence && <p className="text-[9px] text-s39-dim leading-relaxed">{inv.evidence}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TIER-1: Severity / Likelihood Matrix ── */}
        {p.findings && p.findings.length > 0 && p.findings.some(f => f.likelihood) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" stroke="#00e5ff" strokeWidth="1"/><path d="M1 5h12M1 9h12M5 1v12M9 1v12" stroke="#00e5ff" strokeWidth=".5" opacity=".3"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">SEVERITY / LIKELIHOOD MATRIX</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">TIER-1</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-2 py-2 border border-s39-border bg-s39-bg2">IMPACT / LIKELIHOOD</th>
                    {["High", "Medium", "Low"].map(l => (
                      <th key={l} className="text-center text-[7px] text-s39-dim tracking-widest px-2 py-2 border border-s39-border bg-s39-bg2">{l.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map(sev => {
                    const sevFindings = p.findings!.filter(f => f.severity === sev && f.likelihood)
                    if (sevFindings.length === 0) return null
                    return (
                      <tr key={sev}>
                        <td className="px-2 py-2 border border-s39-border font-bold" style={{ color: SEV_RAW_COLORS[sev] }}>{sev}</td>
                        {["High", "Medium", "Low"].map(l => {
                          const count = sevFindings.filter(f => f.likelihood === l).length
                          const cellColor = count > 0 && (sev === "CRITICAL" || sev === "HIGH") && l === "High" ? "bg-s39-red/10" : count > 0 ? "bg-s39-bg2" : ""
                          return (
                            <td key={l} className={`text-center px-2 py-2 border border-s39-border ${cellColor}`}>
                              {count > 0 ? <span className="text-s39-lite font-bold">{count}</span> : <span className="text-s39-dim">-</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[8px] text-s39-dim mt-3 italic">Severity is determined by Impact x Likelihood. Critical/High findings with High likelihood represent immediate risk vectors.</p>
          </div>
        )}

        {/* ══════════ FINDING DETAILS (after all Tier-1 analysis) ══════════ */}

        {/* ── Finding Details ── */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">FINDING DETAILS</div>
            {p.findings.map((f, idx) => {
              const fColor = SEV_RAW_COLORS[f.severity as SeverityLevel] || "#7a8c9e"
              return (
                <div key={idx} className="bg-s39-bg2 border border-s39-border mb-3 overflow-hidden">
                  {/* Finding header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-s39-border" style={{ background: `${fColor}06` }}>
                    <div className="w-1 h-6 shrink-0" style={{ background: fColor }} />
                    <SevBadge sev={f.severity} />
                    <span className="text-[11px] text-s39-lite font-bold flex-1">{f.title}</span>
                    <span className={`text-[8px] px-2 py-0.5 border shrink-0 ${
                      f.status === "RESOLVED" ? "text-s39-green border-s39-green/30 bg-s39-green/5" :
                      f.status === "ACKNOWLEDGED" ? "text-s39-yellow border-s39-yellow/30 bg-s39-yellow/5" :
                      "text-s39-orange border-s39-orange/30 bg-s39-orange/5"
                    }`}>
                      {f.status}
                    </span>
                  </div>
                  {/* Finding body */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <div className="text-[9px] text-s39-cyan font-mono">{f.location}</div>
                      {f.likelihood && (
                        <span className={`text-[7px] tracking-widest px-1.5 py-0.5 border ${
                          f.likelihood === "High" ? "text-s39-red border-s39-red/30 bg-s39-red/5"
                            : f.likelihood === "Medium" ? "text-s39-yellow border-s39-yellow/30 bg-s39-yellow/5"
                            : "text-s39-green border-s39-green/30 bg-s39-green/5"
                        }`}>
                          {f.likelihood.toUpperCase()} LIKELIHOOD
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-s39-mid leading-relaxed mb-3">{f.description}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {f.impact && (
                        <div className="bg-s39-bg0 border border-s39-border p-3">
                          <div className="text-[8px] text-s39-orange tracking-widest mb-1">IMPACT</div>
                          <div className="text-[9px] text-s39-mid leading-relaxed">{f.impact}</div>
                        </div>
                      )}
                      {f.recommendation && (
                        <div className="bg-s39-bg0 border border-s39-border p-3">
                          <div className="text-[8px] text-s39-green tracking-widest mb-1">RECOMMENDATION</div>
                          <div className="text-[9px] text-s39-mid leading-relaxed">{f.recommendation}</div>
                        </div>
                      )}
                    </div>
                    {f.proofOfConcept && (
                      <div className="mt-3 bg-[#0a0e14] border border-s39-border overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-s39-bg2 border-b border-s39-border">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="1" width="8" height="8" rx="1" stroke="#00cccc" strokeWidth="0.8"/><path d="M3 5l1.5 1.5L7 3.5" stroke="#00cccc" strokeWidth="0.8" strokeLinecap="round"/></svg>
                          <span className="text-[8px] text-s39-cyan tracking-widest">PROOF OF CONCEPT / CODE-LEVEL EVIDENCE</span>
                          <span className="text-[7px] text-s39-dim ml-auto">TIER-1</span>
                        </div>
                        <pre className="text-[9px] text-s39-mid leading-relaxed font-mono whitespace-pre-wrap p-3 overflow-x-auto">{f.proofOfConcept}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Centralization / Governance ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Contract Uncertainty */}
          {p.contractUncertainty && (
            <div className="bg-s39-bg1 border border-s39-border p-5">
              <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">CONTRACT UNCERTAINTY</div>
              <div className="flex items-center gap-2 mb-3 text-[9px]">
                <span className="text-s39-green">{p.contractUncertainty.filter((c) => !c.value || c.label === "Open Source").length} Passed</span>
                <span className="text-s39-dim">|</span>
                <span className="text-s39-orange">
                  {p.contractUncertainty.filter((c) => {
                    if (c.label === "Open Source") return !c.value
                    return c.value === true
                  }).length} Attention
                </span>
              </div>
              {p.contractUncertainty.map((c, i) => {
                const isGood = c.label === "Open Source" ? c.value : !c.value
                return (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-s39-border last:border-0">
                    <span className="text-[10px] text-s39-mid">{c.label}</span>
                    <span className={`text-[10px] font-bold ${isGood ? "text-s39-green" : "text-s39-orange"}`}>
                      {c.value ? "Yes" : "No"}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Owner Privilege */}
          {p.ownerPrivilege && (
            <div className="bg-s39-bg1 border border-s39-border p-5">
              <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">OWNER PRIVILEGE</div>
              <div className="flex items-center gap-2 mb-3 text-[9px]">
                <span className="text-s39-green">
                  {p.ownerPrivilege.filter((o) => {
                    if (o.label === "Ownership Renounced") return o.value === true
                    return o.value === false || o.value === "No" || o.value === "0.00%"
                  }).length} Passed
                </span>
                <span className="text-s39-dim">|</span>
                <span className="text-s39-orange">
                  {p.ownerPrivilege.filter((o) => {
                    if (o.label === "Ownership Renounced") return o.value !== true
                    return o.value === true || o.value === "Yes"
                  }).length} Attention
                </span>
              </div>
              {p.ownerPrivilege.map((o, i) => (
                <CheckRow key={i} label={o.label} value={o.value} />
              ))}
            </div>
          )}
        </div>

        {/* ── Centralization Overview ── */}
        {(p.centralizationLevel || p.centralizationRisk) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">CENTRALIZATION OVERVIEW</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ["Centralization Level", p.centralizationLevel],
                ["Centralization Risk", p.centralizationRisk],
              ] as [string, string | undefined][])
                .filter(([, v]) => !!v)
                .map(([label, value]) => {
                  const color = value === "Low" ? "#00ff88" : value === "Medium" ? "#ffd600" : "#ff6b00"
                  return (
                    <div key={label} className="bg-s39-bg2 p-3 text-center">
                      <div className="text-[8px] text-s39-dim tracking-widest mb-1">{label.toUpperCase()}</div>
                      <div className="text-sm font-bold" style={{ color }}>{value}</div>
                    </div>
                  )
                })}
              {p.contractAddress && (
                <div className="bg-s39-bg2 p-3 text-center col-span-2">
                  <div className="text-[8px] text-s39-dim tracking-widest mb-1">CONTRACT</div>
                  <div className="text-[9px] text-s39-cyan font-mono break-all">{p.contractAddress}</div>
                  {p.tokenAge && (
                    <div className="text-[8px] text-s39-dim mt-1">Token Age: {p.tokenAge}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LIMITATIONS & DISCLAIMER ── */}
        {p.limitations && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#ff6b00" strokeWidth="1"/><path d="M7 4v4M7 9.5v.5" stroke="#ff6b00" strokeWidth="1" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-orange tracking-[0.15em]">LIMITATIONS & DISCLAIMER</span>
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {p.limitations.statements.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <span className="text-s39-orange text-[9px] shrink-0 mt-0.5 font-mono">{i + 1}.</span>
                  <span className="text-[9px] text-s39-mid leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#1a0e00] border border-[#ff6b0030] p-4">
              <p className="text-[8px] text-s39-orange leading-relaxed font-bold tracking-wide">{p.limitations.disclaimer}</p>
            </div>
          </div>
        )}

        {/* ── ABOUT THE AUDITOR ── */}
        {p.auditorProfile && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="#00e5ff" strokeWidth="1"/><path d="M2 12c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="#00e5ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">ABOUT THE AUDITOR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[18px] text-s39-white font-bold mb-1">{p.auditorProfile.firmName}</div>
                <p className="text-[9px] text-s39-mid leading-relaxed">{p.auditorProfile.description}</p>
              </div>
              <div>
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">METHODOLOGY</div>
                <p className="text-[9px] text-s39-mid leading-relaxed">{p.auditorProfile.methodology}</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">AREAS OF EXPERTISE</div>
              <div className="flex flex-wrap gap-2">
                {p.auditorProfile.experience.map((exp, i) => (
                  <span key={i} className="text-[8px] text-s39-cyan bg-s39-cyan/5 border border-s39-cyan/20 px-2.5 py-1">{exp}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-4 flex-wrap text-[9px]">
              <span className="text-s39-dim">Contact:</span>
              <a href={`mailto:${p.auditorProfile.contactEmail}`} className="text-s39-cyan hover:underline">{p.auditorProfile.contactEmail}</a>
              {p.auditorProfile.telegram && (
                <a href={p.auditorProfile.telegram} target="_blank" rel="noreferrer" className="text-s39-cyan hover:underline">Telegram</a>
              )}
            </div>
          </div>
        )}

        {/* ── Socials / GitHub ── */}
        {(p.githubUrl || p.website || p.telegram || p.twitter || p.discord || p.contractAddress) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">LINKS & SOCIALS</div>
            <div className="flex gap-3 flex-wrap">
              {p.website && (
                <a href={p.website} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-cyan border border-s39-cyan/20 px-3 py-1.5 hover:bg-s39-cyan/5 transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  Website
                </a>
              )}
              {p.githubUrl && (
                <a href={p.githubUrl} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub
                </a>
              )}
              {p.twitter && (
                <a href={p.twitter} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X / Twitter
                </a>
              )}
              {p.telegram && (
                <a href={p.telegram} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </a>
              )}
              {p.discord && (
                <a href={p.discord} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z"/></svg>
                  Discord
                </a>
              )}
  {p.contractAddress && (
> <a href={getExplorer(p.network || "Ethereum").addressUrl(p.contractAddress)} target="_blank" rel="noreferrer"
  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors flex items-center gap-1.5">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
  {getExplorer(p.network || "Ethereum").name}
                </a>
              )}
            </div>
          </div>
        )}

        {/* PDF Link */}
        {p.pdfUrl && (
          <div className="bg-s39-bg1 border border-s39-green/20 p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[9px] text-s39-green tracking-widest mb-1">FULL AUDIT REPORT</div>
              <div className="text-[10px] text-s39-mid">Download the complete PDF audit report</div>
            </div>
            <a href={p.pdfUrl} target="_blank" rel="noreferrer">
              <S39Btn primary small>View PDF</S39Btn>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// METHODOLOGY PAGE
// ═══════════════════════════════════════════════════════════════════
function MethodologyPage() {
  const phases: [string, string, string, string][] = [
    ["01", "System Comprehension", "#00e5ff", "Complete architectural analysis: trust boundaries, funds flow, actor model, threat surface and external dependencies."],
    ["02", "Threat Modeling", "#00ff88", "Systematic mapping of attack surfaces: privilege escalation, economic attack vectors, oracle risks and MEV exposure."],
    ["03", "Manual Code Review", "#ffd600", "Function-by-function review: invariant validation, state transitions, business logic and verification of every critical path."],
    ["04", "AI-Guided Verification", "#ff6b00", "Use of the Solay39 AI Copilot for coverage gaps, invariant generation, pattern detection and next-best-action analysis."],
    ["05", "Remediation Validation", "#ff2d55", "Verification of every fix: regression review, score recomputation and final signature on the audit report."],
  ]

  return (
    <div className="max-w-[900px] mx-auto px-4 py-12">
      <h1 className="text-xl sm:text-2xl font-bold text-s39-white mb-2 text-balance">
        Solay39 Manual-First Audit Framework
      </h1>
      <p className="text-[11px] text-s39-mid mb-10">
        Five structured phases. Human review first, AI in support.
      </p>

      {phases.map(([n, t, c, d]) => (
        <div key={n} className="flex gap-5 mb-5 bg-s39-bg1 border border-s39-border p-5 sm:p-6">
          <div className="text-2xl font-bold opacity-30 leading-none shrink-0 w-9" style={{ color: c }}>
            {n}
          </div>
          <div>
            <div className="text-[12px] font-bold mb-1.5" style={{ color: c }}>{t}</div>
            <div className="text-[10px] text-s39-mid leading-relaxed">{d}</div>
          </div>
        </div>
      ))}

      {/* Score Formula */}
      <div className="bg-s39-bg1 border border-s39-green/20 p-6 mt-8">
        <div className="text-[9px] text-s39-green tracking-[0.15em] mb-3">TRANSPARENT SCORE FORMULA</div>
        <div className="text-[10px] sm:text-[11px] text-s39-lite font-mono mb-2 break-words">
          {"Score = min(98, Base - (Critical x 25) - (High x 10) - (Medium x 3) - (Low x 1) - CentralizationRisk - GovernancePenalty)"}
        </div>
        <div className="text-[9px] text-s39-dim mb-4 italic">
          {"Maximum score: 98 — security is risk reduction, not perfection."}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ["CRITICAL", "-25pts", "#ff2d55"],
            ["HIGH", "-10pts", "#ff6b00"],
            ["MEDIUM", "-3pts", "#ffd600"],
            ["LOW/INFO", "-0pts", "#00e5ff"],
          ] as [string, string, string][]).map(([s, p, c]) => (
            <div key={s} className="bg-s39-bg2 px-3 py-2.5 text-center">
              <div className="text-[8px] font-bold tracking-widest" style={{ color: c }}>{s}</div>
              <div className="text-sm font-bold text-s39-lite mt-1">{p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Scale */}
      <div className="bg-s39-bg1 border border-s39-border p-6 mt-4">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">RATING SCALE</div>
        <div className="flex gap-2 flex-wrap">
          {([
            ["AAA", "95-100", "#00ff88"],
            ["AA", "90-94", "#00ff88"],
            ["A", "80-89", "#00e5ff"],
            ["BBB", "70-79", "#ffd600"],
            ["BB", "60-69", "#ff6b00"],
            ["B", "<60", "#ff2d55"],
          ] as [string, string, string][]).map(([r, range, c]) => (
            <div key={r} className="bg-s39-bg2 px-3.5 py-2 text-center min-w-[70px]">
              <div className="text-[13px] font-bold" style={{ color: c }}>{r}</div>
              <div className="text-[8px] text-s39-dim">{range}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SKYNET PUBLIC COMPONENT (CertiK-inspired)
// ═══════════════════════════════════════════════════════════════════
// Price data type from our API
interface LivePriceData {
  ticker: string
  address: string
  price: string
  priceNum: number
  change24h?: string
  volume24h?: string
  marketCap?: string
}

export function SkynetPublic({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<"portfolio" | "methodology">("portfolio")
  const [search, setSearch] = useState("")
  const [net, setNet] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [detail, setDetail] = useState<PortfolioProject | null>(null)

  // Navigate to the shareable audit URL
  const goToAudit = useCallback((p: PortfolioProject) => {
    router.push(`/audit/${p.id}`)
  }, [router])
  const [livePrices, setLivePrices] = useState<Record<string, LivePriceData>>({})
  const [priceLoading, setPriceLoading] = useState(true)

  // Merge default + published audits
  const [allProjects, setAllProjects] = useState<PortfolioProject[]>(DEFAULT_PROJECTS)

  // Fetch live prices from GeckoTerminal API (including dynamically published tokens)
  useEffect(() => {
    let mounted = true
    async function fetchPrices() {
      try {
        // Build extra tokens param from published projects
        const extraTokens = allProjects
          .filter((p) => p.ticker && p.contractAddress && /^0x[a-fA-F0-9]{40}$/.test(p.contractAddress))
          .map((p) => `${p.ticker}:${p.contractAddress}`)
          .join(",")
        const qs = extraTokens ? `?extra=${encodeURIComponent(extraTokens)}` : ""
        const res = await fetch(`/api/prices${qs}`)
        if (!res.ok) throw new Error("Price fetch failed")
        const data = await res.json()
        if (mounted && data.prices) {
          setLivePrices(data.prices)
        }
      } catch {
        // Non-critical — prices just won't update
      } finally {
        if (mounted) setPriceLoading(false)
      }
    }
    fetchPrices()
    // Refresh prices every 60s
    const interval = setInterval(fetchPrices, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [allProjects])

  // Apply live prices to projects (match by ticker or contractAddress)
  const projectsWithPrices = allProjects.map((p) => {
    const lp = p.ticker ? livePrices[p.ticker] : undefined
    if (!lp) return p
    return {
      ...p,
      price: lp.price || p.price,
      change24h: lp.change24h || p.change24h,
      tvl: lp.marketCap || p.tvl,
      volume24h: lp.volume24h || p.volume24h,
    }
  })

  useEffect(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

    async function loadAllAudits() {
      // 1. Load from localStorage
      const published = getPublishedAudits()
      const cleaned = published.filter((pub) => {
        const defaultMatch = DEFAULT_PROJECTS.find((dp) => norm(dp.name) === norm(pub.name))
        return !defaultMatch
      })
      if (cleaned.length !== published.length) {
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(cleaned))
      }

      // 2. Load from Vercel Blob (server-persisted audits)
      let blobAudits: PortfolioProject[] = []
      try {
        const res = await fetch("/api/audits")
        if (res.ok) {
          const data = await res.json()
          blobAudits = (data.audits || []) as PortfolioProject[]
        }
      } catch { /* non-critical */ }

      // 3. Merge: defaults + blob + localStorage (deduplicate by id/name)
      const merged = [...DEFAULT_PROJECTS]
      const allExtras = [...blobAudits, ...cleaned]
      for (const pub of allExtras) {
        if (!merged.some((m) => m.id === pub.id || norm(m.name) === norm(pub.name))) {
          merged.push(pub)
        }
      }
      setAllProjects(merged)
    }

    loadAllAudits()
  }, [])

  // Use live prices for all display
  const displayProjects = projectsWithPrices

  const filtered = displayProjects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => net === "all" || p.network === net)
    .sort((a, b) => (sortBy === "score" ? b.score - a.score : a.name.localeCompare(b.name)))

  const networks = [...new Set(displayProjects.map((p) => p.network))]
  const totalTvl = displayProjects.reduce((s, p) => {
    const n = parseFloat((p.tvl || "0").replace(/[^0-9.]/g, ""))
    return s + (isNaN(n) ? 0 : n)
  }, 0)
  const avgScore = Math.round(displayProjects.reduce((s, p) => s + p.score, 0) / (displayProjects.length || 1))
  const totalCriticals = displayProjects.reduce((s, p) => s + p.criticals, 0)

  // Top Security Score projects (top 4)
  const topProjects = [...displayProjects].sort((a, b) => b.score - a.score).slice(0, 4)

  // Recently audited (sorted by date desc)
  const recentProjects = [...displayProjects]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

  if (detail) return <ProjectDetail p={detail} onBack={() => setDetail(null)} backHref="/" isLive={!!livePrices[detail.ticker || ""]} />

  return (
    <div className="min-h-dvh bg-s39-bg0">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-s39-bg0/95 border-b border-s39-border backdrop-blur-sm">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-sm font-bold text-s39-green tracking-wider animate-[glow_3s_infinite]">
              SOLAY39 <span className="text-s39-dim">SKYNET</span>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              {(["portfolio", "methodology"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-[9px] tracking-[0.12em] uppercase cursor-pointer bg-transparent border-none font-mono pb-0.5 transition-colors ${
                    tab === t
                      ? "text-s39-green border-b border-s39-green"
                      : "text-s39-mid hover:text-s39-lite"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search protocol..."
              className="hidden sm:block w-36 bg-s39-bg2 border border-s39-border text-s39-lite p-1 px-2.5 text-[9px] font-mono outline-none focus:border-s39-green transition-colors"
            />
            <a
              href={TG_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-s39-green border border-s39-green/30 px-3 py-1 tracking-widest hover:border-s39-green/60 transition-colors"
            >
              Telegram
            </a>
            <button
              onClick={onBack}
              className="text-[9px] text-s39-dim cursor-pointer bg-transparent border-none font-mono hover:text-s39-mid transition-colors"
            >
              {"<- Login"}
            </button>
          </div>
        </div>
        {/* Mobile tabs + search */}
        <div className="sm:hidden flex border-t border-s39-border">
          {(["portfolio", "methodology"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[9px] tracking-[0.12em] uppercase cursor-pointer bg-transparent border-none font-mono transition-colors ${
                tab === t ? "text-s39-green border-b-2 border-s39-green" : "text-s39-mid"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="sm:hidden px-4 py-2 border-t border-s39-border">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search protocol..."
            className="w-full bg-s39-bg2 border border-s39-border text-s39-lite p-1.5 px-3 text-[10px] font-mono outline-none focus:border-s39-green"
          />
        </div>
      </nav>

      {tab === "portfolio" && (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Hero */}
          <div className="text-center mb-8 sm:mb-12 animate-[fadeUp_0.6s_ease]">
            <div className="text-[8px] text-s39-dim tracking-[0.22em] mb-3">
              SMART CONTRACT SECURITY AUDIT PLATFORM
            </div>
            <h1 className="text-xl sm:text-[28px] font-bold text-s39-white leading-tight mb-2 text-balance">
              Securing protocols through<br className="hidden sm:inline" /> deep human review.
            </h1>
            <p className="text-[11px] text-s39-mid mb-6">
              Institutional-grade manual audits — Solay39 Manual-First Audit Framework
            </p>
            <div className="flex gap-3 justify-center">
              <a href={`mailto:${PUB_EMAIL}`}>
                <S39Btn primary small>Request Audit</S39Btn>
              </a>
              <a href={TG_URL} target="_blank" rel="noreferrer">
                <S39Btn small>Telegram</S39Btn>
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {([
              [`$${totalTvl.toFixed(1)}M`, "TVL Secured", "text-s39-green"],
              [String(displayProjects.length), "Audits Completed", "text-s39-cyan"],
              [String(totalCriticals), "Criticals Found", "text-s39-red"],
              [String(avgScore), "Average Score", "text-s39-yellow"],
            ] as [string, string, string][]).map(([v, l, c]) => (
              <div key={l} className="bg-s39-bg1 border border-s39-border p-4 text-center hover:border-s39-muted transition-colors">
                <div className={`text-xl sm:text-2xl font-bold leading-none ${c}`}>{v}</div>
                <div className="text-[8px] text-s39-dim tracking-[0.12em] mt-1 uppercase">{l}</div>
              </div>
            ))}
          </div>

          {/* Top Security Scores */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="text-[9px] text-s39-green tracking-[0.15em]">TOP SECURITY SCORES</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {topProjects.map((p) => {
                const sc = scoreColor(p.score)
                return (
                  <div
                    key={p.id}
                    onClick={() => goToAudit(p)}
                    className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-green/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <TokenLogo name={p.name} score={p.score} logoUrl={p.logoUrl} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-s39-white truncate group-hover:text-s39-green transition-colors">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <NetworkIcon network={p.network} />
                          <span className="text-[8px] text-s39-dim">{p.network}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: sc }}>{p.score}</span>
                        <span className="text-[9px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                          {p.rating}
                        </span>
                      </div>
                      {p.price ? (
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="text-[10px] text-s39-lite">{p.price}</div>
                            {!priceLoading && livePrices[p.ticker || ""] && (
                              <span className="text-[6px] text-s39-green bg-s39-green/10 px-1 py-px tracking-wider">LIVE</span>
                            )}
                          </div>
                          {p.change24h && (
                            <div className={`text-[8px] ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                              {p.change24h}
                            </div>
                          )}
                        </div>
                      ) : priceLoading && p.ticker ? (
                        <div className="text-[8px] text-s39-dim animate-pulse">Loading...</div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recently Audited Carousel */}
          <div className="mb-8">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">RECENTLY AUDITED</div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {recentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className="bg-s39-bg1 border border-s39-border p-3 min-w-[140px] cursor-pointer hover:border-s39-green/30 transition-colors shrink-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TokenLogo name={p.name} score={p.score} logoUrl={p.logoUrl} />
                    <div className="text-[10px] font-bold text-s39-white truncate max-w-[80px]">{p.name}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-s39-dim">
                      {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: scoreColor(p.score) }}>{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex gap-2.5 mb-4 items-center flex-wrap">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mr-2">ALL AUDITS</div>
            <select
              value={net}
              onChange={(e) => setNet(e.target.value)}
              className="bg-s39-bg2 border border-s39-border text-s39-mid p-1.5 px-3 text-[10px] font-mono outline-none"
            >
              <option value="all">All Networks</option>
              {networks.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-s39-bg2 border border-s39-border text-s39-mid p-1.5 px-3 text-[10px] font-mono outline-none"
            >
              <option value="score">Sort: Score</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          {/* Table - Desktop */}
          <div className="hidden md:block bg-s39-bg1 border border-s39-border">
            <div className="grid grid-cols-[32px_2fr_70px_60px_1fr_90px_80px] px-4 py-2.5 border-b border-s39-border">
              {["#", "PROTOCOL", "SCORE", "RATING", "FINDINGS", "NETWORK", "STATUS"].map((h) => (
                <div key={h} className="text-[7.5px] text-s39-dim tracking-[0.15em]">{h}</div>
              ))}
            </div>
            {filtered.map((p, i) => {
              const rankColor = i === 0 ? "text-s39-yellow" : i === 1 ? "text-s39-mid" : i === 2 ? "text-s39-orange" : "text-s39-dim"
              const sc = scoreColor(p.score)
              return (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className="grid grid-cols-[32px_2fr_70px_60px_1fr_90px_80px] px-4 py-3 border-b border-s39-border items-center transition-colors hover:bg-s39-bg2 cursor-pointer"
                >
                  <div className={`text-[10px] font-bold ${rankColor}`}>#{i + 1}</div>
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenLogo name={p.name} score={p.score} logoUrl={p.logoUrl} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-s39-white truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.ticker && <span className="text-[8px] text-s39-dim">{p.ticker}</span>}
                        {p.price ? (
                          <>
                            <span className="text-[8px] text-s39-dim">|</span>
                            <span className="text-[8px] text-s39-lite">{p.price}</span>
                            {!priceLoading && livePrices[p.ticker || ""] && (
                              <span className="text-[5px] text-s39-green bg-s39-green/10 px-0.5 tracking-wider">LIVE</span>
                            )}
                            {p.change24h && (
                              <span className={`text-[8px] ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                                {p.change24h}
                              </span>
                            )}
                          </>
                        ) : priceLoading && p.ticker ? (
                          <span className="text-[8px] text-s39-dim animate-pulse">...</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ScoreRing score={p.score} size={32} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                      {p.rating}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <SevPill sev="CRITICAL" count={p.criticals} />
                    <SevPill sev="HIGH" count={p.highs} />
                    <SevPill sev="MEDIUM" count={p.mediums} />
                    <SevPill sev="LOW" count={p.lows} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <NetworkIcon network={p.network} />
                    <span className="text-[9px] text-s39-mid">{p.network}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-s39-green border border-s39-green/20 px-2 py-0.5 tracking-wider">
                      AUDITED
                    </span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[10px] text-s39-dim">No results found.</div>
            )}
          </div>

          {/* Cards - Mobile */}
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map((p, i) => {
              const sc = scoreColor(p.score)
              return (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TokenLogo name={p.name} score={p.score} logoUrl={p.logoUrl} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-s39-white truncate">
                          #{i + 1} {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <NetworkIcon network={p.network} />
                          <span className="text-[8px] text-s39-dim">{p.network}</span>
                          {p.price ? (
                            <>
                              <span className="text-[8px] text-s39-dim">|</span>
                              <span className="text-[8px] text-s39-lite">{p.price}</span>
                              {p.change24h && (
                                <span className={`text-[7px] ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                                  {p.change24h}
                                </span>
                              )}
                            </>
                          ) : priceLoading && p.ticker ? (
                            <span className="text-[8px] text-s39-dim animate-pulse">...</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <ScoreRing score={p.score} size={44} />
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <span className="text-[8px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                      {p.rating}
                    </span>
                    <span className="text-[8px] text-s39-green border border-s39-green/20 px-2 py-0.5 tracking-wider">
                      AUDITED
                    </span>
                    <SevPill sev="CRITICAL" count={p.criticals} />
                    <SevPill sev="HIGH" count={p.highs} />
                    <SevPill sev="MEDIUM" count={p.mediums} />
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="bg-s39-bg1 border border-s39-border p-8 text-center text-[10px] text-s39-dim">
                No results found.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "methodology" && <MethodologyPage />}

      {/* Footer */}
      <footer className="border-t border-s39-border px-6 py-8 text-center mt-10">
        <div className="text-[8px] text-s39-dim tracking-[0.15em]">
          {"SOLAY39 \u00A9 2026 \u2014 SMART CONTRACT SECURITY"}
        </div>
        <div className="flex gap-6 justify-center mt-3 flex-wrap">
          <a href={`mailto:${PUB_EMAIL}`} className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            {PUB_EMAIL}
          </a>
          <a href={TG_URL} target="_blank" rel="noreferrer" className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            t.me/Solay39audit
          </a>
          <a href="https://github.com/sanettanammurata-max/Solay39-" target="_blank" rel="noreferrer" className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
