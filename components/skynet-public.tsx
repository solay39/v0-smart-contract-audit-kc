"use client"

import { useState, useEffect } from "react"
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
  const idx = existing.findIndex((p) => p.id === project.id)
  if (idx >= 0) {
    existing[idx] = project
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

// ── Token Logo (first letter styled) ─────────────────────────────
function TokenLogo({ name, score }: { name: string; score: number }) {
  const col = scoreColor(score)
  return (
    <div
      className="w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0"
      style={{
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

function ProjectDetail({ p, onBack }: { p: PortfolioProject; onBack: () => void }) {
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
          <button onClick={onBack}
            className="bg-transparent border-none text-s39-mid font-mono text-[10px] cursor-pointer mb-5 tracking-widest hover:text-s39-green transition-colors">
            {"<- BACK TO PORTFOLIO"}
          </button>

          {/* Hero: Logo + Name + Badges + Score arc */}
          <div className="flex gap-6 sm:gap-10 items-start flex-col sm:flex-row">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <TokenLogo name={p.name} score={p.score} />
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
              </div>

              {/* Price + Market Cap row */}
              {p.price && (
                <div className="flex gap-6 items-end flex-wrap mb-4">
                  <div>
                    <div className="text-[8px] text-s39-dim tracking-widest mb-0.5">
                      Token Price ({p.ticker || p.name.slice(0, 3).toUpperCase()})
                      <span className="ml-2 text-s39-dim/60">24h</span>
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

            {/* Score Arc */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="text-[8px] text-s39-dim tracking-[0.15em]">SOLAY39 SECURITY SCORE</div>
              <ScoreArc score={p.score} size={160} />
            </div>
          </div>
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
              <span className="ml-2 text-s39-lite">Manual Review</span>
              <span className="ml-2 text-s39-lite">Static Analysis</span>
              <span className="ml-2 text-s39-lite">AI-Guided Verification</span>
            </div>
          </div>
        </div>

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
                    <div className="text-[9px] text-s39-cyan mb-2 font-mono">{f.location}</div>
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

        {/* ── Socials / GitHub ── */}
        {(p.githubUrl || p.website) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">LINKS</div>
            <div className="flex gap-4 flex-wrap">
              {p.website && (
                <a href={p.website} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-cyan border border-s39-cyan/20 px-3 py-1.5 hover:bg-s39-cyan/5 transition-colors">
                  Website
                </a>
              )}
              {p.githubUrl && (
                <a href={p.githubUrl} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors">
                  GitHub
                </a>
              )}
              {p.contractAddress && (
                <a href={`https://etherscan.io/address/${p.contractAddress}`} target="_blank" rel="noreferrer"
                  className="text-[10px] text-s39-mid border border-s39-border px-3 py-1.5 hover:bg-s39-bg2 transition-colors">
                  Etherscan
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
        <div className="text-[10px] sm:text-[11px] text-s39-lite font-mono mb-4 break-words">
          {"Score = 100 - (Critical x 25) - (High x 10) - (Medium x 3) - CentralizationRisk - GovernancePenalty + CoverageBonus"}
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
export function SkynetPublic({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"portfolio" | "methodology">("portfolio")
  const [search, setSearch] = useState("")
  const [net, setNet] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [detail, setDetail] = useState<PortfolioProject | null>(null)

  // Merge default + published audits
  const [allProjects, setAllProjects] = useState<PortfolioProject[]>(DEFAULT_PROJECTS)

  useEffect(() => {
    const published = getPublishedAudits()
    if (published.length > 0) {
      const merged = [...published]
      for (const dp of DEFAULT_PROJECTS) {
        if (!merged.some((m) => m.id === dp.id)) {
          merged.push(dp)
        }
      }
      setAllProjects(merged)
    }
  }, [])

  const filtered = allProjects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => net === "all" || p.network === net)
    .sort((a, b) => (sortBy === "score" ? b.score - a.score : a.name.localeCompare(b.name)))

  const networks = [...new Set(allProjects.map((p) => p.network))]
  const totalTvl = allProjects.reduce((s, p) => {
    const n = parseFloat((p.tvl || "0").replace(/[^0-9.]/g, ""))
    return s + (isNaN(n) ? 0 : n)
  }, 0)
  const avgScore = Math.round(allProjects.reduce((s, p) => s + p.score, 0) / allProjects.length)
  const totalCriticals = allProjects.reduce((s, p) => s + p.criticals, 0)

  // Top Security Score projects (top 4)
  const topProjects = [...allProjects].sort((a, b) => b.score - a.score).slice(0, 4)

  // Recently audited (sorted by date desc)
  const recentProjects = [...allProjects]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6)

  if (detail) return <ProjectDetail p={detail} onBack={() => setDetail(null)} />

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
              [String(allProjects.length), "Audits Completed", "text-s39-cyan"],
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
                    onClick={() => setDetail(p)}
                    className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-green/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <TokenLogo name={p.name} score={p.score} />
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
                      {p.price && (
                        <div className="text-right">
                          <div className="text-[10px] text-s39-lite">{p.price}</div>
                          {p.change24h && (
                            <div className={`text-[8px] ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                              {p.change24h}
                            </div>
                          )}
                        </div>
                      )}
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
                  onClick={() => setDetail(p)}
                  className="bg-s39-bg1 border border-s39-border p-3 min-w-[140px] cursor-pointer hover:border-s39-green/30 transition-colors shrink-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TokenLogo name={p.name} score={p.score} />
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
                  onClick={() => setDetail(p)}
                  className="grid grid-cols-[32px_2fr_70px_60px_1fr_90px_80px] px-4 py-3 border-b border-s39-border items-center transition-colors hover:bg-s39-bg2 cursor-pointer"
                >
                  <div className={`text-[10px] font-bold ${rankColor}`}>#{i + 1}</div>
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenLogo name={p.name} score={p.score} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-s39-white truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.ticker && <span className="text-[8px] text-s39-dim">{p.ticker}</span>}
                        {p.price && (
                          <>
                            <span className="text-[8px] text-s39-dim">|</span>
                            <span className="text-[8px] text-s39-lite">{p.price}</span>
                            {p.change24h && (
                              <span className={`text-[8px] ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                                {p.change24h}
                              </span>
                            )}
                          </>
                        )}
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
                  onClick={() => setDetail(p)}
                  className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TokenLogo name={p.name} score={p.score} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-s39-white truncate">
                          #{i + 1} {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <NetworkIcon network={p.network} />
                          <span className="text-[8px] text-s39-dim">{p.network}</span>
                          {p.price && (
                            <>
                              <span className="text-[8px] text-s39-dim">|</span>
                              <span className="text-[8px] text-s39-lite">{p.price}</span>
                            </>
                          )}
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
