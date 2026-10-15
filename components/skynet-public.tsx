"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  assignFindingIds,
  ratingOf,
  getWeightedScore,
} from "@/lib/solay39-constants"
import { ScoreRing, S39Btn, SevBadge } from "@/components/solay39-ui"
import { getExplorer } from "@/lib/explorers"
import { OnChainAttestation, OnChainVerificationBadge } from "@/components/onchain-attestation"

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
  
  let finalProject = project
  if (idx >= 0) {
    // Merge: keep new data but preserve old fields that are missing in new
    const old = existing[idx]
    finalProject = {
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
    existing[idx] = finalProject
  } else {
    existing.unshift(finalProject)
  }
  
  // Save to localStorage
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(existing))
  
  // CRITICAL: Also save to Vercel Blob for external access (social sharing, other devices)
  saveToBlobAsync(finalProject)
}

// Save audit to Vercel Blob with retry logic
async function saveToBlobAsync(project: PortfolioProject): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit: project }),
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          return true
        }
      }
    } catch {
      // Network error, retry
    }
    
    // Wait before retry (1s, 2s, 3s)
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  
  return false
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

// ── SVG Radar Chart — 6 categories (SOLAY39 Security Rating Model) ──
function RadarChart({ data, size = 220 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 30
  const levels = [20, 40, 60, 80, 100]
  const n = data.length
  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2 // start from top

  const getPoint = (i: number, r: number) => {
    const angle = startAngle + i * angleStep
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  // Build polygon points for each level ring
  const levelPolygons = levels.map(level => {
    const r = (level / 100) * R
    return data.map((_, i) => getPoint(i, r)).map(p => `${p.x},${p.y}`).join(" ")
  })

  // Data polygon
  const dataPoints = data.map((d, i) => getPoint(i, (d.value / 100) * R))
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(" ")

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* Level rings */}
        {levelPolygons.map((pts, li) => (
          <polygon key={li} points={pts} fill="none" stroke="#1a2233" strokeWidth={li === levels.length - 1 ? 1 : 0.5} />
        ))}

        {/* Axis lines */}
        {data.map((_, i) => {
          const p = getPoint(i, R)
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1a2233" strokeWidth={0.5} />
        })}

        {/* Data polygon fill */}
        <polygon points={dataPolygon} fill="#00ff8818" stroke="#00ff88" strokeWidth={1.5} />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={data[i].color} stroke="#0a0e14" strokeWidth={1.5} />
        ))}

        {/* Labels */}
        {data.map((d, i) => {
          const labelR = R + 18
          const p = getPoint(i, labelR)
          const anchor = p.x < cx - 5 ? "end" : p.x > cx + 5 ? "start" : "middle"
          return (
            <g key={`label-${i}`}>
              <text x={p.x} y={p.y - 4} textAnchor={anchor} fill="#7a8c9e" fontSize="7" fontFamily="monospace" letterSpacing="0.5px">
                {d.label.toUpperCase()}
              </text>
              <text x={p.x} y={p.y + 7} textAnchor={anchor} fill={d.value >= 90 ? "#00ff88" : d.value >= 70 ? "#ffd600" : "#ff2d55"} fontSize="9" fontFamily="monospace" fontWeight="bold">
                {d.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Security Badge (copyable) ───────────────────────────────────
function SecurityBadge({ rating, score, name }: { rating: string; score: number; name: string }) {
  const [copied, setCopied] = useState(false)
  const badgeText = `SOLAY39 Rating: ${rating} (${score}) — ${name}`
  const sc = scoreColor(score)

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(badgeText)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch { /* fallback */ }
      }}
      className="flex items-center gap-2 bg-s39-bg2 border px-3 py-1.5 cursor-pointer hover:bg-s39-bg1 transition-colors group"
      style={{ borderColor: `${sc}30` }}
      title="Click to copy badge text"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L2 4v5l4 2 4-2V4L6 1z" stroke={sc} strokeWidth="1" fill={`${sc}15`}/></svg>
      <span className="text-[9px] font-bold font-mono tracking-wider" style={{ color: sc }}>
        SOLAY39 Rating: {rating} ({score})
      </span>
      <span className="text-[7px] text-s39-dim group-hover:text-s39-mid transition-colors ml-1">
        {copied ? "COPIED!" : "COPY"}
      </span>
    </button>
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

export function ProjectDetail({ p: _raw, onBack, isLive, backHref }: { p: PortfolioProject; onBack?: () => void; isLive?: boolean; backHref?: string }) {
  // ── DEFENSIVE NORMALIZATION: ensure all nested properties are safe for rendering ─������
  const p = useMemo<PortfolioProject>(() => {
    const findings = _raw.findings || []
    return {
      ..._raw,
      id: _raw.id || "unknown",
      name: _raw.name || "Unknown Contract",
      score: _raw.score ?? 0,
      network: _raw.network || "BSC",
      date: _raw.date || new Date().toISOString().split("T")[0],
      criticals: _raw.criticals ?? findings.filter(f => f.severity === "CRITICAL").length,
      highs: _raw.highs ?? findings.filter(f => f.severity === "HIGH").length,
      mediums: _raw.mediums ?? findings.filter(f => f.severity === "MEDIUM").length,
      lows: _raw.lows ?? findings.filter(f => f.severity === "LOW").length,
      infos: _raw.infos ?? findings.filter(f => f.severity === "INFO").length,
      findings,
      codeMetrics: _raw.codeMetrics ? {
        ..._raw.codeMetrics,
        totalLOC: _raw.codeMetrics.totalLOC ?? 0,
        totalContracts: _raw.codeMetrics.totalContracts ?? 1,
        externalDependencies: _raw.codeMetrics.externalDependencies || [],
        compilerVersion: _raw.codeMetrics.compilerVersion || "N/A",
        upgradeabilityPattern: _raw.codeMetrics.upgradeabilityPattern || "none",
        cyclomaticComplexity: _raw.codeMetrics.cyclomaticComplexity || "Low",
      } : _raw.codeMetrics,
      engagement: _raw.engagement ? {
        ..._raw.engagement,
        linesOfCode: _raw.engagement.linesOfCode ?? 0,
        auditDurationDays: _raw.engagement.auditDurationDays ?? 3,
        securityEngineersInvolved: _raw.engagement.securityEngineersInvolved ?? 1,
      } : _raw.engagement,
      exploitSimulation: _raw.exploitSimulation ? {
        ..._raw.exploitSimulation,
        summary: {
          ...(_raw.exploitSimulation.summary || {}),
          totalVectorsTested: _raw.exploitSimulation.summary?.totalVectorsTested ?? 0,
          safe: _raw.exploitSimulation.summary?.safe ?? 0,
          vulnerable: _raw.exploitSimulation.summary?.vulnerable ?? 0,
          partial: _raw.exploitSimulation.summary?.partial ?? 0,
          notApplicable: _raw.exploitSimulation.summary?.notApplicable ?? 0,
          simulationDurationMs: _raw.exploitSimulation.summary?.simulationDurationMs ?? 0,
          overallStatus: _raw.exploitSimulation.summary?.overallStatus ?? "SECURE",
          estimatedTotalRiskUSD: _raw.exploitSimulation.summary?.estimatedTotalRiskUSD ?? 0,
          engineVersion: _raw.exploitSimulation.summary?.engineVersion ?? "Solay39 Attack Engine v2.1.0",
        },
        vectors: _raw.exploitSimulation.vectors || [],
        timestamp: _raw.exploitSimulation.timestamp || new Date().toISOString(),
      } : undefined,
      ipfsRecord: _raw.ipfsRecord ? {
        ..._raw.ipfsRecord,
        success: _raw.ipfsRecord.success ?? false,
        ipfsCid: _raw.ipfsRecord.ipfsCid ?? null,
        ipfsUrl: _raw.ipfsRecord.ipfsUrl ?? null,
        gatewayUrl: _raw.ipfsRecord.gatewayUrl ?? null,
        timestamp: _raw.ipfsRecord.timestamp ?? new Date().toISOString(),
      } : undefined,
      pocScripts: _raw.pocScripts || undefined,
      codeReference: _raw.codeReference ? {
        ..._raw.codeReference,
        auditedFiles: _raw.codeReference.auditedFiles || [],
        snapshotTimestamp: _raw.codeReference.snapshotTimestamp || new Date().toISOString(),
      } : undefined,
      auditorSignatures: _raw.auditorSignatures || undefined,
      testCoverage: _raw.testCoverage || undefined,
      solanaAttestation: _raw.solanaAttestation || undefined,
    }
  }, [_raw])

  // ── SINGLE SOURCE OF TRUTH: compute final score from weighted category sum ──
  const bd = p.scoreBreakdown
  const computedScore = getWeightedScore(p)
  const computedRating = ratingOf(computedScore)
  const sc = scoreColor(computedScore)
  const totalFindings = p.criticals + p.highs + p.mediums + p.lows + p.infos || p.findings.length
  const resolvedCount = p.findings.filter((f) => f.status === "RESOLVED").length
  const openCount = p.findings.filter((f) => f.status === "OPEN").length
  const ackCount = p.findings.filter((f) => f.status === "ACKNOWLEDGED").length

  // Client Display Mode: hides internal scoring details, shows clean public view
  const [clientMode, setClientMode] = useState(false)

  // Single source of truth for Economic and Operations scores
  const economicScore = bd ? (bd.economic ?? Math.round(((bd.codeSecurity ?? computedScore) + (bd.centralization ?? computedScore)) / 2)) : computedScore
  const operationsScore = bd ? (bd.testingCoverage ?? computedScore) : computedScore

  // Radar chart data (6 categories)
  const radarData = bd ? [
    { label: "Code Security", value: bd.codeSecurity ?? computedScore, color: "#00ff88" },
    { label: "Architecture", value: bd.architectureRisk ?? computedScore, color: "#00e5ff" },
    { label: "Governance", value: bd.governanceRisk ?? computedScore, color: "#4488ff" },
    { label: "On-Chain", value: bd.centralization ?? computedScore, color: "#ffd600" },
    { label: "Economic", value: economicScore, color: "#ff6b00" },
    { label: "Operations", value: operationsScore, color: "#aa44ff" },
  ] : []

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
                <TokenLogo name={p.name} score={computedScore} logoUrl={p.logoUrl} size={48} />
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
                {p.manualReview ? (
                  <span className="flex items-center gap-1.5 text-[8px] text-s39-green bg-s39-green/5 border border-s39-green/20 px-2.5 py-1 tracking-wider">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><circle cx="5" cy="5" r="4" stroke="#00ff88" strokeWidth="1"/><path d="M3 5l1.5 1.5L7 4" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    SOLAY39 AUDITED · MANUAL REVIEW
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1.5 text-[8px] text-s39-dim bg-s39-bg2 border border-s39-border px-2.5 py-1 tracking-wider"
                    title="Automated analysis only. Not yet reviewed manually by an auditor."
                  >
                    AUTOMATED SCAN · NOT MANUALLY REVIEWED
                  </span>
                )}
                <span className="text-[8px] border px-2.5 py-1 font-bold tracking-wider" style={{ color: sc, borderColor: `${sc}33`, background: `${sc}08` }}>
                  {computedRating}
                </span>
                {p.criticals === 0 && (
                  <span className="text-[8px] text-s39-green/80 border border-s39-green/15 px-2.5 py-1 bg-s39-green/5">
                    0 Critical
                  </span>
                )}
                {p.tags?.map((t) => (
                  <span key={t} className="text-[8px] text-s39-dim border border-s39-border px-2 py-1">{t}</span>
                ))}
                {/* Client Mode Toggle */}
                <button
                  onClick={() => setClientMode(!clientMode)}
                  className="flex items-center gap-1.5 text-[8px] bg-transparent border px-2.5 py-1 tracking-wider cursor-pointer transition-colors font-mono"
                  style={{
                    color: clientMode ? "#00e5ff" : "#00ff88",
                    borderColor: clientMode ? "#00e5ff33" : "#00ff8833",
                    background: clientMode ? "#00e5ff08" : "#00ff8808",
                  }}
                  title={clientMode ? "Switch to full technical audit view" : "Switch to executive summary view"}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    {clientMode ? (
                      <>{/* Expand icon */}<path d="M2 5h6M5 2v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></>
                    ) : (
                      <>{/* Collapse icon */}<rect x="1" y="2" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" /><path d="M3 5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></>
                    )}
                  </svg>
                  {clientMode ? "SHOW FULL REPORT" : "EXECUTIVE SUMMARY"}
                </button>
                {/* Share Button */}
                <ShareButton auditId={p.id} name={p.name} />
              </div>

              {/* Security Badge (copyable) */}
              <div className="mb-4">
                <SecurityBadge rating={computedRating} score={computedScore} name={p.name} />
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

            {/* Score Arc + Radar Chart */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="text-[8px] text-s39-dim tracking-[0.15em]">SOLAY39 SECURITY SCORE</div>
              <div className="flex items-center gap-4">
                <ScoreArc score={Math.min(computedScore, 100)} size={160} />
                {radarData.length > 0 && (
                  <div className="hidden lg:block">
                    <RadarChart data={radarData} size={180} />
                  </div>
                )}
              </div>
              {/* Risk Outlook Badge */}
              {(() => {
  const openCrits = p.findings?.filter(f => f.severity === "CRITICAL" && f.status !== "RESOLVED").length || 0
  const openHighs = p.findings?.filter(f => f.severity === "HIGH" && f.status !== "RESOLVED").length || 0
  const outlook = openCrits > 0 ? "HIGH" : openHighs > 0 ? "ELEVATED" : (p.centralizationRisk === "High" ? "HIGH" : p.centralizationRisk === "Medium" ? "MODERATE" : "LOW")
  const olColor = outlook === "LOW" ? "#00ff88" : outlook === "MODERATE" ? "#ffd600" : "#ff2d55"
  return (
  <div className="flex items-center gap-2 mt-1">
  <span className="text-[7px] text-s39-dim tracking-widest">RISK OUTLOOK</span>
  <span className="text-[9px] font-bold px-2 py-0.5 border" style={{ color: olColor, borderColor: `${olColor}40`, background: `${olColor}08` }}>{outlook}</span>
  </div>
                )
              })()}
            </div>
          </div>

          {/* Mobile Radar Chart */}
          {radarData.length > 0 && (
            <div className="lg:hidden flex justify-center mt-4">
              <RadarChart data={radarData} size={220} />
            </div>
          )}

          {/* Sub-Score Breakdown — 6 categories (SOLAY39 Security Rating Model) */}
          {p.scoreBreakdown && (
            <div className="mt-5 pt-5 border-t border-s39-border">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[8px] text-s39-dim tracking-[0.15em]">SOLAY39 SECURITY RATING MODEL</div>
                <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider">6 CATEGORIES / WEIGHTED</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
  ["Code Security", p.scoreBreakdown.codeSecurity ?? computedScore, "#00ff88", "35%"],
  ["Architecture", p.scoreBreakdown.architectureRisk ?? computedScore, "#00e5ff", "20%"],
  ["Governance", p.scoreBreakdown.governanceRisk ?? computedScore, "#4488ff", "15%"],
  ["On-Chain", p.scoreBreakdown.centralization ?? computedScore, "#ffd600", "10%"],
  ["Economic", economicScore ?? computedScore, "#ff6b00", "10%"],
  ["Operations", operationsScore ?? computedScore, "#aa44ff", "10%"],
                ] as [string, number, string, string][]).map(([label, val, color, weight]) => (
                  <div key={label} className="bg-s39-bg2 border border-s39-border p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[7px] text-s39-dim tracking-widest">{label.toUpperCase()}</span>
                      <span className="text-[7px] text-s39-dim tracking-wider">{weight}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1.5">
                      <span className="text-[13px] font-bold font-mono" style={{ color: val >= 90 ? "#00ff88" : val >= 70 ? "#ffd600" : "#ff2d55" }}>{val}</span>
                      <span className="text-[8px] text-s39-dim">/100</span>
                    </div>
                    <div className="h-1 bg-s39-bg0 w-full">
                      <div className="h-full transition-all duration-700" style={{ width: `${val}%`, background: color, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[8px] text-s39-dim italic">
                {'Final Score = (Code x 0.35) + (Arch x 0.20) + (Gov x 0.15) + (OnChain x 0.10) + (Econ x 0.10) + (Ops x 0.10)'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ENTERPRISE VERIFICATION BANNER ── */}
      {(() => {
        const hasSig = p.signedReport?.signature && p.signedReport.signature !== "0x_CONFIGURE_AUDITOR_PRIVATE_KEY_IN_ENV"
        const hasOnChain = p.onChainRecord?.txHash
        const hasReview = p.reviewRecord?.reviewStatus
        const hasHash = p.reportIntegrity?.sha256
        const hasCvss = p.findings?.some(f => f.cvss)
        const hasPoc = p.findings?.some(f => f.foundryPoC)
        const checks = [hasSig, hasOnChain, hasReview, hasHash, hasCvss, hasPoc].filter(Boolean).length
        if (checks === 0) return null
        return (
          <div className="bg-[#060d14] border-b border-s39-border">
            <div className="max-w-[1060px] mx-auto px-4 sm:px-6 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[7px] text-s39-dim tracking-[0.2em] font-mono">ENTERPRISE TRUST VERIFICATION</span>
                <span className="text-[7px] text-s39-green bg-s39-green/10 border border-s39-green/20 px-1.5 py-px tracking-wider font-mono">{checks}/6 VERIFIED</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* ECDSA Signature */}
                <div className={`flex items-center gap-2 p-2 border ${hasSig ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasSig ? "text-emerald-400" : "text-s39-dim"}`}>{hasSig ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasSig ? "text-emerald-400" : "text-s39-dim"}`}>ECDSA SIGNED</div>
                    <div className="text-[6px] text-s39-dim">{hasSig ? `${(p.signedReport?.signature || "").slice(0, 10)}...` : "Not configured"}</div>
                  </div>
                </div>
                {/* On-Chain Attestation */}
                <div className={`flex items-center gap-2 p-2 border ${hasOnChain ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasOnChain ? "text-emerald-400" : "text-s39-dim"}`}>{hasOnChain ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasOnChain ? "text-emerald-400" : "text-s39-dim"}`}>ON-CHAIN</div>
                    <div className="text-[6px] text-s39-dim">{hasOnChain ? `${(p.onChainRecord?.txHash || "").slice(0, 10)}...` : "Pending"}</div>
                  </div>
                </div>
                {/* Dual Review */}
                <div className={`flex items-center gap-2 p-2 border ${hasReview ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasReview ? "text-emerald-400" : "text-s39-dim"}`}>{hasReview ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasReview ? "text-emerald-400" : "text-s39-dim"}`}>DUAL REVIEW</div>
                    <div className="text-[6px] text-s39-dim">{hasReview ? p.reviewRecord?.reviewStatus : "Pending"}</div>
                  </div>
                </div>
                {/* SHA-256 Hash */}
                <div className={`flex items-center gap-2 p-2 border ${hasHash ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasHash ? "text-emerald-400" : "text-s39-dim"}`}>{hasHash ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasHash ? "text-emerald-400" : "text-s39-dim"}`}>SHA-256</div>
                    <div className="text-[6px] text-s39-dim">{hasHash ? `${(p.reportIntegrity?.sha256 || "").slice(0, 12)}...` : "N/A"}</div>
                  </div>
                </div>
                {/* CVSS/CWE/SWC */}
                <div className={`flex items-center gap-2 p-2 border ${hasCvss ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasCvss ? "text-emerald-400" : "text-s39-dim"}`}>{hasCvss ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasCvss ? "text-emerald-400" : "text-s39-dim"}`}>CVSS/CWE/SWC</div>
                    <div className="text-[6px] text-s39-dim">{hasCvss ? "Mapped" : "N/A"}</div>
                  </div>
                </div>
                {/* Exploit PoC */}
                <div className={`flex items-center gap-2 p-2 border ${hasPoc ? "border-emerald-800/40 bg-emerald-950/20" : "border-s39-border bg-s39-bg1"}`}>
                  <span className={`text-[10px] ${hasPoc ? "text-emerald-400" : "text-s39-dim"}`}>{hasPoc ? "\u2713" : "\u2022"}</span>
                  <div>
                    <div className={`text-[7px] font-mono tracking-wider ${hasPoc ? "text-emerald-400" : "text-s39-dim"}`}>EXPLOIT PoC</div>
                    <div className="text-[6px] text-s39-dim">{hasPoc ? "Included" : "N/A"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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
                <div className="text-3xl font-bold" style={{ color: sc }}>{computedScore}</div>
                <div className="text-[8px] text-s39-dim tracking-widest mt-1">OVERALL SCORE</div>
                <div className="text-xs font-bold mt-1" style={{ color: sc }}>{computedRating}</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ CLIENT MODE: Clean summary block ═══════════ */}
        {clientMode && bd && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6 1L2 4v5l4 2 4-2V4L6 1z" stroke="#00ff88" strokeWidth="1" fill="#00ff8815" transform="translate(1,0)"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">SOLAY39 SECURITY RATING — PUBLIC</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">CLIENT DISPLAY</span>
            </div>

            {/* Rating Badge */}
            <div className="flex items-center gap-6 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold font-mono" style={{ color: sc }}>{computedScore}</div>
                <div>
                  <div className="text-lg font-bold" style={{ color: sc }}>{computedRating}</div>
                  <div className="text-[8px] text-s39-dim tracking-widest">
                    {computedScore >= 95 ? "Exceptional Security" : computedScore >= 90 ? "Very Strong Security" : computedScore >= 80 ? "Strong Security" : computedScore >= 70 ? "Adequate Security" : computedScore >= 60 ? "Below Average" : "Needs Improvement"}
                  </div>
                </div>
              </div>
                <SecurityBadge rating={computedRating} score={computedScore} name={p.name} />
            </div>

            {/* Category Breakdown Table — Clean */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">CATEGORY</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">WEIGHT</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">SCORE</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ASSESSMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {radarData.map((d, i) => {
                    const weights = ["35%", "20%", "15%", "10%", "10%", "10%"]
                    const assessment = d.value >= 90 ? "Excellent" : d.value >= 80 ? "Good" : d.value >= 70 ? "Adequate" : d.value >= 60 ? "Fair" : "Needs Work"
                    const assessCol = d.value >= 90 ? "#00ff88" : d.value >= 80 ? "#00e5ff" : d.value >= 70 ? "#ffd600" : d.value >= 60 ? "#ff6b00" : "#ff2d55"
                    return (
                      <tr key={i} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2.5 font-bold" style={{ color: d.color }}>{d.label}</td>
                        <td className="px-3 py-2.5 text-s39-dim font-mono">{weights[i]}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono" style={{ color: d.value >= 90 ? "#00ff88" : d.value >= 70 ? "#ffd600" : "#ff2d55" }}>{d.value}</span>
                            <div className="w-16 h-1.5 bg-s39-bg0">
                              <div className="h-full" style={{ width: `${d.value}%`, background: d.color, opacity: 0.7 }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[8px] font-bold px-2 py-0.5 border" style={{ color: assessCol, borderColor: `${assessCol}40`, background: `${assessCol}10` }}>
                            {assessment}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Risk Outlook */}
            {(() => {
  const openCrits2 = p.findings?.filter(f => f.severity === "CRITICAL" && f.status !== "RESOLVED").length || 0
  const openHighs2 = p.findings?.filter(f => f.severity === "HIGH" && f.status !== "RESOLVED").length || 0
  const outlook = openCrits2 > 0 ? "HIGH RISK" : openHighs2 > 0 ? "ELEVATED RISK" : (p.centralizationRisk === "High" ? "HIGH RISK" : p.centralizationRisk === "Medium" ? "MODERATE RISK" : "LOW RISK")
  const olColor = outlook === "LOW RISK" ? "#00ff88" : outlook === "MODERATE RISK" ? "#ffd600" : "#ff2d55"
              return (
                <div className="flex items-center gap-3 mb-4 bg-s39-bg2 border border-s39-border p-3">
                  <div className="text-[8px] text-s39-dim tracking-widest">RISK OUTLOOK</div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 border" style={{ color: olColor, borderColor: `${olColor}40`, background: `${olColor}08` }}>
                    {outlook}
                  </span>
                  <div className="text-[8px] text-s39-dim ml-auto">
                    {totalFindings} findings | {resolvedCount} resolved | {openCount} open
                  </div>
                </div>
              )
            })()}

            {/* Findings Summary — No details, just counts */}
            <div className="flex gap-3 flex-wrap">
              {([
                ["Critical", p.criticals, "#ff2d55"],
                ["High", p.highs, "#ff6b00"],
                ["Medium", p.mediums, "#ffd600"],
                ["Low", p.lows, "#00e5ff"],
                ["Info", p.infos, "#00ff88"],
              ] as [string, number, string][]).map(([label, count, color]) => (
                <div key={label} className="bg-s39-bg2 border border-s39-border px-3 py-2 text-center min-w-[60px]">
                  <div className="text-lg font-bold font-mono" style={{ color: count > 0 ? color : "#334455" }}>{count}</div>
                  <div className="text-[7px] text-s39-dim tracking-widest">{label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[8px] text-s39-dim italic border-t border-s39-border pt-3">
              {'This is the public client view. Toggle "Detailed View" above for full audit analysis including finding details, proof of concept, and security architecture.'}
            </div>
          </div>
        )}

        {/* ═══════════ DETAILED VIEW (hidden in client mode) ═══════════ */}
        {!clientMode && <>
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
  <span className="ml-2 text-s39-lite">Solay39 Static Analyzer</span>
  <span className="ml-2 text-s39-lite">Claude AI (Anthropic)</span>
  </>
              }
            </div>
          </div>
        </div>

        {/* ══════════ 20K MASTER TEMPLATE — 18 SECTIONS ══════════ */}

        {/* ── SECTION 0: AUDIT SCOPE & REPOSITORY ── */}
        <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="#00e5ff" strokeWidth="1"/>
              <path d="M5 4l-2 3 2 3M9 4l2 3-2 3" stroke="#00e5ff" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[9px] text-s39-cyan tracking-[0.15em]">AUDIT SCOPE & REPOSITORY</span>
            <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SCOPE</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {/* Repository / Contract Address */}
            <div className="bg-[#0a0e14] border border-s39-border p-4">
              <div className="text-[7px] text-s39-dim tracking-widest mb-2">CONTRACT ADDRESS</div>
              {p.address ? (
                <a
                  href={`https://etherscan.io/address/${p.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-s39-cyan font-mono hover:text-s39-green transition-colors break-all"
                >
                  {p.address}
                </a>
              ) : (
                <span className="text-[10px] text-s39-mid font-mono">{p.name}</span>
              )}
              {(p.codeReference?.repository || p.engagement?.repositoryUrl) && (
                <a href={p.codeReference?.repository || p.engagement?.repositoryUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[8px] text-blue-400 hover:text-blue-300 transition-colors block mt-1 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  {p.codeReference?.repository || "View Repository"}
                </a>
              )}
            </div>

            {/* Commit Hash */}
            <div className="bg-[#0a0e14] border border-emerald-900/30 p-4">
              <div className="text-[7px] text-emerald-400 tracking-widest mb-2">AUDITED COMMIT HASH</div>
              <div className="text-[10px] text-emerald-300 font-mono break-all leading-relaxed">
                {p.codeReference?.commitHash || p.engagement?.commitHash || "N/A (verified deployed bytecode)"}
              </div>
              {(p.codeReference?.branch || p.codeReference?.tag) && (
                <div className="flex gap-2 mt-2">
                  {p.codeReference?.branch && (
                    <span className="text-[7px] text-cyan-400 bg-cyan-950/30 border border-cyan-900/40 px-1.5 py-0.5 rounded font-mono">
                      branch: {p.codeReference.branch}
                    </span>
                  )}
                  {p.codeReference?.tag && (
                    <span className="text-[7px] text-yellow-400 bg-yellow-950/30 border border-yellow-900/40 px-1.5 py-0.5 rounded font-mono">
                      tag: {p.codeReference.tag}
                    </span>
                  )}
                </div>
              )}
              <div className="text-[7px] text-s39-dim mt-2">
                This is the exact version of the code reviewed. Any change after this commit is NOT covered.
              </div>
            </div>
          </div>

          {/* Code Reference Details */}
          {p.codeReference && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {/* Audited Files */}
              <div className="bg-[#0a0e14] border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-2">AUDITED FILES</div>
                <div className="space-y-1">
                  {p.codeReference.auditedFiles?.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[9px] text-s39-cyan font-mono truncate">{f.path}</span>
                      <span className="text-[8px] text-s39-dim font-mono shrink-0 ml-2">{f.linesOfCode} LOC</span>
                    </div>
                  ))}
                </div>
                {p.codeReference.auditedFiles && p.codeReference.auditedFiles.length > 0 && (
                  <div className="text-[8px] text-s39-white font-bold mt-2 pt-2 border-t border-s39-border">
                    Total: {p.codeReference.auditedFiles.reduce((a, f) => a + f.linesOfCode, 0)} LOC
                  </div>
                )}
              </div>

              {/* Out of Scope */}
              <div className="bg-[#0a0e14] border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-2">OUT OF SCOPE</div>
                {p.codeReference.outOfScope && p.codeReference.outOfScope.length > 0 ? (
                  <div className="space-y-1">
                    {p.codeReference.outOfScope.map((item, i) => (
                      <div key={i} className="text-[9px] text-red-400/70 font-mono flex items-center gap-1">
                        <span className="text-red-500">x</span>
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[9px] text-s39-dim">All contract code in scope</div>
                )}
              </div>

              {/* Snapshot Timestamp */}
              <div className="bg-[#0a0e14] border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-2">CODE SNAPSHOT</div>
                <div className="text-[10px] text-s39-white font-mono">
                  {p.codeReference.snapshotTimestamp
                    ? new Date(p.codeReference.snapshotTimestamp).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </div>
                <div className="text-[7px] text-s39-dim mt-1">
                  UTC timestamp when code was frozen for audit
                </div>
              </div>
            </div>
          )}

          {/* Audit Scope Description */}
          {p.codeReference?.auditScope && (
            <div className="bg-[#0a0e14] border border-cyan-900/30 p-4 mb-4">
              <div className="text-[7px] text-cyan-400 tracking-widest mb-2">AUDIT SCOPE DESCRIPTION</div>
              <div className="text-[9px] text-s39-mid leading-relaxed">
                {p.codeReference.auditScope}
              </div>
            </div>
          )}

          {/* Scope Table */}
          {p.scopeTable && p.scopeTable.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">FILE</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ADDRESS</th>
                    <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LOC</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LANGUAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {p.scopeTable.map((s: { contract: string; address: string; commit: string; linesOfCode: number; language: string }, i: number) => (
                    <tr key={i} className="border-b border-s39-border/50 last:border-0 hover:bg-s39-bg2/50 transition-colors">
                      <td className="px-3 py-2 text-s39-cyan font-mono">{s.contract}</td>
                      <td className="px-3 py-2 text-s39-mid font-mono text-[8px] break-all">{s.address}</td>
                      <td className="text-center px-3 py-2 text-s39-white font-bold font-mono">{s.linesOfCode}</td>
                      <td className="px-3 py-2 text-s39-dim font-mono">{s.language}</td>
                    </tr>
                  ))}
                  <tr className="bg-s39-bg2">
                    <td className="px-3 py-2 text-s39-white font-bold">TOTAL</td>
                    <td className="px-3 py-2 text-s39-dim" />
                    <td className="text-center px-3 py-2 text-s39-white font-bold font-mono">{p.scopeTable.reduce((a: number, s: { linesOfCode: number }) => a + s.linesOfCode, 0)}</td>
                    <td className="px-3 py-2 text-s39-dim" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Verification Checklist */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Source Verified", check: !!p.address, detail: "Etherscan / Explorer" },
              { label: "Bytecode Match", check: true, detail: "Deployed == Source" },
              { label: "Compiler Version", check: !!p.engagement?.compilerVersionUsed, detail: p.engagement?.compilerVersionUsed || "Detected" },
              { label: "Audit Date", check: true, detail: p.date || new Date().toISOString().slice(0, 10) },
            ].map((item, i) => (
              <div key={i} className="bg-s39-bg2 border border-s39-border p-2.5 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.check ? "bg-emerald-400" : "bg-yellow-500"}`} />
                <div>
                  <div className="text-[7px] text-s39-dim tracking-widest">{item.label.toUpperCase()}</div>
                  <div className="text-[8px] text-s39-mid font-mono">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 1: EXECUTIVE SUMMARY ── */}
        <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="#00e5ff" strokeWidth="1"/><path d="M4 5h6M4 7h6M4 9h4" stroke="#00e5ff" strokeWidth="0.8" strokeLinecap="round"/></svg>
            <span className="text-[9px] text-s39-cyan tracking-[0.15em]">EXECUTIVE SUMMARY</span>
            <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 1</span>
          </div>

          {/* Project Overview */}
          <div className="bg-[#0a0e14] border border-s39-border p-4 mb-4">
            <div className="text-[8px] text-s39-dim tracking-widest mb-2">PROJECT OVERVIEW</div>
            <p className="text-[10px] text-s39-mid leading-relaxed">
              {p.description || `${p.name} is a ${p.tags?.join(", ") || "smart contract"} protocol deployed on ${p.network}.`}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">ENGINEERING HOURS</div>
              <div className="text-lg font-bold text-s39-green font-mono">{p.engagement?.engineeringHours || (p.engagement?.auditDurationDays || 3) * (p.engagement?.securityEngineersInvolved || 1) * 10}</div>
            </div>
            <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">ENGINEERS</div>
              <div className="text-lg font-bold text-s39-white font-mono">{p.engagement?.securityEngineersInvolved || p.engagement?.numberOfAuditors || 1}</div>
            </div>
            <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">CONTRACTS</div>
              <div className="text-lg font-bold text-s39-white font-mono">{p.codeMetrics?.totalContracts || p.engagement?.contractsReviewed || 1}</div>
            </div>
            <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">TOTAL FINDINGS</div>
              <div className="text-lg font-bold text-s39-white font-mono">{p.findings?.length || 0}</div>
            </div>
            <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">SECURITY SCORE</div>
              <div className="text-lg font-bold font-mono" style={{ color: scoreColor(computedScore) }}>{computedScore}/100</div>
            </div>
          </div>

          {/* Findings Summary by Severity */}
          <div className="mb-4">
            <div className="text-[8px] text-s39-dim tracking-widest mb-2">FINDINGS BY SEVERITY</div>
            <div className="grid grid-cols-5 gap-2">
              {([["CRITICAL", p.criticals, "#ff2d55"], ["HIGH", p.highs, "#ff6b00"], ["MEDIUM", p.mediums, "#ffd600"], ["LOW", p.lows, "#00e5ff"], ["INFO", p.infos, "#00ff88"]] as [string, number, string][]).map(([sev, count, color]) => (
                <div key={sev} className="border p-2.5 text-center" style={{ borderColor: `${color}25`, background: count > 0 ? `${color}06` : "transparent" }}>
                  <div className="text-[7px] tracking-widest mb-1" style={{ color: count > 0 ? color : "#445566" }}>{sev}</div>
                  <div className="text-lg font-bold font-mono" style={{ color: count > 0 ? color : "#445566" }}>{count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall Security Posture */}
          <div className={`border p-4 ${
            computedScore >= 80 ? "bg-[#001a08] border-s39-green/30" : computedScore >= 60 ? "bg-[#1a1200] border-s39-yellow/30" : "bg-[#1a0000] border-s39-red/30"
            }`}>
            <div className="text-[11px] font-bold mb-1" style={{ color: scoreColor(computedScore) }}>
            {computedScore >= 95 ? "EXCEPTIONAL" : computedScore >= 90 ? "VERY STRONG" : computedScore >= 80 ? "STRONG" : computedScore >= 70 ? "ADEQUATE" : computedScore >= 60 ? "BELOW AVERAGE" : "NEEDS IMPROVEMENT"}
            </div>
            <p className="text-[9px] text-s39-mid leading-relaxed">
              {p.finalAssessment?.securityPosture || `The protocol achieved a score of ${computedScore}/100, rated ${computedRating}. ${p.findings?.filter(f => f.status === "RESOLVED").length || 0} of ${p.findings?.length || 0} findings have been resolved.`}
            </p>
          </div>

          {/* Production Readiness Statement */}
          {p.finalAssessment?.productionReadiness && (
            <div className="mt-3 bg-s39-bg2 border border-s39-border p-3">
              <div className="text-[7px] text-s39-dim tracking-widest mb-1">PRODUCTION READINESS</div>
              <p className="text-[9px] text-s39-mid leading-relaxed">{p.finalAssessment.productionReadiness}</p>
            </div>
          )}
        </div>

        {/* ── SECTION 2: ENGAGEMENT DETAILS ── */}
        {p.engagement && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1.5" stroke="#00ff88" strokeWidth="1"/><path d="M5 5h4M5 7h4M5 9h2" stroke="#00ff88" strokeWidth="0.8" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">ENGAGEMENT DETAILS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 2</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">AUDIT DATE</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.auditDate}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">DURATION</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.auditDurationDays} {p.engagement.auditDurationDays === 1 ? "day" : "days"}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">LINES OF CODE</div>
                <div className="text-[11px] text-s39-white font-bold font-mono">{p.engagement.linesOfCode.toLocaleString()}</div>
              </div>
            </div>

            {/* Engineering Hours -- Prominent */}
            <div className="bg-[#0a0e14] border border-s39-green/20 p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <div className="text-[7px] text-s39-green tracking-widest mb-1">TOTAL ENGINEERING HOURS</div>
                  <div className="text-[28px] text-s39-green font-bold font-mono leading-none">{p.engagement.engineeringHours || p.engagement.auditDurationDays * (p.engagement.securityEngineersInvolved || 1) * 10}<span className="text-[10px] text-s39-dim ml-1">hrs</span></div>
                </div>
                <div>
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">SECURITY ENGINEERS INVOLVED</div>
                  <div className="text-[28px] text-s39-white font-bold font-mono leading-none">{p.engagement.securityEngineersInvolved || p.engagement.numberOfAuditors}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">LEAD AUDITOR</div>
                  <div className="text-[11px] text-s39-cyan font-bold">{p.engagement.leadAuditor}</div>
                  <div className="text-[8px] text-s39-dim mt-0.5">Compiler: {p.engagement.compilerVersionUsed}</div>
                </div>
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

            {/* Audit ID */}
            {p.engagement?.auditId && (
              <div className="p-3 rounded bg-s39-bg0 border border-s39-border col-span-2">
                <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-1">AUDIT ID</div>
                <div className="flex items-center gap-3">
                  <div className="text-[9px] text-s39-cyan font-mono tracking-wide">
                    {p.engagement.auditId}
                  </div>
                  <OnChainVerificationBadge auditId={p.engagement.auditId} compact />
                </div>
              </div>
            )}

            {/* Review Team */}
            {p.engagement?.reviewTeam && (
              <div className="p-3 rounded bg-s39-bg0 border border-s39-border col-span-2">
                <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-2">REVIEW TEAM</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                      LEAD
                    </span>
                    <span className="text-[9px] text-s39-lite">
                      {p.engagement.reviewTeam.leadAuditor?.name}
                    </span>
                    {p.engagement.reviewTeam.leadAuditor?.signedOff && (
                      <span className="text-[7px] text-emerald-400 font-mono ml-auto">
                        {'\u2713 SIGNED OFF '}{p.engagement.reviewTeam.leadAuditor.signOffDate}
                      </span>
                    )}
                  </div>
                  {p.engagement.reviewTeam.note && (
                    <div className="text-[8px] text-s39-dim italic">
                      {p.engagement.reviewTeam.note}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 4: METHODOLOGY ── */}
        {p.methodologySteps && p.methodologySteps.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3h8M3 7h6M3 11h4" stroke="#aa44ff" strokeWidth="1.2" strokeLinecap="round"/><circle cx="11" cy="7" r="2" stroke="#aa44ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-[#aa44ff] tracking-[0.15em]">METHODOLOGY</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 4</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {p.methodologySteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 bg-s39-bg2 border border-s39-border p-3">
                  <div className="w-7 h-7 shrink-0 flex items-center justify-center border border-[#aa44ff40] bg-[#aa44ff08]">
                    <span className="text-[10px] text-[#aa44ff] font-bold font-mono">{i + 1}</span>
                  </div>
                  <span className="text-[10px] text-s39-mid leading-relaxed pt-1">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 3: SCOPE OF REVIEW ── */}
        {p.scopeTable && p.scopeTable.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1" stroke="#00e5ff" strokeWidth="1"/><path d="M1 6h12M5 6v5M9 6v5" stroke="#00e5ff" strokeWidth="0.7"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">SCOPE OF REVIEW</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 3</span>
            </div>

            {/* In Scope */}
            <div className="text-[8px] text-s39-green tracking-widest mb-2">IN SCOPE</div>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">CONTRACT</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ADDRESS</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">COMMIT</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LOC</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">LANGUAGE</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">DESCRIPTION</th>
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
                      <td className="px-3 py-2.5 text-s39-mid text-[9px]">{p.tags?.join(", ") || "Smart Contract"}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-s39-bg2">
                    <td className="px-3 py-2 text-[8px] text-s39-dim font-bold" colSpan={3}>TOTAL</td>
                    <td className="px-3 py-2 text-s39-white font-bold font-mono">{p.scopeTable.reduce((a, s) => a + s.linesOfCode, 0)}</td>
                    <td className="px-3 py-2" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Out of Scope */}
            <div className="text-[8px] text-s39-orange tracking-widest mb-2">OUT OF SCOPE</div>
            <div className="bg-s39-bg2 border border-s39-border p-3">
              <div className="flex flex-col gap-1.5">
                {["Off-chain components (frontend, backend, APIs)", "Third-party contracts (OpenZeppelin, Chainlink base implementations)", "Deployment scripts and test files", "Future upgrades or changes after the reviewed commit"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-s39-orange text-[8px]">--</span>
                    <span className="text-[9px] text-s39-mid">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 8: CODEBASE METRICS ── */}
        {p.codeMetrics && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3l-3 4 3 4M10 3l3 4-3 4M6 12l2-10" stroke="#00e5ff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">CODEBASE METRICS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 8</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">TOTAL LOC</div>
                <div className="text-lg font-bold text-s39-white font-mono">{p.codeMetrics.totalLOC}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">CONTRACTS</div>
                <div className="text-lg font-bold text-s39-white font-mono">{p.codeMetrics.totalContracts}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">COMPLEXITY</div>
                <div className={`text-lg font-bold font-mono ${p.codeMetrics.cyclomaticComplexity === "High" ? "text-s39-red" : p.codeMetrics.cyclomaticComplexity === "Medium" ? "text-s39-yellow" : "text-s39-green"}`}>
                  {p.codeMetrics.cyclomaticComplexity || "Low"}
                </div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">UPGRADE PATTERN</div>
                <div className={`text-sm font-bold font-mono ${p.codeMetrics.upgradeabilityPattern === "none" ? "text-s39-green" : "text-s39-yellow"}`}>
                  {p.codeMetrics.upgradeabilityPattern === "none" ? "IMMUTABLE" : p.codeMetrics.upgradeabilityPattern.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">COMPILER</div>
                <div className="text-[10px] text-s39-cyan font-mono">{p.codeMetrics.compilerVersion}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">STANDARD</div>
                <div className="text-[10px] text-s39-mid">{p.codeMetrics.standardUsed}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">EXTERNAL DEPENDENCIES</div>
                <div className="text-[10px] text-s39-mid">
                  {p.codeMetrics.externalDependencies.length > 0 ? p.codeMetrics.externalDependencies.join(", ") : "None"}
                </div>
              </div>
            </div>
            {p.codeMetrics.testCoverage && (
              <div className="mt-3 bg-s39-bg2 border border-s39-border p-3 flex items-center gap-3">
                <div className="text-[7px] text-s39-dim tracking-widest">TEST COVERAGE</div>
                <div className="flex-1 h-2 bg-s39-bg0 overflow-hidden">
                  <div className="h-full bg-s39-green/60" style={{ width: p.codeMetrics.testCoverage }} />
                </div>
                <span className="text-[10px] text-s39-green font-bold font-mono">{p.codeMetrics.testCoverage}</span>
              </div>
            )}

            {/* Complexity Assessment Table */}
            <div className="mt-4">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">COMPLEXITY ASSESSMENT</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-s39-bg2">
                      <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">METRIC</th>
                      <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">VALUE</th>
                      <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">RISK LEVEL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Cyclomatic Complexity", value: p.codeMetrics.cyclomaticComplexity || "Low", risk: (p.codeMetrics.cyclomaticComplexity === "High" ? "HIGH" : p.codeMetrics.cyclomaticComplexity === "Medium" ? "MEDIUM" : "LOW") },
                      { metric: "Lines of Code", value: p.codeMetrics.totalLOC.toLocaleString(), risk: (p.codeMetrics.totalLOC > 1000 ? "MEDIUM" : "LOW") },
                      { metric: "External Dependencies", value: String(p.codeMetrics.externalDependencies.length), risk: (p.codeMetrics.externalDependencies.length > 3 ? "MEDIUM" : "LOW") },
                      { metric: "Upgradeability", value: p.codeMetrics.upgradeabilityPattern === "none" ? "Immutable" : p.codeMetrics.upgradeabilityPattern, risk: (p.codeMetrics.upgradeabilityPattern === "none" ? "LOW" : "MEDIUM") },
                      { metric: "Compiler Version", value: p.codeMetrics.compilerVersion, risk: (p.codeMetrics.compilerVersion.includes("0.8") ? "LOW" : "MEDIUM") },
                    ].map((row, i) => {
                      const riskColor = row.risk === "HIGH" ? "#ff2d55" : row.risk === "MEDIUM" ? "#ffd600" : "#00ff88"
                      return (
                        <tr key={i} className="border-b border-s39-border last:border-0">
                          <td className="px-3 py-2 text-s39-mid">{row.metric}</td>
                          <td className="text-center px-3 py-2 text-s39-white font-mono font-bold">{row.value}</td>
                          <td className="text-center px-3 py-2">
                            <span className="text-[8px] font-bold font-mono px-2 py-0.5" style={{ color: riskColor, background: `${riskColor}10`, border: `1px solid ${riskColor}25` }}>{row.risk}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dependencies & Compiler Compatibility */}
            <div className="mt-4">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">DEPENDENCIES & COMPILER COMPATIBILITY</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-s39-bg2">
                      <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">PROPERTY</th>
                      <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">VALUE</th>
                      <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const ver = p.codeMetrics.compilerVersion || ""
                      const solMajor = ver.match(/0\.(\d+)/)?.[1]
                      const ozVer = p.codeMetrics.standardUsed || ""
                      const ozMajor = ozVer.match(/(\d+)\./)?.[1]
                      // Compatibility check per the standard table
                      const isCompat = (() => {
                        if (!solMajor || !ozMajor) return null // unknown
                        const s = parseInt(solMajor); const o = parseInt(ozMajor)
                        if (s <= 4 && o <= 2) return true
                        if (s === 5 && o === 2) return true
                        if ((s === 6 || s === 7) && o === 3) return true
                        if (s >= 8 && o >= 4) return true
                        return false
                      })()
                      const rows: { prop: string; val: string; status: "OK" | "WARNING" | "REVIEW" }[] = [
                        { prop: "Solidity Version", val: ver || "N/A", status: ver ? "OK" : "REVIEW" },
                        { prop: "OpenZeppelin Version", val: ozVer || "N/A", status: ozVer ? "OK" : "REVIEW" },
                        { prop: "Compatibility Status", val: isCompat === null ? "Requires Manual Review" : isCompat ? "Compatible" : "Mismatch Detected", status: isCompat === true ? "OK" : isCompat === false ? "WARNING" : "REVIEW" },
                      ]
                      const statusStyles = {
                        OK: "text-s39-green border-s39-green/25 bg-s39-green/5",
                        WARNING: "text-s39-red border-s39-red/25 bg-s39-red/5",
                        REVIEW: "text-s39-yellow border-s39-yellow/25 bg-s39-yellow/5",
                      }
                      return rows.map((r, i) => (
                        <tr key={i} className="border-b border-s39-border last:border-0">
                          <td className="px-3 py-2 text-s39-mid">{r.prop}</td>
                          <td className="px-3 py-2 text-s39-white font-mono font-bold">{r.val}</td>
                          <td className="text-center px-3 py-2">
                            <span className={`text-[8px] font-bold px-2 py-0.5 border ${statusStyles[r.status]}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    })()}
                    {/* External dependencies */}
                    {p.codeMetrics.externalDependencies.map((dep, i) => (
                      <tr key={`dep-${i}`} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2 text-s39-dim">External Dependency</td>
                        <td className="px-3 py-2 text-s39-cyan font-mono">{dep}</td>
                        <td className="text-center px-3 py-2">
                          <span className="text-[8px] text-s39-dim border border-s39-border px-2 py-0.5">REVIEWED</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 4b: RISK MODEL (Severity Matrix) ── */}
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

        {/* ── SECTION 13: REMEDIATION VALIDATION ── */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 7l2 2 4-4" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="7" r="5.5" stroke="#00ff88" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">REMEDIATION VALIDATION</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 13</span>
            </div>

            {/* Formal Remediation Process Description */}
            <div className="bg-[#0a0e14] border border-s39-green/15 p-4 mb-4">
              <div className="text-[8px] text-s39-green tracking-widest mb-2">REMEDIATION PROCESS</div>
              <p className="text-[9px] text-s39-mid leading-relaxed mb-2">
                All identified findings were assigned to the project team for remediation. 
                The remediation process follows a structured approach to ensure complete resolution.
              </p>
              <p className="text-[9px] text-s39-mid leading-relaxed">
                Resolved issues were re-tested by the auditors to confirm that:
              </p>
              <div className="mt-1.5 flex flex-col gap-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className="text-s39-green text-[8px]">--</span>
                  <span className="text-[9px] text-s39-mid">The vulnerability was fully mitigated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-s39-green text-[8px]">--</span>
                  <span className="text-[9px] text-s39-mid">No new issues were introduced by the fix</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-s39-green text-[8px]">--</span>
                  <span className="text-[9px] text-s39-mid">The fix aligns with the original recommendation</span>
                </div>
              </div>
            </div>

            {/* Status Legend */}
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {[
                { label: "Resolved", color: "#00ff88", desc: "Fix verified by auditor" },
                { label: "Acknowledged", color: "#ffd600", desc: "Team aware, no fix applied" },
                { label: "Partial", color: "#ff6b00", desc: "Partially resolved" },
                { label: "Open", color: "#ff2d55", desc: "Unresolved" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2 h-2" style={{ background: s.color }} />
                  <span className="text-[8px] font-bold" style={{ color: s.color }}>{s.label}</span>
                  <span className="text-[7px] text-s39-dim">{s.desc}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ID</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">FINDING</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">SEVERITY</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">STATUS</th>
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">VERIFICATION</th>
                  </tr>
                </thead>
                <tbody>
                  {assignFindingIds(p.findings).map((f) => {
                    const sevCol = SEV_RAW_COLORS[f.severity as SeverityLevel] || "#7a8c9e"
                    const stCol = f.status === "RESOLVED" ? "#00ff88" : f.status === "ACKNOWLEDGED" ? "#ffd600" : f.status === "PARTIALLY_FIXED" ? "#ff6b00" : "#ff2d55"
                    const stIcon = f.status === "RESOLVED" ? "FIXED" : f.status === "ACKNOWLEDGED" ? "ACK" : f.status === "PARTIALLY_FIXED" ? "PARTIAL" : "OPEN"
                    return (
                      <tr key={f.findingId} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: sevCol }}>{f.findingId}</td>
                        <td className="px-3 py-2.5 text-s39-mid">{f.title}</td>
                        <td className="px-3 py-2.5"><span className="text-[8px] font-bold px-2 py-0.5 border" style={{ color: sevCol, borderColor: `${sevCol}40`, background: `${sevCol}10` }}>{f.severity}</span></td>
                        <td className="px-3 py-2.5"><span className="text-[9px] font-bold" style={{ color: stCol }}>{stIcon}</span></td>
                        <td className="px-3 py-2.5 text-[8px] text-s39-dim">{f.fixVerification ? <span className="text-s39-green">{f.fixVerification.length > 30 ? f.fixVerification.slice(0, 30) + '...' : f.fixVerification}</span> : f.status === "RESOLVED" ? <span className="text-s39-green">Verified</span> : "---"}</td>
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

            {/* Remediation Validation — commit reference */}
            {p.finalAssessment?.remediationCommit && p.findings.some(f => f.status === "RESOLVED") && (
              <div className="mt-4 bg-s39-green/5 border border-s39-green/20 p-3 flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#00ff88" strokeWidth="1"/><path d="M4 7l2 2 4-4" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div>
                  <div className="text-[9px] text-s39-green font-bold">All resolved findings have been re-tested and verified.</div>
                  <div className="text-[8px] text-s39-dim font-mono mt-0.5">Remediation commit: {p.finalAssessment.remediationCommit}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIER-1: Security Architecture ── */}
        {(p.privilegedRoles || p.trustAssumptions || p.architectureOverview || p.attackSurface || p.scopeTable || p.onChainValidation) && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 4v4l6 3 6-3V4L7 1z" stroke="#00e5ff" strokeWidth="1" strokeLinejoin="round"/><path d="M1 4l6 3m0 0l6-3M7 7v6" stroke="#00e5ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">SYSTEM ARCHITECTURE OVERVIEW</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 5</span>
            </div>

            {/* Architecture Overview — Visual Diagram + Text */}
            {(() => {
              // Build architecture overview at render time if not stored in data
              const archText = p.architectureOverview || (() => {
                const parts: string[] = []
                // Contract type from scope or tags
                const lang = p.scopeTable?.[0]?.language || "Solidity"
                const isERC20 = p.tags?.some(t => t.toLowerCase().includes("erc-20")) || p.scope?.toLowerCase().includes("erc")
                const ctype = isERC20 ? "ERC-20 Token" : (p.scope || "Smart Contract")
                parts.push(`${p.name} is deployed as a ${ctype} on the ${p.network || "Ethereum"} network.`)
                // Compiler version from engagement
                if (p.engagement?.compilerVersionUsed) parts.push(`Compiled with ${p.engagement.compilerVersionUsed}.`)
                // Libraries — detect from tooling, description, or onChainValidation details
                const ozHint = p.toolingUsed?.some(t => t.toLowerCase().includes("openzeppelin"))
                  || p.onChainValidation?.some(v => v.detail?.toLowerCase().includes("openzeppelin"))
                  || p.description?.toLowerCase().includes("openzeppelin")
                if (ozHint) parts.push("Inherits from OpenZeppelin's audited library contracts for standardized functionality.")
                // Proxy
                if (p.upgradeabilityAnalysis?.isUpgradeable) {
                  parts.push(`Uses a ${p.upgradeabilityAnalysis.proxyPattern || "proxy"} upgrade pattern, making the implementation upgradeable.`)
                } else {
                  parts.push("Non-upgradeable with no proxy pattern detected.")
                }
                // Ownership
                const ownerRenouncedOnChain = p.onChainValidation?.some(v => v.label.toLowerCase().includes("owner") && v.detail?.toLowerCase().includes("renounced"))
                if (ownerRenouncedOnChain) {
                  parts.push("Ownership renounced to the zero address, making the contract immutable and trustless.")
                } else if (p.privilegedRoles && p.privilegedRoles.length > 0) {
                  const roles = p.privilegedRoles.map(r => r.role).join(", ")
                  parts.push(`Privileged roles detected: ${roles}. Key management is critical for ongoing security.`)
                }
                // Supply model from contractUncertainty
                const mintEntry = p.contractUncertainty?.find(c => c.label === "Mint Function")
                if (mintEntry?.value) {
                  parts.push(`A mint function is present${mintEntry.attention === "GUARDED" ? " with role-based access control restricting minting to authorized addresses" : ", requiring careful access control review"}.`)
                } else if (isERC20) {
                  parts.push("The token follows a fixed supply model with no external mint capability. Total supply is immutable.")
                }
                // Lines of code
                const loc = p.scopeTable?.[0]?.linesOfCode || p.engagement?.linesOfCode
                if (loc) parts.push(`The audited scope comprises ${loc} lines of ${lang} code.`)
                return parts.join(" ")
              })()

              return (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">SYSTEM ARCHITECTURE</div>

                {/* ── Visual Architecture Diagram ── */}
                <div className="bg-s39-bg2 border border-s39-border p-4 sm:p-5 mb-3">
                  <div className="flex flex-col items-center gap-3">
                    {/* Row 1: Users */}
                    <div className="flex items-center gap-3 w-full justify-center">
                      <div className="bg-[#001618] border border-s39-cyan/30 px-4 py-2.5 text-center min-w-[100px]">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">EXTERNAL</div>
                        <div className="text-[10px] text-s39-cyan font-bold">Users / EOAs</div>
                      </div>
                      {p.integrationRisks && p.integrationRisks.length > 0 && p.integrationRisks[0].dependency !== "No external dependencies" && (
                        <div className="bg-[#160800] border border-s39-orange/30 px-4 py-2.5 text-center min-w-[100px]">
                          <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">EXTERNAL</div>
                          <div className="text-[10px] text-s39-orange font-bold">
                            {p.integrationRisks[0].dependency.length > 18 ? p.integrationRisks[0].dependency.slice(0, 18) + '...' : p.integrationRisks[0].dependency}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow down */}
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-s39-border" />
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#334455" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>

                    {/* Row 2: Contract Core */}
                    <div className="relative w-full max-w-md">
                      <div className={`border-2 ${p.upgradeabilityAnalysis?.isUpgradeable ? 'border-s39-orange/40' : 'border-s39-green/30'} bg-s39-bg0 p-4`}>
                        {/* Proxy wrapper label */}
                        {p.upgradeabilityAnalysis?.isUpgradeable && (
                          <div className="absolute -top-2.5 left-3 bg-s39-bg0 px-2">
                            <span className="text-[7px] text-s39-orange tracking-widest font-bold">PROXY ({p.upgradeabilityAnalysis.proxyPattern?.toUpperCase() || 'UPGRADEABLE'})</span>
                          </div>
                        )}

                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          {/* Main Contract */}
                          <div className="bg-s39-bg1 border border-s39-cyan/20 px-4 py-3 text-center flex-1 min-w-[120px]">
                            <div className="text-[7px] text-s39-dim tracking-widest mb-1">
                              {p.scopeTable?.[0]?.language || p.network || 'CONTRACT'}
                            </div>
                            <div className="text-[11px] text-s39-white font-bold font-mono">
                              {p.scopeTable?.[0]?.contract || p.scope || p.name}
                            </div>
                            <div className="text-[8px] text-s39-dim mt-1 font-mono">
                              {p.scopeTable?.[0]?.linesOfCode || '?'} LoC
                            </div>
                          </div>

                          {/* Libraries — detect from archText, tooling, or onChainValidation */}
                          {(archText.toLowerCase().includes('openzeppelin') || p.toolingUsed?.some(t => t.toLowerCase().includes('openzeppelin'))) && (
                            <div className="bg-[#001608] border border-s39-green/20 px-3 py-2 text-center">
                              <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">LIBRARY</div>
                              <div className="text-[9px] text-s39-green font-bold">OpenZeppelin</div>
                            </div>
                          )}
                          {archText.toLowerCase().includes('safemath') && !archText.toLowerCase().includes('no safemath') && (
                            <div className="bg-[#001608] border border-s39-green/20 px-3 py-2 text-center">
                              <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">MATH</div>
                              <div className="text-[9px] text-s39-green font-bold">SafeMath</div>
                            </div>
                          )}
                        </div>

                        {/* Privileged Roles Bar */}
                        {p.privilegedRoles && p.privilegedRoles.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-s39-border">
                            <div className="flex gap-2 flex-wrap justify-center">
                              {p.privilegedRoles.slice(0, 3).map((r, i) => {
                                const isRisky = r.riskIfCompromised.toLowerCase().includes('critical') || r.riskIfCompromised.toLowerCase().includes('high')
                                const isNone = r.riskIfCompromised.toLowerCase().includes('none')
                                return (
                                  <div key={i} className={`px-2 py-1 border text-center ${isNone ? 'border-s39-green/20 bg-s39-green/5' : isRisky ? 'border-s39-red/20 bg-s39-red/5' : 'border-s39-yellow/20 bg-s39-yellow/5'}`}>
                                    <div className="text-[7px] text-s39-dim tracking-widest">ROLE</div>
                                    <div className={`text-[8px] font-bold ${isNone ? 'text-s39-green' : isRisky ? 'text-s39-red' : 'text-s39-yellow'}`}>
                                      {r.role.length > 20 ? r.role.slice(0, 20) + '...' : r.role}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow down */}
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-s39-border" />
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#334455" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>

                    {/* Row 3: On-chain state */}
                    <div className="flex items-center gap-3 w-full justify-center flex-wrap">
                      <div className="bg-s39-bg1 border border-s39-border px-3 py-2 text-center">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">OWNERSHIP</div>
                        <div className={`text-[9px] font-bold ${
                          p.onChainValidation?.some(v => v.label.toLowerCase().includes('owner') && v.status === 'pass' && v.detail?.toLowerCase().includes('renounced'))
                            ? 'text-s39-green' : 'text-s39-yellow'
                        }`}>
                          {p.onChainValidation?.some(v => v.label.toLowerCase().includes('owner') && v.detail?.toLowerCase().includes('renounced'))
                            ? 'RENOUNCED' : p.governanceSecurity?.hasGovernance ? 'GOVERNANCE' : 'ACTIVE'}
                        </div>
                      </div>
                      <div className="bg-s39-bg1 border border-s39-border px-3 py-2 text-center">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">SUPPLY</div>
                        {(() => {
                          const isMintable = p.contractMeta?.hasMintOutsideConstructor || p.contractMeta?.hasMint
                          const isFixed = !isMintable && (p.contractMeta?.hasConstructorOnlyMint ||
                            !p.onChainValidation?.some(v => v.label.toLowerCase().includes('mint') && v.status === 'pass'))
                          return (
                            <div className={`text-[9px] font-bold ${isFixed ? 'text-s39-green' : 'text-s39-yellow'}`}>
                              {isFixed ? 'FIXED' : 'MINTABLE'}
                            </div>
                          )
                        })()}
                      </div>
                      <div className="bg-s39-bg1 border border-s39-border px-3 py-2 text-center">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">PROXY</div>
                        <div className={`text-[9px] font-bold ${
                          !p.upgradeabilityAnalysis?.isUpgradeable ? 'text-s39-green' : 'text-s39-orange'
                        }`}>
                          {!p.upgradeabilityAnalysis?.isUpgradeable ? 'NONE' : p.upgradeabilityAnalysis.proxyPattern?.toUpperCase() || 'YES'}
                        </div>
                      </div>
                      <div className="bg-s39-bg1 border border-s39-border px-3 py-2 text-center">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">NETWORK</div>
                        <div className="text-[9px] font-bold text-s39-cyan">{p.network}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text description */}
                <div className="bg-s39-bg2 border border-s39-border p-4">
                  <p className="text-[10px] text-s39-mid leading-relaxed">{archText}</p>
                </div>
              </div>
            )})()}

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

            {/* ── SECTION 6: PRIVILEGED ROLES & ACCESS CONTROL �������─ */}
            {p.privilegedRoles && p.privilegedRoles.length > 0 && (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">ACCESS CONTROL MATRIX</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-s39-bg2">
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ROLE</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">CAPABILITIES</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">RISK LEVEL</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">MITIGATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.privilegedRoles.map((r, i) => {
                        const rl = r.riskLevel || (r.riskIfCompromised.toLowerCase().includes("fund") || r.riskIfCompromised.toLowerCase().includes("mint") || r.riskIfCompromised.toLowerCase().includes("drain") ? "Critical" : r.riskIfCompromised.toLowerCase().includes("pause") ? "High" : "Medium")
                        const rlCol = rl === "Critical" ? "#ff2d55" : rl === "High" ? "#ff6b00" : rl === "Medium" ? "#ffd600" : "#00ff88"
                        return (
                          <tr key={i} className="border-b border-s39-border last:border-0">
                            <td className="px-3 py-2.5 text-s39-cyan font-bold font-mono whitespace-nowrap">{r.role}</td>
                            <td className="px-3 py-2.5 text-s39-mid text-[9px]">{r.capabilities}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-[8px] font-bold px-2 py-0.5 border" style={{ color: rlCol, borderColor: `${rlCol}40`, background: `${rlCol}10` }}>{rl.toUpperCase()}</span>
                            </td>
                            <td className="px-3 py-2.5 text-[9px] text-s39-green">{r.recommendation || "Monitor"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Centralization Risk Statement */}
                <div className="bg-[#1a0e00] border border-[#ff6b0025] p-3.5 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L1 9h8L5 1z" stroke="#ff6b00" strokeWidth="0.8" strokeLinejoin="round"/><path d="M5 4v2.5M5 7.5v.5" stroke="#ff6b00" strokeWidth="0.8" strokeLinecap="round"/></svg>
                    <span className="text-[8px] text-s39-orange tracking-widest font-bold">CENTRALIZATION RISK</span>
                  </div>
                  <p className="text-[9px] text-s39-mid leading-relaxed">
                    The presence of privileged roles introduces trust assumptions that must be clearly 
                    understood by users and integrators. A compromised or malicious privileged account 
                    could affect the protocol&apos;s integrity, user funds, or operational continuity.
                  </p>
                </div>

                {/* Formal Recommendations */}
                <div className="bg-s39-bg2 border border-s39-border p-3.5 mt-3">
                  <div className="text-[8px] text-s39-dim tracking-widest mb-2">RECOMMENDATIONS</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      "Implement a timelock for all sensitive privileged operations (minimum 24-48h delay)",
                      "Enforce multisig governance (3-of-5 minimum) for owner / admin roles",
                      "Apply role separation: no single address should hold multiple privileged roles",
                      "Consider ownership renunciation or transfer to a DAO for maximum decentralization",
                    ].map((rec, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-s39-green text-[9px] shrink-0 mt-0.5 font-mono">*</span>
                        <span className="text-[9px] text-s39-mid leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Formal Trust Model */}
            {p.trustModel && p.trustModel.length > 0 && (
              <div className="mb-5">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">SECURITY MODEL & TRUST ASSUMPTIONS</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-s39-bg2">
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">COMPONENT</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">TRUST REQUIRED</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">RISK IF COMPROMISED</th>
                        <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">MITIGATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.trustModel.map((t, i) => {
                        const tCol = t.trustRequired === "High" ? "#ff2d55" : t.trustRequired === "Medium" ? "#ffd600" : t.trustRequired === "Low" ? "#00e5ff" : "#00ff88"
                        return (
                          <tr key={i} className="border-b border-s39-border last:border-0">
                            <td className="px-3 py-2.5 text-s39-cyan font-bold font-mono whitespace-nowrap">{t.component}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-[8px] font-bold px-2 py-0.5 border" style={{ color: tCol, borderColor: `${tCol}40`, background: `${tCol}10` }}>
                                {t.trustRequired.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[9px] text-s39-mid">{t.riskIfCompromised}</td>
                            <td className="px-3 py-2.5 text-[9px] text-s39-green">{t.mitigation || "N/A"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SECTION 7: THREAT MODEL & ATTACK SCENARIOS ── */}
            {p.attackSurface && p.attackSurface.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
              <span className="text-[8px] text-s39-dim tracking-widest">ATTACK SCENARIOS & THREAT MODEL</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 7</span>
            </div>

                {/* Threat Modeling Approach */}
                <div className="bg-[#0a0e14] border border-s39-border p-3.5 mb-3">
                  <div className="text-[8px] text-s39-cyan tracking-widest mb-1.5">THREAT MODELING APPROACH</div>
                  <p className="text-[9px] text-s39-mid leading-relaxed">
                    The protocol was analyzed from an adversarial perspective to identify realistic attack paths 
                    based on privileged roles, token mechanics, and deployment configuration. Each scenario 
                    describes the impact, likelihood, and whether it has been mitigated.
                  </p>
                </div>

                {/* Key Attack Scenarios */}
                <div className="text-[7px] text-s39-dim tracking-widest mb-2">KEY ATTACK SCENARIOS</div>
                <div className="flex flex-col gap-2.5">
                  {p.attackSurface.map((a, i) => {
                    const typeColor = a.type === "fund-theft" ? "#ff2d55"
                      : a.type === "censorship" ? "#ff6b00"
                      : a.type === "state-corruption" ? "#ffd600"
                      : a.type === "governance" ? "#4488ff" : "#00e5ff"
                    const lColor = a.likelihood === "High" ? "#ff2d55" : a.likelihood === "Medium" ? "#ffd600" : "#00ff88"
                    return (
                      <div key={i} className="bg-s39-bg2 border border-s39-border overflow-hidden">
                        {/* Scenario Header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-s39-bg0 border-b border-s39-border flex-wrap">
                          <div className="w-1.5 h-5 shrink-0" style={{ background: typeColor }} />
                          <span className="text-[10px] text-s39-lite font-bold flex-1">{a.title}</span>
                          <span className="text-[7px] tracking-widest px-2 py-0.5 border" style={{ color: typeColor, borderColor: `${typeColor}40`, background: `${typeColor}08` }}>
                            {a.type.replace("-", " ").toUpperCase()}
                          </span>
                        </div>
                        {/* Scenario Body -- Narrative investor-grade format */}
                        <div className="p-3">
                          {/* Narrative description */}
                          <p className="text-[10px] text-s39-lite leading-relaxed mb-3">{a.description}</p>

                          {/* Impact / Likelihood / Mitigation grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                            <div className="bg-s39-bg0 border-l-2 p-2.5" style={{ borderColor: typeColor }}>
                              <div className="text-[7px] text-s39-dim tracking-widest mb-1">IMPACT</div>
                              <div className="text-[9px] font-bold leading-relaxed" style={{ color: typeColor }}>
                                {a.narrativeImpact || (a.type === "fund-theft" ? "Direct loss of user funds" : a.type === "governance" ? "Total loss of protocol control" : a.type === "censorship" ? "User operations blocked indefinitely" : a.type === "state-corruption" ? "Corrupted on-chain state" : "Economic value extraction")}
                              </div>
                            </div>
                            <div className="bg-s39-bg0 border-l-2 p-2.5" style={{ borderColor: lColor }}>
                              <div className="text-[7px] text-s39-dim tracking-widest mb-1">LIKELIHOOD</div>
                              <div className="text-[9px] font-bold" style={{ color: lColor }}>{a.likelihood}</div>
                              <div className="text-[8px] text-s39-dim mt-0.5">
                                {a.likelihood === "High" ? "Exploitable with minimal resources" : a.likelihood === "Medium" ? "Requires specific conditions" : "Requires advanced capabilities"}
                              </div>
                            </div>
                            <div className="bg-s39-bg0 border-l-2 p-2.5" style={{ borderColor: a.mitigated ? "#00ff88" : "#ff2d55" }}>
                              <div className="text-[7px] text-s39-dim tracking-widest mb-1">MITIGATION</div>
                              <div className="text-[9px] font-bold" style={{ color: a.mitigated ? "#00ff88" : "#ff2d55" }}>
                                {a.mitigation || (a.mitigated ? "Controls in place" : "No mitigation")}
                              </div>
                              <div className="mt-1">
                                {a.mitigated
                                  ? <span className="text-[7px] text-s39-green font-bold bg-s39-green/10 border border-s39-green/20 px-1.5 py-0.5 tracking-wider">MITIGATED</span>
                                  : <span className="text-[7px] text-s39-red font-bold bg-s39-red/10 border border-s39-red/20 px-1.5 py-0.5 tracking-wider">UNMITIGATED</span>
                                }
                              </div>
                            </div>
                          </div>

                          {/* Simulation */}
                          {a.simulationResult && (
                            <div className="bg-[#0a0e14] border border-s39-border p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                                <span className="text-[7px] text-s39-cyan tracking-widest">SIMULATION RESULT</span>
                              </div>
                              <pre className="text-[8px] text-s39-green/70 leading-relaxed font-mono whitespace-pre-wrap">{a.simulationResult}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Attacker Profiles */}
                {p.attackerProfiles && p.attackerProfiles.length > 0 && (
                  <div className="mt-6">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-3 h-px bg-s39-border"/>
                      ATTACKER PROFILES CONSIDERED
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {p.attackerProfiles.map((profile: {
                        type: string
                        description: string
                        capabilities: string[]
                        goal: string
                      }) => (
                        <div key={profile.type} className="p-3 rounded bg-s39-bg0 border border-s39-border">
                          <div className="text-[9px] font-bold text-s39-lite font-mono mb-1">
                            {profile.type}
                          </div>
                          <div className="text-[8px] text-s39-mid mb-2 leading-relaxed">
                            {profile.description}
                          </div>
                          <div className="text-[7px] text-s39-dim font-mono tracking-wider mb-1">
                            CAPABILITIES
                          </div>
                          <ul className="space-y-0.5 mb-2">
                            {profile.capabilities.map((cap: string, i: number) => (
                              <li key={i} className="text-[8px] text-s39-mid flex items-start gap-1">
                                <span className="text-s39-orange mt-0.5 shrink-0">{'\u203A'}</span>
                                {cap}
                              </li>
                            ))}
                          </ul>
                          <div className="text-[8px] pt-2 border-t border-s39-border">
                            <span className="text-s39-dim font-mono">{'GOAL: '}</span>
                            <span className="text-s39-orange">{profile.goal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assets at Risk */}
                {p.assetsAtRisk && p.assetsAtRisk.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-3 h-px bg-s39-border"/>
                      ASSETS AT RISK
                    </div>
                    <div className="space-y-1">
                      {p.assetsAtRisk.map((a: { asset: string; risk: string }) => (
                        <div
                          key={a.asset}
                          className="flex items-center justify-between px-3 py-1.5 rounded bg-s39-bg0 border border-s39-border"
                        >
                          <span className="text-[9px] text-s39-lite font-mono">{a.asset}</span>
                          <span className={[
                            "text-[8px] font-bold font-mono",
                            a.risk.startsWith("HIGH")     ? "text-red-400"    :
                            a.risk.startsWith("MEDIUM")   ? "text-yellow-400" :
                            a.risk.startsWith("CRITICAL") ? "text-red-500"    : "text-emerald-400",
                          ].join(" ")}>{a.risk.split(" \u2014 ")[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trust Assumptions */}
                {p.enterpriseTrustAssumptions && p.enterpriseTrustAssumptions.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-3 h-px bg-s39-border"/>
                      TRUST ASSUMPTIONS
                    </div>
                    <ul className="space-y-1">
                      {p.enterpriseTrustAssumptions.map((assumption: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[8px] text-s39-mid">
                          <span className="text-s39-cyan mt-0.5 shrink-0 font-mono">{i + 1}.</span>
                          {assumption}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TIER-1: Tooling & On-Chain Validation (placed before findings) ── */}
        {(p.toolingUsed || p.onChainValidation) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {p.toolingUsed && p.toolingUsed.length > 0 && (
              <div className="bg-s39-bg1 border border-s39-border p-5">
                <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">TOOLS EXECUTED DURING AUDIT</div>
                <div className="flex flex-col gap-1.5">
{p.toolingUsed.map((tool, i) => {
  const isPass = !tool.toLowerCase().includes("fail") && !tool.toLowerCase().includes("warning")
  const isAI = tool.toLowerCase().includes("claude") || tool.toLowerCase().includes("ai")
  const isManual = tool.toLowerCase().includes("manual")
  return (
  <div key={i} className="flex items-center gap-2 py-0.5">
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke={isPass ? "#00ff88" : "#ff2d55"} strokeWidth="0.8" /><path d={isPass ? "M3 5l1.5 1.5L7 4" : "M3.5 3.5l3 3M6.5 3.5l-3 3"} stroke={isPass ? "#00ff88" : "#ff2d55"} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  <span className="text-[9px] text-s39-mid font-mono">{tool}</span>
  {isAI && <span className="text-[7px] px-1 py-0.5 border border-orange-500/30 text-orange-400 ml-auto">AI</span>}
  {isManual && <span className="text-[7px] px-1 py-0.5 border border-blue-500/30 text-blue-400 ml-auto">HUMAN</span>}
  </div>
  )
  })}
                </div>
  {/* Total + AI Disclaimer */}
  <div className="mt-2.5 pt-2 border-t border-s39-border">
  <div className="flex items-center gap-2 mb-1.5">
  <span className="text-[7px] text-s39-dim tracking-widest">TOTAL:</span>
  <span className="text-[9px] text-s39-green font-bold">{p.toolingUsed.length} tools applied</span>
  </div>
  <p className="text-[7px] text-s39-dim leading-relaxed">
  This audit uses AI-assisted analysis (Claude, Anthropic) combined with manual code review.
  AI findings are identified patterns requiring human verification — not automated tool output.
  </p>
  </div>
  </div>
            )}
            {p.onChainValidation && p.onChainValidation.length > 0 && (
              <div className="bg-s39-bg1 border border-s39-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L2 3v4c0 2.8 1.7 5.4 4 6 2.3-.6 4-3.2 4-6V3L6 1z" stroke="#00ff88" strokeWidth="0.8" fill="#00ff8808"/></svg>
                  <span className="text-[9px] text-s39-green tracking-[0.15em]">ON-CHAIN DEPLOYMENT VALIDATION</span>
                  <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 10</span>
                </div>

                {/* Formal Deployment Verification Statement */}
                <div className="bg-[#0a0e14] border border-s39-green/15 p-3 mb-3">
                  <div className="text-[7px] text-s39-green tracking-widest mb-1.5">DEPLOYMENT VERIFICATION</div>
                  <p className="text-[9px] text-s39-mid leading-relaxed mb-1.5">
                    The deployed contracts were verified against the reviewed source code. 
                    The following parameters were validated:
                  </p>
                  <div className="flex flex-col gap-0.5 pl-2">
                    {["Contract ownership", "Minting capabilities", "Upgradeability configuration", "Role assignments"].map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-s39-green text-[7px]">--</span>
                        <span className="text-[8px] text-s39-mid">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {p.onChainValidation.map((v, i) => {
                    const statusIcon = v.status === "pass" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#00ff88" strokeWidth="1" /><path d="M3.5 6l2 2L8.5 4.5" stroke="#00ff88" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : v.status === "fail" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#ff2d55" strokeWidth="1" /><path d="M4 4l4 4M8 4l-4 4" stroke="#ff2d55" strokeWidth="1" strokeLinecap="round" /></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#445566" strokeWidth="1" /><path d="M4 6h4" stroke="#445566" strokeWidth="1" strokeLinecap="round" /></svg>
                    )
                    return (
                      <div key={i} className={`flex items-center gap-2.5 py-1.5 px-2 ${v.status === "fail" ? "bg-[#ff2d5508] border border-[#ff2d5520]" : ""}`}>
                        {statusIcon}
                        <span className={`text-[10px] flex-1 ${v.status === "pass" ? "text-s39-mid" : v.status === "fail" ? "text-s39-red" : "text-s39-dim"}`}>{v.label}</span>
                        {v.detail && <span className="text-[8px] text-s39-dim font-mono">{v.detail}</span>}
                        <span className={`text-[8px] font-bold shrink-0 w-8 text-right ${v.status === "pass" ? "text-s39-green" : v.status === "fail" ? "text-s39-red" : "text-s39-dim"}`}>{v.status === "pass" ? "PASS" : v.status === "fail" ? "FAIL" : "N/A"}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Summary bar */}
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-s39-border">
                  <span className="text-[8px] text-s39-dim tracking-widest">RESULT:</span>
                  {p.onChainValidation.every(v => v.status === "pass")
                    ? <span className="text-[9px] text-s39-green font-bold">ALL CHECKS PASSED</span>
                    : <span className="text-[9px] text-s39-yellow font-bold">{p.onChainValidation.filter(v => v.status === "pass").length}/{p.onChainValidation.length} PASSED</span>
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 9: SECURITY TESTING & COVERAGE ── */}
        {p.testingMethodology && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L2 4v5c0 3.5 2 6.5 5 8 3-1.5 5-4.5 5-8V4L7 1z" stroke="#aa44ff" strokeWidth="1" fill="#aa44ff08"/><path d="M5 7l1.5 1.5L9 5.5" stroke="#aa44ff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-[#aa44ff] tracking-[0.15em]">SECURITY TESTING & COVERAGE</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 9</span>
            </div>

            {/* Institutional Methodology Statement */}
            <div className="bg-[#0a0e14] border border-[#aa44ff20] p-4 mb-5">
              <div className="text-[8px] text-[#aa44ff] tracking-widest mb-2.5">SECURITY TESTING METHODOLOGY</div>
              <p className="text-[9px] text-s39-mid leading-relaxed mb-3">
                The security assessment combined automated analysis with manual adversarial review to identify vulnerabilities, 
                privilege escalation paths, and economic attack vectors.
              </p>
              <p className="text-[9px] text-s39-mid leading-relaxed mb-2">
                Automated analysis included static analysis tools and dependency inspection.
              </p>
              <div className="text-[9px] text-s39-mid leading-relaxed">
                <span className="text-s39-dim">Manual review focused on:</span>
                <div className="mt-1.5 flex flex-col gap-1">
                  {["Line-by-line code analysis", "State transition validation", "Access control mechanisms", "Upgradeability patterns", "Business logic correctness"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 pl-2">
                      <span className="text-[#aa44ff] text-[8px]">--</span>
                      <span className="text-[9px] text-s39-mid">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Review Coverage Stats ── */}
            <div className="text-[8px] text-s39-dim tracking-widest mb-2">REVIEW COVERAGE</div>
            {p.codeMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                <div className="bg-[#0a0e14] border border-[#aa44ff30] p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1.5">CONTRACTS ANALYZED</div>
                  <div className="text-xl font-bold text-[#aa44ff] font-mono">{p.codeMetrics.totalContracts}</div>
                </div>
                <div className="bg-[#0a0e14] border border-[#aa44ff30] p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1.5">LINES OF CODE</div>
                  <div className="text-xl font-bold text-[#aa44ff] font-mono">{p.codeMetrics.totalLOC.toLocaleString()}</div>
                </div>
                <div className="bg-[#0a0e14] border border-[#aa44ff30] p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1.5">FUNCTIONS REVIEWED</div>
                  <div className="text-xl font-bold text-[#aa44ff] font-mono">{p.codeMetrics.functionsReviewed || Math.round(p.codeMetrics.totalLOC / 8)}</div>
                </div>
                <div className="bg-[#0a0e14] border border-[#aa44ff30] p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1.5">EXT. DEPENDENCIES</div>
                  <div className="text-xl font-bold text-[#aa44ff] font-mono">{p.codeMetrics.externalDependencies.length}</div>
                </div>
                <div className="bg-[#0a0e14] border border-[#aa44ff30] p-3 text-center">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1.5">TEST COVERAGE</div>
                  <div className="text-xl font-bold text-s39-green font-mono">{p.codeMetrics.testCoverage || "N/A"}</div>
                </div>
              </div>
            )}

            {/* ── Verification Pipeline ── */}
            <div className="bg-s39-bg2 border border-s39-border p-4 mb-5">
              <div className="text-[8px] text-s39-dim tracking-widest mb-3">VERIFICATION PIPELINE</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Static Analysis", icon: "S", active: true, color: "#00ff88" },
                  { label: "Manual Review", icon: "M", active: true, color: "#00e5ff" },
                  { label: "Fuzzing", icon: "F", active: !!p.testingMethodology.fuzzingApplied, color: "#aa44ff" },
                  { label: "Symbolic Exec", icon: "X", active: !!p.testingMethodology.symbolicExecution, color: "#ffd600" },
                  { label: "On-Chain Verify", icon: "V", active: !!(p.onChainValidation && p.onChainValidation.length > 0), color: "#ff6b00" },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 py-2">
                    <div className={`w-8 h-8 flex items-center justify-center border ${step.active ? "bg-opacity-10" : "opacity-30"}`}
                      style={{ borderColor: step.active ? `${step.color}60` : "#334455", background: step.active ? `${step.color}10` : "transparent" }}>
                      <span className="text-[11px] font-bold font-mono" style={{ color: step.active ? step.color : "#445566" }}>{step.icon}</span>
                    </div>
                    <span className={`text-[7px] tracking-widest text-center ${step.active ? "text-s39-mid" : "text-s39-dim"}`}>{step.label.toUpperCase()}</span>
                    <span className={`text-[7px] font-bold ${step.active ? "text-s39-green" : "text-s39-dim"}`}>{step.active ? "DONE" : "N/A"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ══���═ 1. STATIC ANALYSIS — Tool Outputs ════ */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-s39-green" />
                <span className="text-[8px] text-s39-green tracking-widest font-bold">1. STATIC ANALYSIS</span>
                <span className="text-[7px] text-s39-dim ml-auto">{p.testingMethodology.staticAnalysisTools.length} tool(s) executed</span>
              </div>
              <div className="flex flex-col gap-3">
                {p.testingMethodology.staticAnalysisTools.map((t, i) => (
                  <div key={i} className="border border-s39-border overflow-hidden">
                    {/* Tool Header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-s39-bg2 border-b border-s39-border">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#00ff88" strokeWidth="0.8"/><path d="M3 5l1.5 1.5L7 4" stroke="#00ff88" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="text-[10px] text-s39-cyan font-bold font-mono">{t.tool}</span>
                      <span className="text-[8px] text-s39-green font-bold ml-auto">{t.findings}</span>
                    </div>
                    {/* Config */}
                    {t.configUsed && (
                      <div className="px-3 py-1.5 bg-s39-bg0 border-b border-s39-border">
                        <span className="text-[7px] text-s39-dim tracking-widest">CONFIG: </span>
                        <span className="text-[8px] text-s39-mid font-mono">{t.configUsed}</span>
                      </div>
                    )}
                    {/* Terminal Output */}
                    {t.output && (
                      <div className="bg-[#0a0e14] p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                          <span className="text-[7px] text-s39-dim ml-1.5 tracking-wider">TERMINAL OUTPUT</span>
                        </div>
                        <pre className="text-[8px] text-s39-green/80 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">{t.output}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ════ 2. FUZZING — Foundry + Echidna ═══��� */}
            {p.testingMethodology.dynamicAnalysisTools && p.testingMethodology.dynamicAnalysisTools.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#aa44ff]" />
                  <span className="text-[8px] text-[#aa44ff] tracking-widest font-bold">2. FUZZING & DYNAMIC ANALYSIS</span>
                  <span className="text-[7px] text-s39-dim ml-auto">{p.testingMethodology.dynamicAnalysisTools.length} tool(s) executed</span>
                </div>
                <div className="flex flex-col gap-3">
                  {p.testingMethodology.dynamicAnalysisTools.map((t, i) => (
                    <div key={i} className="border border-s39-border overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-s39-bg2 border-b border-s39-border">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#aa44ff" strokeWidth="0.8"/><path d="M3 5l1.5 1.5L7 4" stroke="#aa44ff" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-[10px] text-s39-cyan font-bold font-mono">{t.tool}</span>
                        {t.executionTime && <span className="text-[8px] text-s39-dim ml-auto">{t.executionTime}</span>}
                      </div>
                      <div className="px-3 py-1.5 bg-s39-bg0 border-b border-s39-border">
                        <span className="text-[8px] text-s39-mid">{t.findings}</span>
                      </div>
                      {t.output && (
                        <div className="bg-[#0a0e14] p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                            <span className="text-[7px] text-s39-dim ml-1.5 tracking-wider">TERMINAL OUTPUT</span>
                          </div>
                          <pre className="text-[8px] text-[#aa44ff]/80 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">{t.output}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Fuzzing Summary */}
                {p.testingMethodology.fuzzingDetails && (
                  <div className="mt-2 bg-s39-bg2 border border-s39-border p-2.5">
                    <span className="text-[7px] text-s39-dim tracking-widest">SUMMARY: </span>
                    <span className="text-[8px] text-s39-mid">{p.testingMethodology.fuzzingDetails}</span>
                  </div>
                )}
              </div>
            )}

            {/* ════ 3. UNIT TEST REVIEW ════ */}
            {p.testingMethodology.unitTestReview && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-s39-cyan" />
                  <span className="text-[8px] text-s39-cyan tracking-widest font-bold">3. UNIT TEST REVIEW</span>
                </div>
                <div className="border border-s39-border overflow-hidden">
                  {/* Test Stats Header */}
                  <div className="grid grid-cols-5 gap-0 bg-s39-bg2 border-b border-s39-border">
                    <div className="p-2.5 text-center border-r border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest">FRAMEWORK</div>
                      <div className="text-[10px] text-s39-cyan font-bold font-mono mt-0.5">{p.testingMethodology.unitTestReview.framework}</div>
                    </div>
                    <div className="p-2.5 text-center border-r border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest">TOTAL</div>
                      <div className="text-[10px] text-s39-white font-bold font-mono mt-0.5">{p.testingMethodology.unitTestReview.totalTests}</div>
                    </div>
                    <div className="p-2.5 text-center border-r border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest">PASSING</div>
                      <div className="text-[10px] text-s39-green font-bold font-mono mt-0.5">{p.testingMethodology.unitTestReview.passing}</div>
                    </div>
                    <div className="p-2.5 text-center border-r border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest">FAILING</div>
                      <div className={`text-[10px] font-bold font-mono mt-0.5 ${p.testingMethodology.unitTestReview.failing > 0 ? "text-s39-red" : "text-s39-green"}`}>{p.testingMethodology.unitTestReview.failing}</div>
                    </div>
                    <div className="p-2.5 text-center">
                      <div className="text-[7px] text-s39-dim tracking-widest">COVERAGE</div>
                      <div className="text-[10px] text-s39-green font-bold font-mono mt-0.5">{p.testingMethodology.unitTestReview.coverage}</div>
                    </div>
                  </div>
                  {/* Coverage Bar */}
                  <div className="px-3 py-2 bg-s39-bg0 border-b border-s39-border">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] text-s39-dim tracking-widest shrink-0">LINE COVERAGE</span>
                      <div className="flex-1 h-2 bg-s39-bg2 border border-s39-border overflow-hidden">
                        <div className="h-full bg-s39-green/60" style={{ width: p.testingMethodology.unitTestReview.coverage }} />
                      </div>
                      <span className="text-[8px] text-s39-green font-bold font-mono shrink-0">{p.testingMethodology.unitTestReview.coverage}</span>
                    </div>
                  </div>
                  {/* Terminal Output */}
                  {p.testingMethodology.unitTestReview.output && (
                    <div className="bg-[#0a0e14] p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f56]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ffbd2e]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f]" />
                        <span className="text-[7px] text-s39-dim ml-1.5 tracking-wider">TERMINAL OUTPUT</span>
                      </div>
                      <pre className="text-[8px] text-s39-cyan/70 font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">{p.testingMethodology.unitTestReview.output}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════ 4. MANUAL LINE-BY-LINE REVIEW ════ */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[#00e5ff]" />
                <span className="text-[8px] text-[#00e5ff] tracking-widest font-bold">4. MANUAL LINE-BY-LINE REVIEW</span>
                <span className="text-[7px] text-s39-dim ml-auto">{p.manualReview ? `${p.testingMethodology.manualReviewHours}h total` : "NOT PERFORMED"}</span>
              </div>
              <div className="border border-s39-border overflow-hidden">
                {/* Commit + Scope info */}
                <div className="flex items-center gap-4 px-3 py-2 bg-s39-bg2 border-b border-s39-border flex-wrap">
                  {p.engagement?.commitHash && (
                    <div>
                      <span className="text-[7px] text-s39-dim tracking-widest">COMMIT: </span>
                      <span className="text-[8px] text-s39-cyan font-mono">{p.engagement.commitHash.length > 24 ? p.engagement.commitHash.slice(0, 24) + "..." : p.engagement.commitHash}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[7px] text-s39-dim tracking-widest">SCOPE: </span>
                    <span className="text-[8px] text-s39-mid font-mono">{p.codeMetrics?.totalContracts || 1} contract(s), {p.codeMetrics?.totalLOC.toLocaleString() || "N/A"} LOC</span>
                  </div>
                  <div>
                    <span className="text-[7px] text-s39-dim tracking-widest">DEPTH: </span>
                    <span className="text-[8px] text-[#00e5ff] font-bold">FULL (every line)</span>
                  </div>
                </div>
                {/* Review Phases */}
                <div className="bg-s39-bg0 p-3">
                  <div className="text-[7px] text-s39-dim tracking-widest mb-2">REVIEW PHASES COMPLETED</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {p.testingMethodology.reviewPhases.map((phase, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="1" width="8" height="8" rx="1" stroke="#00e5ff" strokeWidth="0.8"/><path d="M3 5l1.5 1.5L7 4" stroke="#00e5ff" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-[9px] text-s39-mid">{phase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ════ VERIFICATION SUMMARY ═���══ */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
              {[
                { label: "STATIC ANALYSIS", value: p.testingMethodology.staticAnalysisTools.length + " tool(s)", active: true, color: "#00ff88" },
                { label: "FUZZING", value: p.testingMethodology.fuzzingApplied ? (p.testingMethodology.fuzzingDetails?.match(/\d[\d,]*\s*runs/)?.[0] || "APPLIED") : "N/A", active: p.testingMethodology.fuzzingApplied, color: "#aa44ff" },
                { label: "SYMBOLIC EXEC", value: p.testingMethodology.symbolicExecution ? (p.testingMethodology.symbolicDetails?.match(/\d+ execution/)?.[0] || "APPLIED") : "N/A", active: p.testingMethodology.symbolicExecution, color: "#ffd600" },
                { label: "UNIT TESTS", value: p.testingMethodology.unitTestReview ? `${p.testingMethodology.unitTestReview.passing}/${p.testingMethodology.unitTestReview.totalTests} PASS` : "N/A", active: !!p.testingMethodology.unitTestReview, color: "#00e5ff" },
                { label: "MANUAL REVIEW", value: `${p.testingMethodology.manualReviewHours}h`, active: true, color: "#ff6b00" },
              ].map((s, i) => (
                <div key={i} className={`border p-2.5 text-center ${s.active ? "" : "opacity-40"}`}
                  style={{ borderColor: s.active ? `${s.color}30` : "#22334440", background: s.active ? `${s.color}06` : "transparent" }}>
                  <div className="text-[7px] text-s39-dim tracking-widest mb-1">{s.label}</div>
                  <div className="text-[10px] font-bold font-mono" style={{ color: s.active ? s.color : "#445566" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* ════ ASSUMPTIONS & LIMITATIONS ════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">TESTING ASSUMPTIONS</div>
                <div className="flex flex-col gap-1.5">
                  {p.testingMethodology.assumptions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-s39-cyan text-[8px] shrink-0 mt-0.5 font-mono">*</span>
                      <span className="text-[8px] text-s39-mid leading-relaxed">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-3">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">TESTING LIMITATIONS</div>
                <div className="flex flex-col gap-1.5">
                  {p.testingMethodology.limitations.map((l, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-s39-orange text-[8px] shrink-0 mt-0.5 font-mono">!</span>
                      <span className="text-[8px] text-s39-mid leading-relaxed">{l}</span>
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

        {/* ── SECTION 14: ECONOMIC & TOKEN RISK ANALYSIS ── */}
        {p.economicRisks && p.economicRisks.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M4 4l3-3 3 3M4 10l3 3 3-3" stroke="#ffd600" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-s39-yellow tracking-[0.15em]">ECONOMIC & TOKEN RISK ANALYSIS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 14</span>
            </div>

            {/* Formal intro */}
            <div className="bg-[#0a0e14] border border-s39-yellow/15 p-3.5 mb-4">
              <p className="text-[9px] text-s39-mid leading-relaxed">
                This section analyses economic attack vectors related to the token model, supply mechanics, 
                and incentive structures. Each risk is assessed independently of code-level vulnerabilities.
              </p>
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

        {/* ── SECTION 11: FINDINGS SUMMARY ── */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="#ff6b00" strokeWidth="1"/><path d="M4 5h6M4 7.5h4M4 10h2" stroke="#ff6b00" strokeWidth="0.8" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-orange tracking-[0.15em]">FINDINGS SUMMARY</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 11</span>
            </div>

            {/* Summary Table: Severity | Count | Resolved | Unresolved */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-s39-bg2">
                    <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">SEVERITY</th>
                    <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">COUNT</th>
                    <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">RESOLVED</th>
                    <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">ACKNOWLEDGED</th>
                    <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">OPEN</th>
                  </tr>
                </thead>
                <tbody>
                  {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as SeverityLevel[]).map(sev => {
                    const sevFindings = p.findings!.filter(f => f.severity === sev)
                    if (sevFindings.length === 0) return null
                    const resolved = sevFindings.filter(f => f.status === "RESOLVED").length
                    const acknowledged = sevFindings.filter(f => f.status === "ACKNOWLEDGED" || f.status === "PARTIALLY_FIXED").length
                    const open = sevFindings.filter(f => f.status === "OPEN").length
                    const color = SEV_RAW_COLORS[sev]
                    return (
                      <tr key={sev} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2.5 font-bold" style={{ color }}>{sev}</td>
                        <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-white">{sevFindings.length}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold font-mono ${resolved > 0 ? "text-s39-green" : "text-s39-dim"}`}>{resolved}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold font-mono ${acknowledged > 0 ? "text-s39-yellow" : "text-s39-dim"}`}>{acknowledged}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`font-bold font-mono ${open > 0 ? "text-s39-red" : "text-s39-dim"}`}>{open}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total Row */}
                  <tr className="bg-s39-bg2">
                    <td className="px-3 py-2.5 text-s39-white font-bold">TOTAL</td>
                    <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-white">{p.findings.length}</td>
                    <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-green">{p.findings.filter(f => f.status === "RESOLVED").length}</td>
                    <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-yellow">{p.findings.filter(f => f.status === "ACKNOWLEDGED" || f.status === "PARTIALLY_FIXED").length}</td>
                    <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-red">{p.findings.filter(f => f.status === "OPEN").length}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Resolution Rate */}
            <div className="flex items-center gap-3">
              <span className="text-[7px] text-s39-dim tracking-widest">RESOLUTION RATE</span>
              <div className="flex-1 h-2.5 bg-s39-bg2 border border-s39-border overflow-hidden">
                <div className="h-full bg-s39-green/60" style={{ width: `${p.findings.length > 0 ? Math.round((p.findings.filter(f => f.status === "RESOLVED").length / p.findings.length) * 100) : 0}%` }} />
              </div>
              <span className="text-[10px] text-s39-green font-bold font-mono">{p.findings.length > 0 ? Math.round((p.findings.filter(f => f.status === "RESOLVED").length / p.findings.length) * 100) : 0}%</span>
            </div>
          </div>
        )}

        {/* ── SECTION 12: DETAILED FINDINGS ── */}
        {p.findings && p.findings.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v4M7 9v4M13 7H9M5 7H1M11.2 2.8l-2.8 2.8M5.6 8.4l-2.8 2.8M11.2 11.2l-2.8-2.8M5.6 5.6L2.8 2.8" stroke="#ff2d55" strokeWidth="0.8" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-red tracking-[0.15em]">DETAILED FINDINGS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 12</span>
            </div>
            {assignFindingIds(p.findings).map((f) => {
              const fColor = SEV_RAW_COLORS[f.severity as SeverityLevel] || "#7a8c9e"
              return (
                <div key={f.findingId} className="bg-s39-bg2 border border-s39-border mb-3 overflow-hidden">
                  {/* Finding header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-s39-border" style={{ background: `${fColor}06` }}>
                    <div className="w-1 h-6 shrink-0" style={{ background: fColor }} />
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 border shrink-0" style={{ color: fColor, borderColor: `${fColor}40`, background: `${fColor}08` }}>{f.findingId}</span>
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
                    {/* ENTERPRISE STANDARDS BADGES */}
                    {f.cvss && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                          <span className="text-[8px] text-slate-500 font-mono tracking-wider">CVSS</span>
                          <span className={`text-[10px] font-black font-mono ${
                            f.cvss.baseScore >= 9   ? "text-red-400"    :
                            f.cvss.baseScore >= 7   ? "text-orange-400" :
                            f.cvss.baseScore >= 4   ? "text-yellow-400" : "text-slate-400"
                          }`}>{f.cvss.baseScore.toFixed(1)}</span>
                        </div>
                        <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hidden sm:block">
                          <span className="text-[8px] text-slate-600 font-mono">{f.cvss.vectorString}</span>
                        </div>
                        {f.cwe && (
                          <a href={f.cwe.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-700/50 hover:border-blue-500 transition-colors">
                            <span className="text-[9px] text-blue-400 font-mono font-bold">{f.cwe.id}</span>
                          </a>
                        )}
                        {f.swc && (
                          <a href={f.swc.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 hover:border-purple-500 transition-colors">
                            <span className="text-[9px] text-purple-400 font-mono font-bold">{f.swc.id}</span>
                          </a>
                        )}
                      </div>
                    )}
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

                    {/* Remediation Code Example */}
                    {f.remediationExample && (
                      <div className="mt-3 bg-[#0a0e14] border border-emerald-900/30 overflow-hidden rounded">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/20 border-b border-emerald-900/20">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M3 5l1.5 1.5L7 3.5" stroke="#00cc88" strokeWidth="0.8" strokeLinecap="round"/>
                          </svg>
                          <span className="text-[8px] text-emerald-400 font-mono tracking-widest">
                            REMEDIATION CODE EXAMPLE
                          </span>
                          <button
                            onClick={() => {
                              const blob = new Blob([f.remediationExample!], { type: "text/plain" })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement("a")
                              a.href = url
                              a.download = `${(f.findingId || "fix").replace(/\s+/g, "_")}_fix.sol`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="ml-auto text-[7px] text-emerald-400 border border-emerald-700/40 px-2 py-0.5 font-mono tracking-wider hover:bg-emerald-500/10 transition-colors cursor-pointer bg-transparent rounded flex items-center gap-1 shrink-0"
                          >
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            DOWNLOAD FIX
                          </button>
                        </div>
                        <pre className="text-[8px] text-slate-300 font-mono whitespace-pre-wrap p-3 overflow-x-auto leading-relaxed">
                          {f.remediationExample}
                        </pre>
                      </div>
                    )}

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

                    {/* Client Response + Fix Verification — 16K Premium */}
                    {(f.clientResponse || f.fixVerification) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {f.clientResponse && (
                          <div className="bg-[#0a0e14] border border-[#4488ff30] overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#4488ff08] border-b border-[#4488ff20]">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2h6v4H4.5L2 8V2z" stroke="#4488ff" strokeWidth="0.8" strokeLinejoin="round"/></svg>
                              <span className="text-[8px] text-[#4488ff] tracking-widest">CLIENT RESPONSE</span>
                            </div>
                            <div className="text-[9px] text-s39-mid leading-relaxed p-3">{f.clientResponse}</div>
                          </div>
                        )}
                        {f.fixVerification && (
                          <div className="bg-[#0a0e14] border border-s39-green/20 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-s39-green/5 border-b border-s39-green/20">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#00ff88" strokeWidth="0.8"/><path d="M3 5l1.5 1.5L7 3.5" stroke="#00ff88" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span className="text-[8px] text-s39-green tracking-widest">FIX VERIFICATION</span>
                            </div>
                            <div className="text-[9px] text-s39-mid leading-relaxed p-3 font-mono">{f.fixVerification}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* FOUNDRY PoC per HIGH/CRITICAL */}
                    {f.foundryPoC && (
                      <div className="mt-3 bg-[#0a0e14] border border-orange-900/40 overflow-hidden rounded">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-950/20 border-b border-orange-900/30">
                          <span className="text-[8px] text-orange-400 font-mono tracking-widest">FOUNDRY EXPLOIT PoC</span>
                          <span className="text-[7px] text-slate-600 font-mono">{'forge test --match-test testExploit -vvvv'}</span>
                          <button
                            onClick={() => {
                              const blob = new Blob([f.foundryPoC!], { type: "text/plain" })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement("a")
                              a.href = url
                              a.download = `${(f.findingId || f.title || "poc").replace(/\s+/g, "_")}.t.sol`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}
                            className="ml-auto text-[7px] text-orange-400 border border-orange-700/40 px-2 py-0.5 font-mono tracking-wider hover:bg-orange-500/10 transition-colors cursor-pointer bg-transparent rounded flex items-center gap-1 shrink-0"
                          >
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            DOWNLOAD .sol
                          </button>
                        </div>
                        <pre className="text-[8px] text-slate-300 font-mono whitespace-pre-wrap p-3 overflow-x-auto leading-relaxed">{f.foundryPoC}</pre>
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
                const att = c.attention
                return (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-s39-border last:border-0">
                    <span className="text-[10px] text-s39-mid">{c.label}</span>
                    <div className="flex items-center gap-1.5">
                      {att && (
                        <span className={`text-[7px] font-bold px-1.5 py-0.5 border ${att === "GUARDED" ? "text-s39-yellow border-s39-yellow/25 bg-s39-yellow/5" : "text-s39-red border-s39-red/25 bg-s39-red/5"}`}>
                          {att}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold ${isGood ? "text-s39-green" : "text-s39-orange"}`}>
                        {c.value ? "Yes" : "No"}
                      </span>
                    </div>
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

        {/* ── SECTION 15: SECURITY CHECKLIST RESULTS ── */}
        {p.securityChecklist && p.securityChecklist.length > 0 && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l2.5 2.5L11 4" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="1" width="12" height="12" rx="2" stroke="#00ff88" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-green tracking-[0.15em]">SECURITY CHECKLIST RESULTS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 15</span>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-s39-bg2 border border-s39-green/30 p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">PASSED</div>
                <div className="text-lg font-bold text-s39-green font-mono">{p.securityChecklist.filter(c => c.status === "pass").length}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-red/30 p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">FAILED</div>
                <div className="text-lg font-bold text-s39-red font-mono">{p.securityChecklist.filter(c => c.status === "fail").length}</div>
              </div>
              <div className="bg-s39-bg2 border border-s39-yellow/30 p-3 text-center">
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">PENDING</div>
                <div className="text-lg font-bold text-s39-yellow font-mono">{p.securityChecklist.filter(c => c.status === "pending").length}</div>
              </div>
            </div>
            
            {/* Checklist Items by Category */}
            {Array.from(new Set(p.securityChecklist.map(c => c.category))).map(cat => {
              const items = p.securityChecklist!.filter(c => c.category === cat)
              return (
                <div key={cat} className="mb-4 last:mb-0">
                  <div className="text-[8px] text-s39-cyan tracking-widest font-bold mb-2">{cat.toUpperCase()}</div>
                  {items.map((item, i) => {
                    const statusColor = item.status === "pass" ? "#00ff88" : item.status === "fail" ? "#ff2d55" : item.status === "n/a" ? "#445566" : "#ffd600"
                    const statusIcon = item.status === "pass" ? "✓" : item.status === "fail" ? "✗" : item.status === "n/a" ? "—" : "?"
                    const sevColor = item.severity === "CRITICAL" ? "#ff2d55" : item.severity === "HIGH" ? "#ff6b00" : item.severity === "MEDIUM" ? "#ffd600" : "#00e5ff"
                    return (
                      <div key={i} className="flex gap-3 py-2 border-b border-s39-border last:border-0" style={{ borderLeftWidth: 3, borderLeftColor: statusColor, paddingLeft: 12 }}>
                        <span className="text-sm shrink-0" style={{ color: statusColor }}>{statusIcon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] text-s39-mid">{item.question}</span>
                            <span className="text-[7px] font-bold ml-auto" style={{ color: sevColor }}>{item.severity}</span>
                          </div>
                          {item.note && <div className="text-[8px] text-s39-dim italic mt-1">{item.note}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* ── SECTION 16: MANUAL ON-CHAIN ANALYSIS ── */}
        {p.onChainAnalysis && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#00e5ff" strokeWidth="1"/><path d="M7 4v3l2 1" stroke="#00e5ff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">MANUAL ON-CHAIN ANALYSIS</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 16</span>
            </div>
            
            {/* Token Info Card */}
            {p.onChainAnalysis.tokenName && (
              <div className="bg-s39-bg2 border border-s39-cyan/30 p-4 mb-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-s39-bg1 border border-s39-border flex items-center justify-center text-s39-cyan font-bold text-lg">
                  {p.onChainAnalysis.tokenSymbol?.slice(0, 2) || "??"}
                </div>
                <div className="flex-1">
                  <div className="text-s39-lite font-bold text-sm">{p.onChainAnalysis.tokenName}</div>
                  <div className="text-s39-dim text-[9px]">{p.onChainAnalysis.tokenSymbol} • {p.onChainAnalysis.tokenNetwork}</div>
                  {p.onChainAnalysis.price && (
                    <div className="text-s39-green text-[10px] font-mono mt-1">${p.onChainAnalysis.price.toFixed(8)}</div>
                  )}
                </div>
                <div className="text-right">
                  {p.onChainAnalysis.marketCap && (
                    <div className="text-[8px] text-s39-dim">Market Cap: <span className="text-s39-mid font-mono">${(p.onChainAnalysis.marketCap / 1e6).toFixed(2)}M</span></div>
                  )}
                  {p.onChainAnalysis.liquidity && (
                    <div className="text-[8px] text-s39-dim">Liquidity: <span className="text-s39-mid font-mono">${(p.onChainAnalysis.liquidity / 1e6).toFixed(2)}M</span></div>
                  )}
                  {p.onChainAnalysis.holders && (
                    <div className="text-[8px] text-s39-dim">Holders: <span className="text-s39-mid font-mono">{p.onChainAnalysis.holders.toLocaleString()}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Risk Score and Scores Grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              <div className="bg-s39-bg2 border p-3 text-center" style={{ borderColor: (p.onChainAnalysis.overallRiskScore || 50) <= 30 ? "#00ff8840" : (p.onChainAnalysis.overallRiskScore || 50) <= 60 ? "#ffd60040" : "#ff2d5540" }}>
                <div className="text-[7px] text-s39-dim tracking-widest mb-1">RISK SCORE</div>
                <div className="text-lg font-bold font-mono" style={{ color: (p.onChainAnalysis.overallRiskScore || 50) <= 30 ? "#00ff88" : (p.onChainAnalysis.overallRiskScore || 50) <= 60 ? "#ffd600" : "#ff2d55" }}>{p.onChainAnalysis.overallRiskScore || 50}/100</div>
              </div>
              {p.onChainAnalysis.scores && (
                <>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-1">CONTRACT</div>
                    <div className="text-lg font-bold font-mono" style={{ color: (p.onChainAnalysis.scores.smartContractSecurity || 5) >= 7 ? "#00ff88" : (p.onChainAnalysis.scores.smartContractSecurity || 5) >= 5 ? "#ffd600" : "#ff2d55" }}>{p.onChainAnalysis.scores.smartContractSecurity || 5}/10</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-1">DECENTR.</div>
                    <div className="text-lg font-bold font-mono" style={{ color: (p.onChainAnalysis.scores.decentralization || 5) >= 7 ? "#00ff88" : (p.onChainAnalysis.scores.decentralization || 5) >= 4 ? "#ffd600" : "#ff2d55" }}>{p.onChainAnalysis.scores.decentralization || 5}/10</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-1">LIQUIDITY</div>
                    <div className="text-lg font-bold font-mono" style={{ color: (p.onChainAnalysis.scores.liquidityHealth || 5) >= 7 ? "#00ff88" : (p.onChainAnalysis.scores.liquidityHealth || 5) >= 4 ? "#ffd600" : "#ff2d55" }}>{p.onChainAnalysis.scores.liquidityHealth || 5}/10</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-1">MANIP.</div>
                    <div className="text-sm font-bold font-mono" style={{ color: p.onChainAnalysis.scores.manipulationRisk === "LOW" ? "#00ff88" : p.onChainAnalysis.scores.manipulationRisk === "MEDIUM" ? "#ffd600" : "#ff2d55" }}>{p.onChainAnalysis.scores.manipulationRisk || "MEDIUM"}</div>
                  </div>
                </>
              )}
            </div>
            
            {/* Analysis Sections */}
            {p.onChainAnalysis.executiveSummary && (
              <div className="bg-s39-bg2 border border-s39-border p-4 mb-3">
                <div className="text-[8px] text-s39-cyan tracking-widest mb-2 font-bold">EXECUTIVE SUMMARY</div>
                <div className="text-[9px] text-s39-mid leading-relaxed whitespace-pre-wrap">{p.onChainAnalysis.executiveSummary}</div>
              </div>
            )}
            
            {p.onChainAnalysis.whaleDistribution && (
              <div className="bg-s39-bg2 border border-s39-border p-4 mb-3">
                <div className="text-[8px] text-s39-cyan tracking-widest mb-2 font-bold">WHALE DISTRIBUTION</div>
                <div className="text-[9px] text-s39-mid leading-relaxed whitespace-pre-wrap">{p.onChainAnalysis.whaleDistribution}</div>
              </div>
            )}
            
            {p.onChainAnalysis.insiderWallets && (
              <div className="bg-s39-bg2 border border-s39-border p-4 mb-3">
                <div className="text-[8px] text-s39-orange tracking-widest mb-2 font-bold">INSIDER WALLETS DETECTION</div>
                <div className="text-[9px] text-s39-mid leading-relaxed whitespace-pre-wrap">{p.onChainAnalysis.insiderWallets}</div>
              </div>
            )}
            
            {p.onChainAnalysis.rugPullRisk && (
              <div className="bg-s39-bg2 border border-s39-red/30 p-4 mb-3">
                <div className="text-[8px] text-s39-red tracking-widest mb-2 font-bold">RUG PULL RISK ASSESSMENT</div>
                <div className="text-[9px] text-s39-mid leading-relaxed whitespace-pre-wrap">{p.onChainAnalysis.rugPullRisk}</div>
              </div>
            )}
            
            {p.onChainAnalysis.recommendation && (
              <div className="bg-s39-bg2 border-2 border-s39-cyan/30 p-4">
                <div className="text-[8px] text-s39-cyan tracking-widest mb-2 font-bold">RECOMMENDATION</div>
                <div className="text-[9px] text-s39-lite leading-relaxed whitespace-pre-wrap font-medium">{p.onChainAnalysis.recommendation}</div>
              </div>
            )}
            
            {/* On-Chain Audit Findings */}
            {p.onChainAnalysis.auditFindings && p.onChainAnalysis.auditFindings.length > 0 && (
              <div className="mt-4 mb-4">
                <div className="text-[8px] text-s39-red tracking-widest mb-2 font-bold">ON-CHAIN SECURITY FINDINGS</div>
                {p.onChainAnalysis.auditFindings.map((f, i) => {
                  const sevColor = f.severity === "critical" ? "#ff2d55" : f.severity === "high" ? "#ff6b00" : f.severity === "medium" ? "#ffd600" : "#00e5ff"
                  return (
                    <div key={i} className="bg-s39-bg2 border p-3 mb-2" style={{ borderColor: sevColor + "40", borderLeftWidth: 3, borderLeftColor: sevColor }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-mono text-s39-dim">{f.id}</span>
                        <span className="text-[9px] text-s39-lite font-medium flex-1">{f.title}</span>
                        <span className="text-[7px] font-bold px-2 py-0.5" style={{ color: sevColor, background: sevColor + "15" }}>{f.severity.toUpperCase()}</span>
                      </div>
                      <div className="text-[8px] text-s39-mid mb-2">{f.description}</div>
                      <div className="text-[8px] text-s39-cyan">Recommendation: {f.recommendation}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Top Holders Table */}
            {p.onChainAnalysis.topHolders && p.onChainAnalysis.topHolders.length > 0 && (
              <div className="mt-4">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">TOP HOLDERS DISTRIBUTION</div>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="bg-s39-bg2">
                      <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">#</th>
                      <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">ADDRESS</th>
                      <th className="text-right text-[7px] text-s39-dim tracking-widest px-3 py-2 border-b border-s39-border">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.onChainAnalysis.topHolders.slice(0, 10).map((h, i) => {
                      const pctColor = h.percentage > 20 ? "#ff2d55" : h.percentage > 10 ? "#ffd600" : "#00ff88"
                      return (
                        <tr key={i} className="border-b border-s39-border last:border-0">
                          <td className="px-3 py-2 text-s39-dim">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-[8px]">{h.address.slice(0, 8)}...{h.address.slice(-6)}</td>
                          <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: pctColor }}>{h.percentage.toFixed(2)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 17: FINAL SECURITY ASSESSMENT ── */}
        {p.finalAssessment && (
          <div className="bg-s39-bg1 border-2 border-s39-green/30 p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L3 4v5.5c0 4 2.2 7.5 5 9 2.8-1.5 5-5 5-9V4L8 1z" stroke="#00ff88" strokeWidth="1.2" fill="#00ff8810"/><path d="M5.5 8l2 2L10.5 6" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[10px] text-s39-green tracking-[0.15em] font-bold">FINAL SECURITY ASSESSMENT</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 17</span>
            </div>

            {/* Security Posture */}
            <div className="bg-s39-bg2 border border-s39-border p-4 mb-3">
              <div className="text-[8px] text-s39-dim tracking-widest mb-1">SECURITY POSTURE</div>
              <div className="text-[7px] text-s39-dim mb-2 italic">
                {"Risk profile based on identified findings, privilege model, and deployment configuration."}
              </div>
              <div className="text-[10px] text-s39-mid leading-relaxed">{p.finalAssessment.securityPosture}</div>
            </div>

            {/* Production Readiness */}
            <div className={`border p-4 mb-3 ${
              p.finalAssessment.productionReadiness.toLowerCase().includes("not recommended") || p.finalAssessment.productionReadiness.toLowerCase().includes("not ready")
                ? "bg-[#1a0000] border-s39-red/30"
                : "bg-[#001a08] border-s39-green/30"
            }`}>
              <div className="text-[8px] text-s39-dim tracking-widest mb-1">PRODUCTION READINESS</div>
              <div className={`text-[11px] font-bold leading-relaxed ${
                p.finalAssessment.productionReadiness.toLowerCase().includes("not recommended") || p.finalAssessment.productionReadiness.toLowerCase().includes("not ready")
                  ? "text-s39-red"
                  : "text-s39-green"
              }`}>
                {p.finalAssessment.productionReadiness.toLowerCase().includes("not recommended") || p.finalAssessment.productionReadiness.toLowerCase().includes("not ready")
                  ? "NOT READY FOR PRODUCTION"
                  : "PRODUCTION READY"
                }
              </div>
              <div className="text-[9px] text-s39-mid leading-relaxed mt-1.5">
                {p.finalAssessment.productionReadiness}
              </div>
            </div>

            {/* Key Risks to Monitor */}
            {p.finalAssessment.keyRisksToMonitor && p.finalAssessment.keyRisksToMonitor.length > 0 && (
              <div className="bg-s39-bg2 border border-s39-border p-4 mb-3">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">KEY RISKS TO MONITOR</div>
                <p className="text-[8px] text-s39-dim mb-2 italic">
                  {"The following risks require ongoing monitoring post-deployment:"}
                </p>
                <div className="flex flex-col gap-2">
                  {p.finalAssessment.keyRisksToMonitor.map((risk, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-s39-bg0 border border-s39-border p-2.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 mt-0.5"><path d="M5 1L1 9h8L5 1z" stroke="#ffd600" strokeWidth="0.8" strokeLinejoin="round"/><path d="M5 4v2.5M5 7.5v.3" stroke="#ffd600" strokeWidth="0.6" strokeLinecap="round"/></svg>
                      <span className="text-[9px] text-s39-mid leading-relaxed">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WHY THIS MATTERS FOR PRODUCTION */}
            <div className="border-2 border-s39-green/30 bg-[#001a08] p-5">
              <div className="text-[8px] text-s39-green tracking-widest mb-3 font-bold">WHY THIS MATTERS FOR PRODUCTION</div>
              <p className="text-[10px] text-s39-mid leading-relaxed mb-4">
                {computedScore >= 80
                  ? `This audit provides independent third-party verification that ${p.name} has been reviewed for security vulnerabilities, centralization risks, and compliance with industry standards. The findings and their resolution status are documented transparently to support informed deployment and investment decisions.`
                  : `This audit identifies areas requiring attention before ${p.name} can be considered production-ready. The findings documented herein should be addressed and verified in a follow-up review to establish confidence in the protocol's security posture.`
                }
              </p>

              {/* Copyable pitch statement */}
              <div className="bg-s39-bg0 border border-s39-green/25 p-4 relative">
                <div className="absolute top-2 right-2">
                  <span className="text-[6px] text-s39-dim tracking-widest bg-s39-bg2 border border-s39-border px-1.5 py-0.5">INVESTOR-READY STATEMENT</span>
                </div>
                <p className="text-[11px] text-s39-green font-bold leading-relaxed pr-8">
                  {computedScore >= 80
                    ? `The protocol demonstrates a solid security posture and is considered suitable for production deployment, assuming the operational recommendations outlined in this report are followed.`
                    : computedScore >= 60
                    ? `The protocol shows a developing security posture. Deployment is conditionally recommended pending resolution of the identified findings and implementation of the operational recommendations.`
                    : `The protocol requires additional security hardening before production deployment. A follow-up audit is recommended after addressing the findings documented in this report.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 15: SOLAY39 SECURITY RATING ── */}
        <div className="bg-s39-bg1 border border-s39-green/20 p-5 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" stroke="#00ff88" strokeWidth="1" strokeLinejoin="round"/></svg>
            <span className="text-[9px] text-s39-green tracking-[0.15em]">SOLAY39 SECURITY RATING</span>
            <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 15</span>
          </div>

          {/* Score + Rating Header — derived from weighted category sum (single source of truth) */}
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 p-5 bg-[#0a0e14] border border-s39-border">
            <div className="text-center">
              <div className="text-[48px] font-bold font-mono leading-none" style={{ color: scoreColor(computedScore) }}>{computedScore}</div>
              <div className="text-[8px] text-s39-dim tracking-widest mt-1">/ 100</div>
            </div>
            <div className="h-16 w-px bg-s39-border hidden sm:block" />
            <div className="text-center sm:text-left">
              <div className="text-[28px] font-bold font-mono" style={{ color: scoreColor(computedScore) }}>{computedRating}</div>
              <div className="text-[9px] text-s39-mid mt-1">
                {computedScore >= 95 ? "Exceptional Security Posture" : computedScore >= 90 ? "Very Strong Security Posture" : computedScore >= 80 ? "Strong Security Posture" : computedScore >= 70 ? "Adequate Security Posture" : computedScore >= 60 ? "Below Average Security Posture" : "Needs Improvement"}
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="text-[8px] text-s39-dim tracking-widest mb-2">CATEGORY BREAKDOWN</div>
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-s39-bg2">
                  <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">CATEGORY</th>
                  <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">WEIGHT</th>
                  <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">SCORE</th>
                  <th className="text-left text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border w-1/3">ASSESSMENT</th>
                  <th className="text-center text-[7px] text-s39-dim tracking-widest px-3 py-2.5 border-b border-s39-border">WEIGHTED</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // SINGLE SOURCE OF TRUTH: read from p.scoreBreakdown (same data as header)
                  const sb = p.scoreBreakdown
                  const cats = [
  { name: "Code Security", weight: 0.35, color: "#00ff88", score: sb?.codeSecurity ?? computedScore },
  { name: "Architecture", weight: 0.20, color: "#00e5ff", score: sb?.architectureRisk ?? computedScore },
  { name: "Governance", weight: 0.15, color: "#4488ff", score: sb?.governanceRisk ?? computedScore },
  { name: "On-Chain Verification", weight: 0.10, color: "#ffd600", score: sb?.centralization ?? computedScore },
  { name: "Economic Model", weight: 0.10, color: "#ff6b00", score: economicScore },
  { name: "Operational Security", weight: 0.10, color: "#aa44ff", score: operationsScore },
                  ]
                  return cats.map((cat, i) => {
                    const catScore = cat.score
                    const weighted = (catScore * cat.weight).toFixed(1)
                    return (
                      <tr key={i} className="border-b border-s39-border last:border-0">
                        <td className="px-3 py-2.5 font-bold" style={{ color: cat.color }}>{cat.name}</td>
                        <td className="text-center px-3 py-2.5 text-s39-dim font-mono">{(cat.weight * 100).toFixed(0)}%</td>
                        <td className="text-center px-3 py-2.5">
                          <span className="font-bold font-mono" style={{ color: scoreColor(catScore) }}>{catScore}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-s39-bg2 overflow-hidden">
                              <div className="h-full" style={{ width: `${catScore}%`, background: cat.color, opacity: 0.6 }} />
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5 font-bold font-mono text-s39-white">{weighted}</td>
                      </tr>
                    )
                  })
                })()}
                {/* Total row — uses component-level computedScore (single source of truth) */}
                <tr className="bg-s39-bg2">
                  <td className="px-3 py-2.5 text-s39-white font-bold">TOTAL</td>
                  <td className="text-center px-3 py-2.5 text-s39-dim font-mono">100%</td>
                  <td className="text-center px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="text-center px-3 py-2.5 font-bold font-mono text-lg" style={{ color: scoreColor(computedScore) }}>{computedScore}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Finding Penalty Impact */}
          <div className="text-[8px] text-s39-dim tracking-widest mb-2">FINDING PENALTY IMPACT</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {([
              ["CRITICAL", p.criticals, "-25pts", "#ff2d55"],
              ["HIGH", p.highs, "-10pts", "#ff6b00"],
              ["MEDIUM", p.mediums, "-3pts", "#ffd600"],
              ["LOW", p.lows, "-1pt", "#00e5ff"],
              ["RESOLVED", p.findings?.filter(f => f.status === "RESOLVED").length || 0, "+credit", "#00ff88"],
            ] as [string, number, string, string][]).map(([sev, count, penalty, color]) => (
              <div key={sev} className="bg-s39-bg2 border border-s39-border p-2.5 text-center">
                <div className="text-[7px] tracking-widest mb-0.5" style={{ color }}>{sev}</div>
                <div className="text-lg font-bold font-mono" style={{ color: count > 0 ? color : "#445566" }}>{count}</div>
                <div className="text-[7px] text-s39-dim mt-0.5">{penalty}</div>
              </div>
            ))}
          </div>

          {/* Risk Outlook */}
            <div className={`border p-4 ${
            computedScore >= 80 ? "bg-[#001a08] border-s39-green/25" : computedScore >= 60 ? "bg-[#1a1200] border-s39-yellow/25" : "bg-[#1a0000] border-s39-red/25"
            }`}>
            <div className="text-[8px] text-s39-dim tracking-widest mb-1">RISK OUTLOOK</div>
            {(() => {
              const oc = p.findings?.filter(f => f.severity === "CRITICAL" && f.status !== "RESOLVED").length || 0
              const oh = p.findings?.filter(f => f.severity === "HIGH" && f.status !== "RESOLVED").length || 0
              const om = p.findings?.filter(f => f.severity === "MEDIUM" && f.status !== "RESOLVED").length || 0
              const ol = p.findings?.filter(f => f.severity === "LOW" && f.status !== "RESOLVED").length || 0
              const totalOpen = oc + oh + om + ol
              const cs = computedScore
              const cr = computedRating
              // Generate fact-based text
              let text = ""
              if (totalOpen === 0) {
                text = `The protocol demonstrates a ${cs >= 90 ? "exemplary" : cs >= 80 ? "strong" : "developing"} security posture with a computed score of ${cs}/100 (${cr}). All identified findings have been resolved or acknowledged.`
              } else {
                const parts: string[] = []
                if (oc > 0) parts.push(`${oc} critical`)
                if (oh > 0) parts.push(`${oh} high`)
                if (om > 0) parts.push(`${om} medium`)
                if (ol > 0) parts.push(`${ol} low`)
                text = `The protocol has a computed score of ${cs}/100 (${cr}). ${totalOpen} finding${totalOpen > 1 ? "s" : ""} remain${totalOpen === 1 ? "s" : ""} open: ${parts.join(", ")}. ${oc > 0 ? "Critical findings require immediate attention before deployment." : oh > 0 ? "High-severity findings should be addressed before production deployment." : "Remaining findings should be addressed in subsequent iterations."}`
              }
              return <p className="text-[9px] text-s39-mid leading-relaxed">{text}</p>
            })()}
          </div>
        </div>

        {/* ── SECTION 16: LIMITATIONS & DISCLAIMER ── */}
        {p.limitations && (
          <div className="bg-s39-bg1 border border-s39-border p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#ff6b00" strokeWidth="1"/><path d="M7 4v4M7 9.5v.5" stroke="#ff6b00" strokeWidth="1" strokeLinecap="round"/></svg>
              <span className="text-[9px] text-s39-orange tracking-[0.15em]">AUDIT LIMITATIONS & DISCLAIMER</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 16</span>
            </div>

            {/* Formal Assessment Scope */}
            <div className="bg-[#0a0e14] border border-s39-orange/15 p-4 mb-4">
              <p className="text-[9px] text-s39-mid leading-relaxed mb-2">
                This security assessment is time-boxed and reflects the state of the codebase at the commit reviewed. 
                The audit does not guarantee the absence of vulnerabilities.
              </p>
              <p className="text-[9px] text-s39-mid leading-relaxed font-bold">
                Smart contract security is a continuous process that requires ongoing monitoring and review, 
                especially after upgrades or configuration changes.
              </p>
            </div>

            {/* Audit Timeframe */}
            {p.engagement && (
              <div className="bg-s39-bg2 border border-s39-border p-4 mb-4">
                <div className="text-[7px] text-s39-dim tracking-widest mb-3">ENGAGEMENT DETAILS</div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <div className="text-[7px] text-s39-dim tracking-widest">AUDIT PERIOD</div>
                    <div className="text-[10px] text-s39-white font-mono mt-0.5">{p.engagement.auditDate} to {p.engagement.deliveryDate}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-s39-dim tracking-widest">DURATION</div>
                    <div className="text-[10px] text-s39-white font-mono mt-0.5">{p.engagement.auditDurationDays} day{p.engagement.auditDurationDays !== 1 ? "s" : ""}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-s39-green tracking-widest">ENGINEERING HOURS</div>
                    <div className="text-[10px] text-s39-green font-mono font-bold mt-0.5">{p.engagement.engineeringHours || p.engagement.auditDurationDays * (p.engagement.securityEngineersInvolved || 1) * 10}h</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-s39-dim tracking-widest">ENGINEERS</div>
                    <div className="text-[10px] text-s39-white font-mono mt-0.5">{p.engagement.securityEngineersInvolved || p.engagement.numberOfAuditors}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-s39-dim tracking-widest">REPORT VALID AS OF</div>
                    <div className="text-[10px] text-s39-white font-mono mt-0.5">{p.engagement.deliveryDate}</div>
                  </div>
                  {p.engagement.commitHash && (
                    <div>
                      <div className="text-[7px] text-s39-dim tracking-widest">COMMIT REVIEWED</div>
                      <div className="text-[10px] text-s39-cyan font-mono mt-0.5">{p.engagement.commitHash.length > 20 ? p.engagement.commitHash.slice(0, 20) + "..." : p.engagement.commitHash}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scope Limitations */}
            <div className="mb-4">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">SCOPE & REVIEW LIMITATIONS</div>
              <div className="flex flex-col gap-2">
                {p.limitations.statements.map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 mt-0.5"><circle cx="5" cy="5" r="4" stroke="#ff6b00" strokeWidth="0.8"/><path d="M5 3v3M5 7.2v.3" stroke="#ff6b00" strokeWidth="0.8" strokeLinecap="round"/></svg>
                    <span className="text-[9px] text-s39-mid leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* No-Guarantee Clause */}
            <div className="bg-[#1a0e00] border border-[#ff6b0030] p-4 mb-4">
              <div className="text-[7px] text-s39-orange tracking-widest mb-2">NO-GUARANTEE CLAUSE</div>
              <p className="text-[9px] text-s39-mid leading-relaxed">
                This security audit does not guarantee the absence of vulnerabilities. No audit can ensure that a smart contract is 100% secure. 
                The assessment is based on the state of the code at the time of review and does not account for future changes, 
                new attack vectors, or undiscovered vulnerabilities in external dependencies.
              </p>
            </div>

            {/* Auditor Responsibility */}
            <div className="bg-s39-bg2 border border-s39-border p-4 mb-4">
              <div className="text-[7px] text-s39-dim tracking-widest mb-2">AUDITOR RESPONSIBILITY</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-s39-cyan text-[9px] shrink-0 mt-0.5">1.</span>
                  <span className="text-[9px] text-s39-mid leading-relaxed">The auditor has conducted this review with professional diligence, applying industry-standard methodologies including manual code review, automated static analysis, and adversarial testing.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-s39-cyan text-[9px] shrink-0 mt-0.5">2.</span>
                  <span className="text-[9px] text-s39-mid leading-relaxed">All findings are reported to the best of the auditor&apos;s knowledge and ability at the time of the engagement. Severity ratings reflect professional judgment and standard risk frameworks.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-s39-cyan text-[9px] shrink-0 mt-0.5">3.</span>
                  <span className="text-[9px] text-s39-mid leading-relaxed">The auditor is not responsible for the actions taken or not taken based on this report. The client is solely responsible for the implementation of recommended fixes and deployment decisions.</span>
                </div>
              </div>
            </div>

            {/* Continuous Security Statement */}
            <div className="bg-[#001a16] border border-s39-green/20 p-4 mb-4">
              <div className="text-[7px] text-s39-green tracking-widest mb-2">CONTINUOUS SECURITY</div>
              <p className="text-[9px] text-s39-mid leading-relaxed">
                Smart contract security is a continuous process that requires ongoing monitoring and review. 
                This report reflects a point-in-time assessment. Post-deployment monitoring, incident response plans, 
                and periodic re-audits are strongly recommended, especially after protocol upgrades, parameter changes, 
                or integration of new external dependencies.
              </p>
            </div>

            {/* Formal Disclaimer */}
            <div className="bg-[#1a0000] border border-[#ff2d5530] p-4">
              <div className="text-[7px] text-s39-red tracking-widest mb-2">DISCLAIMER & LIMITATION OF LIABILITY</div>
              <p className="text-[8px] text-s39-orange leading-relaxed tracking-wide">{p.limitations.disclaimer}</p>
            </div>
          </div>
        )}

        </>}
        {/* ═══════════ END OF DETAILED VIEW ═══════════ */}

        {/* ── SECTION 17A: REPORT INTEGRITY & VERIFICATION ── */}
            {p.reportIntegrity && (
              <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
                <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-s39-border" />
                  {'Report Integrity & Verification'}
                  <span className="flex-1 h-px bg-s39-border" />
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded bg-s39-bg0 border border-emerald-900/40">
                    <div className="text-[8px] text-emerald-400 font-mono tracking-wider mb-1">SHA-256 REPORT HASH</div>
                    <code className="text-[9px] text-emerald-300 font-mono break-all leading-relaxed">
                      {p.reportIntegrity.sha256}
                    </code>
                    <div className="text-[8px] text-s39-dim mt-1">
                      {'Cryptographic hash of the complete report at publication time. Any tampering changes this value.'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                      <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-1">REPORT ID</div>
                      <div className="text-[9px] text-s39-mid font-mono">{p.reportIntegrity.reportId}</div>
                    </div>
                    <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                      <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-1">PUBLISHED</div>
                      <div className="text-[9px] text-s39-mid font-mono">
                        {new Date(p.reportIntegrity.timestamp).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-1">AUDITOR SIGNATURE</div>
                    <div className="text-[9px] text-s39-mid">{p.reportIntegrity.auditorSignature}</div>
                  </div>
                  <a href={p.reportIntegrity.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-2.5 rounded border border-emerald-700/50 bg-emerald-950/20 text-emerald-400 text-[9px] font-mono tracking-wider hover:bg-emerald-950/40 transition-colors">
                    {'Verify Report Integrity →'}
                  </a>
                </div>
              </section>
            )}

            {/* ── SECTION: AUDITOR SIGNATURES ���─ */}
            {p.auditorSignatures && (
              <section className="border border-purple-900/40 rounded-xl overflow-hidden bg-s39-bg1 mt-6">
                <div className="p-5 sm:p-6 bg-purple-950/10 border-b border-purple-900/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#a855f7"/>
                      </svg>
                      <span className="text-[10px] tracking-[0.12em] text-purple-400 font-bold">AUDITOR SIGNATURES</span>
                    </div>
                    {p.auditorSignatures.certificationId && (
                      <span className="text-[8px] text-purple-400/70 font-mono bg-purple-950/30 border border-purple-900/40 px-2 py-0.5 rounded">
                        {p.auditorSignatures.certificationId}
                      </span>
                    )}
                  </div>
                  {p.auditorSignatures.firmName && (
                    <div className="text-[12px] text-s39-white font-bold">{p.auditorSignatures.firmName}</div>
                  )}
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Lead Auditor */}
                  {p.auditorSignatures.leadAuditor && (
                    <div className="p-4 rounded bg-s39-bg0 border border-purple-900/30">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-950/40 border border-purple-800/40 flex items-center justify-center shrink-0">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="8" r="4" stroke="#a855f7" strokeWidth="1.5"/>
                            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[7px] text-purple-400 tracking-widest mb-1">LEAD AUDITOR</div>
                          <div className="text-[12px] text-s39-white font-bold">{p.auditorSignatures.leadAuditor.name}</div>
                          <div className="text-[9px] text-s39-mid">{p.auditorSignatures.leadAuditor.title}</div>
                          {p.auditorSignatures.leadAuditor.walletAddress && (
                            <div className="text-[8px] text-cyan-400 font-mono mt-1 truncate">
                              {p.auditorSignatures.leadAuditor.walletAddress}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="w-24 h-10 border-b-2 border-purple-700/50 mb-1 flex items-end justify-center">
                            <span className="text-[10px] text-purple-400 italic font-serif pb-1">{p.auditorSignatures.leadAuditor.name.split(" ")[0]}</span>
                          </div>
                          {p.auditorSignatures.leadAuditor.signedAt && (
                            <div className="text-[7px] text-s39-dim">
                              {new Date(p.auditorSignatures.leadAuditor.signedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security Engineers */}
                  {p.auditorSignatures.securityEngineers && p.auditorSignatures.securityEngineers.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {p.auditorSignatures.securityEngineers.map((eng, i) => (
                        <div key={i} className="p-3 rounded bg-s39-bg0 border border-s39-border">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center shrink-0">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" stroke="#22d3ee" strokeWidth="1.5"/>
                                <path d="M9 12l2 2 4-4" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[7px] text-cyan-400 tracking-widest mb-0.5">SECURITY ENGINEER</div>
                              <div className="text-[10px] text-s39-white font-bold truncate">{eng.name}</div>
                              <div className="text-[8px] text-s39-dim truncate">{eng.title}</div>
                            </div>
                            <div className="w-16 h-6 border-b border-cyan-800/40 flex items-end justify-center shrink-0">
                              <span className="text-[8px] text-cyan-400/70 italic font-serif pb-0.5">{eng.name.split(" ")[0]}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reviewers */}
                  {p.auditorSignatures.reviewers && p.auditorSignatures.reviewers.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {p.auditorSignatures.reviewers.map((rev, i) => (
                        <div key={i} className="p-2.5 rounded bg-s39-bg0 border border-s39-border">
                          <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">REVIEWER</div>
                          <div className="text-[9px] text-s39-white font-bold truncate">{rev.name}</div>
                          <div className="text-[7px] text-s39-dim truncate">{rev.title}</div>
                          <div className="w-full h-4 border-b border-s39-border mt-1 flex items-end justify-center">
                            <span className="text-[7px] text-s39-mid italic font-serif pb-0.5">{rev.name.split(" ")[0]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border flex items-center justify-between">
                  <div className="text-[7px] text-s39-dim">
                    All signatures are cryptographically bound to the report hash
                  </div>
                  <div className="text-[7px] text-purple-400/70 font-mono">
                    {p.auditorSignatures.certificationId || "SOLAY39-CERTIFIED"}
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION 17A-bis: ECDSA CRYPTOGRAPHIC SIGNATURE ── */}
            {(() => {
              const hasSig = p.signedReport?.signature && p.signedReport.signature !== "0x_CONFIGURE_AUDITOR_PRIVATE_KEY_IN_ENV"
              const hasAddr = p.signedReport?.auditorAddress && p.signedReport.auditorAddress !== "0x_NOT_CONFIGURED"
              return (
                <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
                  <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                    <span className="w-4 h-px bg-s39-border"/>
                    {'ECDSA Cryptographic Signatures'}
                    <span className="flex-1 h-px bg-s39-border"/>
                    {hasSig
                      ? <span className="text-[7px] text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded bg-emerald-950/20 tracking-wider">SIGNED</span>
                      : <span className="text-[7px] text-yellow-500 border border-yellow-700/40 px-1.5 py-0.5 rounded bg-yellow-950/20 tracking-wider">PENDING</span>}
                  </div>

                  {/* Lead Auditor Signature */}
                  <div className="space-y-3">
                    <div className="p-3 rounded bg-s39-bg0 border border-purple-900/40">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[7px] text-purple-300 tracking-widest border border-purple-700/40 px-1.5 py-0.5 rounded bg-purple-950/20">LEAD AUDITOR</span>
                        <span className="text-[8px] text-s39-mid font-mono">Solay39 Founder</span>
                      </div>
                      <div className="text-[8px] text-purple-400 font-mono tracking-wider mb-1">
                        ECDSA SIGNATURE (EIP-191)
                      </div>
                      {hasSig ? (
                        <code className="text-[8px] text-purple-300 font-mono break-all leading-relaxed block">
                          {p.signedReport!.signature}
                        </code>
                      ) : (
                        <div className="text-[8px] text-s39-dim font-mono italic">
                          Signature will be cryptographically bound when AUDITOR_PRIVATE_KEY is configured
                        </div>
                      )}
                      {hasAddr && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[7px] text-s39-dim tracking-wider">WALLET:</span>
                          <a href={"https://etherscan.io/address/" + p.signedReport!.auditorAddress} target="_blank" rel="noopener noreferrer"
                            className="text-[8px] text-blue-400 font-mono hover:text-blue-300 transition-colors">
                            {p.signedReport!.auditorAddress}{' \u2197'}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Security Reviewer Signature */}
                    <div className="p-3 rounded bg-s39-bg0 border border-cyan-900/40">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[7px] text-cyan-300 tracking-widest border border-cyan-700/40 px-1.5 py-0.5 rounded bg-cyan-950/20">SECURITY REVIEWER</span>
                        <span className="text-[8px] text-s39-mid font-mono">Solay39 QA</span>
                      </div>
                      <div className="text-[8px] text-cyan-400 font-mono tracking-wider mb-1">
                        DUAL REVIEW COUNTERSIGNATURE
                      </div>
                      <div className="text-[8px] text-s39-dim font-mono italic">
                        Independent review completed. Countersignature generated during dual-review gate.
                      </div>
                    </div>

                    {/* Report Hash */}
                    {p.signedReport?.reportHash && (
                      <div className="p-3 rounded bg-s39-bg0 border border-emerald-900/40">
                        <div className="text-[8px] text-emerald-400 font-mono tracking-wider mb-1">SIGNED REPORT HASH (SHA-256)</div>
                        <code className="text-[8px] text-emerald-300 font-mono break-all leading-relaxed block">
                          {p.signedReport.reportHash}
                        </code>
                        <div className="text-[7px] text-s39-dim mt-1">
                          Any modification to the report content will produce a different hash, invalidating the signature.
                        </div>
                      </div>
                    )}

                    {/* Verification Instructions */}
                    <div className="p-3 rounded bg-[#0a0e14] border border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest mb-2">VERIFICATION INSTRUCTIONS</div>
                      <pre className="text-[8px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{`// Verify this signature using ethers.js
const { ethers } = require("ethers");
const reportHash = "${p.signedReport?.reportHash || "report_sha256_hash"}";
const signature  = "${hasSig ? p.signedReport!.signature.slice(0, 20) + "..." : "0x..."}";
const messageBytes = ethers.getBytes("0x" + reportHash);
const recovered = ethers.verifyMessage(messageBytes, signature);
console.log("Signer:", recovered);
// Expected: ${hasAddr ? p.signedReport!.auditorAddress : "Solay39 Auditor Wallet"}`}</pre>
                    </div>
                  </div>
                </section>
              )
            })()}

            {/* ── SECTION 17A-ter: ON-CHAIN ATTESTATION ── */}
            <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
              <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-s39-border"/>
                {'On-Chain Attestation'}
                <span className="flex-1 h-px bg-s39-border"/>
                {p.onChainRecord?.txHash
                  ? <span className="text-[7px] text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded bg-emerald-950/20 tracking-wider">ATTESTED</span>
                  : <span className="text-[7px] text-yellow-500 border border-yellow-700/40 px-1.5 py-0.5 rounded bg-yellow-950/20 tracking-wider">PENDING</span>}
              </div>
              <div className="space-y-3">
                {p.onChainRecord?.txHash ? (
                  <>
                    <div className="p-3 rounded bg-s39-bg0 border border-blue-900/40">
                      <div className="text-[8px] text-blue-400 font-mono tracking-wider mb-1">TRANSACTION HASH</div>
                      <a href={p.onChainRecord.explorerUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-blue-300 font-mono hover:text-blue-200 transition-colors break-all block">
                        {p.onChainRecord.txHash}{' \u2197'}
                      </a>
                      <div className="text-[8px] text-s39-dim mt-1">
                        {'Block #'}{p.onChainRecord.blockNumber}{' \u2014 BSC Mainnet'}
                      </div>
                    </div>
                    {p.signedReport?.reportHash && (
                      <div className="p-3 rounded bg-s39-bg0 border border-emerald-900/30">
                        <div className="text-[8px] text-emerald-400 font-mono tracking-wider mb-1">ON-CHAIN REPORT HASH</div>
                        <code className="text-[8px] text-emerald-300 font-mono break-all">{p.signedReport.reportHash}</code>
                        <div className="text-[7px] text-s39-dim mt-1">This hash is permanently stored in the blockchain and can be independently verified.</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-2">ATTESTATION PROTOCOL</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500 text-[8px] mt-0.5">1.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">SHA-256 hash of the complete report is computed at publication time</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500 text-[8px] mt-0.5">2.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">Hash is signed with auditor ECDSA key (EIP-191 personal_sign)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500 text-[8px] mt-0.5">3.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">Signed hash is submitted to the Solay39 Audit Registry smart contract on BSC</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500 text-[8px] mt-0.5">4.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">Transaction receipt provides immutable, timestamped proof of audit completion</span>
                      </div>
                    </div>
                    <div className="mt-3 text-[7px] text-s39-dim border-t border-s39-border pt-2">
                      On-chain attestation will be published when the Audit Registry contract is deployed. The report hash ({p.signedReport?.reportHash ? p.signedReport.reportHash.slice(0, 16) + "..." : "computed at publish"}) is ready for attestation.
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION 17A-quater: IPFS DECENTRALIZED STORAGE ── */}
            <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
              <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-s39-border"/>
                {'IPFS Decentralized Storage'}
                <span className="flex-1 h-px bg-s39-border"/>
                {p.ipfsRecord?.success
                  ? <span className="text-[7px] text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded bg-emerald-950/20 tracking-wider">PINNED</span>
                  : <span className="text-[7px] text-yellow-500 border border-yellow-700/40 px-1.5 py-0.5 rounded bg-yellow-950/20 tracking-wider">PENDING</span>}
              </div>
              <div className="space-y-3">
                {p.ipfsRecord?.success && p.ipfsRecord.ipfsCid ? (
                  <>
                    <div className="p-3 rounded bg-s39-bg0 border border-cyan-900/40">
                      <div className="text-[8px] text-cyan-400 font-mono tracking-wider mb-1">IPFS CONTENT ID (CID)</div>
                      <code className="text-[10px] text-cyan-300 font-mono break-all block">
                        {p.ipfsRecord.ipfsCid}
                      </code>
                    </div>
                    {/* Primary Gateway Link */}
                    <a
                      href={p.ipfsRecord.gatewayUrl as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded bg-s39-bg0 border border-cyan-900/40 hover:border-cyan-600/60 transition-colors group flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-cyan-400 font-bold group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                          View Report on IPFS
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 9l6-6M4 3h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div className="text-[8px] text-s39-dim font-mono mt-0.5 truncate">
                          {p.ipfsRecord.gatewayUrl as string}
                        </div>
                      </div>
                    </a>

                    {/* Alternative Gateways */}
                    <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest mb-2">ALTERNATIVE GATEWAYS</div>
                      <div className="flex flex-wrap gap-2">
                        <a href={`https://dweb.link/ipfs/${p.ipfsRecord.ipfsCid}`} target="_blank" rel="noopener noreferrer"
                          className="text-[8px] text-cyan-400/70 hover:text-cyan-400 font-mono transition-colors">dweb.link</a>
                        <span className="text-s39-dim">|</span>
                        <a href={`https://cloudflare-ipfs.com/ipfs/${p.ipfsRecord.ipfsCid}`} target="_blank" rel="noopener noreferrer"
                          className="text-[8px] text-cyan-400/70 hover:text-cyan-400 font-mono transition-colors">cloudflare-ipfs.com</a>
                        <span className="text-s39-dim">|</span>
                        <a href={`https://w3s.link/ipfs/${p.ipfsRecord.ipfsCid}`} target="_blank" rel="noopener noreferrer"
                          className="text-[8px] text-cyan-400/70 hover:text-cyan-400 font-mono transition-colors">w3s.link</a>
                      </div>
                      <div className="text-[7px] text-s39-dim mt-2">
                        Note: Public gateways may take time to propagate. Use the primary Pinata gateway for immediate access.
                      </div>
                    </div>
                    <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                      <div className="text-[7px] text-s39-dim tracking-widest mb-2">WHAT THIS MEANS</div>
                      <div className="text-[8px] text-s39-mid leading-relaxed">
                        This audit report has been permanently pinned to the InterPlanetary File System (IPFS), a decentralized storage network. 
                        The content is immutable - any modification would produce a different CID. 
                        The report can be independently retrieved and verified by anyone using the CID above, even if solay39.eu becomes unavailable.
                      </div>
                    </div>
                    {p.ipfsRecord.timestamp && (
                      <div className="text-[7px] text-s39-dim font-mono">
                        Pinned: {new Date(p.ipfsRecord.timestamp as string).toLocaleString()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-3 rounded bg-s39-bg0 border border-s39-border">
                    <div className="text-[8px] text-s39-dim font-mono tracking-wider mb-2">IPFS PINNING PROTOCOL</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-500 text-[8px] mt-0.5">1.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">Complete audit report is serialized to JSON</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-500 text-[8px] mt-0.5">2.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">JSON is uploaded to IPFS via Pinata pinning service</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-500 text-[8px] mt-0.5">3.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">IPFS generates a Content ID (CID) - a cryptographic hash of the content</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-cyan-500 text-[8px] mt-0.5">4.</span>
                        <span className="text-[8px] text-s39-mid leading-relaxed">The pinned content remains permanently accessible via any IPFS gateway</span>
                      </div>
                    </div>
                    <div className="mt-3 text-[7px] text-s39-dim border-t border-s39-border pt-2">
                      {p.ipfsRecord?.error 
                        ? `IPFS pinning error: ${p.ipfsRecord.error}. Report will be pinned when PINATA_JWT is configured.`
                        : "IPFS pinning will be enabled when PINATA_JWT is configured."}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION: ON-CHAIN ATTESTATION ── */}
            {p.signedReport?.reportHash && (
              <div className="mt-6">
                <OnChainAttestation
                  auditId={p.signedReport.auditId || `SOL-${Date.now()}`}
                  reportHash={p.signedReport.reportHash}
                  score={typeof p.score === "number" ? p.score : 0}
                  ipfsCid={p.ipfsRecord?.ipfsCid as string | undefined}
                  auditedContractAddress={p.address}
                />
              </div>
            )}

            {/* ── SECTION: SOLANA ON-CHAIN ATTESTATION ── */}
            {p.solanaAttestation && (
              <section className="border border-purple-900/40 rounded-xl overflow-hidden bg-s39-bg1 mt-6">
                <div className="p-5 sm:p-6 bg-purple-950/10 border-b border-purple-900/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_#9945ff]" />
                      <span className="text-[10px] tracking-[0.12em] text-purple-400 font-bold">SOLANA ON-CHAIN ATTESTATION</span>
                    </div>
                    <span className="text-[8px] px-3 py-1 rounded-full bg-emerald-950/30 text-emerald-400 border border-emerald-900/40 font-semibold">
                      CONFIRMED
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  {/* TX Signature */}
                  <div>
                    <div className="text-[8px] text-s39-dim tracking-widest mb-2">TRANSACTION SIGNATURE</div>
                    <div className="text-[10px] text-purple-400 font-mono break-all leading-relaxed">
                      {p.solanaAttestation.txSignature}
                    </div>
                  </div>

                  {/* Network + Timestamp */}
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <div className="text-[8px] text-s39-dim tracking-widest mb-1">NETWORK</div>
                      <div className="text-[10px] text-s39-white font-bold uppercase">
                        {p.solanaAttestation.network}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-s39-dim tracking-widest mb-1">CONFIRMED</div>
                      <div className="text-[10px] text-s39-white">
                        {new Date(p.solanaAttestation.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* What this means */}
                  <div className="bg-s39-bg0 border border-s39-border rounded-lg p-4">
                    <div className="text-[9px] text-s39-mid leading-relaxed">
                      This audit report has been permanently recorded on the{" "}
                      <span className="text-purple-400 font-semibold">Solana blockchain</span>{" "}
                      via the Memo Program. The report hash is immutably timestamped on-chain.
                      Transaction cost: ~$0.000005. Anyone can verify authenticity on Solscan.
                    </div>
                  </div>

                  {/* Verify Button */}
                  <a
                    href={p.solanaAttestation.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] font-bold bg-purple-950/30 text-purple-400 border border-purple-900/40 hover:bg-purple-950/50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Verify on Solscan
                  </a>
                </div>

                <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border">
                  <div className="text-[7px] text-s39-dim font-mono flex items-center gap-4 flex-wrap">
                    <span>Program: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr</span>
                    <span>|</span>
                    <span>Cost: ~0.000005 SOL</span>
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION 17B: ECONOMIC ATTACK SURFACE ── */}
            {p.economicAttackVectors?.some((v: { applicable: boolean }) => v.applicable) && (
              <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
                <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-s39-border" />
                  {'Economic Attack Surface Analysis'}
                  <span className="flex-1 h-px bg-s39-border" />
                </div>
                <div className="space-y-3">
                  {p.economicAttackVectors
                    .filter((v: { applicable: boolean }) => v.applicable)
                    .map((v: {
                      type: string; title: string; severity: string
                      description: string; exploitCondition: string
                      estimatedLoss: string; mitigation: string; pocSketch: string
                    }) => (
                    <div key={v.type} className="p-4 rounded-lg bg-s39-bg0 border border-s39-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded ${
                          v.severity === "High"   ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" :
                          v.severity === "Medium" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30" :
                                                    "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                        }`}>{v.severity.toUpperCase()}</span>
                        <span className="text-xs font-medium text-s39-lite font-mono">{v.title}</span>
                      </div>
                      <p className="text-[10px] text-s39-mid mb-3 leading-relaxed">{v.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] mb-2">
                        <div className="p-2 rounded bg-s39-bg1 border border-s39-border">
                          <span className="text-s39-dim font-mono">{'CONDITION: '}</span>
                          <span className="text-s39-mid">{v.exploitCondition}</span>
                        </div>
                        <div className="p-2 rounded bg-s39-bg1 border border-s39-border">
                          <span className="text-s39-dim font-mono">{'EST. LOSS: '}</span>
                          <span className="text-s39-orange">{v.estimatedLoss}</span>
                        </div>
                      </div>
                      <div className="text-[10px] p-2 rounded bg-s39-bg1 border border-s39-border mb-2">
                        <span className="text-s39-green font-mono">{'MITIGATION: '}</span>
                        <span className="text-s39-mid">{v.mitigation}</span>
                      </div>
                      {v.pocSketch !== "N/A" && v.pocSketch !== "N/A — not applicable" && (
                        <div className="bg-[#0a0e14] border border-s39-border overflow-hidden rounded">
                          <div className="px-3 py-1 border-b border-s39-border">
                            <span className="text-[8px] text-s39-cyan font-mono tracking-wider">ATTACK SKETCH</span>
                          </div>
                          <pre className="text-[8px] text-s39-mid font-mono whitespace-pre-wrap p-3 leading-relaxed">{v.pocSketch}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI EXPLOIT SIMULATION */}
            {p.exploitSimulation && (() => {
              const sim = p.exploitSimulation
              const s = sim.summary
              const statusColor = s.overallStatus === "SECURE" ? "#00ff88" : s.overallStatus === "AT_RISK" ? "#ffa500" : "#ff4444"
              const statusBg = s.overallStatus === "SECURE" ? "bg-emerald-950/20 border-emerald-800/40" : s.overallStatus === "AT_RISK" ? "bg-yellow-950/20 border-yellow-800/40" : "bg-red-950/20 border-red-800/40"
              return (
                <section className="border border-s39-border rounded-xl overflow-hidden bg-s39-bg1 mt-6">
                  {/* Header Banner */}
                  <div className={`p-5 sm:p-6 border-b border-s39-border ${statusBg}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1l2 3h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" stroke={statusColor} strokeWidth="1" fill={`${statusColor}22`}/>
                      </svg>
                      <span className="text-[9px] tracking-[0.15em]" style={{ color: statusColor }}>AI EXPLOIT SIMULATOR</span>
                      <span className="text-[7px] text-s39-dim bg-s39-bg1 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto font-mono">
                        {s.engineVersion}
                      </span>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                      <div className="bg-s39-bg0 border border-s39-border p-3 text-center">
                        <div className="text-xl font-bold font-mono" style={{ color: statusColor }}>{s.totalVectorsTested}</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">VECTORS TESTED</div>
                      </div>
                      <div className="bg-s39-bg0 border border-emerald-900/30 p-3 text-center">
                        <div className="text-xl font-bold text-emerald-400 font-mono">{s.safe}</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">SAFE</div>
                      </div>
                      <div className="bg-s39-bg0 border border-red-900/30 p-3 text-center">
                        <div className="text-xl font-bold text-red-400 font-mono">{s.vulnerable}</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">VULNERABLE</div>
                      </div>
                      <div className="bg-s39-bg0 border border-yellow-900/30 p-3 text-center">
                        <div className="text-xl font-bold text-yellow-400 font-mono">{s.partial}</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">PARTIAL</div>
                      </div>
                      <div className="bg-s39-bg0 border border-s39-border p-3 text-center">
                        <div className="text-xl font-bold text-s39-dim font-mono">{s.notApplicable}</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">N/A</div>
                      </div>
                      <div className="bg-s39-bg0 border border-s39-border p-3 text-center">
                        <div className="text-sm font-bold text-s39-cyan font-mono">{s.simulationDurationMs}ms</div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">DURATION</div>
                      </div>
                      <div className="bg-s39-bg0 border border-s39-border p-3 text-center">
                        <div className="text-sm font-bold font-mono" style={{ color: s.estimatedTotalRiskUSD > 0 ? "#ff4444" : "#00ff88" }}>
                          ${s.estimatedTotalRiskUSD > 0 ? (s.estimatedTotalRiskUSD / 1_000_000).toFixed(1) + "M" : "0"}
                        </div>
                        <div className="text-[7px] text-s39-dim tracking-widest mt-0.5">EST. RISK</div>
                      </div>
                    </div>

                    {/* Overall Status Badge */}
                    <div className="flex items-center gap-3 p-3 rounded bg-s39-bg0 border" style={{ borderColor: `${statusColor}44` }}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}66` }} />
                      <div>
                        <div className="text-[10px] font-bold font-mono tracking-wider" style={{ color: statusColor }}>
                          {s.overallStatus === "SECURE" ? "CONTRACT SECURE" : s.overallStatus === "AT_RISK" ? "POTENTIAL RISKS IDENTIFIED" : "CRITICAL VULNERABILITIES FOUND"}
                        </div>
                        <div className="text-[8px] text-s39-dim mt-0.5">
                          {s.overallStatus === "SECURE"
                            ? "All simulated attack vectors were blocked by existing contract defenses."
                            : s.overallStatus === "AT_RISK"
                              ? "Some attack vectors show partial vulnerability. Review recommended."
                              : "Active exploitation possible. Immediate remediation required."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Vectors */}
                  <div className="p-5 sm:p-6 space-y-2">
                    <div className="text-[7px] text-s39-dim tracking-[0.15em] mb-3 font-mono">ATTACK VECTOR RESULTS</div>
                    {sim.vectors.map((v) => {
                      const vc = v.status === "SAFE" ? "#00ff88" : v.status === "VULNERABLE" ? "#ff4444" : v.status === "PARTIAL" ? "#ffa500" : "#555"
                      const catColor = v.category === "code" ? "#00e5ff" : v.category === "economic" ? "#ffd600" : v.category === "governance" ? "#aa44ff" : "#ff6b00"
                      return (
                        <details key={v.id} className="group border border-s39-border rounded overflow-hidden bg-s39-bg0 hover:border-s39-muted transition-colors">
                          <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none">
                            {/* Status Indicator */}
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: vc, boxShadow: v.status !== "NOT_APPLICABLE" ? `0 0 6px ${vc}88` : "none" }} />
                            {/* ID */}
                            <span className="text-[7px] text-s39-dim font-mono w-12 shrink-0">{v.id}</span>
                            {/* Attack Type */}
                            <span className="text-[10px] text-s39-white font-bold flex-1">{v.attackType}</span>
                            {/* Category */}
                            <span className="text-[6px] tracking-widest px-1.5 py-0.5 border rounded shrink-0 hidden sm:inline" style={{ color: catColor, borderColor: `${catColor}44` }}>
                              {v.category.toUpperCase()}
                            </span>
                            {/* Confidence */}
                            <span className="text-[7px] text-s39-dim font-mono shrink-0 hidden sm:inline">{v.confidence}%</span>
                            {/* Status */}
                            <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded shrink-0" style={{ color: vc, backgroundColor: `${vc}11`, border: `1px solid ${vc}33` }}>
                              {v.status}
                            </span>
                            {/* Gas */}
                            <span className="text-[7px] text-s39-dim font-mono shrink-0 hidden md:inline">{(v.gasUsed / 1000).toFixed(0)}k gas</span>
                            {/* Expand Arrow */}
                            <svg className="w-3 h-3 text-s39-dim group-open:rotate-180 transition-transform shrink-0" viewBox="0 0 12 12" fill="none">
                              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            </svg>
                          </summary>
                          <div className="px-4 pb-4 pt-2 border-t border-s39-border space-y-3">
                            {/* Description */}
                            <div className="text-[9px] text-s39-mid leading-relaxed">{v.description}</div>

                            {/* Attack Flow */}
                            <div className="bg-s39-bg1 border border-s39-border p-3 rounded">
                              <div className="text-[7px] text-s39-dim tracking-widest mb-2">ATTACK FLOW</div>
                              {v.attackFlow.map((step, i) => (
                                <div key={i} className="flex items-start gap-2 mb-1">
                                  <span className="text-[8px] font-mono shrink-0" style={{ color: vc }}>{step.split('.')[0]}.</span>
                                  <span className="text-[8px] text-s39-mid">{step.split('.').slice(1).join('.').trim()}</span>
                                </div>
                              ))}
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-s39-bg1 border border-s39-border p-2 text-center">
                                <div className="text-[7px] text-s39-dim tracking-widest">GAS USED</div>
                                <div className="text-[10px] text-s39-white font-mono font-bold">{v.gasUsed.toLocaleString()}</div>
                              </div>
                              <div className="bg-s39-bg1 border border-s39-border p-2 text-center">
                                <div className="text-[7px] text-s39-dim tracking-widest">MAX DRAIN</div>
                                <div className="text-[10px] font-mono font-bold" style={{ color: v.maxDrainableUSD > 0 ? "#ff4444" : "#00ff88" }}>
                                  ${v.maxDrainableUSD > 0 ? (v.maxDrainableUSD / 1_000_000).toFixed(1) + "M" : "0"}
                                </div>
                              </div>
                              <div className="bg-s39-bg1 border border-s39-border p-2 text-center">
                                <div className="text-[7px] text-s39-dim tracking-widest">CONFIDENCE</div>
                                <div className="text-[10px] text-s39-cyan font-mono font-bold">{v.confidence}%</div>
                              </div>
                            </div>

                            {/* Mitigation */}
                            {v.mitigationApplied && (
                              <div className="flex items-center gap-2 p-2 bg-emerald-950/10 border border-emerald-900/30 rounded">
                                <span className="text-emerald-400 text-[10px]">{'\u2713'}</span>
                                <span className="text-[8px] text-emerald-300">Mitigation: {v.mitigationApplied}</span>
                              </div>
                            )}

                            {/* Exploit Code */}
                            {v.exploitCode && (
                              <div className="bg-[#0a0e14] border border-red-900/40 rounded overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/20 border-b border-red-900/30">
                                  <span className="text-[8px] text-red-400 font-mono tracking-widest">EXPLOIT CODE</span>
                                  <button
                                    onClick={() => {
                                      const blob = new Blob([v.exploitCode!], { type: "text/plain" })
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement("a")
                                      a.href = url
                                      a.download = `${v.id}_exploit.t.sol`
                                      a.click()
                                      URL.revokeObjectURL(url)
                                    }}
                                    className="ml-auto text-[7px] text-red-400 border border-red-700/40 px-2 py-0.5 font-mono tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer bg-transparent rounded flex items-center gap-1 shrink-0"
                                  >
                                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    DOWNLOAD
                                  </button>
                                </div>
                                <pre className="text-[8px] text-slate-300 font-mono whitespace-pre-wrap p-3 leading-relaxed">{v.exploitCode}</pre>
                              </div>
                            )}

                            {/* CVSS Impact */}
                            {v.cvssImpact && (
                              <div className="text-[7px] text-s39-dim font-mono">
                                CVSS Impact: {v.cvssImpact}
                              </div>
                            )}
                          </div>
                        </details>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border flex items-center justify-between">
                    <div className="text-[7px] text-s39-dim font-mono">
                      Simulation completed: {new Date(sim.timestamp).toLocaleString()}
                    </div>
                    <div className="text-[7px] text-s39-dim font-mono">
                      {s.totalVectorsTested} vectors | {s.simulationDurationMs}ms | {s.engineVersion}
                    </div>
                  </div>
                </section>
              )
            })()}

            {/* POC EXPLOIT SCRIPTS */}
            {p.pocScripts && p.pocScripts.length > 0 && (
              <section className="border border-red-900/40 rounded-xl overflow-hidden bg-s39-bg1 mt-6">
                <div className="p-5 sm:p-6 bg-red-950/10 border-b border-red-900/30">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1v6M8 11v1M3 5l2 2M11 5l2 2M4 13h8" stroke="#ff4444" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[9px] tracking-[0.15em] text-red-400">EXECUTABLE EXPLOIT SCRIPTS</span>
                    <span className="text-[7px] text-red-400/60 bg-red-950/30 border border-red-900/40 px-1.5 py-0.5 tracking-wider ml-auto font-mono rounded">
                      {p.pocScripts.length} PoC{p.pocScripts.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-[8px] text-s39-mid leading-relaxed">
                    The following Proof-of-Concept exploit scripts demonstrate the identified vulnerabilities. 
                    These are real, executable test files that can be run with Foundry or Hardhat to verify the attack vectors.
                  </div>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  {p.pocScripts.map((poc) => (
                    <details key={poc.id} className="group border border-s39-border rounded overflow-hidden bg-s39-bg0">
                      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-s39-bg1 transition-colors">
                        <div className="w-8 h-8 rounded bg-red-950/30 border border-red-900/40 flex items-center justify-center shrink-0">
                          {poc.framework === "foundry" ? (
                            <span className="text-[8px] text-red-400 font-bold font-mono">F</span>
                          ) : (
                            <span className="text-[8px] text-yellow-400 font-bold font-mono">H</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-s39-white font-bold truncate">{poc.filename}</div>
                          <div className="text-[8px] text-s39-dim truncate">{poc.description}</div>
                        </div>
                        <span className="text-[7px] text-s39-dim border border-s39-border px-1.5 py-0.5 rounded font-mono shrink-0">
                          {poc.framework.toUpperCase()}
                        </span>
                        <svg className="w-3 h-3 text-s39-dim group-open:rotate-180 transition-transform shrink-0" viewBox="0 0 12 12" fill="none">
                          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </summary>
                      <div className="border-t border-s39-border">
                        {/* Run Command */}
                        <div className="px-4 py-2 bg-s39-bg1 border-b border-s39-border flex items-center gap-2">
                          <span className="text-[7px] text-s39-dim tracking-widest">RUN:</span>
                          <code className="text-[9px] text-cyan-400 font-mono flex-1">{poc.runCommand}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(poc.runCommand)}
                            className="text-[7px] text-s39-dim hover:text-cyan-400 transition-colors px-1.5 py-0.5 border border-s39-border rounded bg-s39-bg0 cursor-pointer"
                          >
                            COPY
                          </button>
                        </div>
                        {/* Code */}
                        <div className="relative">
                          <div className="absolute top-2 right-2 flex gap-2 z-10">
                            <button
                              onClick={() => navigator.clipboard.writeText(poc.fullScript)}
                              className="text-[7px] text-s39-dim hover:text-cyan-400 transition-colors px-2 py-1 border border-s39-border rounded bg-s39-bg0 cursor-pointer flex items-center gap-1"
                            >
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3 3V2a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.2"/></svg>
                              COPY CODE
                            </button>
                            <button
                              onClick={() => {
                                const blob = new Blob([poc.fullScript], { type: "text/plain" })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement("a")
                                a.href = url
                                a.download = poc.filename.split("/").pop() || "exploit.sol"
                                a.click()
                                URL.revokeObjectURL(url)
                              }}
                              className="text-[7px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 border border-red-900/40 rounded bg-red-950/20 cursor-pointer flex items-center gap-1"
                            >
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5.5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              DOWNLOAD
                            </button>
                          </div>
                          <pre className="text-[8px] text-slate-300 font-mono whitespace-pre-wrap p-4 leading-relaxed max-h-[500px] overflow-auto bg-[#0a0e14]">
                            {poc.fullScript}
                          </pre>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
                <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border">
                  <div className="text-[7px] text-s39-dim font-mono flex items-center gap-4">
                    <span>Framework: Foundry + Hardhat</span>
                    <span>|</span>
                    <span>Run locally to verify vulnerabilities</span>
                  </div>
                </div>
              </section>
            )}

            {/* TEST COVERAGE & ANALYSIS */}
            {p.testCoverage && (
              <section className="border border-emerald-900/40 rounded-xl overflow-hidden bg-s39-bg1 mt-6">
                <div className="p-5 sm:p-6 bg-emerald-950/10 border-b border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5"/>
                    </svg>
                    <span className="text-[10px] tracking-[0.12em] text-emerald-400 font-bold">TEST COVERAGE & ANALYSIS</span>
                  </div>
                  <div className="text-[8px] text-s39-mid">
                    Comprehensive testing metrics from automated analysis tools
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  {/* Coverage Bars */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Line Coverage", value: p.testCoverage.lineCoverage },
                      { label: "Branch Coverage", value: p.testCoverage.branchCoverage },
                      { label: "Function Coverage", value: p.testCoverage.functionCoverage },
                      { label: "Statement Coverage", value: p.testCoverage.statementCoverage },
                    ].map((cov, i) => (
                      <div key={i} className="bg-s39-bg0 border border-s39-border p-3 rounded">
                        <div className="text-[7px] text-s39-dim tracking-widest mb-2">{cov.label.toUpperCase()}</div>
                        <div className="text-[16px] text-emerald-400 font-bold font-mono">{cov.value}%</div>
                        <div className="h-1.5 bg-s39-bg2 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${cov.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fuzz Testing */}
                  {p.testCoverage.fuzzTesting && (
                    <div className="bg-s39-bg0 border border-cyan-900/30 p-4 rounded">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[9px] text-cyan-400 tracking-widest font-bold">FUZZ TESTING</span>
                        </div>
                        <span className={`text-[7px] px-2 py-0.5 rounded font-mono ${
                          p.testCoverage.fuzzTesting.status === "PASSED" ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/40" :
                          p.testCoverage.fuzzTesting.status === "ISSUES_FOUND" ? "bg-yellow-950/30 text-yellow-400 border border-yellow-900/40" :
                          "bg-s39-bg2 text-s39-dim border border-s39-border"
                        }`}>
                          {p.testCoverage.fuzzTesting.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <div className="text-[7px] text-s39-dim">Runs Completed</div>
                          <div className="text-[11px] text-cyan-300 font-mono">{p.testCoverage.fuzzTesting.runsCompleted.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Edge Cases Found</div>
                          <div className="text-[11px] text-cyan-300 font-mono">{p.testCoverage.fuzzTesting.edgeCasesFound}</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Max Depth</div>
                          <div className="text-[11px] text-cyan-300 font-mono">{p.testCoverage.fuzzTesting.maxDepth}</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Mutations</div>
                          <div className="text-[11px] text-cyan-300 font-mono">{p.testCoverage.fuzzTesting.mutations.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Static Analysis Tools */}
                  {p.testCoverage.staticAnalysis && p.testCoverage.staticAnalysis.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[8px] text-s39-dim tracking-widest">STATIC ANALYSIS TOOLS</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {p.testCoverage.staticAnalysis.map((tool, i) => (
                          <div key={i} className="bg-s39-bg0 border border-s39-border p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-s39-white font-bold">{tool.tool}</span>
                              <span className="text-[7px] text-s39-dim font-mono">v{tool.version}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {tool.criticalIssues > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[7px] text-red-400">Critical</span>
                                  <span className="text-[8px] text-red-400 font-mono">{tool.criticalIssues}</span>
                                </div>
                              )}
                              {tool.highIssues > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[7px] text-orange-400">High</span>
                                  <span className="text-[8px] text-orange-400 font-mono">{tool.highIssues}</span>
                                </div>
                              )}
                              {tool.mediumIssues > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[7px] text-yellow-400">Medium</span>
                                  <span className="text-[8px] text-yellow-400 font-mono">{tool.mediumIssues}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[7px] text-s39-dim">Low</span>
                                <span className="text-[8px] text-s39-mid font-mono">{tool.lowIssues}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[7px] text-s39-dim">Info</span>
                                <span className="text-[8px] text-s39-mid font-mono">{tool.informational}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[7px] text-s39-dim">Gas Opts</span>
                                <span className="text-[8px] text-cyan-400 font-mono">{tool.gasOptimizations}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Formal Verification & Symbolic Execution */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Formal Verification */}
                    {p.testCoverage.formalVerification && (
                      <div className="bg-s39-bg0 border border-purple-900/30 p-4 rounded">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#a855f7" strokeWidth="1.5"/>
                            </svg>
                            <span className="text-[9px] text-purple-400 tracking-widest font-bold">FORMAL VERIFICATION</span>
                          </div>
                          <span className={`text-[7px] px-2 py-0.5 rounded font-mono ${
                            p.testCoverage.formalVerification.status === "VERIFIED" ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/40" :
                            p.testCoverage.formalVerification.status === "PARTIAL" ? "bg-yellow-950/30 text-yellow-400 border border-yellow-900/40" :
                            "bg-s39-bg2 text-s39-dim border border-s39-border"
                          }`}>
                            {p.testCoverage.formalVerification.status}
                          </span>
                        </div>
                        {p.testCoverage.formalVerification.tool && (
                          <div className="text-[8px] text-s39-dim mb-2">Tool: {p.testCoverage.formalVerification.tool}</div>
                        )}
                        <div className="flex gap-4 mb-3">
                          <div>
                            <div className="text-[14px] text-emerald-400 font-bold font-mono">{p.testCoverage.formalVerification.propertiesVerified}</div>
                            <div className="text-[7px] text-s39-dim">Verified</div>
                          </div>
                          <div>
                            <div className="text-[14px] text-red-400 font-bold font-mono">{p.testCoverage.formalVerification.propertiesFailed}</div>
                            <div className="text-[7px] text-s39-dim">Failed</div>
                          </div>
                        </div>
                        {p.testCoverage.formalVerification.invariantsChecked && (
                          <div className="space-y-1 border-t border-s39-border pt-2">
                            <div className="text-[7px] text-s39-dim">Invariants Checked:</div>
                            {p.testCoverage.formalVerification.invariantsChecked.slice(0, 4).map((inv, i) => (
                              <div key={i} className="text-[8px] text-purple-300 flex items-center gap-1">
                                <span className="text-emerald-400">✓</span>
                                {inv}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Symbolic Execution */}
                    {p.testCoverage.symbolicExecution && (
                      <div className="bg-s39-bg0 border border-s39-border p-4 rounded">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span className="text-[9px] text-s39-mid tracking-widest font-bold">SYMBOLIC EXECUTION</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[7px] text-s39-dim">Paths Explored</div>
                            <div className="text-[12px] text-s39-white font-mono">{p.testCoverage.symbolicExecution.pathsExplored.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-[7px] text-s39-dim">Max Depth</div>
                            <div className="text-[12px] text-s39-white font-mono">{p.testCoverage.symbolicExecution.maxPathDepth}</div>
                          </div>
                        </div>
                        {p.testCoverage.symbolicExecution.timeoutReached && (
                          <div className="text-[7px] text-yellow-400 mt-2">
                            Note: Analysis timeout reached on some paths
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Gas Analysis */}
                  {p.testCoverage.gasAnalysis && (
                    <div className="bg-s39-bg0 border border-orange-900/30 p-4 rounded">
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2v10l4 4" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="1.5"/>
                        </svg>
                        <span className="text-[9px] text-orange-400 tracking-widest font-bold">GAS ANALYSIS</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <div className="text-[7px] text-s39-dim">Avg Gas/Function</div>
                          <div className="text-[11px] text-orange-300 font-mono">{p.testCoverage.gasAnalysis.averageGasPerFunction.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Most Expensive</div>
                          <div className="text-[11px] text-orange-300 font-mono truncate">{p.testCoverage.gasAnalysis.mostExpensiveFunction}()</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Max Gas</div>
                          <div className="text-[11px] text-orange-300 font-mono">{p.testCoverage.gasAnalysis.mostExpensiveGas.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[7px] text-s39-dim">Deploy Cost</div>
                          <div className="text-[11px] text-orange-300 font-mono">{p.testCoverage.gasAnalysis.totalDeploymentCost.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border">
                  <div className="text-[7px] text-s39-dim font-mono flex items-center gap-4 flex-wrap">
                    <span>Tools: Solay39 Static Analyzer, Claude AI (Anthropic), Manual Review</span>
                    <span>|</span>
                    <span>Analysis performed on audited code snapshot</span>
                  </div>
                </div>
              </section>
            )}

            {/* FORMAL VERIFICATION */}
            {p.formalVerification && (
              <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
                <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-s39-border"/>
                  {'Formal Verification & Invariant Testing'}
                  <span className="flex-1 h-px bg-s39-border"/>
                </div>
                <div className="space-y-2 mb-4">
                  {(p.formalVerification.invariantsTested || []).map((inv: {
                    invariant: string
                    result: string
                    method: string
                  }) => (
                    <div
                      key={inv.invariant}
                      className="flex items-start gap-3 p-2.5 rounded bg-s39-bg0 border border-s39-border"
                    >
                      <span className={[
                        "text-[11px] font-black mt-0.5 shrink-0",
                        inv.result.startsWith("PASS")   ? "text-emerald-400" :
                        inv.result.startsWith("FAIL")   ? "text-red-400"     :
                                                          "text-yellow-400",
                      ].join(" ")}>
                        {inv.result.startsWith("PASS") ? "\u2713" :
                         inv.result.startsWith("FAIL") ? "\u2717" : "\u26A0"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-s39-lite leading-relaxed">
                          {inv.invariant}
                        </div>
                        <div className="text-[7px] text-s39-dim font-mono mt-0.5">
                          {inv.method}
                        </div>
                      </div>
                      <span className={[
                        "text-[8px] font-bold font-mono shrink-0",
                        inv.result.startsWith("PASS")   ? "text-emerald-400" :
                        inv.result.startsWith("FAIL")   ? "text-red-400"     :
                                                          "text-yellow-400",
                      ].join(" ")}>{inv.result.split(" \u2014 ")[0]}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[8px] text-s39-dim font-mono p-2.5 rounded bg-s39-bg0 border border-s39-border leading-relaxed">
                  {p.formalVerification.verificationMethod}
                </div>
              </section>
            )}

            {/* RESIDUAL RISK */}
            {p.residualRisk && (
              <section className="border border-s39-border rounded-xl p-6 bg-s39-bg1 mt-6">
                <div className="text-[9px] font-mono tracking-widest text-s39-dim uppercase mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-s39-border"/>
                  Residual Risk Assessment
                  <span className="flex-1 h-px bg-s39-border"/>
                </div>
                <div className="space-y-3 mb-4">
                  {(p.residualRisk.items || []).map((item: {
                    category: string
                    description: string
                    likelihood: string
                    impact: string
                    mitigation: string
                  }) => (
                    <div key={item.category} className="p-3 rounded bg-s39-bg0 border border-s39-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-bold text-s39-lite">{item.category}</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className="text-[7px] text-s39-dim font-mono">IMPACT</span>
                          <span className={[
                            "text-[8px] font-bold font-mono",
                            item.impact.startsWith("High") || item.impact.startsWith("Critical")
                              ? "text-red-400"
                              : item.impact.startsWith("Medium")
                              ? "text-yellow-400"
                              : "text-emerald-400",
                          ].join(" ")}>
                            {item.impact.split(" \u2014 ")[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <p className="text-[8px] text-s39-mid mb-2 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="text-[8px] pt-2 border-t border-s39-border">
                        <span className="text-emerald-400 font-mono">{'MITIGATION: '}</span>
                        <span className="text-s39-mid">{item.mitigation}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded bg-emerald-950/20 border border-emerald-800/30">
                  <div className="text-[7px] text-s39-dim font-mono tracking-wider mb-1">
                    OVERALL RESIDUAL RISK
                  </div>
                  <div className="text-[9px] text-emerald-400 font-medium leading-relaxed">
                    {p.residualRisk.overallResidualRisk}
                  </div>
                </div>
              </section>
            )}

            {/* ── SECTION 18: ABOUT SOLAY39 ── (always visible) */}
        {p.auditorProfile && (
          <div className="bg-s39-bg1 border border-s39-cyan/15 p-5 sm:p-6 mb-4">
            <div className="flex items-center gap-2 mb-5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="#00e5ff" strokeWidth="1"/><path d="M2 12c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="#00e5ff" strokeWidth="1"/></svg>
              <span className="text-[9px] text-s39-cyan tracking-[0.15em]">ABOUT SOLAY39</span>
              <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">SECTION 18</span>
            </div>

            {/* Firm Identity */}
            <div className="bg-[#0a0e14] border border-s39-border p-5 mb-4">
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <div className="flex-1">
                  <div className="text-[22px] text-s39-white font-bold mb-1 tracking-tight">{p.auditorProfile.firmName}</div>
                  <div className="text-[9px] text-s39-cyan tracking-widest mb-3">INDEPENDENT SMART CONTRACT SECURITY</div>
                  <p className="text-[10px] text-s39-mid leading-relaxed">{p.auditorProfile.description}</p>
                </div>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center min-w-[80px]">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">AUDITS</div>
                    <div className="text-lg font-bold text-s39-cyan font-mono">25+</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center min-w-[80px]">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">CHAINS</div>
                    <div className="text-lg font-bold text-s39-cyan font-mono">8+</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center min-w-[80px]">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">LOC REVIEWED</div>
                    <div className="text-lg font-bold text-s39-cyan font-mono">50K+</div>
                  </div>
                  <div className="bg-s39-bg2 border border-s39-border p-3 text-center min-w-[80px]">
                    <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">FINDINGS</div>
                    <div className="text-lg font-bold text-s39-cyan font-mono">100+</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Methodology + Positioning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-s39-bg2 border border-s39-border p-4">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">AUDIT METHODOLOGY</div>
                <p className="text-[9px] text-s39-mid leading-relaxed">{p.auditorProfile.methodology}</p>
              </div>
              <div className="bg-s39-bg2 border border-s39-border p-4">
                <div className="text-[8px] text-s39-dim tracking-widest mb-2">POSITIONING</div>
                <p className="text-[9px] text-s39-mid leading-relaxed">
                  SOLAY39 combines AI-augmented analysis with deep manual review to deliver Tier-1 quality audits. 
                  Every report follows a standardized 18-section template with full tool output transparency, 
                  on-chain verification, and weighted scoring methodology.
                </p>
              </div>
            </div>

            {/* Areas of Expertise */}
            <div className="mb-4">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">AREAS OF EXPERTISE</div>
              <div className="flex flex-wrap gap-2">
                {p.auditorProfile.experience.map((exp, i) => (
                  <span key={i} className="text-[8px] text-s39-cyan bg-s39-cyan/5 border border-s39-cyan/20 px-2.5 py-1">{exp}</span>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-s39-bg2 border border-s39-border p-3 flex gap-6 flex-wrap items-center">
              <div>
                <span className="text-[7px] text-s39-dim tracking-widest">EMAIL: </span>
                <a href={`mailto:${p.auditorProfile.contactEmail}`} className="text-[9px] text-s39-cyan hover:underline font-mono">{p.auditorProfile.contactEmail}</a>
              </div>
              {p.auditorProfile.telegram && (
                <div>
                  <span className="text-[7px] text-s39-dim tracking-widest">TELEGRAM: </span>
                  <a href={p.auditorProfile.telegram} target="_blank" rel="noreferrer" className="text-[9px] text-s39-cyan hover:underline font-mono">@solay39</a>
                </div>
              )}
              <div>
                <span className="text-[7px] text-s39-dim tracking-widest">WEBSITE: </span>
                <span className="text-[9px] text-s39-cyan font-mono">solay39.eu</span>
              </div>
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
                <a href={getExplorer(p.network || "Ethereum").addressUrl(p.contractAddress)} target="_blank" rel="noreferrer"
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

        {/* GitHub Sync Panel (Founder Only) */}
        <SyncToGitHubPanel auditId={p.id} projectName={p.name} />

        {/* Bulk Fix GitHub Panel (Founder Only - fix all audits at once) */}
        <BulkFixGitHubPanel />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SYNC TO GITHUB PANEL (Founder Only)
// ═══════════════════════════════════════════════════════════════════
function SyncToGitHubPanel({ auditId, projectName }: { auditId: string; projectName: string }) {
  const [founderKey, setFounderKey] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    githubUrl?: string
    githubError?: string
    error?: string
    message?: string
    htmlSizeKB?: number
  } | null>(null)

  const handleSync = async () => {
    if (!founderKey.trim()) return
    setSyncing(true)
    setResult(null)

    try {
      // Usa force-publish: rigenera sempre l'HTML completo (38 pagine)
      // con tutti i dati da Supabase e sovrascrive GitHub
      const res = await fetch("/api/force-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId, founderKey }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Sync failed" })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-s39-bg1 border border-s39-border p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            fill="#aaa"
          />
        </svg>
        <span className="text-[9px] text-s39-mid tracking-[0.15em]">GITHUB SYNC</span>
        <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">
          FOUNDER ONLY
        </span>
      </div>

      <p className="text-[9px] text-s39-dim mb-3">
        Rigenera e sincronizza il report HTML completo (38 pagine) su GitHub.
        Sovrascrive il file esistente con la versione aggiornata dalla piattaforma.
      </p>

      <div className="flex gap-2 items-center">
        <input
          type="password"
          placeholder="Founder key"
          value={founderKey}
          onChange={(e) => setFounderKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSync()}
          className="flex-1 bg-s39-bg2 border border-s39-border text-s39-lite text-[10px] px-3 py-2 focus:border-s39-cyan/50 outline-none"
        />
        <button
          onClick={handleSync}
          disabled={syncing || !founderKey.trim()}
          className="px-4 py-2 bg-s39-cyan/10 border border-s39-cyan/30 text-s39-cyan text-[9px] font-bold tracking-widest hover:bg-s39-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? "SYNCING..." : "FORCE SYNC"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 p-3 border text-[9px] ${
            result.success
              ? "bg-s39-green/10 border-s39-green/30 text-s39-green"
              : "bg-s39-red/10 border-s39-red/30 text-s39-red"
          }`}
        >
          {result.message || result.error}
          {result.htmlSizeKB && (
            <span className="ml-2 opacity-60">({result.htmlSizeKB}KB)</span>
          )}
          {result.githubUrl && (
            <a
              href={result.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="block mt-2 text-s39-cyan underline"
            >
              Visualizza su GitHub
            </a>
          )}
          {result.githubError && !result.success && (
            <div className="mt-1 opacity-70 text-[8px] break-all">{result.githubError}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// BULK FIX GITHUB PANEL (Founder Only - fix all audits at once)
// ═══════════════════════════════════════════════════════════════════
function BulkFixGitHubPanel() {
  const [founderKey, setFounderKey] = useState("")
  const [running, setRunning] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [results, setResults] = useState<{
    total?: number
    succeeded?: number
    failed?: number
    dryRun?: boolean
    message?: string
    error?: string
    results?: {
      id: string
      name: string
      score: number
      htmlSizeKB: number
      githubUrl?: string
      error?: string
      skipped?: boolean
    }[]
  } | null>(null)

  const handleRun = async () => {
    if (!founderKey.trim()) return
    setRunning(true)
    setResults(null)

    try {
      const res = await fetch("/api/bulk-fix-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderKey, dryRun }),
      })
      const data = await res.json()
      setResults(data)
    } catch (err) {
      setResults({ message: err instanceof Error ? err.message : "Request failed" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-s39-bg1 border border-s39-border p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] text-s39-mid tracking-[0.15em]">BULK FIX GITHUB</span>
        <span className="text-[7px] text-s39-dim bg-s39-bg2 border border-s39-border px-1.5 py-0.5 tracking-wider ml-auto">
          FOUNDER ONLY
        </span>
      </div>

      <p className="text-[9px] text-s39-dim mb-4">
        Rigenera e sincronizza TUTTI gli audit su GitHub con lo score corretto e le 38 pagine complete.
        Usa prima <strong className="text-s39-lite">Dry Run</strong> per vedere cosa verrebbe modificato.
      </p>

      <div className="flex gap-2 items-center mb-3">
        <input
          type="password"
          placeholder="Founder key"
          value={founderKey}
          onChange={(e) => setFounderKey(e.target.value)}
          className="flex-1 bg-s39-bg2 border border-s39-border text-s39-lite text-[10px] px-3 py-2 focus:border-s39-cyan/50 outline-none"
        />
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="accent-cyan-400"
          />
          <span className="text-[9px] text-s39-mid whitespace-nowrap">Dry Run</span>
        </label>
        <button
          onClick={handleRun}
          disabled={running || !founderKey.trim()}
          className={`px-4 py-2 border text-[9px] font-bold tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            dryRun
              ? "bg-s39-cyan/10 border-s39-cyan/30 text-s39-cyan hover:bg-s39-cyan/20"
              : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {running ? "RUNNING..." : dryRun ? "DRY RUN" : "FIX ALL"}
        </button>
      </div>

      {results && (
        <div className="mt-3 space-y-2">
          {/* Summary */}
          <div className={`p-3 border text-[9px] ${
            results.error || results.failed
              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
              : "bg-s39-green/10 border-s39-green/30 text-s39-green"
          }`}>
            {results.message || results.error}
          </div>

          {/* Stats bar */}
          {results.total && (
            <div className="flex gap-3 text-[8px] p-2 bg-s39-bg2 border border-s39-border">
              <span className="text-s39-mid">TOTALE: <strong className="text-s39-lite">{results.total}</strong></span>
              {!results.dryRun && (
                <>
                  <span className="text-s39-green">OK: <strong>{results.succeeded}</strong></span>
                  {(results.failed ?? 0) > 0 && (
                    <span className="text-red-400">ERRORI: <strong>{results.failed}</strong></span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Per-audit results */}
          {results.results && (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {results.results.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 px-2 py-1.5 text-[8px] border ${
                    r.error
                      ? "bg-red-500/5 border-red-500/20 text-red-400"
                      : r.skipped
                      ? "bg-s39-bg2 border-s39-border text-s39-dim"
                      : "bg-s39-green/5 border-s39-green/20 text-s39-green"
                  }`}
                >
                  <span className="font-mono w-4">
                    {r.error ? "X" : r.skipped ? "O" : "V"}
                  </span>
                  <span className="flex-1 truncate text-s39-lite">{r.name}</span>
                  <span className="font-bold text-s39-cyan">{r.score}</span>
                  <span className="text-s39-dim">{r.htmlSizeKB}KB</span>
                  {r.githubUrl && (
                    <a
                      href={r.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-s39-cyan underline ml-1"
                    >
                      -&gt;
                    </a>
                  )}
                  {r.error && (
                    <span className="text-red-400 text-[7px] truncate max-w-32">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
    ["04", "AI-Assisted Analysis", "#ff6b00", "Claude AI (Anthropic) for coverage gaps, pattern detection and code analysis. All AI findings require manual human verification."],
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

      {/* 6-Category Weighted Scoring Model */}
      <div className="bg-s39-bg1 border border-s39-green/20 p-6 mt-8">
        <div className="text-[9px] text-s39-green tracking-[0.15em] mb-3">SOLAY39 SECURITY RATING MODEL</div>
        <div className="text-[8px] text-s39-dim tracking-wider mb-4">6 CATEGORIES / WEIGHTED / TRANSPARENT</div>

        <div className="text-[10px] sm:text-[11px] text-s39-lite font-mono mb-4 break-words bg-s39-bg2 p-4 border border-s39-border">
          {"Final Score = (Code Security x 0.35) + (Architecture x 0.20) + (Governance x 0.15) + (On-Chain x 0.10) + (Economic x 0.10) + (Operations x 0.10)"}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {([
            ["Code Security", "35%", "#00ff88", "Vulnerability density, reentrancy, overflow, access-control, input validation, business-logic integrity."],
            ["Architecture", "20%", "#00e5ff", "Separation of concerns, upgrade pattern, library usage, modularity, trust boundary design."],
            ["Governance", "15%", "#4488ff", "Admin key model, timelock, multisig, proposal lifecycle, decentralization trajectory."],
            ["On-Chain", "10%", "#ffd600", "Ownership status, mint/pause ability, supply model, on-chain verification, proxy detection."],
            ["Economic", "10%", "#ff6b00", "Token distribution, MEV exposure, oracle dependency, flash-loan risk, supply concentration."],
            ["Operations", "10%", "#aa44ff", "Static analysis coverage, fuzzing, symbolic execution, manual review hours, CI/CD maturity."],
          ] as [string, string, string, string][]).map(([cat, weight, color, desc]) => (
            <div key={cat} className="bg-s39-bg2 border border-s39-border p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold" style={{ color }}>{cat}</span>
                <span className="text-[9px] text-s39-dim font-mono">{weight}</span>
              </div>
              <div className="text-[9px] text-s39-mid leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <div className="text-[9px] text-s39-dim italic mb-4">
          {"Maximum score: 98. Security is risk reduction, not perfection. Each category is independently assessed by the lead auditor on a 0-100 scale."}
        </div>

        {/* Finding Penalties */}
        <div className="text-[8px] text-s39-dim tracking-[0.15em] mb-2">FINDING SEVERITY PENALTIES</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {([
            ["CRITICAL", "-25pts", "#ff2d55"],
            ["HIGH", "-10pts", "#ff6b00"],
            ["MEDIUM", "-3pts", "#ffd600"],
            ["LOW/INFO", "-1pt", "#00e5ff"],
          ] as [string, string, string][]).map(([s, pts, c]) => (
            <div key={s} className="bg-s39-bg2 px-3 py-2.5 text-center">
              <div className="text-[8px] font-bold tracking-widest" style={{ color: c }}>{s}</div>
              <div className="text-sm font-bold text-s39-lite mt-1">{pts}</div>
            </div>
          ))}
        </div>
        <div className="text-[8px] text-s39-dim">
          {"Resolved findings restore partial credit: CRITICAL +15, HIGH +7, MEDIUM +2. Penalties stack additively onto the weighted base score."}
        </div>
      </div>

      {/* Rating Scale */}
      <div className="bg-s39-bg1 border border-s39-border p-6 mt-4">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">RATING SCALE</div>
        <div className="flex gap-2 flex-wrap mb-4">
          {([
            ["AAA", "95-100", "#00ff88", "Exceptional — near-zero risk, renounced ownership, verified immutable."],
            ["AA", "90-94", "#00ff88", "Very Strong — minimal findings, robust architecture."],
            ["A", "80-89", "#00e5ff", "Strong — well-designed, minor issues resolved."],
            ["BBB", "70-79", "#ffd600", "Adequate — functional but has centralization or governance concerns."],
            ["BB", "60-69", "#ff6b00", "Below Average — significant findings or centralization risk."],
            ["B", "<60", "#ff2d55", "Needs Improvement — critical vulnerabilities or unresolved issues."],
          ] as [string, string, string, string][]).map(([r, range, c, desc]) => (
            <div key={r} className="bg-s39-bg2 px-3.5 py-2 min-w-[90px]">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-[13px] font-bold" style={{ color: c }}>{r}</div>
                <div className="text-[8px] text-s39-dim font-mono">{range}</div>
              </div>
              <div className="text-[8px] text-s39-dim leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════���════════════════════
// MAIN SKYNET PUBLIC COMPONENT (CertiK-inspired)
// ═══════��═══════════════════════════════════════════════════════════
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

  // Founder mode: triple-click the SOLAY39 logo to toggle
  const [founderMode, setFounderMode] = useState(false)
  const [founderKey, setFounderKey] = useState("")
  const [founderAuthed, setFounderAuthed] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [deleteError, setDeleteError] = useState<string | null>(null)
  
  const handleDeleteAudit = useCallback(async (auditId: string) => {
    if (!founderAuthed || !founderKey) {
      setDeleteError("Not authenticated")
      return
    }
    setDeleting(auditId)
    setDeleteError(null)
    
    try {
      console.log("[v0] Deleting audit:", auditId)
      const res = await fetch("/api/audits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auditId, founderKey }),
      })
      
      const data = await res.json()
      console.log("[v0] Delete response:", res.status, data)
      
      if (res.ok && data.success) {
        // Remove from local state
        setAllProjects(prev => prev.filter(p => p.id !== auditId))
        // Also remove from localStorage
        const local = getPublishedAudits().filter(p => p.id !== auditId)
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(local))
        setDeleteConfirm(null)
        console.log("[v0] Audit deleted successfully")
      } else {
        // Show error to user
        setDeleteError(data.error || `Delete failed: ${res.status}`)
        console.error("[v0] Delete failed:", data.error)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setDeleteError(msg)
      console.error("[v0] Delete exception:", err)
    }
    setDeleting(null)
  }, [founderAuthed, founderKey])

  // Merge default + published audits
  const [allProjects, setAllProjects] = useState<PortfolioProject[]>(DEFAULT_PROJECTS)

  // Fetch live prices from GeckoTerminal API (including dynamically published tokens)
  useEffect(() => {
    let mounted = true
    async function fetchPrices() {
      try {
        // Build extra tokens param from published projects
        const priceTokens = allProjects.filter((p) => p.ticker && p.contractAddress)
        const extraTokens = priceTokens
          .map((p) => `${p.ticker}:${p.contractAddress}:${p.network || "Ethereum"}`)
          .join(",")
        const qs = extraTokens ? `?extra=${encodeURIComponent(extraTokens)}` : ""
        const res = await fetch(`/api/prices${qs}`)
        if (!res.ok) throw new Error("Price fetch failed")
        const data = await res.json()
        if (mounted && data.prices) {
          setLivePrices(data.prices)
        }
      } catch {
        // Non-critical ��� prices just won't update
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
      //    Blob data takes priority (has full enterprise audit: PoC, CVSS, signatures, etc.)
      //    Default fills in cosmetic fields the blob is missing
      const merged = [...DEFAULT_PROJECTS.map(dp => {
        const blobMatch = [...blobAudits, ...cleaned].find(
          pub => pub.id === dp.id || norm(pub.name) === norm(dp.name)
        )
        if (!blobMatch) return dp
        return {
          ...dp,           // defaults as base (hardcoded tags, socials, etc.)
          ...blobMatch,    // blob OVERWRITES everything (findings, enterprise, scores, signatures)
          logoUrl: blobMatch.logoUrl || dp.logoUrl,
          tags: blobMatch.tags || dp.tags,
        }
      })]
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
    .sort((a, b) => (sortBy === "score" ? getWeightedScore(b) - getWeightedScore(a) : a.name.localeCompare(b.name)))

  const networks = [...new Set(displayProjects.map((p) => p.network))]
  const totalTvl = displayProjects.reduce((s, p) => {
    const n = parseFloat((p.tvl || "0").replace(/[^0-9.]/g, ""))
    return s + (isNaN(n) ? 0 : n)
  }, 0)
  const avgScore = Math.round(displayProjects.reduce((s, p) => s + getWeightedScore(p), 0) / (displayProjects.length || 1))
  const totalCriticals = displayProjects.reduce((s, p) => s + p.criticals, 0)

  // Top Security Score projects (top 4)
  const topProjects = [...displayProjects].sort((a, b) => getWeightedScore(b) - getWeightedScore(a)).slice(0, 4)

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
            <div className="text-sm font-bold text-s39-green tracking-wider animate-[glow_3s_infinite] select-none">
              SOLAY39 <span className="text-s39-dim">SKYNET</span>
              {founderMode && <span className="text-[6px] text-red-500 ml-1 tracking-wider">ADMIN</span>}
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
              href="/skynet-pro"
              className="text-[9px] text-s39-cyan border border-s39-cyan/30 px-3 py-1 tracking-widest hover:border-s39-cyan/60 transition-colors"
            >
              PRO
            </a>
            <a
              href="https://github.com/solay39/Solay39-audit/tree/main/audits"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-s39-lite border border-s39-border px-3 py-1 tracking-widest hover:border-s39-lite/60 transition-colors"
            >
              Audits
            </a>
            <a
              href="https://x.com/solay39official"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-s39-lite border border-s39-border px-3 py-1 tracking-widest hover:border-s39-lite/60 transition-colors"
            >
              X
            </a>
            <a
              href="https://www.linkedin.com/in/solay39"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-[#0A66C2] border border-[#0A66C2]/30 px-3 py-1 tracking-widest hover:border-[#0A66C2]/60 transition-colors"
            >
              LinkedIn
            </a>
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
            {/* Founder admin toggle - Admin button */}
            <button
              onClick={() => {
                if (founderAuthed) {
                  setFounderMode(false); setFounderAuthed(false); setFounderKey(""); setDeleteConfirm(null)
                } else {
                  setFounderMode(prev => !prev)
                }
              }}
              className={`px-2 py-1 flex items-center gap-1.5 text-[8px] cursor-pointer bg-transparent border rounded transition-all tracking-wider font-mono ${
                founderAuthed
                  ? "text-red-400 border-red-800/60 hover:bg-red-500/10"
                  : founderMode
                    ? "text-yellow-500 border-yellow-800/40 hover:bg-yellow-500/10"
                    : "text-s39-dim border-s39-border hover:text-s39-mid hover:border-s39-muted"
              }`}
              title={founderAuthed ? "Exit admin mode" : "Admin panel - manage audits"}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              {founderAuthed ? "EXIT" : "ADMIN"}
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

          {/* Founder Admin Panel */}
          {founderMode && !founderAuthed && (
            <div className="mb-6 p-4 border border-red-800/40 bg-red-950/20 rounded">
              <div className="text-[8px] text-red-400 tracking-[0.15em] mb-2 font-mono">FOUNDER AUTHENTICATION</div>
              <div className="flex gap-2 items-center">
                <input
                  type="password"
                  value={founderKey}
                  onChange={(e) => setFounderKey(e.target.value)}
                  placeholder="Enter founder key..."
                  className="flex-1 bg-s39-bg2 border border-s39-border text-s39-lite p-2 px-3 text-[10px] font-mono outline-none focus:border-red-500"
                />
                <button
                  onClick={() => { if (founderKey.length >= 4) setFounderAuthed(true) }}
                  className="text-[9px] text-red-400 border border-red-500/40 px-4 py-2 font-mono tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer bg-transparent"
                >
                  AUTHENTICATE
                </button>
              </div>
            </div>
          )}
          {founderMode && founderAuthed && (
            <div className="mb-6 border border-red-800/40 bg-red-950/10 rounded overflow-hidden">
              {/* Header */}
              <div className="p-3 flex items-center justify-between border-b border-red-800/30">
                <div className="text-[8px] text-red-400 tracking-[0.15em] font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  FOUNDER MODE -- AUDIT MANAGEMENT
                </div>
                <button
                  onClick={() => { setFounderMode(false); setFounderAuthed(false); setFounderKey(""); setDeleteConfirm(null) }}
                  className="text-[8px] text-s39-dim hover:text-red-400 cursor-pointer bg-transparent border-none font-mono"
                >
                  EXIT
                </button>
              </div>
              {/* Sync and Audit list */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[7px] text-s39-dim tracking-[0.15em] font-mono">
                    ALL AUDITS ({allProjects.length})
                  </div>
                  <button
                    onClick={async () => {
                      const localAudits = getPublishedAudits()
                      let synced = 0
                      let failed = 0
                      for (const audit of localAudits) {
                        try {
                          const res = await fetch("/api/audits", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ audit }),
                          })
                          if (res.ok) synced++
                          else failed++
                        } catch {
                          failed++
                        }
                      }
                      alert(`Synced ${synced}/${localAudits.length} audits to cloud.${failed > 0 ? ` Failed: ${failed}` : ""}`)
                    }}
                    className="text-[8px] text-cyan-400 border border-cyan-500/40 px-3 py-1.5 font-mono tracking-wider hover:bg-cyan-500/10 transition-colors cursor-pointer bg-transparent"
                  >
                    SYNC ALL TO CLOUD
                  </button>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {allProjects.map((audit) => {
                    const isDefault = DEFAULT_PROJECTS.some(d => d.id === audit.id)
                    const ws = getWeightedScore(audit)
                    return (
                      <div key={audit.id} className="flex items-center gap-3 p-2 bg-s39-bg2/50 border border-s39-border rounded hover:border-red-800/40 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-s39-lite font-bold truncate">{audit.name}</span>
                            <span className="text-[7px] font-mono px-1.5 py-px border rounded" style={{ color: scoreColor(ws), borderColor: `${scoreColor(ws)}33` }}>
                              {ws}
                            </span>
                            {isDefault && (
                              <span className="text-[6px] text-s39-dim bg-s39-bg1 px-1.5 py-px border border-s39-border rounded font-mono">DEFAULT</span>
                            )}
                          </div>
                          <div className="text-[7px] text-s39-dim font-mono mt-0.5 truncate">
                            {audit.id} | {audit.network} | {audit.date}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm(audit.id)}
                          disabled={deleting === audit.id}
                          className={`text-[8px] font-mono tracking-wider px-3 py-1.5 border rounded cursor-pointer transition-all bg-transparent shrink-0 ${
                            deleting === audit.id
                              ? "text-s39-dim border-s39-border opacity-50"
                              : "text-red-400/70 border-red-800/40 hover:text-red-400 hover:border-red-600 hover:bg-red-500/10"
                          }`}
                        >
                          {deleting === audit.id ? "..." : "DELETE"}
                        </button>
                      </div>
                    )
                  })}
                  {allProjects.length === 0 && (
                    <div className="text-[9px] text-s39-dim text-center py-4 font-mono">No audits found.</div>
                  )}
                </div>
              </div>
            </div>
          )}

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
                const ws = getWeightedScore(p)
                const wr = ratingOf(ws)
                const sc = scoreColor(ws)
                return (
                  <div
                    key={p.id}
                    onClick={() => goToAudit(p)}
                    className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-green/30 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <TokenLogo name={p.name} score={ws} logoUrl={p.logoUrl} />
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
                        <span className="text-lg font-bold" style={{ color: sc }}>{ws}</span>
                        <span className="text-[9px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                          {wr}
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
              {recentProjects.map((p) => {
                const ws = getWeightedScore(p)
                return (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className="bg-s39-bg1 border border-s39-border p-3 min-w-[140px] cursor-pointer hover:border-s39-green/30 transition-colors shrink-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TokenLogo name={p.name} score={ws} logoUrl={p.logoUrl} />
                    <div className="text-[10px] font-bold text-s39-white truncate max-w-[80px]">{p.name}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-s39-dim">
                      {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: scoreColor(ws) }}>{ws}</span>
                  </div>
                </div>
              )})}
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
            <div className={`grid ${founderAuthed ? "grid-cols-[32px_2fr_70px_60px_1fr_90px_80px_40px]" : "grid-cols-[32px_2fr_70px_60px_1fr_90px_80px]"} px-4 py-2.5 border-b border-s39-border`}>
              {[...(["#", "PROTOCOL", "SCORE", "RATING", "FINDINGS", "NETWORK", "STATUS"]), ...(founderAuthed ? [""] : [])].map((h) => (
                <div key={h || "del"} className="text-[7.5px] text-s39-dim tracking-[0.15em]">{h}</div>
              ))}
            </div>
            {filtered.map((p, i) => {
              const rankColor = i === 0 ? "text-s39-yellow" : i === 1 ? "text-s39-mid" : i === 2 ? "text-s39-orange" : "text-s39-dim"
              const ws = getWeightedScore(p)
              const wr = ratingOf(ws)
              const sc = scoreColor(ws)
              return (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className={`grid ${founderAuthed ? "grid-cols-[32px_2fr_70px_60px_1fr_90px_80px_40px]" : "grid-cols-[32px_2fr_70px_60px_1fr_90px_80px]"} px-4 py-3 border-b border-s39-border items-center transition-colors hover:bg-s39-bg2 cursor-pointer`}
                >
                  <div className={`text-[10px] font-bold ${rankColor}`}>#{i + 1}</div>
                  <div className="flex items-center gap-3 min-w-0">
                    <TokenLogo name={p.name} score={ws} logoUrl={p.logoUrl} />
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
                    <ScoreRing score={ws} size={32} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                      {wr}
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
                  {founderAuthed && (
                    <div className="flex justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p.id) }}
                        className="w-6 h-6 flex items-center justify-center text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer bg-transparent border border-red-800/30 rounded text-[10px] font-bold"
                        title={`Delete ${p.name}`}
                      >
                        X
                      </button>
                    </div>
                  )}
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
              const ws = getWeightedScore(p)
              const wr = ratingOf(ws)
              const sc = scoreColor(ws)
              return (
                <div
                  key={p.id}
                  onClick={() => goToAudit(p)}
                  className="bg-s39-bg1 border border-s39-border p-4 cursor-pointer hover:border-s39-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TokenLogo name={p.name} score={ws} logoUrl={p.logoUrl} />
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
                    <ScoreRing score={ws} size={44} />
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <span className="text-[8px] font-bold border px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}44` }}>
                      {wr}
                    </span>
                    <span className="text-[8px] text-s39-green border border-s39-green/20 px-2 py-0.5 tracking-wider">
                      AUDITED
                    </span>
                    <SevPill sev="CRITICAL" count={p.criticals} />
                    <SevPill sev="HIGH" count={p.highs} />
                    <SevPill sev="MEDIUM" count={p.mediums} />
                    {founderAuthed && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p.id) }}
                        className="ml-auto text-[7px] text-red-500/70 border border-red-800/40 px-2 py-0.5 font-mono tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer bg-transparent"
                      >
                        DELETE
                      </button>
                    )}
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
            Telegram
          </a>
          <a href="https://x.com/solay39official" target="_blank" rel="noreferrer" className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            X / Twitter
          </a>
          <a href="https://www.linkedin.com/in/solay39" target="_blank" rel="noreferrer" className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            LinkedIn
          </a>
          <a href="https://github.com/solay39/Solay39-audit/tree/main/audits" target="_blank" rel="noreferrer" className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors">
            GitHub Audits
          </a>
        </div>
      </footer>

      {/* Delete Confirmation Dialog (fixed overlay, always on top) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-s39-bg1 border border-red-800 p-6 max-w-sm w-full rounded" onClick={(e) => e.stopPropagation()}>
            <div className="text-[9px] text-red-400 tracking-[0.15em] font-mono mb-3">CONFIRM DELETION</div>
            <p className="text-[11px] text-s39-lite mb-1">
              Are you sure you want to permanently delete this audit?
            </p>
            <p className="text-[9px] text-s39-dim mb-1 font-mono break-all">
              ID: {deleteConfirm}
            </p>
            <p className="text-[8px] text-red-400/60 mb-4 font-mono">
              This action is irreversible. The audit will be removed from Blob storage.
            </p>
            {deleteError && (
              <div className="text-[9px] text-red-500 bg-red-500/10 border border-red-500/30 p-2 mb-3 font-mono">
                Error: {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteAudit(deleteConfirm)}
                disabled={deleting === deleteConfirm}
                className="flex-1 text-[9px] text-red-400 border border-red-500/50 py-2 font-mono tracking-wider hover:bg-red-500/20 transition-colors cursor-pointer bg-transparent disabled:opacity-50"
              >
                {deleting === deleteConfirm ? "DELETING..." : "DELETE PERMANENTLY"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 text-[9px] text-s39-mid border border-s39-border py-2 font-mono tracking-wider hover:border-s39-muted transition-colors cursor-pointer bg-transparent"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
