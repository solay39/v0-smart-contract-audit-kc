/**
 * Echidna Fuzz Testing Runner
 * 
 * Property-based fuzzing for smart contracts.
 * Finds edge cases through randomized testing.
 */

import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

export interface EchidnaTest {
  name: string
  status: "passed" | "failed" | "shrunk"
  counterexample?: string[]
  gasUsed?: number
  coverage?: number
}

export interface EchidnaResult {
  success: boolean
  tool: "echidna"
  version: string
  tests: EchidnaTest[]
  error?: string
  coverage?: {
    covered: number
    total: number
    percentage: number
  }
  summary: {
    passed: number
    failed: number
    total: number
  }
  rawOutput?: string
}

export interface EchidnaConfig {
  testLimit?: number
  timeout?: number
  contractAddress?: string
  format?: "text" | "json"
  coverage?: boolean
  shrinkLimit?: number
  seqLen?: number
}

/**
 * Run Echidna locally
 */
export async function runEchidnaLocal(
  contractPath: string,
  config?: EchidnaConfig
): Promise<EchidnaResult> {
  return new Promise((resolve) => {
    const args = [
      contractPath,
      "--format", config?.format || "json",
      "--test-limit", String(config?.testLimit || 10000),
      "--timeout", String(config?.timeout || 300),
      "--seq-len", String(config?.seqLen || 100),
    ]

    if (config?.coverage) {
      args.push("--coverage")
    }

    if (config?.shrinkLimit) {
      args.push("--shrink-limit", String(config.shrinkLimit))
    }

    const proc = spawn("echidna", args, {
      timeout: (config?.timeout || 300) * 1000 + 30000,
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
      try {
        // Parse JSON output
        const lines = stdout.trim().split("\n").filter(l => l.startsWith("{"))
        const tests: EchidnaTest[] = []
        
        for (const line of lines) {
          try {
            const event = JSON.parse(line)
            if (event.test) {
              tests.push({
                name: event.test,
                status: event.status || "passed",
                counterexample: event.counterexample,
                gasUsed: event.gas,
              })
            }
          } catch {
            // Skip non-JSON lines
          }
        }

        const passed = tests.filter(t => t.status === "passed").length
        const failed = tests.filter(t => t.status === "failed" || t.status === "shrunk").length

        resolve({
          success: failed === 0 && code === 0,
          tool: "echidna",
          version: "2.2.x",
          tests,
          rawOutput: stdout,
          summary: {
            passed,
            failed,
            total: tests.length,
          },
        })
      } catch (err) {
        // Fallback to text parsing
        const tests = parseEchidnaTextOutput(stdout)
        
        resolve({
          success: !stdout.includes("failed!") && !stdout.includes("FAILED"),
          tool: "echidna",
          version: "2.2.x",
          tests,
          rawOutput: stdout,
          error: stderr || undefined,
          summary: {
            passed: tests.filter(t => t.status === "passed").length,
            failed: tests.filter(t => t.status === "failed").length,
            total: tests.length,
          },
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        success: false,
        tool: "echidna",
        version: "unknown",
        tests: [],
        error: `Echidna not installed: ${err.message}`,
        summary: { passed: 0, failed: 0, total: 0 },
      })
    })
  })
}

function parseEchidnaTextOutput(output: string): EchidnaTest[] {
  const tests: EchidnaTest[] = []
  const lines = output.split("\n")
  
  for (const line of lines) {
    // Match: "echidna_test_name: passed"
    const passMatch = line.match(/^(\w+):\s*passed/)
    if (passMatch) {
      tests.push({ name: passMatch[1], status: "passed" })
      continue
    }
    
    // Match: "echidna_test_name: failed!"
    const failMatch = line.match(/^(\w+):\s*failed!?\s*(.*)/)
    if (failMatch) {
      tests.push({
        name: failMatch[1],
        status: "failed",
        counterexample: failMatch[2] ? [failMatch[2]] : undefined,
      })
    }
  }
  
  return tests
}

/**
 * Generate Echidna test file from contract
 */
export function generateEchidnaTest(
  contractCode: string,
  contractName: string,
  invariants: Array<{ name: string; condition: string }>
): string {
  const testFunctions = invariants.map(inv => `
    function echidna_${inv.name}() public view returns (bool) {
        return ${inv.condition};
    }
`).join("\n")

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./${contractName}.sol";

contract ${contractName}Echidna is ${contractName} {
    constructor() ${contractName}() {}

${testFunctions}

    // Default invariants
    function echidna_balance_non_negative() public view returns (bool) {
        return address(this).balance >= 0;
    }
}
`
}

/**
 * Run Echidna from source code with auto-generated tests
 */
export async function runEchidnaFromSource(
  sourceCode: string,
  contractName: string,
  invariants?: Array<{ name: string; condition: string }>,
  config?: EchidnaConfig
): Promise<EchidnaResult> {
  const tmpDir = path.join(os.tmpdir(), `echidna-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    // Write contract
    const contractPath = path.join(tmpDir, `${contractName}.sol`)
    fs.writeFileSync(contractPath, sourceCode)

    // Generate and write test file
    const defaultInvariants = [
      { name: "total_supply_bounded", condition: "totalSupply() <= type(uint256).max" },
    ]
    const testCode = generateEchidnaTest(sourceCode, contractName, invariants || defaultInvariants)
    const testPath = path.join(tmpDir, `${contractName}Echidna.sol`)
    fs.writeFileSync(testPath, testCode)

    // Write echidna config
    const echidnaConfig = `
testLimit: ${config?.testLimit || 10000}
seqLen: ${config?.seqLen || 100}
contractAddr: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"
deployer: "0x30000"
sender: ["0x10000", "0x20000"]
`
    fs.writeFileSync(path.join(tmpDir, "echidna.yaml"), echidnaConfig)

    const result = await runEchidnaLocal(testPath, config)
    return result
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * Run Echidna via Railway backend
 */
export async function runEchidnaRemote(
  sourceCode: string,
  contractName: string,
  invariants?: Array<{ name: string; condition: string }>,
  apiUrl?: string
): Promise<EchidnaResult> {
  const backendUrl = apiUrl || process.env.SECURITY_BACKEND_URL

  if (!backendUrl) {
    return {
      success: false,
      tool: "echidna",
      version: "unknown",
      tests: [],
      error: "SECURITY_BACKEND_URL not configured",
      summary: { passed: 0, failed: 0, total: 0 },
    }
  }

  try {
    const response = await fetch(`${backendUrl}/api/echidna`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SECURITY_API_KEY || "",
      },
      body: JSON.stringify({
        code: sourceCode,
        contractName,
        invariants,
        testLimit: 10000,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        tool: "echidna",
        version: "unknown",
        tests: [],
        error: `Backend error: ${response.status}`,
        summary: { passed: 0, failed: 0, total: 0 },
      }
    }

    return await response.json() as EchidnaResult
  } catch (err) {
    return {
      success: false,
      tool: "echidna",
      version: "unknown",
      tests: [],
      error: err instanceof Error ? err.message : "Unknown error",
      summary: { passed: 0, failed: 0, total: 0 },
    }
  }
}

/**
 * Convert Echidna failures to findings
 */
export function convertEchidnaToFindings(result: EchidnaResult): Array<{
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
  tool: string
  counterexample?: string[]
}> {
  return result.tests
    .filter(t => t.status === "failed" || t.status === "shrunk")
    .map(test => ({
      title: `[Echidna] Property Violation: ${test.name}`,
      severity: "HIGH",
      location: `Invariant: ${test.name}`,
      description: `Fuzzing found a counterexample that violates the ${test.name} invariant.${test.counterexample ? `\n\nCounterexample: ${test.counterexample.join(", ")}` : ""}`,
      impact: "The contract has a logical flaw that can be exploited under specific conditions found by fuzz testing.",
      recommendation: "Review the invariant condition and fix the contract logic to ensure it always holds.",
      tool: "echidna",
      counterexample: test.counterexample,
    }))
}
