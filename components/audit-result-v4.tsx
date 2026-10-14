"use client"

/**
 * SOLAY39 — Audit Result v4.0
 * Ultra-detailed report display: Flash Loan Scenarios, MEV Exposure,
 * Score Breakdown by 6 categories, Historical Exploit Context, Architecture Recommendations
 * Designed to visually surpass CertiK, Hacken, Cyfrin reports
 */

import { useState } from "react"
import { ScoreRing, SevBadge } from "@/components/solay39-ui"
import { scoreColor, ratingOf } from "@/lib/solay39-constants"

// ── Types ─────────────────────────────────────────────────────────

interface Finding {
  id?: number
  title: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  location: string
  description: string
  impact: string
  recommendation: string
  likelihood?: string
  proofOfConcept?: string
  historicalContext?: string | null
  remediationExample?: string | null
  cvss?: { score: number; severity: string; vectorString: string }
  foundryPoC?: string
}

interface FlashLoanScenario {
  scenario: string
  borrowAmount: string
  profitEstimate: string
  steps: string[]
  prerequisites: string[]
  mitigation: string
  exploitable: boolean
}

interface MEVExposure {
  function: string
  attackType: string
  maxExtractableValue: string
  protected: boolean
  description: string
}

interface ScoreBreakdownAI {
  codeSecurity: number
  accessControl: number
  economicSafety: number
  upgradeSafety: number
  operationalMaturity: number
  dependencyHealth: number
  deductions: Array<{ category: string; reason: string; points: number }>
}

interface AuditResultV4Props {
  findings: Finding[]
  score: number
  scoreBreakdown?: {
    finalScore: number
    breakdown?: Record<string, number>
  }
  scoreBreakdownAI?: ScoreBreakdownAI | null
  flashLoanScenarios?: FlashLoanScenario[]
  mevExposure?: MEVExposure[]
  architectureRecommendations?: string[]
  architectureOverview?: string
  privilegedRoles?: Array<{ role: string; capabilities: string; riskIfCompromised: string; controlMechanism?: string }>
  trustAssumptions?: Array<{ statement: string }>
  attackSurface?: Array<{ title: string; type: string; description: string; likelihood: string; estimatedImpact?: string; mitigated: boolean }>
  governanceSecurity?: Record<string, unknown>
  upgradeabilityAnalysis?: Record<string, unknown>
  economicRisks?: Array<{ title: string; category: string; description: string; severity: string; quantifiedImpact?: string; mitigation?: string }>
  integrationRisks?: Array<{ dependency: string; riskType: string; description: string; severity: string }>
  invariantsChecked?: Array<{ invariant: string; holds: boolean; evidence: string }>
  formalVerification?: { tool: string; invariants: Array<{ id: string; property: string; description: string; status: string; method: string }> }
  residualRisk?: { level: string; items: Array<{ category: string; description: string; likelihood: string; mitigation: string }>; statement: string }
  testingMethodology?: Record<string, unknown>
  aiEngagement?: Record<string, unknown>
  aiScopeTable?: Array<{ contract: string; linesOfCode: number; language: string }>
  signedReport?: { reportHash: string; publicKey?: string }
}

// ── Tab config ─────────────────────────────────────────────────────

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "findings",      label: "Findings" },
  { id: "flashloan",     label: "Flash Loan" },
  { id: "mev",           label: "MEV" },
  { id: "score",         label: "Score Breakdown" },
  { id: "architecture",  label: "Architecture" },
  { id: "threat",        label: "Threat Model" },
  { id: "formal",        label: "Formal Verification" },
  { id: "methodology",   label: "Methodology" },
]

// ── Colours ─────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ff2222",
  HIGH:     "#ff6600",
  MEDIUM:   "#ffcc00",
  LOW:      "#00aaff",
  INFO:     "#4a5568",
}

const SEV_BG: Record<string, string> = {
  CRITICAL: "#2a0808",
  HIGH:     "#2a1400",
  MEDIUM:   "#2a2200",
  LOW:      "#08182a",
  INFO:     "#0c0f14",
}

