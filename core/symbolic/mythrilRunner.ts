/**
 * Mythril Symbolic Execution Runner
 * 
 * Integrates with Mythril for deep symbolic execution analysis.
 * Finds complex bugs that static analysis misses.
 */

import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface MythrilIssue {
  swc_id: string
  swc_title: string
  severity: "High" | "Medium" | "Low"
  description: {
    head: string
    tail: string
  }
  locations: Array<{
    sourceMap: string
    function: string
    filename: string
    lineno: number
  }>
  extra?: {
    discoveryTime?: number
    testCase?: string
  }
}

export interface MythrilResult {
  success: boolean
  tool: "mythril"
  version: string
  issues: MythrilIssue[]
  error?: string
  executionTime?: number
  summary: {
    high: number
    medium: number
    low: number
    total: number
  }
}

/**
 * Run Mythril locally (requires mythril installed)
 */
export async function runMythrilLocal(
  contractPath: string,
  options?: {
    timeout?: number
    executionDepth?: number
    solcVersion?: string
  }
): Promise<MythrilResult> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    const args = [
      "analyze",
      contractPath,
      "--output", "json",
      "--execution-timeout", String(options?.timeout || 300),
      "--max-depth", String(options?.executionDepth || 22),
    ]

    if (options?.solcVersion) {
      args.push("--solv", options.solcVersion)
    }

    const proc = spawn("myth", args, {
      timeout: (options?.timeout || 300) * 1000 + 30000, // Add buffer
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      const executionTime = Date.now() - startTime

      try {
        if (stdout.trim()) {
          const report = JSON.parse(stdout)
          const issues: MythrilIssue[] = report.issues || []

          resolve({
            success: true,
            tool: "mythril",
            version: report.mythrilVersion || "0.24.x",
            issues,
            executionTime,
            summary: {
              high: issues.filter(i => i.severity === "High").length,
              medium: issues.filter(i => i.severity === "Medium").length,
              low: issues.filter(i => i.severity === "Low").length,
              total: issues.length,
            },
          })
        } else {
          resolve({
            success: code === 0,
            tool: "mythril",
            version: "unknown",
            issues: [],
            error: stderr || "No output from Mythril",
            executionTime,
            summary: { high: 0, medium: 0, low: 0, total: 0 },
          })
        }
      } catch (err) {
        resolve({
          success: false,
          tool: "mythril",
          version: "unknown",
          issues: [],
          error: `Parse error: ${err instanceof Error ? err.message : "Unknown"}`,
          executionTime,
          summary: { high: 0, medium: 0, low: 0, total: 0 },
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        success: false,
        tool: "mythril",
        version: "unknown",
        issues: [],
        error: `Mythril not installed: ${err.message}`,
        executionTime: Date.now() - startTime,
        summary: { high: 0, medium: 0, low: 0, total: 0 },
      })
    })
  })
}

/**
 * Run Mythril from source code
 */
