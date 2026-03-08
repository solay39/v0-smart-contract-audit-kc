/**
 * Full Audit Pipeline
 * 
 * Orchestrates all security tools:
 * - Slither (static analysis)
 * - Mythril (symbolic execution)
 * - Echidna (fuzz testing)
 * - Anvil (mainnet fork simulation)
 * - Exploit generation & validation
 */

import { runSlitherRemote, convertSlitherToFindings, type SlitherResult } from "../static/slitherRunner"
import { runMythrilRemote, convertMythrilToFindings, type MythrilResult } from "../symbolic/mythrilRunner"
import { runEchidnaRemote, convertEchidnaToFindings, type EchidnaResult } from "../fuzz/echidnaRunner"
import { calculateProfit, type ProfitCalculation } from "../defi/profitCalculator"
import { ethers } from "ethers"

export interface AuditConfig {
  contractCode: string
  contractName: string
  contractAddress?: string
  network?: string
  runSlither?: boolean
  runMythril?: boolean
  runEchidna?: boolean
  runExploitSim?: boolean
  rpcUrl?: string
  backendUrl?: string
}

export interface Finding {
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
  tool: string
  verified?: boolean
  exploitPath?: string
}

export interface FullAuditResult {
  success: boolean
  timestamp: string
  contractName: string
  contractAddress?: string
  
  // Tool results
  slither?: SlitherResult
  mythril?: MythrilResult
  echidna?: EchidnaResult
  
  // Aggregated findings
  findings: Finding[]
  
  // Exploit simulation
  exploitSimulation?: {
    attempted: number
    successful: number
    exploits: Array<{
      vulnerability: string
      success: boolean
      profit?: ProfitCalculation
      txHash?: string
    }>
  }
  
  // Summary
  summary: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
    toolsRun: string[]
    executionTime: number
  }
  
  // Errors
  errors: Array<{ tool: string; error: string }>
}

/**
 * Run complete security audit
 */
