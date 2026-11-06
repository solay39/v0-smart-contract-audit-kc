/**
 * Solay39 AI Audit Engine — auditEngine.ts
 * UPGRADE v2: Every StaticFinding now carries CertiK-grade fields:
 *   cvss       → full CVSSv3.1 vector + base score
 *   likelihood → "High" | "Medium" | "Low"
 *   codeEvidence → exact snippet proving the finding
 *   remediationExample → Solidity showing the correct fix
 *   foundryPoC → runnable forge test for HIGH/CRITICAL
 */

import { parseContract, getAttackSurface, type ParseResult } from "./codeParser"
import { scanDependencies, type DependencyScanResult } from "./dependencyScanner"
import { analyzeEconomicAttacks, type EconomicAnalysisResult } from "./economicAnalyzer"
import { analyzeCrossChain, type CrossChainAnalysisResult } from "./crossChainAnalyzer"
import { computeCVSS, type CVSSVector } from "../severity/cvssEngine"
// CertiK-level integrations
import { MLVulnDetector, type MLVulnerability } from "../ai/mlVulnDetector"
import { VulnSignatureDB, type VulnMatch } from "../db/vulnSignatureDB"
import { ChainRegistry, type ChainConfig, type ChainSpecificPattern } from "../multichain/chainRegistry"
import { runSlither, type SlitherRunResult } from "../../lib/slither-client"
import { isCoveredBySlither, slitherToFindings } from "./slitherMapper"

export interface AuditEngineResult {
  metadata: {
    contractName: string
    network: string
    address?: string
    linesOfCode: number
    complexity: number
    timestamp: string
    chainConfig?: ChainConfig
  }
  parsing: ParseResult
  dependencies: DependencyScanResult
  staticAnalysis: {
    findings: StaticFinding[]
    /** Not measured: there is no ground-truth benchmark yet, so no coverage percentage is claimed. */
    coverage: number | null
    /** Number of distinct checks actually executed on this contract. */
    checksRun: number
  }
  // Heuristic exploit-similarity and signature analysis (keyword/regex based, not a trained model)
  mlAnalysis: {
    vulnerabilities: MLVulnerability[]
    riskScore: number
    confidence: number
  }
  signatureMatches: SignatureMatchSummary[]
  chainSpecificVulns: ChainSpecificPattern[]
  /** Which engines produced the findings, with tool versions for reproducibility. */
  toolchain: {
    mode: "slither" | "heuristic-only"
    slither: Omit<SlitherRunResult, "findings"> & { findingsCount: number }
    /** Heuristic findings discarded because Slither analysed the same class precisely */
    heuristicFindingsDropped: number
  }
  // Standard analysis
  economic: EconomicAnalysisResult
  crossChain: CrossChainAnalysisResult
  threatModel: ThreatModel
  attackSimulations: AttackSimulation[]
  summary: AuditSummary
}

export interface SignatureMatchSummary {
  signatureId: string
  name: string
  severity: StaticFinding["severity"]
  category: string
  /** 1-based line of the first occurrence */
  line: number
  occurrences: number
  matchedText: string
}

export interface StaticFinding {
  id: string
  title: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  category: string
  description: string
  location: string
  lineNumber?: number
  impact: string
  recommendation: string
  swcId?: string
  cweId?: string
  cvss?: { score: number; severity: string; vector: string; vectorString: string }
  likelihood?: "High" | "Medium" | "Low"
  codeEvidence?: string
  remediationExample?: string
  foundryPoC?: string
  /** Engine that produced the finding. Heuristic and signature findings need manual confirmation. */
  source?: "slither" | "heuristic" | "signature"
  /** Slither detector name, when source = "slither" */
  detector?: string
  referenceUrl?: string
}

export interface ThreatModel {
  attackSurface: string[]
  entryPoints: string[]
  highValueTargets: string[]
  attackers: { type: string; capability: string; motivation: string }[]
  threatScenarios: string[]
}

export interface AttackSimulation {
  name: string
  type: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  steps: string[]
  prerequisites: string[]
  estimatedImpact: string
  exploitCode?: string
  mitigation: string
}

export interface AuditSummary {
  overallRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE"
  score: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  infoCount: number
  passedChecks: number
  totalChecks: number
  recommendations: string[]
}

