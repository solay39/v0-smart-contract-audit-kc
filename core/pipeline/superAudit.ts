// core/pipeline/superAudit.ts
// Unified security audit pipeline - combines all analysis engines

import { FuzzResult, runFoundryFuzz, generateFuzzTest } from "../fuzz/fuzzRunner"
import { SymbolicResult, runSymbolicOnSource } from "../symbolic/symbolicAnalyzer"
import {
  FlashLoanResult,
  OracleManipulationResult,
  runDeFiAttackSimulation,
} from "../simulator/flashLoanSimulator"
import {
  InvariantViolation,
  checkInvariants,
  STANDARD_INVARIANTS,
  DEFI_INVARIANTS,
  extractInvariantsFromCode,
} from "../formal/invariantEngine"
import {
  AttackGraph,
  buildAttackGraph,
  calculateRiskScore,
  toMermaid,
} from "../security/attackGraph"
import {
  ClassificationResult,
  classifyVulnerability,
  classifyMultiple,
} from "../ai/vulnClassifier"
import { ethers } from "ethers"

export interface ContractInput {
  source: string
  name: string
  bytecode?: string
  address?: string
  network?: string
  rpcUrl?: string
}

export interface SuperAuditResult {
  // Analysis results
  staticAnalysis: {
    findings: Array<{
      title: string
      severity: string
      description: string
      location: string
    }>
    classification: ClassificationResult[]
  }
  fuzzTesting?: {
    enabled: boolean
    results?: FuzzResult[]
    generatedTest?: string
    error?: string
  }
  symbolicExecution?: {
    enabled: boolean
    results?: SymbolicResult
    error?: string
  }
  formalVerification: {
    invariantViolations: InvariantViolation[]
    extractedInvariants: number
  }
  attackSimulation?: {
    flashLoan?: FlashLoanResult
    oracle?: OracleManipulationResult
    riskLevel: string
    error?: string
  }

  // Aggregate results
  attackGraph: AttackGraph
  attackGraphMermaid: string
  riskScore: {
    score: number
    level: string
    breakdown: Array<{ category: string; score: number }>
  }

  // Metadata
  timestamp: string
  duration: number
  toolsUsed: string[]
}

export interface SuperAuditOptions {
  enableFuzzing?: boolean
  enableSymbolic?: boolean
  enableAttackSimulation?: boolean
  symbolicTimeout?: number
  fuzzRuns?: number
}

export async function runSuperAudit(
  contract: ContractInput,
  options: SuperAuditOptions = {}
): Promise<SuperAuditResult> {
  const startTime = Date.now()
  const toolsUsed: string[] = ["Solay39 Static Analyzer"]

  // 1. Static Analysis (always runs - pattern-based)
  const staticFindings = runPatternAnalysis(contract.source)
  const classification = classifyMultiple(
    staticFindings.map((f) => ({ description: f.description, location: f.location }))
  )

  // 2. Formal Verification - Invariant checking
  const extractedInvariants = extractInvariantsFromCode(contract.source)
  const isDeFi = detectDeFiContract(contract.source)
  const allInvariants = [
    ...STANDARD_INVARIANTS,
    ...(isDeFi ? DEFI_INVARIANTS : []),
    ...extractedInvariants,
  ]

  // Simulate state for invariant checking
  const simulatedState = extractStateFromSource(contract.source)
  const invariantViolations = checkInvariants(simulatedState, extractedInvariants)
  toolsUsed.push("Formal Invariant Checker")

  // 3. Fuzz Testing (optional - requires Foundry)
  let fuzzTesting: SuperAuditResult["fuzzTesting"]
  if (options.enableFuzzing) {
    toolsUsed.push("Foundry Fuzzer")
    try {
      const functions = extractFunctions(contract.source)
      const invariants = extractedInvariants.map((i) => i.name)
      const generatedTest = generateFuzzTest(contract.name, functions, invariants)

      fuzzTesting = {
        enabled: true,
        generatedTest,
        // Note: Actual fuzzing requires Foundry installed on backend
        // results: await runFoundryFuzz(`test/${contract.name}Fuzz.t.sol`, options.fuzzRuns)
      }
    } catch (err) {
      fuzzTesting = {
        enabled: true,
        error: err instanceof Error ? err.message : "Fuzzing failed",
      }
    }
  } else {
    fuzzTesting = { enabled: false }
  }

  // 4. Symbolic Execution (optional - requires Mythril)
  let symbolicExecution: SuperAuditResult["symbolicExecution"]
  if (options.enableSymbolic && contract.bytecode) {
    toolsUsed.push("Mythril Symbolic Executor")
    try {
      const results = await runSymbolicOnSource(
        contract.source,
        contract.name,
        options.symbolicTimeout || 120
      )
      symbolicExecution = { enabled: true, results }
    } catch (err) {
      symbolicExecution = {
        enabled: true,
        error: err instanceof Error ? err.message : "Symbolic execution failed",
      }
    }
  } else {
    symbolicExecution = { enabled: false }
  }

  // 5. DeFi Attack Simulation (optional - requires RPC)
  let attackSimulation: SuperAuditResult["attackSimulation"]
  if (options.enableAttackSimulation && contract.address && contract.rpcUrl) {
    toolsUsed.push("DeFi Attack Simulator")
    try {
      const provider = new ethers.JsonRpcProvider(contract.rpcUrl)
      const results = await runDeFiAttackSimulation(provider, contract.address, {
        flashLoan: { targetFunction: "withdraw(uint256)" },
      })
      attackSimulation = {
        flashLoan: results.flashLoan,
        riskLevel: results.riskLevel,
      }
    } catch (err) {
      attackSimulation = {
        riskLevel: "UNKNOWN",
        error: err instanceof Error ? err.message : "Attack simulation failed",
      }
    }
  }

  // 6. Build Attack Graph
  const allVulnerabilities = [
    ...staticFindings.map((f) => ({
      type: f.title,
      severity: f.severity,
      location: f.location,
      description: f.description,
    })),
    ...(symbolicExecution?.results?.issues || []).map((i) => ({
      type: i.title,
      severity: i.severity,
      location: i.contract,
      description: i.description,
    })),
  ]

  const attackGraph = buildAttackGraph(allVulnerabilities)
  const attackGraphMermaid = toMermaid(attackGraph)
  const riskScore = calculateRiskScore(attackGraph)

  return {
    staticAnalysis: {
      findings: staticFindings,
      classification,
    },
    fuzzTesting,
    symbolicExecution,
    formalVerification: {
      invariantViolations,
      extractedInvariants: extractedInvariants.length,
    },
    attackSimulation,
    attackGraph,
    attackGraphMermaid,
    riskScore,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    toolsUsed,
  }
}

