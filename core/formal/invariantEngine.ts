// core/formal/invariantEngine.ts
// State snapshot checks. These are not formal proofs or executed Solidity tests.

export interface ContractState {
  totalSupply?: bigint
  maxSupply?: bigint
  balance?: bigint
  owner?: string
  paused?: boolean
  [key: string]: unknown
}

export interface InvariantViolation {
  invariant: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  currentValue: string
  expectedCondition: string
  impact: string
}

export interface InvariantDefinition {
  name: string
  condition: (state: ContractState) => boolean
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description: string
  requiredFields?: string[]
  executable?: boolean
}

// Built-in invariants for common ERC20/ERC721 patterns
export const STANDARD_INVARIANTS: InvariantDefinition[] = [
  {
    name: "totalSupply <= maxSupply",
    requiredFields: ["maxSupply", "totalSupply"],
    condition: (s) => s.totalSupply! <= s.maxSupply!,
    severity: "CRITICAL",
    description: "Total supply must never exceed max supply cap",
  },
  {
    name: "balance >= 0",
    requiredFields: ["balance"],
    condition: (s) => s.balance! >= BigInt(0),
    severity: "CRITICAL",
    description: "Balances must never be negative",
  },
  {
    name: "owner != address(0)",
    requiredFields: ["owner"],
    condition: (s) => s.owner !== "0x0000000000000000000000000000000000000000",
    severity: "HIGH",
    description: "Owner must not be zero address",
  },
  {
    name: "sum(balances) == totalSupply",
    requiredFields: ["totalSupply", "allBalances"],
    condition: (s) => {
      const sum = (s.allBalances as bigint[]).reduce((a, b) => a + b, BigInt(0))
      return sum === s.totalSupply
    },
    severity: "CRITICAL",
    description: "Sum of all balances must equal total supply",
  },
]

export interface InvariantEvaluation {
  invariant: string
  status: "PASSED" | "FAILED" | "NOT_APPLICABLE" | "NOT_RUN" | "ERROR"
  reason?: string
}

/** A missing input or evaluator error is explicitly not a passed check. */
export function evaluateInvariants(
  state: ContractState, customInvariants: InvariantDefinition[] = [],
): InvariantEvaluation[] {
  return [...STANDARD_INVARIANTS, ...customInvariants].map(inv => {
    if (inv.executable === false) return {
      invariant: inv.name, status: "NOT_RUN", reason: "Source expression is a candidate, not an executable proof.",
    }
    const missing = (inv.requiredFields || []).filter(field => state[field] === undefined || state[field] === null)
    if (missing.length) return {
      invariant: inv.name, status: "NOT_APPLICABLE", reason: `Missing state: ${missing.join(", ")}`,
    }
    try {
      const result = inv.condition(state)
      if (typeof result !== "boolean") throw new Error("Evaluator did not return a boolean")
      return { invariant: inv.name, status: result ? "PASSED" : "FAILED" }
    } catch (error) {
      return { invariant: inv.name, status: "ERROR", reason: error instanceof Error ? error.message : "Evaluation failed" }
    }
  })
}

// Compatibility: violations only. An empty list is NOT evidence that checks passed.
export function checkInvariants(
  state: ContractState,
  customInvariants: InvariantDefinition[] = []
): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const allInvariants = [...STANDARD_INVARIANTS, ...customInvariants]

  const evaluations = evaluateInvariants(state, customInvariants)
  for (const [index, inv] of allInvariants.entries()) {
      if (evaluations[index].status === "FAILED") {
        violations.push({
          invariant: inv.name,
          severity: inv.severity,
          currentValue: JSON.stringify(state, (_, v) =>
            typeof v === "bigint" ? v.toString() : v
          ),
          expectedCondition: inv.description,
          impact: `Invariant "${inv.name}" violated - ${inv.description}`,
        })
      }
  }

  return violations
}

// DeFi-specific invariants
export const DEFI_INVARIANTS: InvariantDefinition[] = [
  {
    name: "reserves > 0",
    requiredFields: ["reserve0", "reserve1"],
    condition: (s) =>
      ((s.reserve0 as bigint) > BigInt(0) && (s.reserve1 as bigint) > BigInt(0)),
    severity: "CRITICAL",
    description: "AMM reserves must be positive",
  },
  {
    name: "k = x * y (constant product)",
    requiredFields: ["reserve0", "reserve1", "kLast"],
    condition: (s) => {
      const k = (s.reserve0 as bigint) * (s.reserve1 as bigint)
      return k >= (s.kLast as bigint)
    },
    severity: "CRITICAL",
    description: "Constant product invariant must hold",
  },
  {
    name: "collateralRatio >= minRatio",
    requiredFields: ["collateralRatio", "minCollateralRatio"],
    condition: (s) =>
      (s.collateralRatio as number) >= (s.minCollateralRatio as number),
    severity: "HIGH",
    description: "Collateral ratio must meet minimum requirement",
  },
  {
    name: "totalDebt <= totalCollateral * LTV",
    requiredFields: ["totalDebt", "totalCollateral", "maxLTV"],
    condition: (s) => {
      const percentage = s.maxLTV as number
      const basisPoints = Math.round(percentage * 100)
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 ||
        Math.abs(percentage * 100 - basisPoints) > 1e-8) throw new Error("LTV must be a percentage with at most two decimals")
      const maxDebt =
        ((s.totalCollateral as bigint) * BigInt(basisPoints)) / BigInt(10000)
      return (s.totalDebt as bigint) <= maxDebt
    },
    severity: "CRITICAL",
    description: "Total debt must not exceed LTV limit",
  },
]

// Generate Solidity invariant test from definitions
export function generateSolidityInvariantTest(
  contractName: string,
  invariants: InvariantDefinition[]
): string {
  const testFunctions = invariants.map((inv) => {
    const fnName = inv.name.replace(/[^a-zA-Z0-9]/g, "_")
    return `
    function invariant_${fnName}() public {
        // ${inv.description}
        // Severity: ${inv.severity}
        assertTrue(
            ${inv.name.replace(/==/g, "==").replace(/>=/g, ">=").replace(/<=/g, "<=")},
            "Invariant violated: ${inv.name}"
        );
    }`
  })

  return `// UNCOMPILED TEMPLATE ONLY. Adapt deployment, getters and assertions before execution.
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

contract ${contractName}InvariantTest is Test {
    ${contractName} public target;

    function setUp() public {
        target = new ${contractName}();
    }
${testFunctions.join("\n")}
}
`
}

// Parse Solidity code to extract potential invariants
export function extractInvariantsFromCode(solidityCode: string): InvariantDefinition[] {
  const invariants: InvariantDefinition[] = []

  // Find require/assert statements that look like invariants
  const requireMatches = solidityCode.matchAll(
    /require\s*\(\s*([^,)]+)\s*(?:,\s*["']([^"']+)["'])?\s*\)/g
  )

  for (const match of requireMatches) {
    const condition = match[1].trim()
    const message = match[2] || condition

    // Detect severity from condition
    let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM"
    if (
      condition.includes("balance") ||
      condition.includes("supply") ||
      condition.includes("owner")
    ) {
      severity = "HIGH"
    }
    if (condition.includes(">=") && condition.includes("0")) {
      severity = "CRITICAL" // Underflow check
    }

    invariants.push({
      name: condition,
      executable: false,
      condition: () => { throw new Error("Source expression has not been executed") },
      severity,
      description: message,
    })
  }

  return invariants
}
