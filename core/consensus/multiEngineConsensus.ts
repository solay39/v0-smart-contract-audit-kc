// Multi-engine consensus: cross-validates AI findings against deterministic
// engines (signature DB, ML detector, attack graph). A finding confirmed by
// independent engines gets higher confidence; deterministic HIGH/CRITICAL hits
// the AI missed are surfaced for mandatory manual review instead of being lost.

import { vulnSignatureDB, type VulnMatch } from "@/core/db/vulnSignatureDB"
import { mlVulnDetector } from "@/core/ai/mlVulnDetector"
import { buildAttackGraph, calculateRiskScore } from "@/core/security/attackGraph"
import { analyzeStructure } from "@/core/static/structuralAnalyzer"

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"

interface InputFinding {
  title?: unknown
  severity?: unknown
  location?: unknown
  description?: unknown
  [key: string]: unknown
}

export interface EngineHit {
  engine: "signature-db" | "ml-detector" | "structural-analyzer" | "slither" | "mythril"
  id: string
  name: string
  category: string
  severity: Severity
  confidence: number
  line?: number
  swc?: string
  cwe?: string
  remediation?: string
  realWorldExploits?: string[]
}

export interface ConsensusAnnotation {
  confirmedBy: string[]
  consensusConfidence: number
  consensusLevel: "CONFIRMED" | "CORROBORATED" | "AI_ONLY"
}

export interface ConsensusReport {
  version: string
  enginesRun: string[]
  totalEngineHits: number
  confirmedFindings: number
  aiOnlyFindings: number
  missedByAI: EngineHit[]
  attackGraph: {
    entryPoints: number
    criticalPaths: number
    riskScore: number
    riskLevel: string
  } | null
  overallConfidence: number
  durationMs: number
}

const STOPWORDS = new Set(["the", "and", "for", "with", "without", "missing", "lack", "unchecked", "potential", "possible", "function", "contract"])

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  reentrancy: ["reentrancy", "reentrant", "re-entrancy", "callback"],
  "access-control": ["access", "owner", "admin", "authorization", "privilege", "onlyowner", "role", "centraliz"],
  oracle: ["oracle", "price", "twap", "chainlink", "manipulation"],
  "flash-loan": ["flash", "flashloan"],
  signature: ["signature", "ecrecover", "replay", "permit", "nonce"],
  arithmetic: ["overflow", "underflow", "arithmetic", "precision", "rounding", "division"],
  "unchecked-call": ["unchecked", "return value", "low-level", "call"],
  "front-running": ["front", "mev", "sandwich", "slippage"],
  dos: ["denial", "dos", "gas limit", "unbounded", "loop"],
  proxy: ["proxy", "upgrade", "delegatecall", "initializ", "storage collision"],
  randomness: ["random", "blockhash", "timestamp"],
}

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  )
}

const CATEGORY_ALIASES: Record<string, string> = {
  integer_overflow: "arithmetic",
  unchecked_return: "unchecked-call",
  frontrunning: "front-running",
  denial_of_service: "dos",
  upgrade_safety: "proxy",
  oracle_manipulation: "oracle",
  price_manipulation: "oracle",
  logic_error: "randomness",
  centralization: "access-control",
}

function categoryKeywords(category: string): string[] {
  const raw = category.toLowerCase()
  const key = CATEGORY_ALIASES[raw] ?? raw.replace(/_/g, "-")
  for (const [cat, words] of Object.entries(CATEGORY_SYNONYMS)) {
    if (key.includes(cat) || cat.includes(key)) return words
  }
  return [key]
}

function hitMatchesFinding(hit: EngineHit, finding: InputFinding): boolean {
  const text = `${finding.title ?? ""} ${finding.description ?? ""}`.toLowerCase()
  if (categoryKeywords(hit.category).some((w) => text.includes(w))) return true
  const a = tokens(hit.name)
  const b = tokens(String(finding.title ?? ""))
  if (a.size === 0 || b.size === 0) return false
  const overlap = [...a].filter((w) => b.has(w)).length
  return overlap / Math.min(a.size, b.size) >= 0.5
}

function normalizeSeverity(s: unknown): Severity {
  const v = String(s ?? "").toUpperCase()
  return (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(v) ? v : "INFO") as Severity
}

