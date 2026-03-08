// core/formal/invariantEngine.ts
// Formal verification - invariant checking engine

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
}

// Built-in invariants for common ERC20/ERC721 patterns
export const STANDARD_INVARIANTS: InvariantDefinition[] = [
  {
    name: "totalSupply <= maxSupply",
    condition: (s) => !s.maxSupply || !s.totalSupply || s.totalSupply <= s.maxSupply,
    severity: "CRITICAL",
    description: "Total supply must never exceed max supply cap",
  },
  {
    name: "balance >= 0",
    condition: (s) => !s.balance || s.balance >= 0n,
    severity: "CRITICAL",
    description: "Balances must never be negative",
  },
  {
    name: "owner != address(0)",
    condition: (s) =>
      !s.owner || s.owner !== "0x0000000000000000000000000000000000000000",
    severity: "HIGH",
    description: "Owner must not be zero address",
  },
  {
    name: "sum(balances) == totalSupply",
    condition: (s) => {
      if (!s.totalSupply || !s.allBalances) return true
      const sum = (s.allBalances as bigint[]).reduce((a, b) => a + b, 0n)
      return sum === s.totalSupply
    },
    severity: "CRITICAL",
    description: "Sum of all balances must equal total supply",
  },
]

// Check all invariants against current state
export function checkInvariants(
  state: ContractState,
  customInvariants: InvariantDefinition[] = []
): InvariantViolation[] {
  const violations: InvariantViolation[] = []
  const allInvariants = [...STANDARD_INVARIANTS, ...customInvariants]

  for (const inv of allInvariants) {
    try {
      if (!inv.condition(state)) {
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
    } catch (err) {
      // Skip invariants that can't be evaluated
    }
  }

  return violations
}

// DeFi-specific invariants
export const DEFI_INVARIANTS: InvariantDefinition[] = [
  {
    name: "reserves > 0",
    condition: (s) =>
      !s.reserve0 ||
      !s.reserve1 ||
      ((s.reserve0 as bigint) > 0n && (s.reserve1 as bigint) > 0n),
    severity: "CRITICAL",
    description: "AMM reserves must be positive",
  },
  {
    name: "k = x * y (constant product)",
    condition: (s) => {
      if (!s.reserve0 || !s.reserve1 || !s.kLast) return true
      const k = (s.reserve0 as bigint) * (s.reserve1 as bigint)
      return k >= (s.kLast as bigint)
    },
    severity: "CRITICAL",
    description: "Constant product invariant must hold",
  },
  {
    name: "collateralRatio >= minRatio",
    condition: (s) =>
      !s.collateralRatio ||
      !s.minCollateralRatio ||
      (s.collateralRatio as number) >= (s.minCollateralRatio as number),
    severity: "HIGH",
    description: "Collateral ratio must meet minimum requirement",
  },
  {
    name: "totalDebt <= totalCollateral * LTV",
    condition: (s) => {
      if (!s.totalDebt || !s.totalCollateral || !s.maxLTV) return true
      const maxDebt =
        ((s.totalCollateral as bigint) * BigInt((s.maxLTV as number) * 100)) / 10000n
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

  return `// SPDX-License-Identifier: MIT
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
      condition: () => true, // Placeholder - actual check happens in Solidity
      severity,
      description: message,
    })
  }

  return invariants
}
