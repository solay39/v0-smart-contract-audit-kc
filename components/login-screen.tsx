"use client"

import { useState } from "react"
import {
  FOUNDER_EMAIL,
  FOUNDER_PASS,
  PUB_EMAIL,
  TG_URL,
  DEFAULT_PROJECTS,
  scoreColor,
  ratingOf,
  getWeightedScore,
} from "@/lib/solay39-constants"
import { ScoreRing, S39Input, S39Btn } from "@/components/solay39-ui"

// ─── Network Badge color map ────────────────────────────────────
const CHAIN_COLORS: Record<string, string> = {
  Ethereum: "#627eea",
  BSC: "#f3ba2f",
  Polygon: "#8247e5",
  Arbitrum: "#28a0f0",
  Optimism: "#ff0420",
  Solana: "#14f195",
  Avalanche: "#e84142",
  Base: "#0052ff",
}

export function LoginScreen({
  onFounder,
  onGuest,
}: {
  onFounder: () => void
  onGuest: () => void
}) {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [err, setErr] = useState("")

  const login = () => {
    if (email === FOUNDER_EMAIL && pass === FOUNDER_PASS) {
      onFounder()
    } else {
      setErr("Invalid credentials.")
    }
  }

  // Sort projects by score descending for the leaderboard
  const leaderboard = [...DEFAULT_PROJECTS].sort((a, b) => b.score - a.score)

  return (
    <main className="min-h-dvh bg-s39-bg0 text-s39-lite">

      {/* ══════════════ TOP NAV BAR ══════════════ */}
      <nav className="sticky top-0 z-40 bg-s39-bg0/90 backdrop-blur-md border-b border-s39-border">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="19" viewBox="0 0 40 48" fill="none">
              <path d="M20 2L4 10v14c0 11.2 6.8 21.6 16 24 9.2-2.4 16-12.8 16-24V10L20 2z"
                stroke="#00ff88" strokeWidth="2" fill="#00ff8808" />
              <path d="M16 24l4 4 8-10" stroke="#00ff88" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] text-s39-green font-bold tracking-wider">SOLAY39</span>
            <span className="text-[8px] text-s39-dim tracking-widest hidden sm:inline">SECURITY RATING</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onGuest}
              className="text-[9px] text-s39-mid tracking-wider hover:text-s39-white transition-colors bg-transparent border-none cursor-pointer font-mono"
            >
              View Ratings
            </button>
            <button
              onClick={() => setShowLogin(true)}
              className="text-[9px] text-s39-green tracking-wider font-bold border border-s39-green/30 bg-s39-green/5 px-3 py-1.5 hover:bg-s39-green/10 transition-colors cursor-pointer font-mono"
            >
              Founder Access
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO ══════════════ */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 sm:pt-28 sm:pb-20 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div className="relative z-10 animate-[fadeUp_0.6s_ease]">
          {/* Shield icon */}
          <div className="flex justify-center mb-5">
            <svg width="40" height="48" viewBox="0 0 40 48" fill="none">
              <path d="M20 2L4 10v14c0 11.2 6.8 21.6 16 24 9.2-2.4 16-12.8 16-24V10L20 2z"
                stroke="#00ff88" strokeWidth="1.5" fill="#00ff8808" />
              <path d="M16 24l4 4 8-10" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-s39-green tracking-wider animate-[glow_3s_infinite] mb-3">
            SOLAY39
          </h1>
          <p className="text-[9px] sm:text-[10px] text-s39-dim tracking-[0.25em] uppercase mb-6">
            Security Rating
          </p>

          <h2 className="text-base sm:text-xl text-s39-white font-bold tracking-wide mb-3 max-w-lg mx-auto text-balance">
            The independent security standard for Web3
          </h2>
          <p className="text-[10px] sm:text-[11px] text-s39-mid max-w-md mx-auto leading-relaxed mb-8">
            Manual-first audit framework with AI-powered verification.
            Securing protocols through deep human review and a transparent,
            penalty-based scoring model.
          </p>

          <div className="flex items-center gap-3 justify-center flex-wrap">
            <S39Btn primary onClick={onGuest}>
              View Ratings
            </S39Btn>
            <S39Btn onClick={() => window.location.href = `mailto:${PUB_EMAIL}?subject=Audit%20Request`}>
              Request an Audit
            </S39Btn>
          </div>
        </div>
      </section>

      {/* ══════════════ TRUST BAR ══════════════ */}
      <section className="border-y border-s39-border bg-s39-bg1 py-4 px-4 animate-[fadeUp_0.8s_ease]">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
          <div className="text-[7px] text-s39-dim tracking-[0.2em] uppercase shrink-0">
            Protocols Secured
          </div>
          {leaderboard.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              {p.logoUrl ? (
                <img src={p.logoUrl} alt="" width={18} height={18} className="opacity-70" />
              ) : (
                <div className="w-[18px] h-[18px] bg-s39-bg2 border border-s39-border flex items-center justify-center text-[7px] text-s39-dim font-bold">
                  {p.ticker?.[0] || p.name[0]}
                </div>
              )}
              <span className="text-[9px] text-s39-mid tracking-wider font-bold">{p.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ LEADERBOARD ══════════════ */}
      <section className="max-w-4xl mx-auto px-4 py-14 sm:py-20 animate-[fadeUp_0.9s_ease]">
        <div className="text-center mb-8">
          <div className="text-[8px] text-s39-green tracking-[0.2em] uppercase mb-2">Security Leaderboard</div>
          <h3 className="text-lg sm:text-2xl text-s39-white font-bold tracking-wide text-balance">
            Top Secured Protocols
          </h3>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-s39-bg1 border border-s39-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_60px_60px] sm:grid-cols-[50px_1fr_100px_100px_80px_80px] items-center gap-2 px-4 py-2.5 bg-s39-bg2 border-b border-s39-border text-[7px] sm:text-[8px] text-s39-dim tracking-[0.15em]">
            <span>#</span>
            <span>PROTOCOL</span>
            <span className="text-center">CHAIN</span>
            <span className="text-center">RATING</span>
            <span className="text-center">SCORE</span>
            <span className="text-center">FINDINGS</span>
          </div>

          {/* Rows */}
          {leaderboard.map((p, idx) => {
            const ws = getWeightedScore(p)
            const wr = ratingOf(ws)
            const sc = scoreColor(ws)
            const chainColor = CHAIN_COLORS[p.network] || "#7a8c9e"
            const totalFindings = p.criticals + p.highs + p.mediums + p.lows + p.infos
            return (
              <button
                key={p.id}
                onClick={onGuest}
                className="w-full grid grid-cols-[40px_1fr_80px_80px_60px_60px] sm:grid-cols-[50px_1fr_100px_100px_80px_80px] items-center gap-2 px-4 py-3 border-b border-s39-border last:border-0 bg-transparent hover:bg-s39-bg2/60 transition-colors cursor-pointer text-left"
              >
                {/* Rank */}
                <span className="text-[10px] text-s39-dim font-bold">{idx + 1}</span>

                {/* Name + Ticker */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt="" width={24} height={24} className="shrink-0" />
                  ) : (
                    <div className="w-6 h-6 bg-s39-bg2 border border-s39-border flex items-center justify-center text-[8px] text-s39-dim font-bold shrink-0">
                      {p.ticker?.[0] || p.name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-[11px] text-s39-white font-bold truncate">{p.name}</div>
                    {p.ticker && <div className="text-[8px] text-s39-dim">{p.ticker}</div>}
                  </div>
                </div>

                {/* Chain */}
                <div className="flex justify-center">
                  <span
                    className="text-[8px] font-bold px-2 py-0.5 border tracking-wider"
                    style={{ color: chainColor, borderColor: `${chainColor}40`, background: `${chainColor}08` }}
                  >
                    {p.network}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex justify-center">
                  <span
                    className="text-[12px] sm:text-[13px] font-bold tracking-widest"
                    style={{ color: sc }}
                  >
                    {wr}
                  </span>
                </div>

                {/* Score */}
                <div className="flex justify-center">
                  <span className="text-[12px] sm:text-[13px] font-bold font-mono" style={{ color: sc }}>
                    {ws}
                  </span>
                </div>

                {/* Findings */}
                <div className="flex justify-center gap-1">
                  {p.criticals > 0 && <span className="text-[8px] text-s39-red font-bold">{p.criticals}C</span>}
                  {p.highs > 0 && <span className="text-[8px] text-s39-orange font-bold">{p.highs}H</span>}
                  {(p.criticals === 0 && p.highs === 0) && (
                    <span className="text-[8px] text-s39-green font-bold">Clean</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="text-center mt-4">
          <button
            onClick={onGuest}
            className="text-[9px] text-s39-dim hover:text-s39-green transition-colors cursor-pointer bg-transparent border-none font-mono tracking-wider"
          >
            {"View all audit reports ->"}
          </button>
        </div>
      </section>

      {/* ══════════════ METHODOLOGY ══════════════ */}
      <section className="border-t border-s39-border bg-s39-bg1 py-14 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[8px] text-s39-cyan tracking-[0.2em] uppercase mb-2">Scoring Model</div>
            <h3 className="text-lg sm:text-2xl text-s39-white font-bold tracking-wide text-balance">
              How the SOLAY39 Rating Works
            </h3>
            <p className="text-[10px] text-s39-mid mt-2 max-w-lg mx-auto leading-relaxed">
              Penalty-based scoring across 6 weighted categories.
              Each starts at 100, with deductions for real vulnerabilities found.
            </p>
          </div>

          {/* 6 Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {([
              ["Code Security", "35%", "#00ff88", "Vulnerability density, reentrancy, overflow, access control, input validation."],
              ["Architecture", "20%", "#00e5ff", "Separation of concerns, upgrade pattern, library usage, modularity."],
              ["Governance", "15%", "#4488ff", "Admin key model, timelock, multisig, decentralization trajectory."],
              ["On-Chain", "10%", "#ffd600", "Ownership status, mint/pause, supply model, on-chain verification."],
              ["Economic", "10%", "#ff6b00", "Token distribution, MEV exposure, oracle dependency, flash-loan risk."],
              ["Operations", "10%", "#aa44ff", "Static analysis, fuzzing, manual review hours, CI/CD maturity."],
            ] as [string, string, string, string][]).map(([cat, weight, color, desc]) => (
              <div key={cat} className="bg-s39-bg2 border border-s39-border p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold" style={{ color }}>{cat}</span>
                  <span className="text-[9px] text-s39-dim font-mono">{weight}</span>
                </div>
                <p className="text-[9px] text-s39-mid leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Formula */}
          <div className="bg-s39-bg0 border border-s39-green/20 p-4 text-center">
            <div className="text-[10px] text-s39-lite font-mono break-words leading-relaxed">
              {"Final = (Code x 0.35) + (Arch x 0.20) + (Gov x 0.15) + (OnChain x 0.10) + (Econ x 0.10) + (Ops x 0.10)"}
            </div>
          </div>

          {/* Rating Scale */}
          <div className="flex gap-2 flex-wrap justify-center mt-6">
            {([
              ["AAA", "95+", "#00ff88"],
              ["AA", "90-94", "#00ff88"],
              ["A", "80-89", "#00e5ff"],
              ["BBB", "70-79", "#ffd600"],
              ["BB", "60-69", "#ff6b00"],
              ["B", "<60", "#ff2d55"],
            ] as [string, string, string][]).map(([r, range, c]) => (
              <div key={r} className="bg-s39-bg2 border border-s39-border px-4 py-2.5 text-center min-w-[72px]">
                <div className="text-[14px] font-bold" style={{ color: c }}>{r}</div>
                <div className="text-[8px] text-s39-dim">{range}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HOW TO GET RATED ══════════════ */}
      <section className="max-w-4xl mx-auto px-4 py-14 sm:py-20">
        <div className="text-center mb-10">
          <div className="text-[8px] text-s39-green tracking-[0.2em] uppercase mb-2">Process</div>
          <h3 className="text-lg sm:text-2xl text-s39-white font-bold tracking-wide text-balance">
            How to Get Your SOLAY39 Rating
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {([
            ["01", "Request", "Submit your protocol for audit via email or Telegram. We assess scope and timeline."],
            ["02", "Audit", "Manual line-by-line code review with static analysis (Slither, Echidna) and AI-guided verification."],
            ["03", "Report", "Receive a comprehensive Tier-1 security assessment with findings, risk model, and remediation guidance."],
            ["04", "Rating", "Your SOLAY39 Security Rating is published on our public leaderboard with full transparency."],
          ] as [string, string, string][]).map(([num, title, desc]) => (
            <div key={num} className="bg-s39-bg1 border border-s39-border p-5 relative">
              <div className="text-[28px] font-bold text-s39-green/10 absolute top-3 right-4">{num}</div>
              <div className="text-[11px] text-s39-white font-bold mb-2">{title}</div>
              <p className="text-[9px] text-s39-mid leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ CTA ══════════════ */}
      <section className="border-t border-s39-border bg-s39-bg1 py-14 sm:py-20 px-4 text-center">
        <div className="max-w-lg mx-auto">
          <h3 className="text-lg sm:text-2xl text-s39-white font-bold tracking-wide mb-3 text-balance">
            Secure Your Protocol
          </h3>
          <p className="text-[10px] text-s39-mid mb-6 leading-relaxed">
            Join the protocols that chose transparency over trust.
            Get your independent SOLAY39 Security Rating.
          </p>
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <S39Btn primary onClick={() => window.location.href = `mailto:${PUB_EMAIL}?subject=Audit%20Request`}>
              Request Your Audit
            </S39Btn>
            <S39Btn onClick={onGuest}>
              View All Ratings
            </S39Btn>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="border-t border-s39-border bg-s39-bg0 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-s39-green font-bold tracking-wider">SOLAY39</span>
            <span className="text-[8px] text-s39-dim tracking-widest">SECURITY RATING</span>
          </div>

          <div className="flex items-center gap-5 flex-wrap justify-center">
            <a
              href={`mailto:${PUB_EMAIL}`}
              className="text-[8px] text-s39-dim tracking-widest hover:text-s39-mid transition-colors"
            >
              {PUB_EMAIL}
            </a>
            <a
              href={TG_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[8px] text-s39-dim tracking-widest hover:text-s39-mid transition-colors"
            >
              Telegram
            </a>
            <button
              onClick={() => setShowLogin(true)}
              className="text-[9px] text-s39-green/70 hover:text-s39-green transition-colors cursor-pointer bg-transparent border border-s39-green/20 px-2.5 py-1 font-mono tracking-wider"
            >
              Founder Access
            </button>
          </div>
        </div>
      </footer>

      {/* ══════════════ FOUNDER LOGIN MODAL ══════════════ */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-s39-bg0/90 backdrop-blur-sm px-4">
          <div className="bg-s39-bg1 border border-s39-border p-6 sm:p-8 w-full max-w-[360px] animate-[fadeUp_0.3s_ease] relative">
            <button
              onClick={() => { setShowLogin(false); setErr("") }}
              className="absolute top-3 right-3 text-s39-dim hover:text-s39-white transition-colors bg-transparent border-none cursor-pointer text-lg leading-none"
              aria-label="Close"
            >
              x
            </button>
            <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-5">
              FOUNDER ACCESS
            </div>
            <S39Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@solay39.com"
              type="email"
            />
            <S39Input
              label="Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••••"
              type="password"
            />
            {err && <div className="text-s39-red text-[9px] mb-2.5">{err}</div>}
            <S39Btn primary onClick={login} className="w-full">
              Access Workspace
            </S39Btn>
          </div>
        </div>
      )}
    </main>
  )
}
