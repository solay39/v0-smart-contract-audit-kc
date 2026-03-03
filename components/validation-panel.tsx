"use client"

// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — ValidationPanel + useAuditValidator hook
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from "react"
import type { ValidationResult, ValidationIssue } from "@/lib/audit-validator"

// ─── HOOK ─────────────────────────────────────────────────────────

export function useAuditValidator() {
  const [result, setResult]             = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const validate = useCallback(async (
    sourceCode: string,
    reportFields: Record<string, unknown>,
    compilerFromExplorer?: string,
  ): Promise<ValidationResult | null> => {
    setIsValidating(true)
    setError(null)
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode, reportFields, compilerFromExplorer }),
      })
      if (!res.ok) throw new Error(`Validation API error: ${res.status}`)
      const data: ValidationResult = await res.json()
      setResult(data)
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])

  const reset = useCallback(() => { setResult(null); setError(null) }, [])

  return { validate, result, isValidating, error, reset }
}

// ─── PANEL ────────────────────────────────────────────────────────

interface ValidationPanelProps {
  result: ValidationResult
  onApplyFix?: (field: string, value: unknown) => void
  onApplyAllFixes?: (fixes: Record<string, unknown>) => void
  onDismiss?: () => void
  onForcePublish?: () => void
}

const SEV: Record<string, { border: string; bg: string; badge: string }> = {
  CRITICAL: { border: "border-[#ff2d55]",  bg: "bg-[#ff2d55]/5",  badge: "bg-[#ff2d55]/15 text-[#ff2d55]" },
  HIGH:     { border: "border-[#ff6b00]",  bg: "bg-[#ff6b00]/5",  badge: "bg-[#ff6b00]/15 text-[#ff6b00]" },
  MEDIUM:   { border: "border-[#ffd600]",  bg: "bg-[#ffd600]/5",  badge: "bg-[#ffd600]/15 text-[#ffd600]" },
  LOW:      { border: "border-[#7a8c9e]",  bg: "bg-[#7a8c9e]/5",  badge: "bg-[#7a8c9e]/15 text-[#7a8c9e]" },
}

