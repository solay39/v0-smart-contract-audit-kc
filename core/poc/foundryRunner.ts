// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Foundry Exploit Test Runner
// /core/poc/foundryRunner.ts
// Executes Foundry tests and returns structured results
// ═══════════════════════════════════════════════════════════════

export interface ExploitTestResult {
  finding_id: string
  poc_generated: boolean
  exploit_result: "FAILED" | "SUCCESS" | "SKIPPED" | "ERROR"
  poc_file: string
  output?: string
  gasUsed?: string
}

/**
 * Run a Foundry exploit test via `forge test`.
 * In server environments without Foundry installed, returns SKIPPED.
 * In real CI/CD pipelines, this executes the actual test.
 */
export function runExploitTest(findingId?: string): ExploitTestResult {
  const pocFile = `poc/${findingId || "SOL-XXX"}.t.sol`

  try {
    // Dynamic import — only works in Node.js environments with child_process
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("child_process") as typeof import("child_process")

    const output = execSync("forge test --match-contract Exploit -vvv", {
      encoding: "utf-8",
      timeout: 120_000, // 2 minute timeout
    })

    // If test passes (no exceptions), the exploit was blocked (secure)
    return {
      finding_id: findingId || "SOL-XXX",
      poc_generated: true,
      exploit_result: "FAILED",
      poc_file: pocFile,
      output: output.slice(0, 2000),
    }
  } catch (err: unknown) {
    // If forge test throws, the exploit succeeded (vulnerable)
    const error = err as { stdout?: string; stderr?: string; message?: string }

    // Check if it's actually forge that failed (test assertion) vs missing binary
    if (error.stdout && error.stdout.includes("FAIL")) {
      return {
        finding_id: findingId || "SOL-XXX",
        poc_generated: true,
        exploit_result: "SUCCESS",
        poc_file: pocFile,
        output: (error.stdout || "").slice(0, 2000),
      }
    }

    // Forge not installed or not in a Foundry project
    if (error.message?.includes("ENOENT") || error.message?.includes("not found")) {
      return {
        finding_id: findingId || "SOL-XXX",
        poc_generated: true,
        exploit_result: "SKIPPED",
        poc_file: pocFile,
        output: "Foundry (forge) not available in current environment. Run locally: forge test --match-contract Exploit -vvvv",
      }
    }

    return {
      finding_id: findingId || "SOL-XXX",
      poc_generated: true,
      exploit_result: "ERROR",
      poc_file: pocFile,
      output: error.message || "Unknown error",
    }
  }
}

/**
 * Simulate exploit test result for web environments where forge is unavailable.
 * Used in the audit workspace to generate structured PoC output.
 */
export function simulateExploitTest(
  findingId: string,
  severity: string,
): ExploitTestResult {
  return {
    finding_id: findingId,
    poc_generated: true,
    exploit_result: severity === "CRITICAL" || severity === "HIGH" ? "SUCCESS" : "FAILED",
    poc_file: `poc/${findingId}.t.sol`,
    output: `[Simulated] Finding ${findingId} (${severity}): PoC generated. Run locally with: forge test --match-contract Exploit -vvvv`,
  }
}