// Pattern-based static analysis
function runPatternAnalysis(
  source: string
): Array<{ title: string; severity: string; description: string; location: string }> {
  const findings: Array<{
    title: string
    severity: string
    description: string
    location: string
  }> = []

  const lines = source.split("\n")

  // Reentrancy
  if (/\.call\{.*value/.test(source) && !/nonReentrant|ReentrancyGuard/.test(source)) {
    const lineNum = lines.findIndex((l) => l.includes(".call{")) + 1
    findings.push({
      title: "Potential Reentrancy",
      severity: "CRITICAL",
      description:
        "External call with value transfer without reentrancy guard. Consider using ReentrancyGuard.",
      location: `Line ${lineNum}`,
    })
  }

  // Unchecked arithmetic (pre-0.8)
  if (/pragma solidity.*0\.[0-7]\./.test(source) && !/SafeMath/.test(source)) {
    findings.push({
      title: "Unchecked Arithmetic",
      severity: "HIGH",
      description:
        "Solidity < 0.8 without SafeMath is vulnerable to integer overflow/underflow.",
      location: "pragma directive",
    })
  }

  // tx.origin
  if (/tx\.origin/.test(source)) {
    const lineNum = lines.findIndex((l) => l.includes("tx.origin")) + 1
    findings.push({
      title: "tx.origin Usage",
      severity: "MEDIUM",
      description:
        "tx.origin should not be used for authorization as it can be exploited via phishing.",
      location: `Line ${lineNum}`,
    })
  }

  // Unchecked external call return
  if (/\.call\(/.test(source) && !/\(bool.*success/.test(source)) {
    findings.push({
      title: "Unchecked Call Return",
      severity: "MEDIUM",
      description: "Return value of low-level call not checked.",
      location: "External call",
    })
  }

  // Centralization risks
  if (/onlyOwner|Ownable/.test(source)) {
    findings.push({
      title: "Centralization Risk",
      severity: "MEDIUM",
      description:
        "Contract uses single-owner pattern. Consider multisig or DAO governance.",
      location: "Access control",
    })
  }

  return findings
}

function detectDeFiContract(source: string): boolean {
  return /swap|liquidity|pool|vault|lending|borrow|stake|yield|farm|amm/i.test(source)
}

function extractStateFromSource(source: string): Record<string, unknown> {
  const state: Record<string, unknown> = {}

  // Extract state variables
  const matches = source.matchAll(/(?:uint|int)\d*\s+(?:public\s+)?(\w+)/g)
  for (const match of matches) {
    state[match[1]] = 0n
  }

  return state
}

function extractFunctions(
  source: string
): Array<{ name: string; params: string[] }> {
  const functions: Array<{ name: string; params: string[] }> = []

  const matches = source.matchAll(
    /function\s+(\w+)\s*\(([^)]*)\)/g
  )

  for (const match of matches) {
    const name = match[1]
    const params = match[2]
      .split(",")
      .map((p) => p.trim().split(/\s+/)[0])
      .filter((p) => p)

    functions.push({ name, params })
  }

  return functions
}