export async function runFullAudit(config: AuditConfig): Promise<FullAuditResult> {
  const startTime = Date.now()
  const errors: Array<{ tool: string; error: string }> = []
  const toolsRun: string[] = []
  let findings: Finding[] = []

  // Results
  let slitherResult: SlitherResult | undefined
  let mythrilResult: MythrilResult | undefined
  let echidnaResult: EchidnaResult | undefined

  // Run tools in parallel where possible
  const promises: Promise<void>[] = []

  // 1. Slither
  if (config.runSlither !== false) {
    promises.push(
      (async () => {
        try {
          slitherResult = await runSlitherRemote(
            config.contractCode,
            config.contractName,
            config.backendUrl
          )
          if (slitherResult.success) {
            toolsRun.push(`Slither v${slitherResult.version}`)
            findings.push(...convertSlitherToFindings(slitherResult))
          } else if (slitherResult.error) {
            errors.push({ tool: "slither", error: slitherResult.error })
          }
        } catch (err) {
          errors.push({ tool: "slither", error: err instanceof Error ? err.message : "Unknown error" })
        }
      })()
    )
  }

  // 2. Mythril
  if (config.runMythril !== false) {
    promises.push(
      (async () => {
        try {
          mythrilResult = await runMythrilRemote(
            config.contractCode,
            config.contractName,
            config.backendUrl
          )
          if (mythrilResult.success) {
            toolsRun.push(`Mythril v${mythrilResult.version}`)
            findings.push(...convertMythrilToFindings(mythrilResult))
          } else if (mythrilResult.error) {
            errors.push({ tool: "mythril", error: mythrilResult.error })
          }
        } catch (err) {
          errors.push({ tool: "mythril", error: err instanceof Error ? err.message : "Unknown error" })
        }
      })()
    )
  }

  // 3. Echidna (if enabled)
  if (config.runEchidna) {
    promises.push(
      (async () => {
        try {
          echidnaResult = await runEchidnaRemote(
            config.contractCode,
            config.contractName,
            undefined,
            config.backendUrl
          )
          if (echidnaResult.success || echidnaResult.tests.length > 0) {
            toolsRun.push(`Echidna v${echidnaResult.version}`)
            findings.push(...convertEchidnaToFindings(echidnaResult))
          } else if (echidnaResult.error) {
            errors.push({ tool: "echidna", error: echidnaResult.error })
          }
        } catch (err) {
          errors.push({ tool: "echidna", error: err instanceof Error ? err.message : "Unknown error" })
        }
      })()
    )
  }

  // Wait for all tools to complete
  await Promise.all(promises)

  // Deduplicate findings by similar title
  findings = deduplicateFindings(findings)

  // 4. Exploit simulation (if enabled and contract address provided)
  let exploitSimulation: FullAuditResult["exploitSimulation"]
  
  if (config.runExploitSim && config.contractAddress && config.rpcUrl) {
    try {
      exploitSimulation = await runExploitSimulation(
        findings.filter(f => f.severity === "CRITICAL" || f.severity === "HIGH"),
        config.contractAddress,
        config.rpcUrl,
        config.backendUrl
      )
      if (exploitSimulation.successful > 0) {
        toolsRun.push("Exploit Simulator")
      }
    } catch (err) {
      errors.push({ tool: "exploit-simulator", error: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  // Calculate summary
  const summary = {
    critical: findings.filter(f => f.severity === "CRITICAL").length,
    high: findings.filter(f => f.severity === "HIGH").length,
    medium: findings.filter(f => f.severity === "MEDIUM").length,
    low: findings.filter(f => f.severity === "LOW").length,
    info: findings.filter(f => f.severity === "INFO").length,
    total: findings.length,
    toolsRun,
    executionTime: Date.now() - startTime,
  }

  return {
    success: errors.length === 0 || findings.length > 0,
    timestamp: new Date().toISOString(),
    contractName: config.contractName,
    contractAddress: config.contractAddress,
    slither: slitherResult,
    mythril: mythrilResult,
    echidna: echidnaResult,
    findings,
    exploitSimulation,
    summary,
    errors,
  }
}

/**
 * Deduplicate findings by semantic similarity
 */
function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen: Array<{ title: string; severity: string }> = []
  
  return findings.filter(f => {
    const normalized = normalizeTitle(f.title)
    
    const isDup = seen.some(s => {
      const sNorm = normalizeTitle(s.title)
      if (sNorm === normalized) return true
      
      // Check word overlap
      const wordsA = new Set(sNorm.split(" ").filter(w => w.length > 3))
      const wordsB = new Set(normalized.split(" ").filter(w => w.length > 3))
      if (wordsA.size === 0 || wordsB.size === 0) return false
      
      const intersection = [...wordsA].filter(w => wordsB.has(w)).length
      const union = new Set([...wordsA, ...wordsB]).size
      return intersection / union > 0.6
    })
    
    if (isDup) return false
    seen.push({ title: f.title, severity: f.severity })
    return true
  })
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[slither\]|\[mythril\]|\[echidna\]|\[ai\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Run exploit simulation for high-severity findings
 */
async function runExploitSimulation(
  vulnerabilities: Finding[],
  contractAddress: string,
  rpcUrl: string,
  backendUrl?: string
): Promise<NonNullable<FullAuditResult["exploitSimulation"]>> {
  const exploits: Array<{
    vulnerability: string
    success: boolean
    profit?: ProfitCalculation
    txHash?: string
  }> = []

  // Call Railway backend for exploit simulation
  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/api/exploit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.SECURITY_API_KEY || "",
        },
        body: JSON.stringify({
          vulnerabilities: vulnerabilities.map(v => ({
            type: v.title.includes("Reentrancy") ? "REENTRANCY" :
                  v.title.includes("Access") ? "ACCESS_CONTROL" :
                  v.title.includes("Flash") ? "FLASH_LOAN_ATTACK" :
                  "UNKNOWN",
            severity: v.severity,
            location: v.location,
          })),
          targetContract: contractAddress,
          rpcUrl,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        for (const result of data.results || []) {
          exploits.push({
            vulnerability: result.vulnerability?.type || "Unknown",
            success: result.success,
            profit: result.profit ? {
              grossProfit: BigInt(result.profit),
              gasCost: 0n,
              flashLoanFee: 0n,
              slippage: 0n,
              netProfit: BigInt(result.profit),
              profitable: true,
              roi: 100,
              breakEvenGasPrice: 0n,
            } : undefined,
            txHash: result.txHash,
          })
        }
      }
    } catch (err) {
      console.error("[FullAudit] Exploit simulation failed:", err)
    }
  }

  return {
    attempted: vulnerabilities.length,
    successful: exploits.filter(e => e.success).length,
    exploits,
  }
}

/**
 * Quick audit (Slither only)
 */
export async function runQuickAudit(code: string, name: string): Promise<FullAuditResult> {
  return runFullAudit({
    contractCode: code,
    contractName: name,
    runSlither: true,
    runMythril: false,
    runEchidna: false,
    runExploitSim: false,
  })
}

/**
 * Deep audit (all tools)
 */
export async function runDeepAudit(
  code: string,
  name: string,
  address?: string,
  rpcUrl?: string
): Promise<FullAuditResult> {
  return runFullAudit({
    contractCode: code,
    contractName: name,
    contractAddress: address,
    runSlither: true,
    runMythril: true,
    runEchidna: true,
    runExploitSim: !!address && !!rpcUrl,
    rpcUrl,
  })
}

/**
 * Format audit report
 */
export function formatAuditReport(result: FullAuditResult): string {
  const lines: string[] = [
    "═".repeat(60),
    `  SOLAY39 SECURITY AUDIT REPORT`,
    "═".repeat(60),
    "",
    `Contract: ${result.contractName}`,
    result.contractAddress ? `Address: ${result.contractAddress}` : "",
    `Timestamp: ${result.timestamp}`,
    `Tools: ${result.summary.toolsRun.join(", ") || "None"}`,
    `Execution Time: ${(result.summary.executionTime / 1000).toFixed(2)}s`,
    "",
    "─".repeat(60),
    "  FINDINGS SUMMARY",
    "─".repeat(60),
    "",
    `  🔴 CRITICAL: ${result.summary.critical}`,
    `  🟠 HIGH:     ${result.summary.high}`,
    `  🟡 MEDIUM:   ${result.summary.medium}`,
    `  🔵 LOW:      ${result.summary.low}`,
    `  ⚪ INFO:     ${result.summary.info}`,
    `  ─────────────────────`,
    `  TOTAL:       ${result.summary.total}`,
    "",
  ]

  if (result.findings.length > 0) {
    lines.push("─".repeat(60))
    lines.push("  DETAILED FINDINGS")
    lines.push("─".repeat(60))
    lines.push("")

    for (const f of result.findings) {
      lines.push(`[${f.severity}] ${f.title}`)
      lines.push(`  Location: ${f.location}`)
      lines.push(`  Tool: ${f.tool}`)
      lines.push(`  ${f.description.slice(0, 200)}...`)
      lines.push("")
    }
  }

  if (result.exploitSimulation && result.exploitSimulation.successful > 0) {
    lines.push("─".repeat(60))
    lines.push("  ⚠️  VERIFIED EXPLOITS")
    lines.push("─".repeat(60))
    lines.push("")
    
    for (const e of result.exploitSimulation.exploits.filter(x => x.success)) {
      lines.push(`  ✓ ${e.vulnerability} - EXPLOITABLE`)
      if (e.profit) {
        lines.push(`    Profit: ${ethers.formatEther(e.profit.netProfit)} ETH`)
      }
    }
    lines.push("")
  }

  if (result.errors.length > 0) {
    lines.push("─".repeat(60))
    lines.push("  ERRORS")
    lines.push("─".repeat(60))
    for (const e of result.errors) {
      lines.push(`  [${e.tool}] ${e.error}`)
    }
    lines.push("")
  }

  lines.push("═".repeat(60))
  lines.push("  Generated by Solay39 Security Platform")
  lines.push("═".repeat(60))

  return lines.filter(l => l !== undefined).join("\n")
}
