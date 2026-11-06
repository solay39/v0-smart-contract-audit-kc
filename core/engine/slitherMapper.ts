/**
 * Maps Slither findings (from the Solay39 Slither worker) to engine findings,
 * and decides which heuristic findings Slither makes redundant.
 */

import type { SlitherRunResult, SlitherWorkerFinding } from "../../lib/slither-client"
import type { StaticFinding } from "./auditEngine"

type Severity = StaticFinding["severity"]

/** Detectors whose High-impact findings are directly exploitable for loss of funds or control. */
const CRITICAL_CHECKS = new Set([
  "reentrancy-eth",
  "arbitrary-send-eth",
  "arbitrary-send-erc20",
  "arbitrary-send-erc20-permit",
  "suicidal",
  "controlled-delegatecall",
  "unprotected-upgrade",
  "delegatecall-loop",
  "msg-value-loop",
])

/** SWC / CWE references for the most common detectors. */
const REFS: Record<string, { swc?: string; cwe?: string; category: string }> = {
  "reentrancy-eth": { swc: "SWC-107", cwe: "CWE-841", category: "Reentrancy" },
  "reentrancy-no-eth": { swc: "SWC-107", cwe: "CWE-841", category: "Reentrancy" },
  "reentrancy-benign": { swc: "SWC-107", cwe: "CWE-841", category: "Reentrancy" },
  "reentrancy-events": { swc: "SWC-107", cwe: "CWE-841", category: "Reentrancy" },
  "reentrancy-unlimited-gas": { swc: "SWC-107", cwe: "CWE-841", category: "Reentrancy" },
  "arbitrary-send-eth": { swc: "SWC-105", cwe: "CWE-284", category: "Access Control" },
  "arbitrary-send-erc20": { swc: "SWC-105", cwe: "CWE-284", category: "Access Control" },
  "arbitrary-send-erc20-permit": { swc: "SWC-117", cwe: "CWE-284", category: "Access Control" },
  suicidal: { swc: "SWC-106", cwe: "CWE-284", category: "Access Control" },
  "unprotected-upgrade": { swc: "SWC-118", cwe: "CWE-665", category: "Upgradeability" },
  "controlled-delegatecall": { swc: "SWC-112", cwe: "CWE-829", category: "Delegatecall" },
  "delegatecall-loop": { swc: "SWC-112", cwe: "CWE-829", category: "Delegatecall" },
  "msg-value-loop": { cwe: "CWE-837", category: "Logic" },
  "tx-origin": { swc: "SWC-115", cwe: "CWE-477", category: "Authorization" },
  "unchecked-lowlevel": { swc: "SWC-104", cwe: "CWE-252", category: "Unchecked Return" },
  "unchecked-send": { swc: "SWC-104", cwe: "CWE-252", category: "Unchecked Return" },
  "unchecked-transfer": { swc: "SWC-104", cwe: "CWE-252", category: "Unchecked Return" },
  "unused-return": { swc: "SWC-104", cwe: "CWE-252", category: "Unchecked Return" },
  "weak-prng": { swc: "SWC-120", cwe: "CWE-330", category: "Randomness" },
  timestamp: { swc: "SWC-116", cwe: "CWE-829", category: "Timestamp Dependence" },
  "uninitialized-state": { swc: "SWC-109", cwe: "CWE-457", category: "Uninitialized Storage" },
  "uninitialized-storage": { swc: "SWC-109", cwe: "CWE-457", category: "Uninitialized Storage" },
  "uninitialized-local": { swc: "SWC-109", cwe: "CWE-457", category: "Uninitialized Storage" },
  "locked-ether": { cwe: "CWE-400", category: "Locked Funds" },
  "missing-zero-check": { cwe: "CWE-20", category: "Input Validation" },
  "incorrect-equality": { swc: "SWC-132", cwe: "CWE-697", category: "Logic" },
  "divide-before-multiply": { swc: "SWC-101", cwe: "CWE-682", category: "Arithmetic" },
  "calls-loop": { swc: "SWC-113", cwe: "CWE-400", category: "Denial of Service" },
  "costly-loop": { swc: "SWC-128", cwe: "CWE-400", category: "Denial of Service" },
  "shadowing-state": { swc: "SWC-119", cwe: "CWE-710", category: "Shadowing" },
  "shadowing-local": { swc: "SWC-119", cwe: "CWE-710", category: "Shadowing" },
  "solc-version": { swc: "SWC-102", cwe: "CWE-1104", category: "Compiler" },
  pragma: { swc: "SWC-103", cwe: "CWE-1104", category: "Compiler" },
  "low-level-calls": { cwe: "CWE-1109", category: "Low-Level Call" },
  "events-access": { cwe: "CWE-778", category: "Events" },
  "events-maths": { cwe: "CWE-778", category: "Events" },
  "encode-packed-collision": { swc: "SWC-133", cwe: "CWE-294", category: "Hash Collision" },
  "erc20-interface": { cwe: "CWE-573", category: "Token Standard" },
  "erc721-interface": { cwe: "CWE-573", category: "Token Standard" },
  "incorrect-modifier": { cwe: "CWE-670", category: "Access Control" },
  "protected-vars": { cwe: "CWE-284", category: "Access Control" },
  "unprotected-initializer": { swc: "SWC-118", cwe: "CWE-665", category: "Upgradeability" },
  "domain-separator-collision": { cwe: "CWE-294", category: "Signature" },
  "assembly": { cwe: "CWE-1104", category: "Code Quality" },
}