const CVSS_PRESETS: Record<string, CVSSVector> = {
  REENTRANCY:      { AV: "N", AC: "L", PR: "N", UI: "N", S: "C", C: "H", I: "H", A: "H" },
  UNCHECKED_CALL:  { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  TX_ORIGIN:       { AV: "N", AC: "L", PR: "N", UI: "R", S: "C", C: "H", I: "H", A: "H" },
  DELEGATECALL:    { AV: "N", AC: "L", PR: "N", UI: "N", S: "C", C: "H", I: "H", A: "H" },
  SELFDESTRUCT:    { AV: "N", AC: "L", PR: "N", UI: "N", S: "C", C: "N", I: "H", A: "H" },
  OVERFLOW:        { AV: "N", AC: "H", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  ZERO_ADDRESS:    { AV: "N", AC: "H", PR: "L", UI: "N", S: "U", C: "N", I: "H", A: "H" },
  FLOATING_PRAGMA: { AV: "N", AC: "H", PR: "N", UI: "N", S: "U", C: "N", I: "L", A: "N" },
  MISSING_EVENT:   { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "L", A: "N" },
  // Nuovi preset v3
  SIG_REPLAY:         { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  WEAK_RANDOM:        { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "L", I: "H", A: "N" },
  UNPROTECTED_INIT:   { AV: "N", AC: "L", PR: "N", UI: "N", S: "C", C: "H", I: "H", A: "H" },
  UNBOUNDED_LOOP:     { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "H" },
  ECRECOVER_ZERO:     { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  FRONT_RUN:          { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  CENTRALIZATION:     { AV: "N", AC: "L", PR: "H", UI: "N", S: "C", C: "H", I: "H", A: "H" },
  LOCKED_ETHER:       { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  DOS_LOOP:           { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "H" },
  MISSING_EXIST:      { AV: "N", AC: "H", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
  ARBI_TRANSFER:      { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "H", A: "N" },
}

function cvss(preset: CVSSVector) {
  const r = computeCVSS(preset)
  return { score: r.score, severity: r.severity, vector: r.vector, vectorString: r.vector }
}

function likelihood(sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"): "High" | "Medium" | "Low" {
  if (sev === "CRITICAL") return "High"
  if (sev === "HIGH") return "Medium"
  return "Low"
}

function reentrancyPoC(contractName: string, loc: string): string {
  return `// SPDX-License-Identifier: MIT
// Solay39 Auto-Generated PoC — ${loc}
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

interface ITarget {
    function withdraw(uint256 amount) external;
    function deposit() external payable;
}

contract Attacker {
    ITarget target; uint count;
    constructor(address _t) { target = ITarget(_t); }
    receive() external payable {
        if (count++ < 3) target.withdraw(1 ether);
    }
    function attack() external payable {
        target.deposit{value: 1 ether}();
        target.withdraw(1 ether);
    }
}

contract ${contractName}ReentrancyTest is Test {
    // vm.createSelectFork(MAINNET_RPC);
    // ITarget target = ITarget(DEPLOYED_ADDRESS);
    Attacker atk;
    function setUp() public { atk = new Attacker(address(0)); vm.deal(address(atk), 2 ether); }
    function test_reentrancy() public {
        atk.attack();
    }
}
// forge test --match-test test_reentrancy -vvvv`
}

function signatureReplayPoC(contractName: string, loc: string): string {
  return `// SOLAY39 Foundry PoC — Signature Replay (${loc})
// forge test --match-test test_signatureReplay -vvvv
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

contract SignatureReplayTest is Test {
    ${contractName} target;
    uint256 signerPk = 0xA11CE;
    address signer;

    function setUp() public {
        signer = vm.addr(signerPk);
        target = new ${contractName}();
    }

    function test_signatureReplay() public {
        bytes32 hash = keccak256(abi.encodePacked(signer, uint256(100)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, hash);
        bytes memory sig = abi.encodePacked(r, s, v);

        // First call — should succeed
        target.execute(signer, 100, sig);

        // Replay same signature — should REVERT but DOESN'T (bug)
        target.execute(signer, 100, sig);
        // If we reach here, replay attack succeeded
    }
}`
}

// Heuristic analysis modules (shared, stateless after construction)
const mlDetector = new MLVulnDetector()
const vulnDB = new VulnSignatureDB()
const chainRegistry = new ChainRegistry()

/** Distinct rule families implemented in runStaticAnalysis(). Keep in sync when adding rules. */
const STATIC_RULE_FAMILIES = 25

const SEVERITY_RANK: Record<StaticFinding["severity"], number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 }

function resolveChain(network?: string, chainId?: number): ChainConfig | undefined {
  const chains = chainRegistry.getAllChains()
  if (chainId !== undefined) {
    const byId = chains.find((c) => c.chainId === chainId)
    if (byId) return byId
  }
  const key = (network || "ethereum").trim().toLowerCase()
  return chainRegistry.getChain(key) ?? chains.find((c) => c.name.toLowerCase() === key)
}

function lineSnippet(code: string, line: number): string {
  return code.split("\n")[line - 1]?.trim() ?? ""
}

/** Group raw regex hits so one signature produces one finding, not one per occurrence. */
function summarizeSignatureMatches(matches: VulnMatch[]): SignatureMatchSummary[] {
  const bySig = new Map<string, SignatureMatchSummary>()
  for (const m of matches) {
    const existing = bySig.get(m.signature.id)
    if (existing) {
      existing.occurrences++
      continue
    }
    bySig.set(m.signature.id, {
      signatureId: m.signature.id,
      name: m.signature.name,
      severity: m.signature.severity,
      category: m.signature.category,
      line: m.line,
      occurrences: 1,
      matchedText: m.matchedText.slice(0, 200),
    })
  }
  return [...bySig.values()]
}

export async function runAuditEngine(
  code: string,
  options: {
    contractName?: string
    network?: string
    address?: string
    chainId?: number
    includeAttackSimulation?: boolean
    includeMLAnalysis?: boolean
    /** Multi-file sources (path -> content). When omitted, `code` is analysed as a single file. */
    sources?: Record<string, string>
    /** Pre-computed Slither result (tests, cached runs), or false to skip Slither. */
    slither?: SlitherRunResult | false
  } = {}
): Promise<AuditEngineResult> {
  // Primary engine: Slither (runs remotely on the Slither worker, in parallel with the heuristics)
  const slitherPromise: Promise<SlitherRunResult> =
    options.slither === false
      ? Promise.resolve({ tool: "slither", status: "unavailable", findings: [], error: "Disabled for this run" })
      : options.slither
        ? Promise.resolve(options.slither)
        : runSlither({ code: options.sources ? undefined : code, sources: options.sources, contractName: options.contractName })

  const parsing = parseContract(code)
  const mainContract = parsing.contracts[0]
  const dependencies = scanDependencies(code, mainContract?.imports || [])
  const staticFindings = runStaticAnalysis(code, parsing)
  const economic = analyzeEconomicAttacks(code)
  const crossChain = analyzeCrossChain(code)
  const threatModel = buildThreatModel(code, parsing, dependencies)

  // Signature database (regex signatures of known vulnerability classes)
  const rawSignatureMatches = vulnDB.scanCode(code)
  const signatureMatches = summarizeSignatureMatches(rawSignatureMatches)
  const signatureById = new Map(rawSignatureMatches.map((m) => [m.signature.id, m.signature]))

  // Heuristic exploit similarity (keyword overlap with historical exploits)
  const ml = options.includeMLAnalysis !== false ? mlDetector.analyze(code) : null
  const mlAnalysis = {
    vulnerabilities: ml?.vulnerabilities ?? [],
    riskScore: ml?.riskScore ?? 0,
    confidence: ml?.confidence ?? 0,
  }

  const chainConfig = resolveChain(options.network, options.chainId)
  const chainSpecificVulns = chainConfig ? chainRegistry.getChainPatterns(chainConfig.id) : []

  const sigFindings: StaticFinding[] = signatureMatches.map((m) => {
    const sig = signatureById.get(m.signatureId)!
    return {
      id: `SIG-${m.signatureId}`,
      title: m.name,
      severity: m.severity,
      category: m.category,
      description: m.occurrences > 1 ? `${sig.description} (${m.occurrences} occurrences)` : sig.description,
      location: `Line ${m.line}`,
      lineNumber: m.line,
      impact: sig.impact,
      recommendation: sig.remediation,
      swcId: sig.swc,
      cweId: sig.cwe,
      likelihood: m.severity === "CRITICAL" ? "High" : m.severity === "HIGH" ? "Medium" : "Low",
      codeEvidence: lineSnippet(code, m.line) || m.matchedText,
    }
  })

  // ML vulnerabilities that are not just re-emitted signature hits
  const mlFindings: StaticFinding[] = mlAnalysis.vulnerabilities
    .filter((v) => !signatureById.has(v.id))
    .map((v) => ({
      id: `HEUR-${v.id}`,
      title: v.name,
      severity: v.severity,
      category: v.category,
      description: v.similarExploits.length
        ? `${v.description} Similar historical exploits: ${v.similarExploits.slice(0, 3).join(", ")}.`
        : v.description,
      location: v.location ? `Line ${v.location.line}` : "Contract-wide",
      lineNumber: v.location?.line,
      impact: v.description,
      recommendation: v.remediation,
      swcId: v.swc,
      cweId: v.cwe,
      likelihood: v.confidence >= 80 ? "High" : v.confidence >= 50 ? "Medium" : "Low",
      codeEvidence: v.location?.code,
      foundryPoC: v.foundryPoC,
    }))

  const heuristicFindings: StaticFinding[] = [
    ...staticFindings.map((f) => ({ ...f, source: "heuristic" as const })),
    ...sigFindings.map((f) => ({ ...f, source: "signature" as const })),
    ...mlFindings.map((f) => ({ ...f, source: "heuristic" as const })),
  ]

  const slither = await slitherPromise
  const slitherOk = slither.status === "ok"
  const slitherFindings = slitherToFindings(slither)
  const keptHeuristics = slitherOk ? heuristicFindings.filter((f) => !isCoveredBySlither(f)) : heuristicFindings

  const allFindings = deduplicateFindings(
    [...slitherFindings, ...keptHeuristics].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        Number(b.source === "slither") - Number(a.source === "slither")
    )
  )
  // Attack simulations follow the final findings (Slither-confirmed when available)
  const attackSimulations = options.includeAttackSimulation !== false
    ? buildAttackSimulations(economic, allFindings)
    : []
  const { findings: _slitherRaw, ...slitherMeta } = slither
  const toolchain: AuditEngineResult["toolchain"] = {
    mode: slitherOk ? "slither" : "heuristic-only",
    slither: { ...slitherMeta, findingsCount: slitherFindings.length },
    heuristicFindingsDropped: heuristicFindings.length - keptHeuristics.length,
  }

  const checksRun =
    STATIC_RULE_FAMILIES + vulnDB.getStats().totalSignatures + chainSpecificVulns.length + (slitherOk ? slither.detectorsRun ?? 0 : 0)
  const triggeredChecks = new Set(allFindings.map((f) => f.id.replace(/-\d+$/, ""))).size

  const summary = calculateSummary(
    [
      ...allFindings,
      ...economic.vulnerabilities.map((v) => ({ severity: v.severity })),
      ...crossChain.vulnerabilities.map((v) => ({ severity: v.severity })),
    ],
    checksRun,
    triggeredChecks
  )

  return {
    metadata: {
      contractName: options.contractName || mainContract?.name || "Unknown",
      network: options.network || chainConfig?.name || "Unknown",
      address: options.address,
      linesOfCode: mainContract?.linesOfCode || code.split("\n").length,
      complexity: mainContract?.complexity || 0,
      timestamp: new Date().toISOString(),
      chainConfig,
    },
    parsing,
    dependencies,
    staticAnalysis: {
      findings: allFindings,
      coverage: null,
      checksRun,
    },
    mlAnalysis,
    signatureMatches,
    chainSpecificVulns,
    toolchain,
    economic,
    crossChain,
    threatModel,
    attackSimulations,
    summary,
  }
}

// ── Source helpers for function-scoped rules ────────────────────────
interface FunctionBody { name: string; header: string; bodyStart: number; end: number }

function stripLineComment(line: string): string {
  const i = line.indexOf("//")
  return i >= 0 ? line.slice(0, i) : line
}

/** Locates every `function name(...) ... { ... }` with brace matching (comments and strings are ignored). */
function extractFunctionBodies(lines: string[]): FunctionBody[] {
  const out: FunctionBody[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = stripLineComment(lines[i]).match(/\bfunction\s+(\w+)\s*\(/)
    if (!m) continue
    let header = ""
    let depth = 0
    let opened = false
    let bodyStart = -1
    for (let j = i; j < lines.length; j++) {
      const line = stripLineComment(lines[j]).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
      for (let k = 0; k < line.length; k++) {
        const ch = line[k]
        if (!opened) {
          if (ch === ";") { j = lines.length; break } // interface / abstract declaration
          if (ch === "{") { opened = true; depth = 1; bodyStart = j; continue }
          header += ch
        } else if (ch === "{") depth++
        else if (ch === "}") {
          depth--
          if (depth === 0) { out.push({ name: m[1], header, bodyStart, end: j }); j = lines.length; break }
        }
      }
      if (!opened) header += " "
    }
  }
  return out
}

/** Contract-level storage variables: parser output plus a declaration scan outside function bodies. */
function collectStateVariables(code: string, parsing: ParseResult): Set<string> {
  const names = new Set<string>()
  const lines = code.split("\n")
  const inFunction = new Set<number>()
  for (const fn of extractFunctionBodies(lines)) for (let i = fn.bodyStart; i <= fn.end; i++) inFunction.add(i)
  // The parser also reports local variables, so keep only declarations outside function bodies.
  for (const c of parsing.contracts)
    for (const v of c.variables) if (v.isMutable !== false && !inFunction.has(v.lineNumber - 1)) names.add(v.name)
  const decl = /^\s*(?:mapping\s*\(.*\)|[A-Za-z_][\w.]*(?:\[\d*\])*)\s+(?:(?:public|private|internal|override)\s+)*(?!constant\b|immutable\b)([A-Za-z_]\w*)\s*(?:=[^;]*)?;/
  lines.forEach((raw, i) => {
    if (inFunction.has(i)) return
    const line = stripLineComment(raw)
    if (/\b(constant|immutable|event|error|using|import|pragma|return)\b/.test(line)) return
    const m = line.match(decl)
    if (m) names.add(m[1])
  })
  return names
}

function writesStateVariable(line: string, stateVars: Set<string>): boolean {
  for (const v of stateVars) {
    const esc = v.replace(/[$]/g, "\\$")
    const assign = new RegExp(`(?:^|[^\\w.])${esc}(?:\\s*\\[[^\\]]*\\])*(?:\\.\\w+)?\\s*(?:[+\\-*/%|&^]|<<|>>)?=(?!=)`)
    const mutate = new RegExp(`(?:^|[^\\w.])${esc}(?:\\s*\\[[^\\]]*\\])*\\.(?:push|pop)\\s*\\(|\\bdelete\\s+${esc}\\b|(?:\\+\\+|--)\\s*${esc}\\b|\\b${esc}(?:\\s*\\[[^\\]]*\\])*\\s*(?:\\+\\+|--)`)
    if (assign.test(line) || mutate.test(line)) return true
  }
  return false
}

// Deduplicate findings by title similarity
function deduplicateFindings(findings: StaticFinding[]): StaticFinding[] {
  const seen = new Set<string>()
  return findings.filter(f => {
    const key = f.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function runStaticAnalysis(code: string, parsing: ParseResult): StaticFinding[] {
  const findings: StaticFinding[] = []
  const lines = code.split("\n")
  const cname = parsing.contracts[0]?.name || "Contract"

  // 1. Reentrancy (per function: external call with value/control transfer followed by a storage write)
  const stateVars = collectStateVariables(code, parsing)
  for (const fn of extractFunctionBodies(lines)) {
    if (/\bnonReentrant\b/.test(fn.header)) continue
    let callLine = -1
    for (let i = fn.bodyStart; i <= fn.end; i++) {
      const line = stripLineComment(lines[i])
      // .transfer()/.send() forward only 2300 gas and cannot re-enter; token calls are covered by signatures
      if (callLine < 0 && /\.call\s*\{[^}]*value\s*:|\.call\s*\(|\.delegatecall\s*\(/.test(line)) {
        callLine = i
        continue
      }
      if (callLine >= 0 && writesStateVariable(line, stateVars)) {
        const snip = lines.slice(callLine, i + 1).join("\n")
        const cl = callLine + 1
        findings.push({
          id: "REENTRANCY-001",
          title: "Reentrancy: State Update After External Call (CEI Violation)",
          severity: "CRITICAL",
          category: "Reentrancy",
          description: `In ${fn.name}(), the external call at line ${cl} happens before the storage write at line ${i + 1}. A malicious receiver can re-enter ${fn.name}() before the state is updated.`,
          location: `${fn.name}() line ${cl}`,
          lineNumber: cl,
          impact: "Attacker can recursively drain the contract's entire ETH balance in a single transaction.",
          recommendation: "Move all state writes BEFORE the external call (CEI pattern), or add OpenZeppelin ReentrancyGuard and the nonReentrant modifier to this function.",
          swcId: "SWC-107", cweId: "CWE-841",
          cvss: cvss(CVSS_PRESETS.REENTRANCY),
          likelihood: "High",
          codeEvidence: snip,
          remediationExample: `// CEI pattern — state update BEFORE external call
balances[msg.sender] = 0;
(bool ok,) = msg.sender.call{value: amount}("");
require(ok, "Transfer failed");`,
          foundryPoC: reentrancyPoC(cname, `${fn.name}() line ${cl}`),
        })
        break
      }
    }
  }

  // 2. Unchecked call return
  for (let i = 0; i < lines.length; i++) {
    if (/\.call\(|\.call\{/.test(lines[i]) && !/\(bool\s+\w+,|require\(.*\.call/.test(lines[i])) {
      let hasCheck = false
      for (let j = i; j < Math.min(i + 3, lines.length); j++) {
        if (/require\(|if\s*\(!?\s*success/.test(lines[j])) { hasCheck = true; break }
      }
      if (!hasCheck) {
        findings.push({
          id: "UNCHECKED-CALL-001",
          title: "Unchecked Low-Level Call Return Value",
          severity: "HIGH",
          category: "Unchecked Return",
          description: `call() at line ${i + 1} does not check its boolean return value. A failed call silently continues execution.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Silent failure of ETH transfer; contract state becomes inconsistent.",
          recommendation: "Capture and check: (bool ok,) = addr.call(...); require(ok);",
          swcId: "SWC-104", cweId: "CWE-252",
          cvss: cvss(CVSS_PRESETS.UNCHECKED_CALL),
          likelihood: likelihood("HIGH"),
          codeEvidence: lines[i].trim(),
          remediationExample: `(bool success, bytes memory data) = target.call{value: amount}(payload);
require(success, "Low-level call failed");`,
        })
      }
    }
  }

  // 3. tx.origin
  for (let i = 0; i < lines.length; i++) {
    if (/tx\.origin/.test(lines[i]) && /require|==|!=/.test(lines[i])) {
      findings.push({
        id: "TX-ORIGIN-001",
        title: "Authorization via tx.origin — Phishing Vulnerable",
        severity: "HIGH",
        category: "Access Control",
        description: `Line ${i + 1} uses tx.origin for authorization. An attacker can trick the owner into calling a malicious contract, bypassing this check.`,
        location: `Line ${i + 1}`,
        lineNumber: i + 1,
        impact: "Phishing attack allows execution of privileged functions on behalf of the owner.",
        recommendation: "Replace tx.origin with msg.sender for all authorization checks.",
        swcId: "SWC-115", cweId: "CWE-290",
        cvss: cvss(CVSS_PRESETS.TX_ORIGIN),
        likelihood: likelihood("HIGH"),
        codeEvidence: lines[i].trim(),
        remediationExample: `// Before: require(tx.origin == owner);
// After:
require(msg.sender == owner, "not owner");`,
      })
    }
  }

  // 4. Delegatecall
  for (let i = 0; i < lines.length; i++) {
    if (/\.delegatecall\(/.test(lines[i])) {
      findings.push({
        id: "DELEGATECALL-001",
        title: "Unprotected delegatecall to Dynamic Address",
        severity: "CRITICAL",
        category: "Dangerous Function",
        description: `delegatecall() at line ${i + 1} executes external code in this contract's storage context. If target is user-controlled, storage takeover is possible.`,
        location: `Line ${i + 1}`,
        lineNumber: i + 1,
        impact: "Arbitrary storage write → complete contract takeover and fund drain.",
        recommendation: "Ensure delegatecall target is an immutable address set at construction. Never allow user input.",
        swcId: "SWC-112", cweId: "CWE-829",
        cvss: cvss(CVSS_PRESETS.DELEGATECALL),
        likelihood: likelihood("CRITICAL"),
        codeEvidence: lines[i].trim(),
        remediationExample: `address public immutable IMPL;
constructor(address _impl) { IMPL = _impl; }
// Use: IMPL.delegatecall(data) — never a user-supplied address`,
      })
    }
  }

  // 5. selfdestruct
  for (let i = 0; i < lines.length; i++) {
    if (/selfdestruct\(|suicide\(/.test(lines[i])) {
      findings.push({
        id: "SELFDESTRUCT-001",
        title: "Unprotected selfdestruct Instruction",
        severity: "HIGH",
        category: "Dangerous Function",
        description: `selfdestruct() at line ${i + 1}. Post-EIP-6780 code is not deleted but ETH is still forwarded to the beneficiary.`,
        location: `Line ${i + 1}`,
        lineNumber: i + 1,
        impact: "Contract ETH drained; dependent contracts bricked.",
        recommendation: "Remove selfdestruct. If a kill-switch is essential, use multisig + 48h timelock.",
        swcId: "SWC-106", cweId: "CWE-664",
        cvss: cvss(CVSS_PRESETS.SELFDESTRUCT),
        likelihood: likelihood("HIGH"),
        codeEvidence: lines[i].trim(),
      })
    }
  }

  // 6. Integer overflow (Solidity < 0.8 without SafeMath)
  const pm = code.match(/pragma\s+solidity\s+([^;]+);/)
  if (pm && /0\.[0-7]/.test(pm[1]) && !/SafeMath/.test(code)) {
    findings.push({
      id: "OVERFLOW-001",
      title: "Integer Overflow/Underflow — No SafeMath",
      severity: "HIGH",
      category: "Arithmetic",
      description: `Solidity ${pm[1].trim()} lacks built-in overflow protection and SafeMath is not imported.`,
      location: "Contract-wide",
      impact: "Wrapped balances or counters can enable double-spends or bypassed conditions.",
      recommendation: "Upgrade to Solidity >=0.8.0, or use SafeMath for all arithmetic.",
      swcId: "SWC-101", cweId: "CWE-190",
      cvss: cvss(CVSS_PRESETS.OVERFLOW),
      likelihood: likelihood("HIGH"),
      codeEvidence: `pragma solidity ${pm[1].trim()};  // no built-in overflow check, SafeMath not found`,
      remediationExample: `// Option A
pragma solidity 0.8.20;
// Option B
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
using SafeMath for uint256;`,
    })
  }

  // 7. Missing zero-address validation
  const adminRx = /function\s+(setOwner|transferOwnership|setAdmin|updateAdmin|setOperator)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = adminRx.exec(code)) !== null) {
    const ln = code.substring(0, m.index).split("\n").length
    const body = code.substring(m.index, code.indexOf("}", m.index))
    if (!/require.*!=.*address\(0\)|address\(0\)\s*!=/.test(body)) {
      findings.push({
        id: "ZERO-ADDRESS-001",
        title: `Missing Zero-Address Guard in ${m[1]}()`,
        severity: "MEDIUM",
        category: "Input Validation",
        description: `${m[1]}() at line ${ln} does not validate against address(0). An accidental call will permanently lock admin functions.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "Permanent loss of admin access; no recovery mechanism.",
        recommendation: `Add require(newAddr != address(0), "Zero address"); as the first check.`,
        swcId: "SWC-123", cweId: "CWE-20",
        cvss: cvss(CVSS_PRESETS.ZERO_ADDRESS),
        likelihood: likelihood("MEDIUM"),
        codeEvidence: lines[ln - 1]?.trim() || m[0],
        remediationExample: `function ${m[1]}(address newAdmin) external onlyOwner {
    require(newAdmin != address(0), "Zero address not allowed");
    admin = newAdmin;
    emit AdminUpdated(newAdmin);
}`,
      })
    }
  }

  // 8. Floating pragma
  if (pm && pm[1].includes("^")) {
    findings.push({
      id: "PRAGMA-001",
      title: "Floating Pragma — Unpinned Compiler Version",
      severity: "LOW",
      category: "Best Practices",
      description: `Pragma ${pm[1].trim()} uses the ^ caret, allowing deployment with any compatible compiler version.`,
      location: "Line 1",
      lineNumber: 1,
      impact: "Potential deployment with an untested compiler version.",
      recommendation: "Pin to an exact version: pragma solidity 0.8.20;",
      swcId: "SWC-103", cweId: "CWE-693",
      cvss: cvss(CVSS_PRESETS.FLOATING_PRAGMA),
      likelihood: likelihood("LOW"),
      codeEvidence: `pragma solidity ${pm[1].trim()};`,
      remediationExample: `pragma solidity 0.8.20;`,
    })
  }

  // 9. Missing events
  const scFuncs = parsing.contracts.flatMap(c =>
    c.functions.filter(f => f.hasStateChange && (f.visibility === "public" || f.visibility === "external"))
  )
  if (scFuncs.length > 0 && !/emit\s+\w+/.test(code)) {
    findings.push({
      id: "EVENT-001",
      title: "Missing Event Emissions on State-Changing Functions",
      severity: "LOW",
      category: "Transparency",
      description: `${scFuncs.length} public/external state-changing functions emit no events.`,
      location: scFuncs.slice(0, 2).map(f => `${f.name}()`).join(", "),
      impact: "Off-chain monitoring tools cannot track state changes.",
      recommendation: "Emit events for every critical state mutation.",
      swcId: "SWC-129",
      cvss: { score: 3.1, severity: "LOW", vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N", vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N" },
      likelihood: "Low",
      codeEvidence: scFuncs.slice(0, 2).map(f => `function ${f.name}(...)  // no emit`).join("\n"),
      remediationExample: `event OwnerUpdated(address indexed prev, address indexed next);
function transferOwnership(address newOwner) external onlyOwner {
    emit OwnerUpdated(owner, newOwner);
    owner = newOwner;
}`,
    })
  }

  // 10. public → external
  for (const contract of parsing.contracts) {
    for (const func of contract.functions) {
      if (func.visibility === "public" && !func.body?.includes("this.")) {
        findings.push({
          id: `GAS-${func.name.toUpperCase().slice(0, 8)}-001`,
          title: `${func.name}(): public Can Be external (Gas Optimization)`,
          severity: "INFO",
          category: "Gas Optimization",
          description: `${func.name}() is public but never called internally. external is cheaper.`,
          location: `Line ${func.lineStart}`,
          lineNumber: func.lineStart,
          impact: "Minor: slightly higher gas per external call.",
          recommendation: "Change visibility from public to external.",
          cvss: { score: 0.0, severity: "NONE", vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N" },
          likelihood: "Low",
          codeEvidence: `function ${func.name}(...) public`,
          remediationExample: `function ${func.name}(...) external { ... }`,
        })
      }
    }
  }


  // ── NUOVI CHECK v3 ─────────────────────────────────────────────

  // [NEW-01] Signature Replay Attack
  if (/ecrecover\s*\(/.test(code)) {
    const hasNonce = /nonce|nonces|_nonce/.test(code)
    const hasChainId = /block\.chainid|chainId|DOMAIN_SEPARATOR|EIP712/.test(code)
    if (!hasNonce || !hasChainId) {
      const ln = lines.findIndex((l) => /ecrecover/.test(l)) + 1
      findings.push({
        id: "SIG-REPLAY-001",
        title: `Signature Replay Attack — Missing ${!hasNonce ? "Nonce" : ""}${!hasNonce && !hasChainId ? " + " : ""}${!hasChainId ? "ChainId" : ""}`,
        severity: "CRITICAL",
        category: "Signature Security",
        description: `ecrecover() found at line ${ln} without ${!hasNonce ? "nonce tracking" : ""}${!hasNonce && !hasChainId ? " and " : ""}${!hasChainId ? "chain ID binding" : ""}. A valid signature can be replayed by anyone.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "Attacker can replay any previously signed transaction to re-execute privileged operations.",
        recommendation: "Implement EIP-712 structured signing with nonce per address and chainId binding. Invalidate nonces after use.",
        swcId: "SWC-121", cweId: "CWE-294",
        cvss: cvss(CVSS_PRESETS.SIG_REPLAY),
        likelihood: "High",
        codeEvidence: lines[ln - 1]?.trim(),
        remediationExample: `// EIP-712 domain separator with chainId\nbytes32 public DOMAIN_SEPARATOR;\nmapping(address => uint256) public nonces;\n\nfunction _verify(address signer, bytes32 hash, bytes memory sig) internal {\n    bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR, hash));\n    require(ecrecover(digest, v, r, s) == signer, "Invalid sig");\n    nonces[signer]++;\n}`,
        foundryPoC: signatureReplayPoC(cname, `Line ${ln}`),
      })
    }
  }

  // [NEW-02] Weak Randomness
  for (let i = 0; i < lines.length; i++) {
    if (/block\.(timestamp|difficulty|prevrandao|number|blockhash)/.test(lines[i])) {
      if (/\%|random|rand|shuffle|lottery|winner|select/.test(lines[i].toLowerCase()) ||
          /keccak256.*block\.(timestamp|number)|block\.(timestamp|number).*keccak256/.test(code.substring(Math.max(0, code.indexOf(lines[i]) - 100), code.indexOf(lines[i]) + 200))) {
        findings.push({
          id: "WEAK-RANDOM-001",
          title: "Weak Randomness from Block Variables",
          severity: "HIGH",
          category: "Randomness",
          description: `Line ${i + 1} uses block.${lines[i].match(/block\.(\w+)/)?.[1]} as a randomness source. Miners and validators can manipulate these values.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Predictable outcomes in lotteries, games, or selection logic. Validators can bias results in their favor.",
          recommendation: "Use Chainlink VRF v2 for verifiable on-chain randomness. Never use block variables for security-sensitive randomness.",
          swcId: "SWC-120", cweId: "CWE-330",
          cvss: cvss(CVSS_PRESETS.WEAK_RANDOM),
          likelihood: "High",
          codeEvidence: lines[i].trim(),
          remediationExample: `// Chainlink VRF v2\nimport "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";\ncontract MyContract is VRFConsumerBaseV2 {\n    function requestRandom() external returns (uint256 requestId) {\n        return COORDINATOR.requestRandomWords(keyHash, subId, 3, 100000, 1);\n    }\n    function fulfillRandomWords(uint256 reqId, uint256[] memory words) internal override {\n        // words[0] is your verifiable random number\n    }\n}`,
        })
        break
      }
    }
  }

  // [NEW-03] Unprotected Initializer (proxy pattern)
  if (/function\s+initialize\s*\(/.test(code) && !/initializer\s+modifier|modifier\s+initializer|_disableInitializers/.test(code)) {
    const ln = lines.findIndex((l) => /function\s+initialize\s*\(/.test(l)) + 1
    findings.push({
      id: "INIT-001",
      title: "Unprotected Initializer — Anyone Can Take Ownership",
      severity: "CRITICAL",
      category: "Access Control",
      description: `initialize() at line ${ln} lacks the initializer modifier or _disableInitializers() call. Anyone can call it on the implementation contract and take ownership.`,
      location: `Line ${ln}`,
      lineNumber: ln,
      impact: "An attacker can initialize the implementation contract, set themselves as owner, and call privileged functions or selfdestruct it — bricking all proxies.",
      recommendation: "Add OpenZeppelin's initializer modifier. Call _disableInitializers() in the constructor of the implementation.",
      cweId: "CWE-665",
      cvss: cvss(CVSS_PRESETS.UNPROTECTED_INIT),
      likelihood: "High",
      codeEvidence: lines[ln - 1]?.trim(),
      remediationExample: `import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";\n\ncontract MyContract is Initializable {\n    /// @custom:oz-upgrades-unsafe-allow constructor\n    constructor() {\n        _disableInitializers(); // prevents init on implementation\n    }\n\n    function initialize(address owner) external initializer {\n        __Ownable_init(owner);\n    }\n}`,
    })
  }

  // [NEW-04] Incorrect Modifier — missing underscore
  const modRx = /modifier\s+(\w+)\s*\([^)]*\)\s*\{([^}]*)\}/g
  let modMatch: RegExpExecArray | null
  while ((modMatch = modRx.exec(code)) !== null) {
    if (!modMatch[2].includes("_")) {
      const ln = code.substring(0, modMatch.index).split("\n").length
      findings.push({
        id: `MODIFIER-${modMatch[1].toUpperCase()}-001`,
        title: `Modifier ${modMatch[1]} Missing Underscore (_) — Function Body Never Executes`,
        severity: "HIGH",
        category: "Logic Error",
        description: `Modifier ${modMatch[1]} at line ${ln} has no underscore (_). The function body of any function using this modifier will NEVER execute.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "Functions decorated with this modifier are silently no-ops. Business logic is completely bypassed.",
        recommendation: "Add the _ placeholder where function body should execute: require(condition, msg); _;",
        cweId: "CWE-670",
        cvss: { score: 7.5, severity: "HIGH", vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N" },
        likelihood: "High",
        codeEvidence: modMatch[0].trim().slice(0, 200),
        remediationExample: `modifier ${modMatch[1]}() {\n    require(msg.sender == owner, "not owner");\n    _;  // <-- this line is mandatory\n}`,
      })
    }
  }

  // [NEW-05] ERC-20 Approval Race Condition
  if (/function\s+approve\s*\(.*address.*uint/.test(code) && !/increaseAllowance|decreaseAllowance/.test(code)) {
    const ln = lines.findIndex((l) => /function\s+approve/.test(l)) + 1
    findings.push({
      id: "ERC20-APPROVE-001",
      title: "ERC-20 Approval Race Condition (Front-Running)",
      severity: "MEDIUM",
      category: "Token Security",
      description: `approve() at line ${ln} does not implement increaseAllowance/decreaseAllowance. A spender can front-run an allowance change to spend both the old and new amounts.`,
      location: `Line ${ln}`,
      lineNumber: ln,
      impact: "Spender can extract double the intended allowance via front-running.",
      recommendation: "Implement increaseAllowance() and decreaseAllowance() as alternatives to approve(). Or require approve(0) before approve(n).",
      swcId: "SWC-114", cweId: "CWE-362",
      cvss: cvss(CVSS_PRESETS.FRONT_RUN),
      likelihood: "Low",
      codeEvidence: lines[ln - 1]?.trim(),
      remediationExample: `// Use OpenZeppelin ERC20 which includes:\nfunction increaseAllowance(address spender, uint256 addedValue) public returns (bool)\nfunction decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool)`,
    })
  }

  // [NEW-06] Unbounded Loop / Gas DoS
  for (let i = 0; i < lines.length; i++) {
    if (/for\s*\(|while\s*\(/.test(lines[i])) {
      const block = lines.slice(i, Math.min(i + 20, lines.length)).join("\n")
      if (/\.length/.test(block) && !/break|continue/.test(block)) {
        const loopVar = lines[i].match(/\.(\w+)\.length/)?.[1] || "array"
        findings.push({
          id: `LOOP-DOS-${i + 1}`,
          title: `Unbounded Loop Over ${loopVar} — Gas Limit DoS`,
          severity: "HIGH",
          category: "Denial of Service",
          description: `Loop at line ${i + 1} iterates over a dynamic array with no bound. If the array grows large enough, gas cost exceeds the block gas limit and the function becomes permanently uncallable.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Function permanently DoS'd once array exceeds ~2000-5000 elements (depending on loop body).",
          recommendation: "Add pagination (startIdx, count params), or restructure to O(1) per-element operations using mappings.",
          swcId: "SWC-128", cweId: "CWE-400",
          cvss: cvss(CVSS_PRESETS.UNBOUNDED_LOOP),
          likelihood: likelihood("HIGH"),
          codeEvidence: lines[i].trim(),
          remediationExample: `// Paginated version\nfunction processAll(uint256 startIdx, uint256 count) external {\n    uint256 end = Math.min(startIdx + count, items.length);\n    for (uint256 i = startIdx; i < end; i++) {\n        _process(items[i]);\n    }\n}`,
        })
        break // one finding per loop location is enough
      }
    }
  }

  // [NEW-07] Missing Access Control on mint/burn
  const mintBurnRx = /function\s+(mint|_mint|burn|_burn)\s*\([^)]*\)\s*(public|external)/g
  while ((m = mintBurnRx.exec(code)) !== null) {
    const ln = code.substring(0, m.index).split("\n").length
    const funcBody = code.substring(m.index, code.indexOf("}", m.index) + 1)
    if (!/onlyOwner|onlyMinter|onlyRole|hasRole|require.*msg\.sender/.test(funcBody)) {
      findings.push({
        id: `MINT-ACCESS-${m[1].toUpperCase()}-001`,
        title: `Unprotected ${m[1]}() — Anyone Can Mint/Burn`,
        severity: "CRITICAL",
        category: "Access Control",
        description: `${m[1]}() at line ${ln} is publicly callable with no access control. Anyone can inflate supply or burn others' tokens.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "Unlimited token minting destroys economic value. Unrestricted burn enables targeted fund destruction.",
        recommendation: `Restrict with onlyOwner or a dedicated MINTER_ROLE. Use OpenZeppelin AccessControl.`,
        cweId: "CWE-284",
        cvss: { score: 9.8, severity: "CRITICAL", vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
        likelihood: "High",
        codeEvidence: lines[ln - 1]?.trim(),
        remediationExample: `bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");\n\nfunction mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {\n    _mint(to, amount);\n}`,
      })
    }
  }

  // [NEW-08] ecrecover returning address(0)
  if (/ecrecover\s*\(/.test(code)) {
    const hasZeroCheck = /ecrecover[\s\S]{0,100}!=\s*address\(0\)|address\(0\)[\s\S]{0,20}!=[\s\S]{0,20}ecrecover/.test(code)
    if (!hasZeroCheck) {
      const ln = lines.findIndex((l) => /ecrecover/.test(l)) + 1
      findings.push({
        id: "ECRECOVER-ZERO-001",
        title: "ecrecover Return Value Not Checked for address(0)",
        severity: "HIGH",
        category: "Signature Security",
        description: `ecrecover() at line ${ln} does not check for a zero-address return. An invalid signature returns address(0); if that's treated as a valid signer the check is bypassed.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "Signature verification bypass — attacker submits malformed signature that ecrecover maps to address(0).",
        recommendation: "Always require: address signer = ecrecover(...); require(signer != address(0), 'invalid sig');",
        cweId: "CWE-252",
        cvss: cvss(CVSS_PRESETS.ECRECOVER_ZERO),
        likelihood: likelihood("HIGH"),
        codeEvidence: lines[ln - 1]?.trim(),
        remediationExample: `address signer = ecrecover(digest, v, r, s);\nrequire(signer != address(0) && signer == expectedSigner, "Invalid signature");`,
      })
    }
  }

  // [NEW-09] Block timestamp in financial logic
  for (let i = 0; i < lines.length; i++) {
    if (/block\.timestamp/.test(lines[i])) {
      if (/\+|\-|\*|<=|>=|<|>/.test(lines[i]) && !/comment|\/\//.test(lines[i])) {
        findings.push({
          id: `TIMESTAMP-${i + 1}`,
          title: "Block Timestamp Used in Financial Arithmetic",
          severity: "MEDIUM",
          category: "Time Manipulation",
          description: `block.timestamp at line ${i + 1} is used in financial arithmetic. Validators can skew timestamps by up to ~15 seconds.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Slightly favorable conditions for MEV bots. If deadlines are short (< 1 min), manipulation is practical.",
          recommendation: "For time-sensitive DeFi logic, use block numbers instead of timestamps. Add reasonable buffer (>= 1 minute) to deadlines.",
          swcId: "SWC-116", cweId: "CWE-330",
          cvss: { score: 4.3, severity: "MEDIUM", vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:M/A:N", vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:M/A:N" },
          likelihood: "Low",
          codeEvidence: lines[i].trim(),
          break: true,
        } as StaticFinding)
        break
      }
    }
  }

  // [NEW-10] Front-Running — missing deadline / slippage
  // Only AMM-style operations need a deadline and a minimum output; plain vault deposits/withdrawals do not.
  if (/\b(swap\w*|addLiquidity\w*|removeLiquidity\w*)\s*\(/.test(code)) {
    const hasDeadline = /deadline|expiry|expiration/.test(code)
    const hasSlippage = /minAmount|minOut|amountOutMin|slippage/.test(code)
    if (!hasDeadline || !hasSlippage) {
      const ln = lines.findIndex((l) => /\b(swap\w*|addLiquidity\w*|removeLiquidity\w*)\s*\(/.test(l)) + 1
      findings.push({
        id: "FRONTRUN-001",
        title: `DeFi Operation Missing ${!hasDeadline ? "Deadline" : ""}${!hasDeadline && !hasSlippage ? " + " : ""}${!hasSlippage ? "Slippage Protection" : ""}`,
        severity: "HIGH",
        category: "MEV / Front-Running",
        description: `DeFi function at line ${ln} lacks ${!hasDeadline ? "transaction deadline" : ""}${!hasDeadline && !hasSlippage ? " and " : ""}${!hasSlippage ? "minimum output amount (slippage)" : ""}. Users are exposed to sandwich attacks.`,
        location: `Line ${ln}`,
        lineNumber: ln,
        impact: "MEV bots can sandwich user transactions. Users receive significantly less than expected. In extreme cases, up to 100% value extracted.",
        recommendation: "Add deadline parameter (block.timestamp + N). Add amountOutMin parameter checked against actual output.",
        cweId: "CWE-362",
        cvss: cvss(CVSS_PRESETS.FRONT_RUN),
        likelihood: likelihood("HIGH"),
        codeEvidence: lines[ln - 1]?.trim(),
        remediationExample: `function swap(\n    uint256 amountIn,\n    uint256 amountOutMin,  // slippage protection\n    address[] calldata path,\n    uint256 deadline       // expiry protection\n) external {\n    require(block.timestamp <= deadline, "Expired");\n    uint256 out = _swap(amountIn, path);\n    require(out >= amountOutMin, "Too much slippage");\n}`,
      })
    }
  }

  // [NEW-11] Centralization Risk
  if (/onlyOwner/.test(code) && !/TimelockController|Timelock|multisig|MultiSig|2-of-3|3-of-5/.test(code)) {
    const sensitiveOps = lines.filter((l) =>
      /onlyOwner/.test(l) && /(pause|upgrade|setFee|setPrice|mint|burn|emergencyWithdraw|drain)/.test(l.toLowerCase())
    )
    if (sensitiveOps.length > 0) {
      findings.push({
        id: "CENTRALIZATION-001",
        title: "High Centralization Risk — Single EOA Controls Critical Functions",
        severity: "HIGH",
        category: "Centralization",
        description: `${sensitiveOps.length} sensitive function(s) (pause/upgrade/setFee/mint/emergencyWithdraw) are controlled by a single onlyOwner address with no timelock or multisig. A compromised or malicious owner can rug instantly.`,
        location: "Contract-wide",
        impact: "Single point of failure. Key compromise or insider threat can drain all funds instantly.",
        recommendation: "Replace single owner with Gnosis Safe multisig (3-of-5). Add 48h TimelockController for sensitive operations. Consider renouncing upgrade ability post-audit.",
        cweId: "CWE-269",
        cvss: cvss(CVSS_PRESETS.CENTRALIZATION),
        likelihood: likelihood("HIGH"),
        codeEvidence: sensitiveOps.slice(0, 2).map((l) => l.trim()).join("\n"),
        remediationExample: `import "@openzeppelin/contracts/governance/TimelockController.sol";\n// Deploy: TimelockController(48 hours, [multisig], [multisig])\n// Set as owner of this contract`,
      })
    }
  }

  // [NEW-12] Locked Ether
  if (/payable/.test(code) && !/function\s+withdraw|function\s+rescue|function\s+emergencyWithdraw|\.transfer\(|\.send\(|\.call\{value:/.test(code)) {
    findings.push({
      id: "LOCKED-ETHER-001",
      title: "Locked Ether — Contract Accepts ETH But Has No Withdrawal",
      severity: "MEDIUM",
      category: "Fund Management",
      description: "Contract has payable functions but no withdrawal mechanism. Any ETH sent will be permanently locked.",
      location: "Contract-wide",
      impact: "All ETH received is permanently inaccessible. User funds lost.",
      recommendation: "Add a withdraw() function restricted to owner, or refund ETH in the same transaction.",
      swcId: "SWC-132", cweId: "CWE-400",
      cvss: cvss(CVSS_PRESETS.LOCKED_ETHER),
      likelihood: likelihood("MEDIUM"),
      remediationExample: `function withdraw() external onlyOwner {\n    (bool ok,) = owner().call{value: address(this).balance}("");\n    require(ok, "Withdraw failed");\n}`,
    })
  }

  // [NEW-13] DoS via External Call in Loop
  for (let i = 0; i < lines.length; i++) {
    if (/for\s*\(|while\s*\(/.test(lines[i])) {
      const block = lines.slice(i, Math.min(i + 15, lines.length)).join("\n")
      if (/\.call\{|\.transfer\(|\.send\(/.test(block)) {
        findings.push({
          id: `DOS-LOOP-${i + 1}`,
          title: "DoS via Revert in External Call Loop",
          severity: "HIGH",
          category: "Denial of Service",
          description: `Loop at line ${i + 1} makes external calls (transfer/call/send) to addresses in an array. One reverting recipient permanently blocks all subsequent recipients.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Grief attack: one malicious address in the list can block distribution to all other recipients.",
          recommendation: "Use pull-payment pattern: track owed balances in a mapping, let each user claim independently.",
          swcId: "SWC-128", cweId: "CWE-400",
          cvss: cvss(CVSS_PRESETS.DOS_LOOP),
          likelihood: likelihood("HIGH"),
          codeEvidence: lines[i].trim(),
          remediationExample: `// Pull payment pattern\nmapping(address => uint256) public pendingWithdrawals;\n\nfunction claimReward() external {\n    uint256 amount = pendingWithdrawals[msg.sender];\n    pendingWithdrawals[msg.sender] = 0;\n    (bool ok,) = msg.sender.call{value: amount}("");\n    require(ok, "Claim failed");\n}`,
        })
        break
      }
    }
  }

  // [NEW-14] Missing Contract Existence Check Before Low-Level Call
  for (let i = 0; i < lines.length; i++) {
    if (/\.call\{|\.call\(/.test(lines[i])) {
      const hasExistCheck = lines.slice(Math.max(0, i - 5), i).some((l) =>
        /\.code\.length|extcodesize|isContract/.test(l)
      )
      if (!hasExistCheck) {
        findings.push({
          id: `NO-EXIST-CHECK-${i + 1}`,
          title: "Missing Contract Existence Check Before Low-Level Call",
          severity: "MEDIUM",
          category: "Input Validation",
          description: `Low-level call at line ${i + 1} is made without checking if the target address contains code. Calls to EOAs or self-destructed contracts succeed silently with return true.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Silent success of calls to non-existent contracts. Critical integrations can break without notice.",
          recommendation: "Check address(target).code.length > 0 before low-level calls to expected contracts.",
          cweId: "CWE-252",
          cvss: cvss(CVSS_PRESETS.MISSING_EXIST),
          likelihood: likelihood("MEDIUM"),
          codeEvidence: lines[i].trim(),
          remediationExample: `require(address(target).code.length > 0, "Target not a contract");\n(bool ok,) = target.call(data);`,
        })
        break
      }
    }
  }

  // [NEW-15] Arbitrary ETH Transfer (user-controlled recipient)
  for (let i = 0; i < lines.length; i++) {
    if (/\.call\{value:|\.transfer\(|\.send\(/.test(lines[i])) {
      const nearbyLines = lines.slice(Math.max(0, i - 3), i + 1).join("\n")
      if (/\b(to|recipient|receiver|addr|target|destination)\b/.test(nearbyLines) &&
          !/msg\.sender|owner\(\)|admin/.test(nearbyLines)) {
        findings.push({
          id: `ARBI-TRANSFER-${i + 1}`,
          title: "ETH Transferred to Externally-Controlled Address",
          severity: "HIGH",
          category: "Fund Management",
          description: `ETH transfer at line ${i + 1} uses an address parameter (to/recipient/receiver). If not properly validated this can be used to drain funds to an attacker-chosen address.`,
          location: `Line ${i + 1}`,
          lineNumber: i + 1,
          impact: "Attacker can redirect ETH payments to arbitrary addresses if recipient validation is weak.",
          recommendation: "Validate recipient against a whitelist or ensure it matches msg.sender / registered beneficiary.",
          cweId: "CWE-601",
          cvss: cvss(CVSS_PRESETS.ARBI_TRANSFER),
          likelihood: likelihood("HIGH"),
          codeEvidence: lines[i].trim(),
          remediationExample: `require(recipient != address(0) && isWhitelisted[recipient], "Invalid recipient");\n(bool ok,) = recipient.call{value: amount}("");\nrequire(ok, "Transfer failed");`,
        })
        break
      }
    }
  }

  return findings
}

function buildThreatModel(code: string, parsing: ParseResult, deps: DependencyScanResult): ThreatModel {
  const attackSurface = getAttackSurface(parsing).map((f) => `${f.name}() [${f.visibility}${f.mutability === "payable" ? ", payable" : ""}]`)
  const entryPoints = parsing.contracts.flatMap(c =>
    c.functions.filter(f => f.visibility === "public" || f.visibility === "external").map(f => `${f.name}()`)
  )
  const highValueTargets = [
    ...(code.includes("payable") ? ["ETH balance"] : []),
    ...(code.includes("transfer") || code.includes("ERC20") ? ["ERC-20 token balances"] : []),
    ...(code.includes("onlyOwner") ? ["Owner privileges"] : []),
  ]
  const attackers = [
    { type: "External Attacker", capability: "Call any public function, deploy contracts, use flash loans", motivation: "Financial gain" },
    { type: "Malicious Token Holder", capability: "Interact with DeFi integrations, front-run transactions", motivation: "MEV / price manipulation" },
    { type: "Compromised Admin", capability: "Execute all onlyOwner/onlyAdmin functions", motivation: "Rug pull / protocol takeover" },
  ]
  const threatScenarios: string[] = []
  if (code.includes(".call{value:")) threatScenarios.push("Reentrancy drain via external ETH call")
  if (code.includes("tx.origin")) threatScenarios.push("Phishing attack via tx.origin bypass")
  if (code.includes("delegatecall")) threatScenarios.push("Storage collision via malicious delegatecall target")
  if (deps.externalCalls.length > 0) threatScenarios.push("Dependency failure cascade from external contract")
  return { attackSurface, entryPoints, highValueTargets, attackers, threatScenarios }
}

function buildAttackSimulations(economic: EconomicAnalysisResult, staticFindings: StaticFinding[]): AttackSimulation[] {
  const sims: AttackSimulation[] = []
  if (economic.flashLoanRisk === "high") {
    sims.push({
      name: "Flash Loan Price Manipulation",
      type: "ECONOMIC",
      severity: "CRITICAL",
      steps: [
        "1. Borrow large amount via Aave / Uniswap V3 flash loan",
        "2. Swap in target AMM pool to skew spot price",
        "3. Call price-sensitive function at manipulated price",
        "4. Reverse swap; repay flash loan; pocket profit",
      ],
      prerequisites: ["Contract reads price from on-chain AMM spot (no TWAP)", "No slippage check"],
      estimatedImpact: "Up to full pool TVL",
      mitigation: "Replace spot price with Chainlink or Uniswap V3 TWAP (>=30 min window)",
    })
  }
  const reentrant = staticFindings.find(f => f.id.startsWith("REENTRANCY") || f.detector === "reentrancy-eth" || f.detector === "reentrancy-no-eth")
  if (reentrant) {
    sims.push({
      name: "Reentrancy — Recursive ETH Drain",
      type: "REENTRANCY",
      severity: "CRITICAL",
      steps: [
        "1. Attacker deploys malicious contract with custom receive()",
        "2. Calls vulnerable withdraw/transfer function",
        "3. receive() re-calls before balance is zeroed",
        "4. Repeat until contract is drained",
      ],
      prerequisites: ["Contract holds ETH", "External call precedes state update"],
      estimatedImpact: "Full ETH balance of contract",
      exploitCode: reentrant.foundryPoC,
      mitigation: "Apply CEI pattern or add nonReentrant modifier",
    })
  }
  return sims
}

function calculateSummary(findings: Array<{ severity: string }>, totalChecks: number, triggeredChecks: number): AuditSummary {
  const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }
  for (const f of findings) if (f.severity in c) c[f.severity as keyof typeof c]++
  const penalty = c.CRITICAL * 20 + c.HIGH * 10 + c.MEDIUM * 5 + c.LOW * 2
  const score = Math.max(0, 100 - penalty)
  let overallRisk: AuditSummary["overallRisk"] = "SAFE"
  if (c.CRITICAL > 0) overallRisk = "CRITICAL"
  else if (c.HIGH > 0) overallRisk = "HIGH"
  else if (c.MEDIUM > 0) overallRisk = "MEDIUM"
  else if (c.LOW > 0) overallRisk = "LOW"
  const recs: string[] = []
  if (c.CRITICAL > 0) recs.push("Fix all CRITICAL findings before any mainnet deployment")
  if (c.HIGH > 0) recs.push("Remediate HIGH findings and obtain re-audit confirmation")
  return {
    overallRisk, score,
    criticalCount: c.CRITICAL, highCount: c.HIGH, mediumCount: c.MEDIUM, lowCount: c.LOW, infoCount: c.INFO,
    passedChecks: Math.max(0, totalChecks - triggeredChecks), totalChecks, recommendations: recs,
  }
}

export { parseContract, scanDependencies, analyzeEconomicAttacks, analyzeCrossChain }
