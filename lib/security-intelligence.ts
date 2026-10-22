import { createHash } from "node:crypto"

export type IntelligenceFinding = {
  id: string
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO"
  title: string
  line: number
  evidence: string
  confidence: "low"
  status: "unconfirmed"
}

export function analyzeSolidity(source: string) {
  const sourceHash = createHash("sha256").update(source).digest("hex")
  const lines = source.split(/\r?\n/)
  const findings: IntelligenceFinding[] = []
  const add = (severity: IntelligenceFinding["severity"], title: string, line: number, evidence: string) => {
    findings.push({ id: createHash("sha256").update(`${sourceHash}:${title}:${line}`).digest("hex").slice(0, 12), severity, title, line, evidence: evidence.trim().slice(0, 240), confidence: "low", status: "unconfirmed" })
  }
  lines.forEach((text, index) => {
    const line = index + 1
    if (/\btx\.origin\b/.test(text)) add("HIGH", "tx.origin used", line, text)
    if (/\bdelegatecall\s*\(/.test(text)) add("HIGH", "delegatecall detected", line, text)
    if (/\bselfdestruct\s*\(/.test(text)) add("HIGH", "selfdestruct detected", line, text)
    if (/\bcall\s*\{[^}]*value\s*:/.test(text)) add("MEDIUM", "Low-level value call", line, text)
    if (/\bblock\.timestamp\b/.test(text)) add("LOW", "block.timestamp usage", line, text)
    if (/\bpragma\s+solidity\s+\^/.test(text)) add("INFO", "Floating compiler pragma", line, text)
  })
  const weights = { HIGH: 25, MEDIUM: 10, LOW: 3, INFO: 1 }
  const riskScore = Math.min(100, findings.reduce((total, finding) => total + weights[finding.severity], 0))
  return { mode: "heuristic-preview", sourceHash, lines: lines.length, findings, rating: { riskScore, securityScore: null, coverage: 0, status: "partial" as const }, disclaimer: "Preview euristica: nessun scanner CI, exploit PoC, bytecode match, revisione umana o prova formale è stato eseguito." }
}