function collectHits(code: string): { hits: EngineHit[]; enginesRun: string[] } {
  const hits: EngineHit[] = []
  const enginesRun: string[] = []

  try {
    const matches: VulnMatch[] = vulnSignatureDB.scanCode(code)
    enginesRun.push("signature-db")
    for (const m of matches) {
      hits.push({
        engine: "signature-db",
        id: m.signature.id,
        name: m.signature.name,
        category: m.signature.category,
        severity: m.signature.severity,
        confidence: m.confidence,
        line: m.line,
        swc: m.signature.swc,
        cwe: m.signature.cwe,
        remediation: m.signature.remediation,
        realWorldExploits: m.signature.realWorldExploits.map((e) => `${e.name} (${e.loss})`),
      })
    }
  } catch (err) {
    console.error("[consensus] signature-db failed:", err)
  }

  try {
    const structural = analyzeStructure(code)
    enginesRun.push("structural-analyzer")
    for (const s of structural) {
      hits.push({
        engine: "structural-analyzer",
        id: s.id,
        name: `${s.name} — ${s.functionName}()`,
        category: s.category,
        severity: s.severity,
        confidence: s.confidence,
        line: s.line,
        swc: s.swc,
        cwe: s.cwe,
        remediation: s.remediation,
      })
    }
  } catch (err) {
    console.error("[consensus] structural-analyzer failed:", err)
  }

  try {
    const ml = mlVulnDetector.analyze(code)
    enginesRun.push("ml-detector")
    for (const v of ml.vulnerabilities) {
      hits.push({
        engine: "ml-detector",
        id: v.id,
        name: v.name,
        category: v.category,
        severity: v.severity,
        confidence: v.confidence,
        line: v.location?.line,
        swc: v.swc,
        cwe: v.cwe,
        remediation: v.remediation,
        realWorldExploits: v.similarExploits,
      })
    }
  } catch (err) {
    console.error("[consensus] ml-detector failed:", err)
  }

  return { hits, enginesRun }
}

export function runMultiEngineConsensus<T extends InputFinding>(
  code: string,
  aiFindings: T[],
  externalHits: EngineHit[] = [],
): { findings: (T & ConsensusAnnotation)[]; report: ConsensusReport } {
  const start = Date.now()
  const { hits, enginesRun } = collectHits(code)
  hits.push(...externalHits)
  for (const engine of new Set(externalHits.map((h) => h.engine))) enginesRun.push(engine)
  const usedHits = new Set<number>()

  const findings = aiFindings.map((f) => {
    const confirming = hits
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => hitMatchesFinding(h, f))
    confirming.forEach(({ i }) => usedHits.add(i))

    const engines = [...new Set(confirming.map(({ h }) => h.engine))]
    const confirmedBy = ["ai", ...engines]
    const consensusLevel: ConsensusAnnotation["consensusLevel"] =
      engines.length >= 2 ? "CONFIRMED" : engines.length === 1 ? "CORROBORATED" : "AI_ONLY"
    const consensusConfidence = consensusLevel === "CONFIRMED" ? 95 : consensusLevel === "CORROBORATED" ? 85 : 70

    return { ...f, confirmedBy, consensusConfidence, consensusLevel }
  })

  const missedByAI = hits
    .filter((h, i) => !usedHits.has(i) && (h.severity === "CRITICAL" || h.severity === "HIGH") && h.confidence >= 60)
    .filter((h, i, arr) => arr.findIndex((x) => x.category === h.category && x.name === h.name) === i)
    .slice(0, 10)

  let attackGraph: ConsensusReport["attackGraph"] = null
  try {
    const graph = buildAttackGraph(
      aiFindings.map((f) => ({
        type: String(f.title ?? "finding"),
        severity: normalizeSeverity(f.severity),
        location: String(f.location ?? "unknown"),
        description: String(f.description ?? ""),
      })),
    )
    const risk = calculateRiskScore(graph)
    attackGraph = {
      entryPoints: graph.entryPoints.length,
      criticalPaths: graph.criticalPaths.length,
      riskScore: risk.score,
      riskLevel: risk.level,
    }
    enginesRun.push("attack-graph")
  } catch (err) {
    console.error("[consensus] attack-graph failed:", err)
  }

  const confirmedFindings = findings.filter((f) => f.consensusLevel !== "AI_ONLY").length
  const overallConfidence = findings.length
    ? Math.round(findings.reduce((s, f) => s + f.consensusConfidence, 0) / findings.length)
    : missedByAI.length ? 60 : 90

  return {
    findings,
    report: {
      version: "1.0.0",
      enginesRun: ["ai", ...enginesRun],
      totalEngineHits: hits.length,
      confirmedFindings,
      aiOnlyFindings: findings.length - confirmedFindings,
      missedByAI,
      attackGraph,
      overallConfidence,
      durationMs: Date.now() - start,
    },
  }
}
