/**
 * Slither Static Analysis Runner
 * 
 * Integrates with Slither - the most used tool by professional auditors.
 * Runs on Railway backend with slither-analyzer installed.
 */

import { exec, spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface SlitherDetector {
  check: string
  impact: "High" | "Medium" | "Low" | "Informational" | "Optimization"
  confidence: "High" | "Medium" | "Low"
  description: string
  elements: Array<{
    type: string
    name: string
    source_mapping: {
      filename_relative: string
      lines: number[]
      starting_column: number
      ending_column: number
    }
  }>
  first_markdown_element?: string
}

export interface SlitherResult {
  success: boolean
  tool: "slither"
  version: string
  detectors: SlitherDetector[]
  error?: string
  rawOutput?: string
  summary: {
    high: number
    medium: number
    low: number
    informational: number
    optimization: number
    total: number
  }
}

/**
 * Run Slither locally (requires slither-analyzer installed)
 */
export async function runSlitherLocal(contractPath: string): Promise<SlitherResult> {
  return new Promise((resolve) => {
    const reportPath = path.join(os.tmpdir(), `slither-${Date.now()}.json`)
    
    const args = [
      contractPath,
      "--json", reportPath,
      "--exclude-dependencies",
      "--exclude-informational",
      "--exclude-optimization",
    ]

    const proc = spawn("slither", args, {
      timeout: 300000, // 5 min timeout
    })

    let stderr = ""
    proc.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      try {
        if (fs.existsSync(reportPath)) {
          const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"))
          fs.unlinkSync(reportPath)

          const detectors: SlitherDetector[] = report.results?.detectors || []
          
          resolve({
            success: true,
            tool: "slither",
            version: report.version || "0.10.x",
            detectors,
            summary: {
              high: detectors.filter(d => d.impact === "High").length,
              medium: detectors.filter(d => d.impact === "Medium").length,
              low: detectors.filter(d => d.impact === "Low").length,
              informational: detectors.filter(d => d.impact === "Informational").length,
              optimization: detectors.filter(d => d.impact === "Optimization").length,
              total: detectors.length,
            },
          })
        } else {
          resolve({
            success: false,
            tool: "slither",
            version: "unknown",
            detectors: [],
            error: stderr || `Slither exited with code ${code}`,
            summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
          })
        }
      } catch (err) {
        resolve({
          success: false,
          tool: "slither",
          version: "unknown",
          detectors: [],
          error: err instanceof Error ? err.message : "Failed to parse Slither output",
          summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        success: false,
        tool: "slither",
        version: "unknown",
        detectors: [],
        error: `Slither not installed or not in PATH: ${err.message}`,
        summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
      })
    })
  })
}

/**
 * Run Slither from source code (creates temp file)
 */
export async function runSlitherFromSource(sourceCode: string, contractName?: string): Promise<SlitherResult> {
  const tmpDir = path.join(os.tmpdir(), `slither-src-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })
  
  const fileName = `${contractName || "Contract"}.sol`
  const filePath = path.join(tmpDir, fileName)
  
  fs.writeFileSync(filePath, sourceCode)
  
  try {
    const result = await runSlitherLocal(filePath)
    return result
  } finally {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Run Slither via Railway backend API
 */
export async function runSlitherRemote(
  sourceCode: string,
  contractName?: string,
  apiUrl?: string
): Promise<SlitherResult> {
  const backendUrl = apiUrl || process.env.SECURITY_BACKEND_URL || process.env.STATIC_ANALYSIS_API_URL
  
  if (!backendUrl) {
    return {
      success: false,
      tool: "slither",
      version: "unknown",
      detectors: [],
      error: "SECURITY_BACKEND_URL not configured",
      summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
    }
  }

  try {
    const response = await fetch(`${backendUrl}/api/slither`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SECURITY_API_KEY || "",
      },
      body: JSON.stringify({
        code: sourceCode,
        contractName: contractName || "Contract",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        tool: "slither",
        version: "unknown",
        detectors: [],
        error: `Backend error: ${response.status} - ${errorText}`,
        summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
      }
    }

    const data = await response.json()
    return data as SlitherResult
  } catch (err) {
    return {
      success: false,
      tool: "slither",
      version: "unknown",
      detectors: [],
      error: err instanceof Error ? err.message : "Failed to call Slither backend",
      summary: { high: 0, medium: 0, low: 0, informational: 0, optimization: 0, total: 0 },
    }
  }
}

/**
 * Convert Slither findings to Solay39 format
 */
export function convertSlitherToFindings(result: SlitherResult): Array<{
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
  tool: string
}> {
  return result.detectors.map(d => {
    const severity = d.impact === "High" ? "CRITICAL" :
                     d.impact === "Medium" ? "HIGH" :
                     d.impact === "Low" ? "MEDIUM" : "INFO"

    const element = d.elements[0]
    const location = element?.source_mapping
      ? `${element.source_mapping.filename_relative}:${element.source_mapping.lines.join(",")}`
      : "Unknown"

    return {
      title: `[Slither] ${d.check.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`,
      severity,
      location,
      description: d.description,
      impact: `Slither detector: ${d.check} (confidence: ${d.confidence})`,
      recommendation: getSlitherRecommendation(d.check),
      tool: "slither",
    }
  })
}

function getSlitherRecommendation(detector: string): string {
  const recommendations: Record<string, string> = {
    "reentrancy-eth": "Use the checks-effects-interactions pattern. Consider using ReentrancyGuard from OpenZeppelin.",
    "reentrancy-no-eth": "Apply checks-effects-interactions pattern even for non-ETH reentrancy.",
    "arbitrary-send-eth": "Restrict ETH transfers to verified addresses only.",
    "controlled-delegatecall": "Never use user-controlled addresses in delegatecall.",
    "suicidal": "Remove selfdestruct or restrict it to admin-only with timelock.",
    "uninitialized-state": "Initialize all state variables in the constructor.",
    "uninitialized-storage": "Explicitly initialize storage pointers.",
    "tx-origin": "Use msg.sender instead of tx.origin for authentication.",
    "unchecked-transfer": "Check return values of ERC20 transfer/transferFrom.",
    "locked-ether": "Add a withdraw function for locked ETH.",
    "incorrect-equality": "Use >= or <= instead of == for balance comparisons.",
  }
  return recommendations[detector] || `Review and fix the ${detector} issue as flagged by Slither.`
}
