// core/fuzz/fuzzRunner.ts
// Foundry fuzz testing runner - requires Foundry installed on backend

import { exec } from "child_process"

export interface FuzzResult {
  type: string
  description: string
  testName?: string
  counterexample?: string
}

export async function runFoundryFuzz(contractPath: string, runs = 5000): Promise<FuzzResult[]> {
  return new Promise((resolve, reject) => {
    exec(
      `forge test --match-path ${contractPath} --fuzz-runs ${runs} -vvv`,
      { timeout: 300000 }, // 5 min timeout
      (err, stdout, stderr) => {
        if (err && !stdout.includes("FAIL")) {
          return reject(new Error(stderr || err.message))
        }
        const vulnerabilities = parseFuzzOutput(stdout)
        resolve(vulnerabilities)
      }
    )
  })
}

function parseFuzzOutput(output: string): FuzzResult[] {
  const issues: FuzzResult[] = []
  const lines = output.split("\n")

  let currentTest = ""
  let counterexample = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Capture test name
    if (line.includes("[FAIL]") || line.includes("[PASS]")) {
      const match = line.match(/\[(FAIL|PASS)\]\s+(\w+)/)
      if (match) currentTest = match[2]
    }

    // Capture counterexample
    if (line.includes("counterexample:")) {
      counterexample = line.split("counterexample:")[1]?.trim() || ""
    }

    // Capture assertion failures
    if (line.includes("FAIL") || line.includes("Assertion")) {
      issues.push({
        type: "FuzzFailure",
        description: line.trim(),
        testName: currentTest,
        counterexample: counterexample || undefined,
      })
    }

    // Capture invariant violations
    if (line.includes("invariant")) {
      issues.push({
        type: "InvariantViolation",
        description: line.trim(),
        testName: currentTest,
        counterexample: counterexample || undefined,
      })
    }
  }

  return issues
}

// Generate fuzz test template for a contract
export function generateFuzzTest(
  contractName: string,
  functions: Array<{ name: string; params: string[] }>,
  invariants: string[]
): string {
  const imports = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";
`

  const setup = `
contract ${contractName}Fuzz is Test {
    ${contractName} public target;

    function setUp() public {
        target = new ${contractName}();
    }
`

  const fuzzFunctions = functions.map(
    (fn) => `
    function testFuzz_${fn.name}(${fn.params.map((p, i) => `${p} arg${i}`).join(", ")}) public {
        // Bound inputs to realistic ranges
        ${fn.params.map((p, i) => (p.includes("uint") ? `arg${i} = bound(arg${i}, 0, type(uint128).max);` : "")).join("\n        ")}
        
        try target.${fn.name}(${fn.params.map((_, i) => `arg${i}`).join(", ")}) {
            // Check invariants after call
            ${invariants.map((inv) => `assertTrue(${inv}, "Invariant violated: ${inv}");`).join("\n            ")}
        } catch {
            // Expected revert is acceptable
        }
    }`
  )

  const invariantTests = invariants.map(
    (inv) => `
    function invariant_${inv.replace(/[^a-zA-Z0-9]/g, "_")}() public {
        assertTrue(${inv}, "Invariant: ${inv}");
    }`
  )

  return `${imports}${setup}${fuzzFunctions.join("\n")}${invariantTests.join("\n")}\n}\n`
}