// ── Sub-components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-s39-green tracking-[3px] font-mono uppercase">{title}</span>
        <div className="flex-1 h-px bg-s39-border" />
      </div>
      {children}
    </div>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-s39-surface border border-s39-border rounded p-4 ${className}`}>
      {children}
    </div>
  )
}

function ScorePill({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const color = pct >= 80 ? "#00ff88" : pct >= 60 ? "#ffcc00" : pct >= 40 ? "#ff9900" : "#ff4444"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-s39-muted font-mono tracking-wide">{label}</span>
        <span className="text-[12px] font-bold font-mono" style={{ color }}>{value}</span>
      </div>
      <div className="h-[3px] bg-s39-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function FindingCard({ f, index }: { f: Finding; index: number }) {
  const [open, setOpen] = useState(false)
  const color = SEV_COLORS[f.severity] || "#4a5568"
  const bg    = SEV_BG[f.severity]    || "#0c0f14"
  const idStr = f.id ? `${f.severity[0]}-${String(f.id).padStart(2, "0")}` : `${f.severity[0]}-${String(index + 1).padStart(2, "0")}`

  return (
    <div
      className="border rounded mb-3 overflow-hidden transition-all"
      style={{ borderColor: `${color}40`, background: bg }}
    >
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-white/5"
        onClick={() => setOpen(o => !o)}
      >
        <span
          className="text-[10px] font-bold font-mono px-2 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {idStr}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-s39-text">{f.title}</span>
            {f.cvss && (
              <span className="text-[10px] font-mono text-s39-muted">
                CVSS {f.cvss.score.toFixed(1)}
              </span>
            )}
            {f.likelihood && (
              <span className="text-[10px] font-mono" style={{ color }}>
                ↑ {f.likelihood} likelihood
              </span>
            )}
          </div>
          <div className="text-[11px] text-s39-muted font-mono mt-0.5">{f.location}</div>
          {f.historicalContext && (
            <div className="text-[11px] mt-1 px-2 py-0.5 rounded" style={{ background: "#2a1a00", color: "#ffaa44", border: "1px solid #3a2a00" }}>
              ⚡ {f.historicalContext}
            </div>
          )}
        </div>
        <span className="text-s39-muted text-[12px] shrink-0">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: `${color}20` }}>
          <div>
            <div className="text-[10px] text-s39-muted tracking-widest mb-1">DESCRIPTION</div>
            <p className="text-[12px] text-s39-text leading-relaxed">{f.description}</p>
          </div>
          <div>
            <div className="text-[10px] text-s39-muted tracking-widest mb-1">IMPACT</div>
            <p className="text-[12px] leading-relaxed" style={{ color }}>{f.impact}</p>
          </div>
          <div>
            <div className="text-[10px] text-s39-muted tracking-widest mb-1">RECOMMENDATION</div>
            <p className="text-[12px] text-s39-text leading-relaxed">{f.recommendation}</p>
          </div>
          {f.proofOfConcept && (
            <div>
              <div className="text-[10px] text-s39-muted tracking-widest mb-1">PROOF OF CONCEPT</div>
              <pre className="text-[11px] bg-s39-bg p-3 rounded overflow-x-auto font-mono text-s39-green leading-relaxed whitespace-pre-wrap">
                {f.proofOfConcept}
              </pre>
            </div>
          )}
          {f.remediationExample && (
            <div>
              <div className="text-[10px] text-s39-muted tracking-widest mb-1">REMEDIATION EXAMPLE</div>
              <pre className="text-[11px] bg-s39-bg p-3 rounded overflow-x-auto font-mono text-emerald-400 leading-relaxed whitespace-pre-wrap">
                {f.remediationExample}
              </pre>
            </div>
          )}
          {f.cvss && (
            <div className="flex gap-4 text-[11px] font-mono">
              <span className="text-s39-muted">CVSS Score: <span style={{ color }}>{f.cvss.score.toFixed(1)}</span></span>
              <span className="text-s39-muted">Vector: <span className="text-s39-text">{f.cvss.vectorString}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────

export function AuditResultV4({
  findings = [],
  score,
  scoreBreakdown,
  scoreBreakdownAI,
  flashLoanScenarios = [],
  mevExposure = [],
  architectureRecommendations = [],
  architectureOverview,
  privilegedRoles = [],
  trustAssumptions = [],
  attackSurface = [],
  governanceSecurity,
  upgradeabilityAnalysis,
  economicRisks = [],
  integrationRisks = [],
  invariantsChecked = [],
  formalVerification,
  residualRisk,
  testingMethodology,
  aiEngagement,
  aiScopeTable = [],
  signedReport,
}: AuditResultV4Props) {
  const [tab, setTab] = useState("overview")

  const finalScore = scoreBreakdown?.finalScore ?? score ?? 0
  const rating     = ratingOf(finalScore)

  const critCount = findings.filter(f => f.severity === "CRITICAL").length
  const highCount  = findings.filter(f => f.severity === "HIGH").length
  const medCount   = findings.filter(f => f.severity === "MEDIUM").length
  const lowCount   = findings.filter(f => f.severity === "LOW").length
  const infoCount  = findings.filter(f => f.severity === "INFO").length

  const exploitableFL = flashLoanScenarios.filter(fl => fl.exploitable).length
  const unprotectedMEV = mevExposure.filter(m => !m.protected).length

  return (
    <div className="font-mono">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Score ring */}
        <div className="flex flex-col items-center justify-center bg-s39-surface border border-s39-border rounded p-5 min-w-[140px]">
          <ScoreRing score={finalScore} size={100} />
          <div className="text-[18px] font-bold mt-2" style={{ color: scoreColor(finalScore) }}>
            {rating}
          </div>
          <div className="text-[10px] text-s39-muted tracking-widest mt-1">SOLAY39 SCORE</div>
        </div>

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-3 gap-2">
          {[
            { label: "CRITICAL", count: critCount, color: SEV_COLORS.CRITICAL },
            { label: "HIGH",     count: highCount,  color: SEV_COLORS.HIGH },
            { label: "MEDIUM",   count: medCount,   color: SEV_COLORS.MEDIUM },
            { label: "LOW",      count: lowCount,   color: SEV_COLORS.LOW },
            { label: "INFO",     count: infoCount,  color: SEV_COLORS.INFO },
            { label: "FLASH LOAN RISK", count: exploitableFL, color: "#ff6600" },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-s39-surface border border-s39-border rounded p-3 text-center">
              <div className="text-[20px] font-bold" style={{ color }}>{count}</div>
              <div className="text-[9px] text-s39-muted tracking-widest">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick metadata */}
        <div className="bg-s39-surface border border-s39-border rounded p-4 min-w-[180px] flex flex-col gap-2 text-[11px]">
          {[
            ["MEV EXPOSURE", `${unprotectedMEV} unprotected`],
            ["FINDINGS",     `${findings.length} total`],
            ["SCOPE",        aiScopeTable[0]?.contract || "N/A"],
            ["LOC",          aiEngagement ? String((aiEngagement as Record<string, unknown>).linesOfCode || "N/A") : "N/A"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-s39-muted tracking-wider">{k}</span>
              <span className="text-s39-text truncate max-w-[100px] text-right">{v}</span>
            </div>
          ))}
          {signedReport && (
            <div className="mt-1 pt-1 border-t border-s39-border">
              <span className="text-[9px] text-s39-green tracking-widest">◈ CRYPTOGRAPHICALLY SIGNED</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap mb-4 border-b border-s39-border pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="text-[10px] tracking-wider px-3 py-1.5 rounded transition-all"
            style={{
              background: tab === t.id ? "#00ff8820" : "transparent",
              color: tab === t.id ? "#00ff88" : "#556655",
              border: `1px solid ${tab === t.id ? "#00ff8840" : "transparent"}`,
            }}
          >
            {t.label}
            {t.id === "findings" && findings.length > 0 && (
              <span className="ml-1 opacity-60">({findings.length})</span>
            )}
            {t.id === "flashloan" && exploitableFL > 0 && (
              <span className="ml-1 text-orange-400">({exploitableFL})</span>
            )}
            {t.id === "mev" && unprotectedMEV > 0 && (
              <span className="ml-1 text-yellow-400">({unprotectedMEV})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Score by category */}
          {scoreBreakdownAI && (
            <Section title="Score Breakdown — 6 Categories">
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Code Security (35%)",         value: scoreBreakdownAI.codeSecurity },
                    { label: "Access Control (20%)",        value: scoreBreakdownAI.accessControl },
                    { label: "Economic Safety (20%)",       value: scoreBreakdownAI.economicSafety },
                    { label: "Upgrade Safety (10%)",        value: scoreBreakdownAI.upgradeSafety },
                    { label: "Operational Maturity (10%)",  value: scoreBreakdownAI.operationalMaturity },
                    { label: "Dependency Health (5%)",      value: scoreBreakdownAI.dependencyHealth },
                  ].map(({ label, value }) => (
                    <ScorePill key={label} label={label} value={value} />
                  ))}
                </div>
              </Card>
            </Section>
          )}

          {/* Attack Surface */}
          {attackSurface.length > 0 && (
            <Section title="Attack Surface Map">
              <div className="space-y-2">
                {attackSurface.map((a, i) => {
                  const c = a.mitigated ? "#00ff88" : a.likelihood === "High" ? "#ff4444" : a.likelihood === "Medium" ? "#ffcc00" : "#00aaff"
                  return (
                    <div key={i} className="flex gap-3 p-3 border border-s39-border rounded bg-s39-bg">
                      <div className="w-2 rounded-full shrink-0" style={{ background: c }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-semibold text-s39-text">{a.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${c}20`, color: c }}>
                            {a.likelihood} likelihood
                          </span>
                          {a.mitigated && (
                            <span className="text-[9px] text-s39-green">✓ mitigated</span>
                          )}
                        </div>
                        <p className="text-[11px] text-s39-muted mt-1">{a.description}</p>
                        {a.estimatedImpact && (
                          <p className="text-[11px] mt-1" style={{ color: c }}>Impact: {a.estimatedImpact}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Privileged Roles */}
          {privilegedRoles.length > 0 && (
            <Section title="Privileged Roles">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-s39-border">
                      {["Role", "Capabilities", "Risk if Compromised", "Control"].map(h => (
                        <th key={h} className="text-left pb-2 pr-4 text-s39-muted tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {privilegedRoles.map((r, i) => (
                      <tr key={i} className="border-b border-s39-border/40">
                        <td className="py-2 pr-4 text-s39-green font-bold">{r.role}</td>
                        <td className="py-2 pr-4 text-s39-text">{r.capabilities}</td>
                        <td className="py-2 pr-4 text-orange-400">{r.riskIfCompromised}</td>
                        <td className="py-2 text-s39-muted">{r.controlMechanism || "EOA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Trust Assumptions */}
          {trustAssumptions.length > 0 && (
            <Section title="Trust Assumptions">
              <Card>
                <ul className="space-y-2">
                  {trustAssumptions.map((t, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-s39-text">
                      <span className="text-s39-green shrink-0">→</span>
                      {t.statement}
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          )}

          {/* Architecture Recommendations */}
          {architectureRecommendations.length > 0 && (
            <Section title="Architecture Recommendations">
              <Card>
                <ul className="space-y-2">
                  {architectureRecommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-s39-text">
                      <span className="text-s39-green shrink-0">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          )}
        </div>
      )}

      {/* ── Tab: Findings ─────────────────────────────────────────── */}
      {tab === "findings" && (
        <div>
          {findings.length === 0 ? (
            <Card className="text-center text-s39-muted text-[13px]">
              No vulnerabilities found — contract passed all security checks.
            </Card>
          ) : (
            <div>
              {/* Severity filter */}
              {(["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as const).map(sev => {
                const group = findings.filter(f => f.severity === sev)
                if (group.length === 0) return null
                return (
                  <div key={sev} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: `${SEV_COLORS[sev]}20`, color: SEV_COLORS[sev], border: `1px solid ${SEV_COLORS[sev]}40` }}
                      >
                        {sev} ({group.length})
                      </span>
                    </div>
                    {group.map((f, idx) => (
                      <FindingCard key={idx} f={f} index={idx} />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Flash Loan ───────────────────────────────────────── */}
      {tab === "flashloan" && (
        <div>
          {flashLoanScenarios.length === 0 ? (
            <Card className="text-center text-s39-muted text-[13px]">
              Flash loan analysis not available — ensure contract source was provided.
            </Card>
          ) : (
            <div className="space-y-4">
              {flashLoanScenarios.map((fl, i) => (
                <Card key={i} className={fl.exploitable ? "border-orange-800" : ""}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            background: fl.exploitable ? "#2a1000" : "#0a2010",
                            color:      fl.exploitable ? "#ff6600"  : "#00ff88",
                            border:     `1px solid ${fl.exploitable ? "#4a2000" : "#1a4020"}`,
                          }}
                        >
                          {fl.exploitable ? "⚡ EXPLOITABLE" : "✓ NOT EXPLOITABLE"}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-s39-text">{fl.scenario}</p>
                    </div>
                    <div className="text-right text-[11px] shrink-0">
                      <div className="text-s39-muted">Borrow needed</div>
                      <div className="text-s39-green font-bold">{fl.borrowAmount}</div>
                      <div className="text-s39-muted mt-1">Max profit</div>
                      <div className="text-orange-400 font-bold">{fl.profitEstimate}</div>
                    </div>
                  </div>
                  {fl.steps.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-s39-muted tracking-widest mb-2">ATTACK STEPS</div>
                      <ol className="space-y-1">
                        {fl.steps.map((s, si) => (
                          <li key={si} className="flex gap-2 text-[12px] text-s39-text">
                            <span className="text-s39-green shrink-0 font-bold">{si + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {fl.prerequisites.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-s39-muted tracking-widest mb-1">PREREQUISITES</div>
                      <ul className="space-y-1">
                        {fl.prerequisites.map((p, pi) => (
                          <li key={pi} className="text-[11px] text-s39-muted">→ {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="pt-2 border-t border-s39-border">
                    <div className="text-[10px] text-s39-muted tracking-widest mb-1">MITIGATION</div>
                    <p className="text-[12px] text-s39-green">{fl.mitigation}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: MEV ──────────────────────────────────────────────── */}
      {tab === "mev" && (
        <div>
          {mevExposure.length === 0 ? (
            <Card className="text-center text-s39-muted text-[13px]">
              MEV exposure analysis not available.
            </Card>
          ) : (
            <div className="space-y-3">
              {mevExposure.map((m, i) => {
                const c = m.protected ? "#00ff88" : "#ffcc00"
                return (
                  <Card key={i}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <code className="text-s39-green text-[12px] font-bold">{m.function}</code>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: `${c}20`, color: c }}
                          >
                            {m.attackType.toUpperCase()}
                          </span>
                          {m.protected ? (
                            <span className="text-[9px] text-s39-green">✓ protected</span>
                          ) : (
                            <span className="text-[9px] text-yellow-400">⚠ unprotected</span>
                          )}
                        </div>
                        <p className="text-[12px] text-s39-text">{m.description}</p>
                      </div>
                      <div className="text-right text-[11px] shrink-0">
                        <div className="text-s39-muted">Max MEV</div>
                        <div className="font-bold" style={{ color: c }}>{m.maxExtractableValue}</div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Score Breakdown ──────────────────────────────────── */}
      {tab === "score" && (
        <div className="space-y-4">
          {scoreBreakdownAI ? (
            <>
              <Section title="Category Scores">
                <Card>
                  <div className="space-y-4">
                    {[
                      { label: "Code Security",        value: scoreBreakdownAI.codeSecurity,        weight: 35 },
                      { label: "Access Control",       value: scoreBreakdownAI.accessControl,       weight: 20 },
                      { label: "Economic Safety",      value: scoreBreakdownAI.economicSafety,      weight: 20 },
                      { label: "Upgrade Safety",       value: scoreBreakdownAI.upgradeSafety,       weight: 10 },
                      { label: "Operational Maturity", value: scoreBreakdownAI.operationalMaturity, weight: 10 },
                      { label: "Dependency Health",    value: scoreBreakdownAI.dependencyHealth,    weight: 5  },
                    ].map(({ label, value, weight }) => (
                      <ScorePill key={label} label={`${label} (${weight}% weight)`} value={value} />
                    ))}
                  </div>
                </Card>
              </Section>

              {scoreBreakdownAI.deductions.length > 0 && (
                <Section title="Score Deductions">
                  <div className="space-y-2">
                    {scoreBreakdownAI.deductions.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border border-s39-border rounded bg-s39-bg">
                        <div>
                          <span className="text-[10px] text-s39-muted tracking-widest mr-2">{d.category}</span>
                          <span className="text-[12px] text-s39-text">{d.reason}</span>
                        </div>
                        <span className="text-red-400 font-bold text-[13px]">-{d.points}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <Card className="text-center text-s39-muted text-[13px]">
              Detailed score breakdown requires AI analysis of contract source code.
            </Card>
          )}

          {/* Findings distribution */}
          <Section title="Finding Distribution">
            <Card>
              <div className="space-y-3">
                {[
                  { sev: "CRITICAL", count: critCount, weight: -25 },
                  { sev: "HIGH",     count: highCount,  weight: -15 },
                  { sev: "MEDIUM",   count: medCount,   weight: -8  },
                  { sev: "LOW",      count: lowCount,   weight: -3  },
                  { sev: "INFO",     count: infoCount,  weight: -1  },
                ].map(({ sev, count, weight }) => (
                  <div key={sev} className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded w-20 text-center"
                      style={{ background: `${SEV_COLORS[sev]}20`, color: SEV_COLORS[sev] }}
                    >
                      {sev}
                    </span>
                    <div className="flex-1 h-[4px] bg-s39-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, count * 20)}%`, background: SEV_COLORS[sev] }}
                      />
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: SEV_COLORS[sev] }}>{count}</span>
                    <span className="text-[10px] text-s39-muted w-16">({weight} pts each)</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        </div>
      )}

      {/* ── Tab: Architecture ─────────────────────────────────────── */}
      {tab === "architecture" && (
        <div className="space-y-4">
          {architectureOverview && (
            <Section title="Architecture Overview">
              <Card>
                <p className="text-[12px] text-s39-text leading-relaxed whitespace-pre-wrap">{architectureOverview}</p>
              </Card>
            </Section>
          )}

          {economicRisks.length > 0 && (
            <Section title="Economic & Game Theory Risks">
              <div className="space-y-3">
                {economicRisks.map((e, i) => {
                  const c = e.severity === "High" ? "#ff4444" : e.severity === "Medium" ? "#ffcc00" : "#00aaff"
                  return (
                    <Card key={i}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[13px] font-semibold text-s39-text">{e.title}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded shrink-0" style={{ background: `${c}20`, color: c }}>{e.severity}</span>
                      </div>
                      <p className="text-[12px] text-s39-muted mb-2">{e.description}</p>
                      {e.quantifiedImpact && (
                        <p className="text-[11px] text-orange-400 mb-2">Estimated impact: {e.quantifiedImpact}</p>
                      )}
                      {e.mitigation && (
                        <p className="text-[11px] text-s39-green">Mitigation: {e.mitigation}</p>
                      )}
                    </Card>
                  )
                })}
              </div>
            </Section>
          )}

          {integrationRisks.length > 0 && (
            <Section title="Integration Risks">
              <div className="space-y-2">
                {integrationRisks.map((ir, i) => {
                  const c = ir.severity === "High" ? "#ff4444" : ir.severity === "Medium" ? "#ffcc00" : "#00aaff"
                  return (
                    <div key={i} className="flex gap-3 p-3 border border-s39-border rounded bg-s39-bg">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] font-bold text-s39-green">{ir.dependency}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${c}20`, color: c }}>{ir.riskType}</span>
                        </div>
                        <p className="text-[11px] text-s39-muted">{ir.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {architectureRecommendations.length > 0 && (
            <Section title="Architecture Recommendations">
              <Card>
                <ul className="space-y-2">
                  {architectureRecommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-s39-text">
                      <span className="text-s39-green shrink-0">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          )}
        </div>
      )}

      {/* ── Tab: Threat Model ─────────────────────────────────────── */}
      {tab === "threat" && (
        <div className="space-y-4">
          {governanceSecurity && (
            <Section title="Governance Security">
              <Card>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(governanceSecurity).map(([k, v]) => {
                    if (Array.isArray(v)) return null
                    return (
                      <div key={k} className="flex flex-col gap-0.5">
                        <span className="text-s39-muted tracking-widest text-[10px]">{k.replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                        <span className="text-s39-text">{String(v ?? "N/A")}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </Section>
          )}

          {upgradeabilityAnalysis && (
            <Section title="Upgradeability Analysis">
              <Card>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(upgradeabilityAnalysis).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-s39-muted tracking-widest text-[10px]">{k.replace(/([A-Z])/g, " $1").toUpperCase()}</span>
                      <span className="text-s39-text">{String(v ?? "N/A")}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          )}

          {invariantsChecked.length > 0 && (
            <Section title="Invariants Checked">
              <div className="space-y-2">
                {invariantsChecked.map((inv, i) => (
                  <div key={i} className="flex gap-3 p-3 border border-s39-border rounded bg-s39-bg">
                    <span className={`text-[14px] shrink-0 ${inv.holds ? "text-s39-green" : "text-red-400"}`}>
                      {inv.holds ? "✓" : "✗"}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-s39-text">{inv.invariant}</p>
                      <p className="text-[11px] text-s39-muted mt-0.5">{inv.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {residualRisk && (
            <Section title="Residual Risk">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] tracking-widest text-s39-muted">OVERALL RESIDUAL RISK</span>
                  <span
                    className="text-[12px] font-bold px-3 py-0.5 rounded"
                    style={{
                      background: residualRisk.level === "HIGH" ? "#2a0808" : residualRisk.level === "MEDIUM" ? "#2a2200" : "#0a2010",
                      color:      residualRisk.level === "HIGH" ? "#ff4444" : residualRisk.level === "MEDIUM" ? "#ffcc00" : "#00ff88",
                    }}
                  >
                    {residualRisk.level}
                  </span>
                </div>
                <p className="text-[12px] text-s39-text mb-3">{residualRisk.statement}</p>
                {residualRisk.items.map((item, i) => (
                  <div key={i} className="flex gap-2 text-[11px] border-t border-s39-border pt-2 mt-2">
                    <span className="text-s39-muted w-20 shrink-0">{item.category}</span>
                    <span className="text-s39-text flex-1">{item.description}</span>
                    <span className="text-s39-green shrink-0">{item.mitigation}</span>
                  </div>
                ))}
              </Card>
            </Section>
          )}
        </div>
      )}

      {/* ── Tab: Formal Verification ──────────────────────────────── */}
      {tab === "formal" && (
        <div className="space-y-4">
          {formalVerification ? (
            <Section title={`Formal Verification — ${formalVerification.tool}`}>
              <div className="space-y-3">
                {formalVerification.invariants.map((inv) => {
                  const statusColor = inv.status === "VERIFIED" ? "#00ff88" : inv.status === "FAILED" ? "#ff4444" : "#ffcc00"
                  return (
                    <Card key={inv.id}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="text-[10px] text-s39-muted mr-2">{inv.id}</span>
                          <span className="text-[13px] font-semibold text-s39-text">{inv.property}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                          style={{ background: `${statusColor}20`, color: statusColor }}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-s39-muted mb-1">{inv.description}</p>
                      <p className="text-[11px] text-s39-muted">Method: {inv.method}</p>
                    </Card>
                  )
                })}
              </div>
            </Section>
          ) : (
            <Card className="text-center text-s39-muted text-[13px]">
              Formal verification requires contract source code. Run the audit with source code to enable this section.
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Methodology ──────────────────────────────────────── */}
      {tab === "methodology" && (
        <div className="space-y-4">
          {testingMethodology && (
            <>
              <Section title="Review Phases">
                <Card>
                  <ul className="space-y-1">
                    {((testingMethodology as Record<string, unknown>).reviewPhases as string[] || []).map((p, i) => (
                      <li key={i} className="flex gap-2 text-[12px] text-s39-text">
                        <span className="text-s39-green shrink-0">{i + 1}.</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Section>

              <Section title="Tools Used">
                <div className="space-y-2">
                  {((testingMethodology as Record<string, unknown>).staticAnalysisTools as Array<Record<string, string>> || []).map((t, i) => (
                    <Card key={i}>
                      <div className="font-bold text-s39-green text-[12px] mb-1">{t.tool}</div>
                      <p className="text-[11px] text-s39-muted">{t.findings}</p>
                      {t.configUsed && <p className="text-[10px] text-s39-muted/60 mt-1">Config: {t.configUsed}</p>}
                    </Card>
                  ))}
                  {((testingMethodology as Record<string, unknown>).dynamicAnalysisTools as Array<Record<string, string>> || []).map((t, i) => (
                    <Card key={i}>
                      <div className="font-bold text-blue-400 text-[12px] mb-1">{t.tool}</div>
                      <p className="text-[11px] text-s39-muted">{t.findings}</p>
                      {t.executionTime && <p className="text-[10px] text-s39-muted/60 mt-1">Time: {t.executionTime}</p>}
                    </Card>
                  ))}
                </div>
              </Section>

              <Section title="Assumptions & Limitations">
                <Card>
                  <div className="mb-3">
                    <div className="text-[10px] text-s39-muted tracking-widest mb-2">ASSUMPTIONS</div>
                    <ul className="space-y-1">
                      {((testingMethodology as Record<string, unknown>).assumptions as string[] || []).map((a, i) => (
                        <li key={i} className="text-[12px] text-s39-text">→ {a}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-s39-border pt-3">
                    <div className="text-[10px] text-s39-muted tracking-widest mb-2">LIMITATIONS</div>
                    <ul className="space-y-1">
                      {((testingMethodology as Record<string, unknown>).limitations as string[] || []).map((l, i) => (
                        <li key={i} className="text-[12px] text-orange-400">⚠ {l}</li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Section>
            </>
          )}

          {aiScopeTable.length > 0 && (
            <Section title="Scope">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-s39-border">
                      {["Contract", "LOC", "Language"].map(h => (
                        <th key={h} className="text-left pb-2 pr-4 text-s39-muted tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aiScopeTable.map((s, i) => (
                      <tr key={i} className="border-b border-s39-border/40">
                        <td className="py-2 pr-4 text-s39-green">{s.contract}</td>
                        <td className="py-2 pr-4 text-s39-text">{s.linesOfCode}</td>
                        <td className="py-2 text-s39-muted">{s.language}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {signedReport && (
            <Section title="Report Integrity">
              <Card>
                <div className="text-[10px] text-s39-muted tracking-widest mb-1">CRYPTOGRAPHIC HASH</div>
                <code className="text-[11px] text-s39-green break-all">{signedReport.reportHash}</code>
                <div className="text-[10px] text-s39-muted mt-2">
                  This report is cryptographically signed by Solay39. The hash above uniquely identifies this audit report and can be used to verify authenticity.
                </div>
              </Card>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