export function ValidationPanel({
  result,
  onApplyFix,
  onApplyAllFixes,
  onDismiss,
  onForcePublish,
}: ValidationPanelProps) {
  const [applied, setApplied]   = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  const criticals = result.issues.filter(i => i.severity === "CRITICAL").length
  const highs     = result.issues.filter(i => i.severity === "HIGH").length
  const mediums   = result.issues.filter(i => i.severity === "MEDIUM").length
  const lows      = result.issues.filter(i => i.severity === "LOW").length
  const autoCount = Object.keys(result.autoFixes).length

  function applyFix(issue: ValidationIssue) {
    if (!issue.autoFixable || issue.autoFixValue === undefined) return
    onApplyFix?.(issue.field, issue.autoFixValue)
    setApplied(prev => new Set([...prev, issue.id]))
  }

  function applyAll() {
    onApplyAllFixes?.(result.autoFixes)
    setApplied(new Set(result.issues.filter(i => i.autoFixable).map(i => i.id)))
  }

  const scoreColor =
    result.score >= 80 ? "text-[#00ff88]" :
    result.score >= 60 ? "text-[#ffd600]" : "text-[#ff2d55]"

  const sorted = [...result.issues].sort((a, b) => {
    const o: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return o[a.severity] - o[b.severity]
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0a0e14] border border-[#1c2836] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2836]">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 animate-pulse ${result.canPublish ? "bg-[#00ff88]" : "bg-[#ff2d55]"}`} />
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#e0e6ed] uppercase">
              VALIDATION REPORT
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-black font-mono ${scoreColor}`}>{result.score}</div>
              <div className="text-[7px] text-[#4a5a6a] tracking-[0.2em]">QUALITY</div>
            </div>
            <button onClick={onDismiss} className="text-[#4a5a6a] hover:text-[#e0e6ed] text-lg transition-colors cursor-pointer">{'x'}</button>
          </div>
        </div>

        {/* Status */}
        <div className={`px-6 py-3 flex items-center gap-3 text-[10px] ${result.canPublish ? "bg-[#00ff88]/5" : "bg-[#ff2d55]/5"}`}>
          {result.canPublish
            ? <span className="text-[#00ff88] font-bold font-mono tracking-wider">PASS — Nessun blocco, pronto per la pubblicazione</span>
            : <span className="text-[#ff2d55] font-bold font-mono tracking-wider">BLOCKED — Correggi i CRITICAL e HIGH prima di pubblicare</span>
          }
          {autoCount > 0 && (
            <button
              onClick={applyAll}
              className="ml-auto px-3 py-1 border border-[#00e5ff]/30 bg-[#00e5ff]/5 text-[#00e5ff] text-[9px] font-bold font-mono tracking-wider hover:bg-[#00e5ff]/10 transition-colors cursor-pointer"
            >
              APPLICA {autoCount} FIX
            </button>
          )}
        </div>

        {/* Counters */}
        <div className="flex gap-2 px-6 py-3 border-b border-[#1c2836]">
          {[
            { n: criticals, l: "CRITICAL", c: "text-[#ff2d55] border-[#ff2d55]/20 bg-[#ff2d55]/5" },
            { n: highs,     l: "HIGH",     c: "text-[#ff6b00] border-[#ff6b00]/20 bg-[#ff6b00]/5" },
            { n: mediums,   l: "MEDIUM",   c: "text-[#ffd600] border-[#ffd600]/20 bg-[#ffd600]/5" },
            { n: lows,      l: "LOW",      c: "text-[#7a8c9e] border-[#7a8c9e]/20 bg-[#7a8c9e]/5" },
          ].map(({ n, l, c }) => (
            <div key={l} className={`px-3 py-1 border text-[9px] font-mono font-bold tracking-wider ${c}`}>
              {n} {l}
            </div>
          ))}
        </div>

        {/* Issues */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-[#4a5a6a] font-mono text-[10px] tracking-wider">
              NESSUN PROBLEMA — REPORT PULITO
            </div>
          ) : sorted.map(issue => {
            const cfg       = SEV[issue.severity]
            const isApplied = applied.has(issue.id)
            const isOpen    = expanded === issue.id

            return (
              <div
                key={issue.id}
                className={`border-l-[3px] ${cfg.border} ${cfg.bg} ${isApplied ? "opacity-40" : ""} transition-opacity`}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                  onClick={() => setExpanded(isOpen ? null : issue.id)}
                >
                  <span className={`text-[8px] font-black font-mono px-2 py-0.5 tracking-wider ${cfg.badge}`}>
                    {issue.severity}
                  </span>
                  <span className="flex-1 text-[10px] font-medium text-[#e0e6ed] font-mono">{issue.field}</span>
                  {isApplied
                    ? <span className="text-[8px] text-[#00ff88] font-mono tracking-wider">FIXED</span>
                    : issue.autoFixable
                      ? <span className="text-[8px] text-[#00e5ff] font-mono tracking-wider">AUTO-FIX</span>
                      : null
                  }
                  <span className="text-[#4a5a6a] text-[8px]">{isOpen ? "[-]" : "[+]"}</span>
                </div>

                {/* Detail */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-2 flex flex-col gap-3 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#00ff88]/5 border border-[#00ff88]/15 p-2">
                        <div className="text-[7px] text-[#00ff88] font-mono mb-1 tracking-widest">EXPECTED</div>
                        <div className="text-[9px] text-[#b0bec5]">{issue.expected}</div>
                      </div>
                      <div className="bg-[#ff2d55]/5 border border-[#ff2d55]/15 p-2">
                        <div className="text-[7px] text-[#ff2d55] font-mono mb-1 tracking-widest">FOUND</div>
                        <div className="text-[9px] text-[#b0bec5]">{issue.found}</div>
                      </div>
                    </div>
                    <p className="text-[9px] text-[#7a8c9e] leading-relaxed">{issue.detail}</p>
                    <div className="bg-[#ffd600]/5 border border-[#ffd600]/15 p-2">
                      <span className="text-[7px] text-[#ffd600] font-mono tracking-widest">FIX: </span>
                      <span className="text-[9px] text-[#b0bec5]">{issue.fix}</span>
                    </div>
                    {issue.autoFixable && !isApplied && (
                      <button
                        onClick={() => applyFix(issue)}
                        className="w-full py-2 bg-[#00e5ff]/5 border border-[#00e5ff]/20 text-[#00e5ff] text-[9px] font-bold font-mono tracking-wider hover:bg-[#00e5ff]/10 transition-colors cursor-pointer"
                      >
                        {'APPLICA FIX -> '}{JSON.stringify(issue.autoFixValue)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-[#1c2836]">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 border border-[#1c2836] text-[#7a8c9e] text-[10px] font-mono tracking-wider hover:border-[#4a5a6a] transition-colors cursor-pointer"
          >
            CHIUDI
          </button>
          {!result.canPublish && onForcePublish && (
            <button
              onClick={onForcePublish}
              className="flex-1 py-2.5 border border-[#ff6b00]/30 text-[#ff6b00] text-[10px] font-mono tracking-wider hover:bg-[#ff6b00]/5 transition-colors cursor-pointer"
            >
              PUBBLICA COMUNQUE
            </button>
          )}
          {result.canPublish && (
            <div className="flex-1 py-2.5 bg-[#00ff88]/5 border border-[#00ff88]/20 text-[#00ff88] text-[10px] font-mono tracking-wider text-center">
              PRONTO PER LA PUBBLICAZIONE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { ValidationResult } from "@/lib/audit-validator"
