import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"

export interface ExploitTestResult {
  finding_id: string
  poc_generated: boolean
  // A generic test outcome does not establish exploit success or contract safety.
  exploit_result: "FAILED" | "SUCCESS" | "SKIPPED" | "ERROR" | "UNVERIFIED"
  execution_status: "NOT_RUN" | "PASSED" | "FAILED" | "ERROR"
  tests_executed: number
  harness_sha256?: string
  poc_file: string
  output?: string
  gasUsed?: string
}

/** Parse actual Forge JSON, never infer exploitation from an assertion failure. */
export function interpretFoundryTests(output: string): Pick<ExploitTestResult,
  "execution_status" | "tests_executed" | "exploit_result"> {
  const suites = JSON.parse(output) as Record<string, { test_results?: Record<string, { status?: string }> }>
  if (!suites || typeof suites !== "object" || Array.isArray(suites)) throw new Error("Invalid Forge report")
  const tests = Object.values(suites).flatMap(suite =>
    suite && typeof suite === "object" && suite.test_results && typeof suite.test_results === "object"
      ? Object.values(suite.test_results) : [])
  const executed = tests.filter(test => test?.status === "Success" || test?.status === "Failure")
  if (!executed.length) return { execution_status: "NOT_RUN", tests_executed: 0, exploit_result: "SKIPPED" }
  return {
    execution_status: executed.some(test => test.status === "Failure") ? "FAILED" : "PASSED",
    tests_executed: executed.length,
    exploit_result: "UNVERIFIED",
  }
}

/** Executes an existing, trusted local harness. Never run AI templates as trusted code. */
export function runExploitTest(findingId = "SOL-XXX"): ExploitTestResult {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(findingId)) throw new Error("Invalid finding ID")
  const pocFile = `poc/${findingId}.t.sol`
  const base: ExploitTestResult = {
    finding_id: findingId, poc_generated: existsSync(pocFile), poc_file: pocFile,
    exploit_result: "SKIPPED", execution_status: "NOT_RUN", tests_executed: 0,
  }
  if (!base.poc_generated) return { ...base, output: "No harness file exists. No test was executed." }
  base.harness_sha256 = createHash("sha256").update(readFileSync(pocFile)).digest("hex")
  try {
    const output = execFileSync("forge", ["test", "--match-path", pocFile, "--json"], {
      encoding: "utf-8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    })
    return { ...base, ...interpretFoundryTests(output), output: output.slice(0, 2000) }
  } catch (err) {
    const error = err as { stdout?: string | Buffer; message?: string; code?: string; signal?: string; status?: number }
    // Non-zero test exit codes can contain valid test results. Compilation,
    // timeout and infrastructure failures must never become an exploit claim.
    if (!error.signal && error.status === 1 && error.stdout) {
      try {
        const output = error.stdout.toString()
        const interpreted = interpretFoundryTests(output)
        if (interpreted.execution_status === "FAILED") {
          return { ...base, ...interpreted, output: output.slice(0, 2000) }
        }
      } catch { /* Invalid JSON is an execution error, not evidence. */ }
    }
    if (error.code === "ENOENT") return { ...base, output: "Foundry is unavailable. No test was executed." }
    return { ...base, exploit_result: "ERROR", execution_status: "ERROR", output: error.message || "Execution failed" }
  }
}

/** Compatibility shim: templates and severity are never execution evidence. */
export function simulateExploitTest(findingId: string, _severity: string): ExploitTestResult {
  return {
    finding_id: findingId, poc_generated: false, exploit_result: "SKIPPED",
    execution_status: "NOT_RUN", tests_executed: 0, poc_file: `poc/${findingId}.t.sol`,
    output: "NOT RUN: a generated template is not an executed or validated exploit.",
  }
}