export async function runMythrilFromSource(
  sourceCode: string,
  contractName?: string,
  options?: {
    timeout?: number
    executionDepth?: number
  }
): Promise<MythrilResult> {
  const tmpDir = path.join(os.tmpdir(), `mythril-src-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })
  
  const fileName = `${contractName || "Contract"}.sol`
  const filePath = path.join(tmpDir, fileName)
  
  fs.writeFileSync(filePath, sourceCode)
  
  try {
    const result = await runMythrilLocal(filePath, options)
    return result
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Run Mythril on bytecode (for deployed contracts)
 */
export async function runMythrilBytecode(
  bytecode: string,
  options?: {
    timeout?: number
    executionDepth?: number
  }
): Promise<MythrilResult> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    const args = [
      "analyze",
      "--bin-runtime", bytecode,
      "--output", "json",
      "--execution-timeout", String(options?.timeout || 300),
      "--max-depth", String(options?.executionDepth || 22),
    ]

    const proc = spawn("myth", args, {
      timeout: (options?.timeout || 300) * 1000 + 30000,
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", () => {
      const executionTime = Date.now() - startTime

      try {
        if (stdout.trim()) {
          const report = JSON.parse(stdout)
          const issues: MythrilIssue[] = report.issues || []

          resolve({
            success: true,
            tool: "mythril",
            version: report.mythrilVersion || "0.24.x",
            issues,
            executionTime,
            summary: {
              high: issues.filter(i => i.severity === "High").length,
              medium: issues.filter(i => i.severity === "Medium").length,
              low: issues.filter(i => i.severity === "Low").length,
              total: issues.length,
            },
          })
        } else {
          resolve({
            success: false,
            tool: "mythril",
            version: "unknown",
            issues: [],
            error: stderr || "No output",
            executionTime,
            summary: { high: 0, medium: 0, low: 0, total: 0 },
          })
        }
      } catch (err) {
        resolve({
          success: false,
          tool: "mythril",
          version: "unknown",
          issues: [],
          error: `Parse error: ${err instanceof Error ? err.message : "Unknown"}`,
          executionTime,
          summary: { high: 0, medium: 0, low: 0, total: 0 },
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        success: false,
        tool: "mythril",
        version: "unknown",
        issues: [],
        error: `Mythril not available: ${err.message}`,
        executionTime: Date.now() - startTime,
        summary: { high: 0, medium: 0, low: 0, total: 0 },
      })
    })
  })
}

/**
 * Run Mythril via Railway backend API
 */
export async function runMythrilRemote(
  sourceCode: string,
  contractName?: string,
  apiUrl?: string
): Promise<MythrilResult> {
  const backendUrl = apiUrl || process.env.SECURITY_BACKEND_URL || process.env.STATIC_ANALYSIS_API_URL
  
  if (!backendUrl) {
    return {
      success: false,
      tool: "mythril",
      version: "unknown",
      issues: [],
      error: "SECURITY_BACKEND_URL not configured",
      summary: { high: 0, medium: 0, low: 0, total: 0 },
    }
  }

  try {
    const response = await fetch(`${backendUrl}/api/mythril`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SECURITY_API_KEY || "",
      },
      body: JSON.stringify({
        code: sourceCode,
        contractName: contractName || "Contract",
        timeout: 300,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        tool: "mythril",
        version: "unknown",
        issues: [],
        error: `Backend error: ${response.status} - ${errorText}`,
        summary: { high: 0, medium: 0, low: 0, total: 0 },
      }
    }

    return await response.json() as MythrilResult
  } catch (err) {
    return {
      success: false,
      tool: "mythril",
      version: "unknown",
      issues: [],
      error: err instanceof Error ? err.message : "Failed to call Mythril backend",
      summary: { high: 0, medium: 0, low: 0, total: 0 },
    }
  }
}

/**
 * Convert Mythril issues to Solay39 format
 */
export function convertMythrilToFindings(result: MythrilResult): Array<{
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
  tool: string
  swcId: string
}> {
  return result.issues.map(issue => {
    const location = issue.locations[0]
    
    return {
      title: `[Mythril] ${issue.swc_title} (${issue.swc_id})`,
      severity: issue.severity === "High" ? "CRITICAL" : issue.severity === "Medium" ? "HIGH" : "MEDIUM",
      location: location ? `${location.filename}:${location.lineno} (${location.function})` : "Unknown",
      description: `${issue.description.head}\n\n${issue.description.tail}`,
      impact: `SWC Registry: ${issue.swc_id} - ${issue.swc_title}`,
      recommendation: getSWCRecommendation(issue.swc_id),
      tool: "mythril",
      swcId: issue.swc_id,
    }
  })
}

function getSWCRecommendation(swcId: string): string {
  const recommendations: Record<string, string> = {
    "SWC-101": "Use SafeMath or Solidity 0.8+ built-in overflow protection.",
    "SWC-104": "Add access control checks before sensitive operations.",
    "SWC-105": "Avoid using tx.origin for authorization. Use msg.sender instead.",
    "SWC-106": "Add signer validation in ecrecover and check for zero address.",
    "SWC-107": "Use checks-effects-interactions pattern to prevent reentrancy.",
    "SWC-110": "Check return values of external calls and handle failures.",
    "SWC-113": "Ensure loop bounds are capped to prevent DoS.",
    "SWC-114": "Use block.timestamp with caution; miners can manipulate up to ~15 seconds.",
    "SWC-115": "Remove or restrict access to selfdestruct.",
    "SWC-120": "Avoid weak sources of randomness. Use Chainlink VRF for on-chain randomness.",
    "SWC-123": "Lock Solidity version with specific pragma to prevent compiler bugs.",
    "SWC-124": "Use SafeERC20 wrapper for token transfers.",
    "SWC-128": "Avoid DoS with unexpected revert by handling failed transfers gracefully.",
    "SWC-131": "Use mappings instead of dynamic arrays for gas efficiency.",
  }
  return recommendations[swcId] || `Fix vulnerability ${swcId} as detected by Mythril symbolic execution.`
}
