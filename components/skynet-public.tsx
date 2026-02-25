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
// PROJECT DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════
function ProjectDetail({ p, onBack }: { p: PortfolioProject; onBack: () => void }) {
  const sc = scoreColor(p.score)
  const bd = p.scoreBreakdown

  return (
    <div className="min-h-dvh bg-s39-bg0">
      {/* Header */}
      <div className="bg-s39-bg1 border-b border-s39-border">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={onBack}
            className="bg-transparent border-none text-s39-mid font-mono text-[10px] cursor-pointer mb-5 tracking-widest hover:text-s39-green transition-colors"
          >
            {"<- BACK TO PORTFOLIO"}
          </button>

          <div className="flex gap-6 sm:gap-8 items-start flex-col sm:flex-row">
            <ScoreRing score={p.score} size={120} />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-s39-white">{p.name}</h1>
                {p.ticker && (
                  <span className="text-[10px] text-s39-dim bg-s39-bg2 px-2 py-0.5">{p.ticker}</span>
                )}
              </div>
              <div className="flex gap-3 items-center flex-wrap text-[9px] text-s39-mid mb-3">
                <NetworkIcon network={p.network} />
                <span>{p.network}</span>
                <span className="text-s39-dim">|</span>
                <span>{p.date}</span>
                {p.auditor && (
                  <>
                    <span className="text-s39-dim">|</span>
                    <span>Auditor: {p.auditor}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[8px] text-s39-green border border-s39-green/30 px-2.5 py-0.5 tracking-widest">
                  AUDITED
                </span>
                <span className="text-[8px] border px-2.5 py-0.5 font-bold" style={{ color: sc, borderColor: `${sc}44` }}>
                  {p.rating}
                </span>
                {p.criticals === 0 && (
                  <span className="text-[8px] text-s39-green border border-s39-green/20 px-2.5 py-0.5">
                    0 Criticals
                  </span>
                )}
                {p.centralizationLevel && (
                  <span className="text-[8px] text-s39-mid border border-s39-border px-2.5 py-0.5">
                    Centralization: {p.centralizationLevel}
                  </span>
                )}
              </div>
              {p.contractAddress && (
                <div className="mt-3 text-[9px] text-s39-dim font-mono break-all">
                  Contract: {p.contractAddress}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-6">
        {/* Price / Stats Bar */}
        {(p.price || p.tvl) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {p.price && (
              <div className="bg-s39-bg1 border border-s39-border p-3.5 text-center">
                <div className="text-lg font-bold text-s39-white">{p.price}</div>
                <div className="text-[8px] text-s39-dim tracking-widest mt-1">PRICE</div>
                {p.change24h && (
                  <div className={`text-[9px] mt-1 ${p.change24h.startsWith("+") ? "text-s39-green" : "text-s39-red"}`}>
                    {p.change24h}
                  </div>
                )}
              </div>
            )}
            {p.tvl && (
              <div className="bg-s39-bg1 border border-s39-border p-3.5 text-center">
                <div className="text-lg font-bold text-s39-white">{p.tvl}</div>
                <div className="text-[8px] text-s39-dim tracking-widest mt-1">TVL SECURED</div>
              </div>
            )}
            <div className="bg-s39-bg1 border border-s39-border p-3.5 text-center">
              <div className="text-lg font-bold" style={{ color: sc }}>{p.score}/100</div>
              <div className="text-[8px] text-s39-dim tracking-widest mt-1">SECURITY SCORE</div>
            </div>
            <div className="bg-s39-bg1 border border-s39-border p-3.5 text-center">
              <div className="text-lg font-bold text-s39-white">
                {p.criticals + p.highs + p.mediums + p.lows + p.infos}
              </div>
              <div className="text-[8px] text-s39-dim tracking-widest mt-1">TOTAL FINDINGS</div>
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        {bd && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">SCORE BREAKDOWN</div>
            {([
              ["Code Security", bd.codeSecurity, "35%", "#00ff88"],
              ["Architecture Risk", bd.architectureRisk, "25%", "#00e5ff"],
              ["Governance Risk", bd.governanceRisk, "20%", "#4488ff"],
              ["Centralization", bd.centralization, "10%", "#ffd600"],
              ["Testing Coverage", bd.testingCoverage, "10%", "#7a8c9e"],
            ] as [string, number, string, string][]).map(([name, val, weight, color]) => (
              <div key={name} className="mb-3">
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-s39-mid">{name}</span>
                  <span style={{ color }}>
                    {val}/100 <span className="text-s39-dim">({weight})</span>
                  </span>
                </div>
                <div className="h-[3px] bg-s39-bg2">
                  <div
                    className="h-full transition-[width] duration-1000 ease-out"
                    style={{ width: `${val}%`, background: color, boxShadow: `0 0 6px ${color}66` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Findings Summary Grid */}
        <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
          <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">FINDINGS SUMMARY</div>
          <div className="grid grid-cols-5 gap-3">
            {([
              ["CRITICAL", p.criticals, "#ff2d55"],
              ["HIGH", p.highs, "#ff6b00"],
              ["MEDIUM", p.mediums, "#ffd600"],
              ["LOW", p.lows, "#00e5ff"],
              ["INFO", p.infos, "#00ff88"],
            ] as [string, number, string][]).map(([s, n, c]) => (
              <div key={s} className="text-center bg-s39-bg2 py-3 px-2">
                <div className="text-xl font-bold" style={{ color: n > 0 ? c : "#445566" }}>
                  {n}
                </div>
                <div className="text-[7px] text-s39-dim tracking-widest mt-1">{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Findings */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">FINDING DETAILS</div>
            {p.findings.map((f, idx) => (
              <div key={idx} className="bg-s39-bg2 border border-s39-border p-4 mb-3">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <SevBadge sev={f.severity} />
                    <span className="text-[11px] text-s39-lite font-bold">{f.title}</span>
                  </div>
                  <span className="text-[8px] text-s39-dim border border-s39-border px-2 py-0.5 shrink-0">
                    {f.status}
                  </span>
                </div>
                <div className="text-[9px] text-s39-cyan mb-2">{f.location}</div>
                <div className="text-[10px] text-s39-mid leading-relaxed mb-2">{f.description}</div>
                {f.impact && (
                  <div className="text-[9px] text-s39-dim mb-1">
                    <span className="text-s39-orange">Impact: </span>{f.impact}
                  </div>
                )}
                {f.recommendation && (
                  <div className="text-[9px] text-s39-dim">
                    <span className="text-s39-green">Fix: </span>{f.recommendation}
                  </div>
                )}
              </div>
            ))}
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
          {"SOLAY39 \u00A9 2025 \u2014 SMART CONTRACT SECURITY"}
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
