"use client"

import { useState } from "react"
import {
  PUB_EMAIL,
  TG_URL,
  DEMO_PROJECTS,
  scoreColor,
  scoreColorClass,
  type DemoProject,
} from "@/lib/solay39-constants"
import { ScoreRing, S39Btn } from "@/components/solay39-ui"

// ── Project Detail View ──────────────────────────────────────────
function ProjectDetail({
  p,
  onBack,
}: {
  p: DemoProject
  onBack: () => void
}) {
  const sc = scoreColor(p.score)

  return (
    <div className="min-h-dvh bg-s39-bg0 px-4 py-8 max-w-[900px] mx-auto">
      <button
        onClick={onBack}
        className="bg-transparent border-none text-s39-mid font-mono text-[10px] cursor-pointer mb-6 tracking-widest hover:text-s39-green transition-colors"
      >
        {"<- BACK TO PORTFOLIO"}
      </button>

      <div className="flex gap-8 items-start mb-9 flex-col sm:flex-row">
        <ScoreRing score={p.score} size={120} />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-s39-white mb-2">{p.name}</h1>
          <div className="text-[9px] text-s39-mid mb-3">
            {p.network} / {p.date}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[8px] text-s39-green border border-s39-green/30 px-2.5 py-0.5 tracking-widest">
              AUDITED
            </span>
            <span
              className="text-[8px] border px-2.5 py-0.5"
              style={{ color: sc, borderColor: `${sc}44` }}
            >
              {p.rating}
            </span>
            {p.criticals === 0 && (
              <span className="text-[8px] text-s39-green border border-s39-green/20 px-2.5 py-0.5">
                0 Criticals
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-s39-bg1 border border-s39-border p-6 mb-4">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">SCORE BREAKDOWN</div>
        {[
          ["Code Security", Math.min(100, p.score + 2), "35%", "#00ff88"],
          ["Architecture Risk", p.score, "25%", "#00e5ff"],
          ["Governance Risk", Math.max(0, p.score - 8), "20%", "#4488ff"],
          ["Centralization", Math.max(0, p.score - 12), "10%", "#ffd600"],
          ["Testing Coverage", Math.min(100, p.score + 1), "10%", "#7a8c9e"],
        ].map(([name, score, weight, color]) => (
          <div key={name as string} className="mb-2.5">
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-s39-mid">{name as string}</span>
              <span style={{ color: color as string }}>
                {score as number}/100{" "}
                <span className="text-s39-dim">({weight as string})</span>
              </span>
            </div>
            <div className="h-[3px] bg-s39-bg2 rounded-sm">
              <div
                className="h-full rounded-sm transition-[width] duration-1000 ease-out"
                style={{
                  width: `${score as number}%`,
                  background: color as string,
                  boxShadow: `0 0 6px ${color}66`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Findings Summary */}
      <div className="bg-s39-bg1 border border-s39-border p-6">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">FINDINGS SUMMARY</div>
        <div className="flex gap-4">
          {(
            [
              ["CRITICAL", p.criticals, "#ff2d55"],
              ["HIGH", p.highs, "#ff6b00"],
              ["MEDIUM", 0, "#ffd600"],
              ["LOW", 0, "#00e5ff"],
            ] as [string, number, string][]
          ).map(([s, n, c]) => (
            <div key={s} className="text-center">
              <div
                className="text-xl font-bold"
                style={{ color: n > 0 ? c : "#445566" }}
              >
                {n}
              </div>
              <div className="text-[7px] text-s39-dim tracking-widest">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Methodology Page ─────────────────────────────────────────────
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
        <div
          key={n}
          className="flex gap-5 mb-5 bg-s39-bg1 border border-s39-border p-5 sm:p-6"
        >
          <div
            className="text-2xl font-bold opacity-30 leading-none shrink-0 w-9"
            style={{ color: c }}
          >
            {n}
          </div>
          <div>
            <div className="text-[12px] font-bold mb-1.5" style={{ color: c }}>
              {t}
            </div>
            <div className="text-[10px] text-s39-mid leading-relaxed">{d}</div>
          </div>
        </div>
      ))}

      {/* Score Formula */}
      <div className="bg-s39-bg1 border border-s39-green/20 p-6 mt-8">
        <div className="text-[9px] text-s39-green tracking-[0.15em] mb-3">
          TRANSPARENT SCORE FORMULA
        </div>
        <div className="text-[10px] sm:text-[11px] text-s39-lite font-mono mb-4 break-words">
          {"Score = 100 - (Critical x 25) - (High x 10) - (Medium x 3) - CentralizationRisk - GovernancePenalty + CoverageBonus"}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              ["CRITICAL", "-25pts", "#ff2d55"],
              ["HIGH", "-10pts", "#ff6b00"],
              ["MEDIUM", "-3pts", "#ffd600"],
              ["LOW/INFO", "-0pts", "#00e5ff"],
            ] as [string, string, string][]
          ).map(([s, p, c]) => (
            <div key={s} className="bg-s39-bg2 px-3 py-2.5 text-center">
              <div
                className="text-[8px] font-bold tracking-widest"
                style={{ color: c }}
              >
                {s}
              </div>
              <div className="text-sm font-bold text-s39-lite mt-1">{p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Scale */}
      <div className="bg-s39-bg1 border border-s39-border p-6 mt-4">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3">RATING SCALE</div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["AAA", "95-100", "#00ff88"],
              ["AA", "90-94", "#00ff88"],
              ["A", "80-89", "#00e5ff"],
              ["BBB", "70-79", "#ffd600"],
              ["BB", "60-69", "#ff6b00"],
              ["B", "<60", "#ff2d55"],
            ] as [string, string, string][]
          ).map(([r, range, c]) => (
            <div
              key={r}
              className="bg-s39-bg2 px-3.5 py-2 text-center min-w-[70px]"
            >
              <div className="text-[13px] font-bold" style={{ color: c }}>
                {r}
              </div>
              <div className="text-[8px] text-s39-dim">{range}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Skynet Public Component ─────────────────────────────────
export function SkynetPublic({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"portfolio" | "methodology">("portfolio")
  const [search, setSearch] = useState("")
  const [net, setNet] = useState("all")
  const [sortBy, setSortBy] = useState("score")
  const [detail, setDetail] = useState<DemoProject | null>(null)

  const filtered = DEMO_PROJECTS.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase())
  )
    .filter((p) => net === "all" || p.network === net)
    .sort((a, b) =>
      sortBy === "score" ? b.score - a.score : a.name.localeCompare(b.name)
    )

  const networks = [...new Set(DEMO_PROJECTS.map((p) => p.network))]

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
            <a
              href={`mailto:${PUB_EMAIL}`}
              className="hidden sm:inline-block text-[9px] text-s39-mid border border-s39-border px-3 py-1 tracking-widest hover:text-s39-lite transition-colors"
            >
              Email
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
          </div>
        </div>
        {/* Mobile tabs */}
        <div className="sm:hidden flex border-t border-s39-border">
          {(["portfolio", "methodology"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[9px] tracking-[0.12em] uppercase cursor-pointer bg-transparent border-none font-mono transition-colors ${
                tab === t
                  ? "text-s39-green border-b-2 border-s39-green"
                  : "text-s39-mid"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {tab === "portfolio" && (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero */}
          <div className="text-center mb-10 sm:mb-14 animate-[fadeUp_0.6s_ease]">
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

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 sm:mb-10">
            {(
              [
                ["$128.4M", "TVL Secured", "text-s39-green"],
                ["23", "Audits Completed", "text-s39-cyan"],
                ["14", "Criticals Found", "text-s39-red"],
                ["91", "Average Score", "text-s39-yellow"],
              ] as [string, string, string][]
            ).map(([v, l, c]) => (
              <div
                key={l}
                className="bg-s39-bg1 border border-s39-border p-4 text-center hover:border-s39-muted transition-colors"
              >
                <div className={`text-xl sm:text-2xl font-bold leading-none ${c}`}>
                  {v}
                </div>
                <div className="text-[8px] text-s39-dim tracking-[0.12em] mt-1 uppercase">
                  {l}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2.5 mb-4 items-center flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search protocol..."
              className="flex-1 min-w-[160px] max-w-[220px] bg-s39-bg2 border border-s39-border text-s39-lite p-1.5 px-3 text-[10px] font-mono outline-none focus:border-s39-green transition-colors"
            />
            <select
              value={net}
              onChange={(e) => setNet(e.target.value)}
              className="bg-s39-bg2 border border-s39-border text-s39-mid p-1.5 px-3 text-[10px] font-mono outline-none"
            >
              <option value="all">All Networks</option>
              {networks.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
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
            <div className="grid grid-cols-[40px_2fr_100px_80px_80px_90px_90px] px-4 py-2 border-b border-s39-border">
              {["#", "PROTOCOL", "SCORE", "RATING", "CRITICALS", "NETWORK", "STATUS"].map(
                (h) => (
                  <div
                    key={h}
                    className="text-[7.5px] text-s39-dim tracking-[0.15em]"
                  >
                    {h}
                  </div>
                )
              )}
            </div>
            {filtered.map((p, i) => {
              const rankColor =
                i === 0
                  ? "text-s39-yellow"
                  : i === 1
                  ? "text-s39-mid"
                  : i === 2
                  ? "text-s39-orange"
                  : "text-s39-dim"
              const sc = scoreColor(p.score)
              return (
                <div
                  key={p.id}
                  onClick={() => setDetail(p)}
                  className="grid grid-cols-[40px_2fr_100px_80px_80px_90px_90px] px-4 py-3 border-b border-s39-border items-center transition-colors hover:bg-s39-bg2 cursor-pointer"
                >
                  <div className={`text-[10px] font-bold ${rankColor}`}>
                    #{i + 1}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-s39-white">
                      {p.name}
                    </div>
                    <div className="text-[8px] text-s39-dim mt-0.5">
                      {p.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreRing score={p.score} size={36} />
                  </div>
                  <div>
                    <span
                      className="text-[9px] font-bold border px-2 py-0.5"
                      style={{ color: sc, borderColor: `${sc}44` }}
                    >
                      {p.rating}
                    </span>
                  </div>
                  <div
                    className={`text-[10px] ${
                      p.criticals > 0 ? "text-s39-red" : "text-s39-dim"
                    }`}
                  >
                    {p.criticals > 0 ? `! ${p.criticals}` : "0"}
                  </div>
                  <div className="text-[9px] text-s39-mid">{p.network}</div>
                  <div>
                    <span className="text-[8px] text-s39-green border border-s39-green/20 px-2 py-0.5 tracking-wider">
                      AUDITED
                    </span>
                  </div>
                </div>
              )
            })}
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
                    <div>
                      <div className="text-[11px] font-bold text-s39-white">
                        #{i + 1} {p.name}
                      </div>
                      <div className="text-[8px] text-s39-dim mt-0.5">
                        {p.network} / {p.date}
                      </div>
                    </div>
                    <ScoreRing score={p.score} size={48} />
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span
                      className="text-[8px] font-bold border px-2 py-0.5"
                      style={{ color: sc, borderColor: `${sc}44` }}
                    >
                      {p.rating}
                    </span>
                    <span className="text-[8px] text-s39-green border border-s39-green/20 px-2 py-0.5 tracking-wider">
                      AUDITED
                    </span>
                    {p.criticals > 0 && (
                      <span className="text-[8px] text-s39-red">
                        {p.criticals} Critical(s)
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === "methodology" && <MethodologyPage />}

      {/* Footer */}
      <footer className="border-t border-s39-border px-6 py-8 text-center mt-10">
        <div className="text-[8px] text-s39-dim tracking-[0.15em]">
          SOLAY39 &copy; 2025 — SMART CONTRACT SECURITY
        </div>
        <div className="flex gap-6 justify-center mt-3 flex-wrap">
          <a
            href={`mailto:${PUB_EMAIL}`}
            className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors"
          >
            {PUB_EMAIL}
          </a>
          <a
            href={TG_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[9px] text-s39-mid hover:text-s39-lite transition-colors"
          >
            t.me/Solay39audit
          </a>
        </div>
      </footer>
    </div>
  )
}