const IMPACT_BASE: Record<string, Severity> = {
  High: "HIGH",
  Medium: "MEDIUM",
  Low: "LOW",
  Informational: "INFO",
  Optimization: "INFO",
}
const DOWNGRADE: Record<Severity, Severity> = { CRITICAL: "HIGH", HIGH: "MEDIUM", MEDIUM: "LOW", LOW: "INFO", INFO: "INFO" }

export function slitherSeverity(f: Pick<SlitherWorkerFinding, "check" | "impact" | "confidence">): Severity {
  let sev = IMPACT_BASE[f.impact] ?? "INFO"
  if (sev === "HIGH" && CRITICAL_CHECKS.has(f.check) && f.confidence !== "Low") sev = "CRITICAL"
  if (f.confidence === "Low") sev = DOWNGRADE[sev]
  return sev
}

function likelihood(f: SlitherWorkerFinding): StaticFinding["likelihood"] {
  return f.confidence === "High" ? "High" : f.confidence === "Medium" ? "Medium" : "Low"
}

function location(f: SlitherWorkerFinding): string {
  const where = [f.contract, f.function ? `${f.function}()` : null].filter(Boolean).join(".")
  const lines = f.startLine ? (f.endLine && f.endLine !== f.startLine ? `L${f.startLine}-L${f.endLine}` : `L${f.startLine}`) : ""
  return [f.file, where, lines].filter(Boolean).join(" ") || "Contract-wide"
}

/** Slither descriptions contain absolute/relative paths; keep the human sentence. */
function cleanDescription(text: string): string {
  return text.replace(/\s*\([^()]*\.sol#[\d-]+\)/g, "").replace(/\n{3,}/g, "\n\n").trim()
}

export function slitherToFindings(result: SlitherRunResult): StaticFinding[] {
  if (result.status !== "ok") return []
  return result.findings.map((f) => {
    const ref = REFS[f.check]
    const severity = slitherSeverity(f)
    return {
      id: `SLITHER-${f.check}-${(f.id || "").slice(0, 10)}`,
      title: f.title || f.check,
      severity,
      category: ref?.category ?? "Static Analysis",
      description: cleanDescription(f.description),
      location: location(f),
      lineNumber: f.startLine ?? undefined,
      impact: `Slither ${f.check}: impact ${f.impact}, confidence ${f.confidence}.`,
      recommendation: f.recommendation || (f.wikiUrl ? `See ${f.wikiUrl}` : "Review the flagged code."),
      swcId: ref?.swc,
      cweId: ref?.cwe,
      likelihood: likelihood(f),
      codeEvidence: f.snippet || undefined,
      source: "slither",
      detector: f.check,
      referenceUrl: f.wikiUrl ?? undefined,
    } satisfies StaticFinding
  })
}

/**
 * Heuristic rule families (id prefixes of runStaticAnalysis) that Slither
 * analyses precisely. When Slither ran successfully these heuristics are
 * dropped: Slither either confirms the issue with data-flow evidence or the
 * heuristic was a false positive.
 */
const COVERED_HEURISTIC_PREFIXES = [
  "REENTRANCY",
  "TX-ORIGIN",
  "UNCHECKED-CALL",
  "DELEGATECALL",
  "SELFDESTRUCT",
  "TIMESTAMP",
  "WEAK-RANDOM",
  "PRAGMA",
  "LOCKED-ETHER",
  "ZERO-ADDRESS",
  "EVENT",
  "LOOP-DOS",
  "DOS-LOOP",
  "NO-EXIST-CHECK",
]

/** Signature / heuristic categories that Slither covers with data-flow analysis. */
const COVERED_CATEGORIES = new Set(["REENTRANCY", "UNCHECKED_RETURN", "Reentrancy", "Unchecked Return"])

export function isCoveredBySlither(f: StaticFinding): boolean {
  if (f.source === "slither") return false
  const id = f.id.replace(/^(SIG|HEUR)-/, "")
  if (COVERED_HEURISTIC_PREFIXES.some((p) => id.startsWith(p))) return true
  if (COVERED_CATEGORIES.has(f.category)) return true
  if (/^REENT|^UNCHK/i.test(id)) return true
  return /reentran/i.test(f.title)
}
