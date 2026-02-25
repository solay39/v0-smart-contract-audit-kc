"use client"

import { useState } from "react"
import {
  CHECKLIST,
  computeScore,
  type Finding,
  type AuditProject,
  type SeverityLevel,
  type FindingStatus,
  SEV_CONFIG,
  SEV_RAW_COLORS,
} from "@/lib/solay39-constants"
import { ScoreRing, S39Input, S39Btn, SevBadge } from "@/components/solay39-ui"
import { exportPDF } from "@/lib/export-pdf"

// ════════════════════════════════════════════════════════════════
// AUDIT WORKSPACE — Founder Only
// ════════════════════════════════════════════════════════════════

type TabId = "dashboard" | "checklist" | "findings" | "skynet"

export function AuditWorkspace({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<TabId>("dashboard")
  const [cat, setCat] = useState(Object.keys(CHECKLIST)[0])
  const [project, setProject] = useState<AuditProject>({
    name: "",
    network: "",
    commit: "",
    scope: "",
    date: new Date().toISOString().slice(0, 10),
  })
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(
      Object.entries(CHECKLIST).map(([c, items]) => [
        c,
        Object.fromEntries(items.map((i) => [i.id, false])),
      ])
    )
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.keys(CHECKLIST).map((k) => [k, ""]))
  )
  const [findings, setFindings] = useState<Finding[]>([])
  const [nf, setNf] = useState<Omit<Finding, "id">>({
    title: "",
    severity: "HIGH",
    category: "",
    location: "",
    description: "",
    impact: "",
    recommendation: "",
    status: "OPEN",
  })
  const [aiCode, setAiCode] = useState("")
  const [aiRes, setAiRes] = useState<Omit<Finding, "id" | "category" | "status">[]>([])
  const [aiLoad, setAiLoad] = useState(false)
  const [aiError, setAiError] = useState("")

  const allChecks = Object.values(checks).flatMap((c) => Object.values(c))
  const anyChecked = allChecks.some(Boolean)
  const rawScore = computeScore(checks, findings)
  const findingScore = Math.max(
    0,
    100 -
      findings.filter((f) => f.severity === "CRITICAL" && f.status === "OPEN").length * 25 -
      findings.filter((f) => f.severity === "HIGH" && f.status === "OPEN").length * 10 -
      findings.filter((f) => f.severity === "MEDIUM" && f.status === "OPEN").length * 3
  )
  const score = anyChecked ? rawScore : findingScore
  const done = allChecks.filter(Boolean).length
  const total = allChecks.length

  const toggle = (c: string, id: string) =>
    setChecks((p) => ({ ...p, [c]: { ...p[c], [id]: !p[c][id] } }))

  const addFinding = () => {
    if (!nf.title) return
    setFindings((p) => [...p, { ...nf, id: Date.now() }])
    setNf({
      title: "",
      severity: "HIGH",
      category: "",
      location: "",
      description: "",
      impact: "",
      recommendation: "",
      status: "OPEN",
    })
  }

  const delFinding = (id: number) => setFindings((p) => p.filter((f) => f.id !== id))
  const updStatus = (id: number, s: FindingStatus) =>
    setFindings((p) => p.map((f) => (f.id === id ? { ...f, status: s } : f)))

  const [aiNote, setAiNote] = useState("")

  const runSkynet = async () => {
    if (!aiCode.trim()) return
    setAiLoad(true)
    setAiRes([])
    setAiError("")
    setAiNote("")
    try {
      const res = await fetch("/api/skynet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: aiCode }),
      })
      const data = await res.json().catch(() => null)
      if (!data) {
        setAiError(`Server returned an empty response (${res.status}).`)
        setAiLoad(false)
        return
      }
      if (!res.ok && !data.findings?.length) {
        setAiError(data.error || `Server error (${res.status}).`)
        setAiLoad(false)
        return
      }
      if (data.note) setAiNote(data.note)
      if (data.error && !data.findings?.length) {
        setAiError(data.error)
      }
      if (data.findings && Array.isArray(data.findings)) {
        setAiRes(data.findings)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setAiError(`Network error: ${msg}. Check your connection and try again.`)
    }
    setAiLoad(false)
  }

  const importFinding = (f: Omit<Finding, "id" | "category" | "status">) =>
    setFindings((p) => {
      // Prevent duplicate imports by checking title
      const isDuplicate = p.some(
        (existing) => existing.title.toLowerCase().trim() === f.title.toLowerCase().trim()
      )
      if (isDuplicate) return p
      return [
        ...p,
        { ...f, id: Date.now(), status: "OPEN" as FindingStatus, category: "" },
      ]
    })

  const TABS: [TabId, string][] = [
    ["dashboard", "Dashboard"],
    ["checklist", "Checklist"],
    ["findings", "Findings"],
    ["skynet", "Skynet AI"],
  ]

  return (
    <div className="min-h-dvh bg-s39-bg0">
      {/* TOP BAR */}
      <nav className="bg-s39-bg1 border-b border-s39-border px-4 sm:px-6 h-[52px] flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
          <div className="text-[13px] font-bold text-s39-green tracking-wider shrink-0">
            SOLAY39
          </div>
          <div className="h-[18px] w-px bg-s39-border shrink-0 hidden sm:block" />
          {TABS.map(([t, l]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[9px] tracking-[0.12em] uppercase cursor-pointer bg-transparent border-none font-mono pb-0.5 transition-colors shrink-0 ${
                tab === t
                  ? "text-s39-green border-b border-s39-green"
                  : "text-s39-dim hover:text-s39-lite"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-3 items-center shrink-0">
          <span className="text-[9px] text-s39-dim hidden sm:inline">
            {project.name || "New Audit"}
          </span>
          <S39Btn small onClick={onLogout}>
            Logout
          </S39Btn>
        </div>
      </nav>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-7">
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="animate-[fadeUp_0.4s_ease]">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 mb-6">
              {/* Score card */}
              <div className="bg-s39-bg1 border border-s39-border p-6 flex flex-col items-center gap-3">
                <ScoreRing score={score} size={110} />
                <div className="text-center">
                  <div className="text-[9px] text-s39-dim tracking-widest">SOLAY39 SCORE</div>
                  <div className="text-[11px] text-s39-mid mt-1">
                    {done}/{total} checks / {findings.length} findings
                  </div>
                </div>
                <S39Btn
                  primary
                  small
                  onClick={() => exportPDF(project, score, findings)}
                  className="w-full"
                >
                  Export PDF
                </S39Btn>
                <S39Btn
                  small
                  onClick={() => setTab("skynet")}
                  className="w-full !text-s39-cyan !border-s39-cyan/30"
                >
                  Skynet AI
                </S39Btn>
              </div>

              {/* Project meta */}
              <div className="bg-s39-bg1 border border-s39-border p-6">
                <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">PROJECT</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <S39Input
                    label="Protocol Name"
                    value={project.name}
                    onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
                    placeholder="ProtocolX"
                  />
                  <S39Input
                    label="Network"
                    value={project.network}
                    onChange={(e) => setProject((p) => ({ ...p, network: e.target.value }))}
                    placeholder="Ethereum"
                  />
                  <S39Input
                    label="Commit Hash"
                    value={project.commit}
                    onChange={(e) => setProject((p) => ({ ...p, commit: e.target.value }))}
                    placeholder="0x..."
                  />
                  <S39Input
                    label="Audit Date"
                    value={project.date}
                    onChange={(e) => setProject((p) => ({ ...p, date: e.target.value }))}
                    type="date"
                  />
                </div>
                <S39Input
                  label="Scope (files or description)"
                  value={project.scope}
                  onChange={(e) => setProject((p) => ({ ...p, scope: e.target.value }))}
                  placeholder="contracts/Token.sol"
                />
              </div>
            </div>

            {/* Checklist progress */}
            <div className="bg-s39-bg1 border border-s39-border p-6">
              <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">
                CHECKLIST PROGRESS — {done}/{total}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {Object.entries(CHECKLIST).map(([c, items]) => {
                  const d = Object.values(checks[c]).filter(Boolean).length
                  const t = items.length
                  const pct = Math.round((d / t) * 100)
                  const col =
                    pct === 100 ? "#00ff88" : pct > 50 ? "#00e5ff" : pct > 0 ? "#ffd600" : "#445566"
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setCat(c)
                        setTab("checklist")
                      }}
                      className="bg-s39-bg2 border border-s39-border p-3 cursor-pointer text-left transition-colors hover:border-s39-muted font-mono"
                    >
                      <div className="text-[9px] text-s39-lite font-bold mb-1.5 truncate">
                        {c}
                      </div>
                      <div className="h-[3px] bg-s39-bg3 rounded-sm mb-1.5">
                        <div
                          className="h-full rounded-sm transition-[width] duration-500"
                          style={{ width: `${pct}%`, background: col }}
                        />
                      </div>
                      <div className="text-[8px]" style={{ color: col }}>
                        {d}/{t} / {pct}%
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKLIST ── */}
        {tab === "checklist" && (
          <div className="animate-[fadeUp_0.4s_ease]">
            <div className="flex gap-2 flex-wrap mb-5">
              {Object.keys(CHECKLIST).map((c) => {
                const d = Object.values(checks[c]).filter(Boolean).length
                const t = CHECKLIST[c].length
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`px-3 py-1 text-[9px] font-mono cursor-pointer tracking-wider border ${
                      cat === c
                        ? "bg-s39-green text-s39-bg0 border-s39-green"
                        : "bg-s39-bg2 text-s39-mid border-s39-border hover:border-s39-muted"
                    }`}
                  >
                    {c}{" "}
                    <span className="opacity-70">
                      {d}/{t}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="bg-s39-bg1 border border-s39-border p-4 sm:p-6 mb-4">
              <div className="text-[12px] font-bold text-s39-green mb-4">{cat}</div>
              {CHECKLIST[cat].map((item) => {
                const checked = checks[cat][item.id]
                const s = SEV_CONFIG[item.sev] || SEV_CONFIG.INFO
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(cat, item.id)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-s39-border transition-colors hover:bg-s39-bg2 w-full text-left font-mono"
                  >
                    <div
                      className={`w-4 h-4 border shrink-0 flex items-center justify-center transition-all ${
                        checked
                          ? "border-s39-green bg-s39-green"
                          : "border-s39-border bg-transparent"
                      }`}
                    >
                      {checked && (
                        <span className="text-s39-bg0 text-[11px] leading-none">
                          {"✓"}
                        </span>
                      )}
                    </div>
                    <div
                      className={`flex-1 text-[10px] ${
                        checked ? "text-s39-mid line-through" : "text-s39-lite"
                      }`}
                    >
                      {item.text}
                    </div>
                    <span
                      className={`text-[7px] border px-1.5 py-px shrink-0 ${s.color} ${s.border}`}
                    >
                      {item.sev}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="bg-s39-bg1 border border-s39-border p-4 sm:p-6">
              <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-2">
                NOTES — {cat}
              </div>
              <textarea
                value={notes[cat]}
                onChange={(e) => setNotes((p) => ({ ...p, [cat]: e.target.value }))}
                placeholder="Additional notes for this category..."
                className="w-full bg-s39-bg2 border border-s39-border text-s39-lite p-3 text-[10px] font-mono resize-y min-h-[80px] outline-none focus:border-s39-green transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── FINDINGS ── */}
        {tab === "findings" && (
          <div className="animate-[fadeUp_0.4s_ease]">
            {/* Add finding form */}
            <div className="bg-s39-bg1 border border-s39-border p-4 sm:p-6 mb-5">
              <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-4">NEW FINDING</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <S39Input
                  label="Title"
                  value={nf.title}
                  onChange={(e) => setNf((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Reentrancy in withdraw()"
                />
                <div className="mb-3">
                  <div className="text-[8px] text-s39-dim tracking-[0.15em] uppercase mb-1">
                    Severity
                  </div>
                  <select
                    value={nf.severity}
                    onChange={(e) =>
                      setNf((p) => ({ ...p, severity: e.target.value as SeverityLevel }))
                    }
                    className="w-full bg-s39-bg2 border border-s39-border p-2 text-[11px] font-mono outline-none"
                    style={{ color: SEV_RAW_COLORS[nf.severity] || "#7a8c9e" }}
                  >
                    {(Object.keys(SEV_CONFIG) as SeverityLevel[]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <S39Input
                  label="Location"
                  value={nf.location}
                  onChange={(e) => setNf((p) => ({ ...p, location: e.target.value }))}
                  placeholder="contracts/Vault.sol:142"
                />
                <div className="mb-3">
                  <div className="text-[8px] text-s39-dim tracking-[0.15em] uppercase mb-1">
                    Status
                  </div>
                  <select
                    value={nf.status}
                    onChange={(e) =>
                      setNf((p) => ({ ...p, status: e.target.value as FindingStatus }))
                    }
                    className="w-full bg-s39-bg2 border border-s39-border text-s39-mid p-2 text-[11px] font-mono outline-none"
                  >
                    {(["OPEN", "RESOLVED", "ACKNOWLEDGED", "PARTIALLY_FIXED"] as FindingStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
              <S39Input
                label="Description"
                value={nf.description}
                onChange={(e) => setNf((p) => ({ ...p, description: e.target.value }))}
                placeholder="Vulnerability description..."
                multi
              />
              <S39Input
                label="Impact"
                value={nf.impact}
                onChange={(e) => setNf((p) => ({ ...p, impact: e.target.value }))}
                placeholder="Potential impact..."
                multi
              />
              <S39Input
                label="Recommendation"
                value={nf.recommendation}
                onChange={(e) => setNf((p) => ({ ...p, recommendation: e.target.value }))}
                placeholder="How to fix..."
                multi
              />
              <S39Btn primary onClick={addFinding}>
                + Add Finding
              </S39Btn>
            </div>

            {/* Findings list */}
            {findings.length === 0 ? (
              <div className="text-center py-10 text-s39-dim text-[10px]">
                No findings added. That&apos;s a good sign.
              </div>
            ) : (
              findings.map((f, i) => {
                const s = SEV_CONFIG[f.severity] || SEV_CONFIG.INFO
                const sevAbbr: Record<string, string> = {
                  CRITICAL: "C",
                  HIGH: "H",
                  MEDIUM: "M",
                  LOW: "L",
                  INFO: "I",
                }
                const fnum = `${sevAbbr[f.severity] || "F"}-${String(i + 1).padStart(2, "0")}`
                return (
                  <div
                    key={f.id}
                    className="bg-s39-bg1 border border-s39-border mb-3 overflow-hidden"
                    style={{ borderLeftWidth: 3, borderLeftColor: SEV_RAW_COLORS[f.severity] }}
                  >
                    <div className="px-4 py-2.5 bg-s39-bg2 flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className="text-[9px] font-bold"
                          style={{ color: SEV_RAW_COLORS[f.severity] }}
                        >
                          {fnum}
                        </span>
                        <SevBadge sev={f.severity} />
                        <span className="text-[11px] text-s39-lite font-bold">{f.title}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={f.status}
                          onChange={(e) => updStatus(f.id, e.target.value as FindingStatus)}
                          className="bg-s39-bg3 border border-s39-border text-[8px] font-mono px-2 py-0.5 outline-none"
                          style={{
                            color:
                              f.status === "RESOLVED"
                                ? "#00ff88"
                                : f.status === "ACKNOWLEDGED"
                                ? "#ffd600"
                                : "#ff2d55",
                          }}
                        >
                          {(
                            ["OPEN", "RESOLVED", "ACKNOWLEDGED", "PARTIALLY_FIXED"] as FindingStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => delFinding(f.id)}
                          className="bg-transparent border-none text-s39-red cursor-pointer text-[12px] leading-none font-mono"
                          aria-label={`Delete finding ${fnum}`}
                        >
                          x
                        </button>
                      </div>
                    </div>
                    {f.location && (
                      <div className="px-4 py-1 text-[9px] text-s39-dim border-b border-s39-border">
                        Location: {f.location}
                      </div>
                    )}
                    {(
                      [
                        ["Description", f.description],
                        ["Impact", f.impact],
                        ["Recommendation", f.recommendation],
                      ] as [string, string][]
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="flex border-b border-s39-border">
                          <div className="min-w-[100px] sm:min-w-[120px] px-3 py-2 bg-s39-bg2 text-[8px] text-s39-dim shrink-0 border-r border-s39-border">
                            {k}
                          </div>
                          <div className="px-3 py-2 text-[10px] text-s39-mid flex-1">{v}</div>
                        </div>
                      ))}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── SKYNET AI ── */}
        {tab === "skynet" && (
          <div className="animate-[fadeUp_0.4s_ease]">
            <div className="bg-s39-bg1 border border-s39-border p-4 sm:p-6 mb-5">
              <div className="text-[9px] text-s39-cyan tracking-[0.15em] mb-1">
                SKYNET AI COPILOT
              </div>
              <div className="text-[10px] text-s39-mid mb-4">
                Paste your Solidity code for automated vulnerability analysis.
              </div>
              <textarea
                value={aiCode}
                onChange={(e) => setAiCode(e.target.value)}
                placeholder="// Paste Solidity code here..."
                className="w-full bg-s39-bg2 border border-s39-border text-s39-lite p-3 text-[10px] font-mono resize-y min-h-[200px] outline-none focus:border-s39-cyan transition-colors mb-3.5"
              />
              <S39Btn
                primary
                onClick={runSkynet}
                disabled={aiLoad}
                className="!bg-s39-cyan !text-s39-bg0 !border-s39-cyan"
              >
                {aiLoad ? (
                  <span className="animate-[pulse-slow_1s_infinite]">Analyzing...</span>
                ) : (
                  "Analyze with Skynet AI"
                )}
              </S39Btn>
            </div>

            {aiError && !aiRes.length && (
              <div className="bg-[#160005] border border-s39-red/30 text-s39-red text-[10px] p-4 mb-5">
                {aiError}
              </div>
            )}

            {aiNote && (
              <div className="bg-s39-bg2 border border-s39-cyan/20 text-s39-cyan text-[10px] p-3 mb-5">
                {aiNote}
              </div>
            )}

            {aiRes.length > 0 && (
              <div>
                <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-3.5">
                  {aiRes.length} FINDING{aiRes.length !== 1 ? "S" : ""} IDENTIFIED
                </div>
                {aiRes.map((f, i) => {
                  const s = SEV_CONFIG[f.severity] || SEV_CONFIG.INFO
                  return (
                    <div
                      key={i}
                      className={`bg-s39-bg1 border ${s.border} mb-3 p-4`}
                      style={{ borderLeftWidth: 3, borderLeftColor: SEV_RAW_COLORS[f.severity] }}
                    >
                      <div className="flex justify-between items-start mb-2.5 flex-wrap gap-2">
                        <div>
                          <SevBadge sev={f.severity} />{" "}
                          <span className="text-[11px] text-s39-lite font-bold ml-2">
                            {f.title}
                          </span>
                        </div>
                        {findings.some(
                          (ex) => ex.title.toLowerCase().trim() === f.title.toLowerCase().trim()
                        ) ? (
                          <span className="text-[9px] text-s39-green/60 px-2 py-1 border border-s39-green/20">
                            Imported
                          </span>
                        ) : (
                          <S39Btn
                            small
                            onClick={() => importFinding(f)}
                            className="!text-s39-green !border-s39-green/30 shrink-0"
                          >
                            {"Import ->"}
                          </S39Btn>
                        )}
                      </div>
                      {f.location && (
                        <div className="text-[9px] text-s39-dim mb-1.5">
                          Location: {f.location}
                        </div>
                      )}
                      {(
                        [
                          ["Description", f.description],
                          ["Impact", f.impact],
                          ["Recommendation", f.recommendation],
                        ] as [string, string][]
                      )
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} className="text-[9.5px] text-s39-mid mb-1">
                            <strong className="text-s39-dim">{k}:</strong> {v}
                          </div>
                        ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
