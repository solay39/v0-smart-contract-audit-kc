// core/symbolic/symbolicAnalyzer.ts
// Symbolic execution wrapper for Mythril

import { spawn } from "child_process"

export interface SymbolicIssue {
  title: string
  severity: "High" | "Medium" | "Low" | "Informational"
  swcId: string
  description: string
  contract: string
  function: string
  lineno?: number
  code?: string
}

export interface SymbolicResult {
  success: boolean
  issues: SymbolicIssue[]
  executionTime: number
  error?: string
}

export async function runSymbolicAnalysis(
  bytecode: string,
  timeout = 300
): Promise<SymbolicResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = [
      "-m",
      "mythril.interfaces.cli",
      "analyze",
      "--bin-runtime",
      bytecode,
      "--execution-timeout",
      String(timeout),
      "-o",
      "json",
    ]

    const p = spawn("python3", args, {
      timeout: (timeout + 30) * 1000,
    })

    let stdout = ""
    let stderr = ""

    p.stdout.on("data", (chunk) => (stdout += chunk))
    p.stderr.on("data", (chunk) => (stderr += chunk))

    p.on("close", (code) => {
      const executionTime = Date.now() - startTime

      if (code !== 0 && !stdout) {
        resolve({
          success: false,
          issues: [],
          executionTime,
          error: stderr || `Process exited with code ${code}`,
        })
        return
      }

      try {
        const result = JSON.parse(stdout)
        const issues: SymbolicIssue[] = (result.issues || []).map(
          (issue: Record<string, unknown>) => ({
            title: issue.title || "Unknown Issue",
            severity: mapMythrilSeverity(issue.severity as string),
            swcId: issue.swc_id || "SWC-000",
            description: issue.description || "",
            contract: issue.contract || "Unknown",
            function: issue.function || "unknown",
            lineno: issue.lineno,
            code: issue.code,
          })
        )

        resolve({
          success: true,
          issues,
          executionTime,
        })
      } catch {
        resolve({
          success: false,
          issues: [],
          executionTime,
          error: "Failed to parse Mythril output",
        })
      }
    })

    p.on("error", (err) => {
      resolve({
        success: false,
        issues: [],
        executionTime: Date.now() - startTime,
        error: err.message,
      })
    })
  })
}

function mapMythrilSeverity(s: string): "High" | "Medium" | "Low" | "Informational" {
  switch (s?.toLowerCase()) {
    case "high":
      return "High"
    case "medium":
      return "Medium"
    case "low":
      return "Low"
    default:
      return "Informational"
  }
}

// Run symbolic analysis on Solidity source via solc compilation
export async function runSymbolicOnSource(
  source: string,
  contractName: string,
  timeout = 300
): Promise<SymbolicResult> {
  const startTime = Date.now()

  return new Promise((resolve) => {
    const args = [
      "-m",
      "mythril.interfaces.cli",
      "analyze",
      "--solidity-code",
      source,
      "-c",
      contractName,
      "--execution-timeout",
      String(timeout),
      "-o",
      "json",
    ]

    const p = spawn("python3", args, {
      timeout: (timeout + 30) * 1000,
    })

    let stdout = ""
    let stderr = ""

    p.stdout.on("data", (chunk) => (stdout += chunk))
    p.stderr.on("data", (chunk) => (stderr += chunk))

    p.on("close", (code) => {
      const executionTime = Date.now() - startTime

      if (code !== 0 && !stdout) {
        resolve({
          success: false,
          issues: [],
          executionTime,
          error: stderr || `Process exited with code ${code}`,
        })
        return
      }

      try {
        const result = JSON.parse(stdout)
        const issues: SymbolicIssue[] = (result.issues || []).map(
          (issue: Record<string, unknown>) => ({
            title: issue.title || "Unknown Issue",
            severity: mapMythrilSeverity(issue.severity as string),
            swcId: issue.swc_id || "SWC-000",
            description: issue.description || "",
            contract: issue.contract || contractName,
            function: issue.function || "unknown",
            lineno: issue.lineno,
            code: issue.code,
          })
        )

        resolve({
          success: true,
          issues,
          executionTime,
        })
      } catch {
        resolve({
          success: false,
          issues: [],
          executionTime,
          error: "Failed to parse Mythril output",
        })
      }
    })

    p.on("error", (err) => {
      resolve({
        success: false,
        issues: [],
        executionTime: Date.now() - startTime,
        error: err.message,
      })
    })
  })
}
