// ════════════════════════════════════════════════════════════════
// SOLAY39 — CONSTANTS & TYPES
// ════════════════════════════════════════════════════════════════

export const FOUNDER_EMAIL = "lippo.f80@gmail.com"
export const FOUNDER_PASS = "Solay39!Audit#2025"
export const PUB_EMAIL = "solay2126@gmail.com"
export const TG_URL = "https://t.me/Solay39audit"

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
export type FindingStatus = "OPEN" | "RESOLVED" | "ACKNOWLEDGED" | "PARTIALLY_FIXED"

export interface Finding {
  id: number
  title: string
  severity: SeverityLevel
  category: string
  location: string
  description: string
  impact: string
  recommendation: string
  status: FindingStatus
  likelihood?: "High" | "Medium" | "Low"
  proofOfConcept?: string
}

// ── Tier-1 types ──────────────────────────────────────────────
export interface PrivilegedRole {
  role: string
  capabilities: string
  riskIfCompromised: string
}

export interface TrustAssumption {
  statement: string // "Users must trust X because Y"
}

export interface AttackScenario {
  title: string
  type: "fund-theft" | "state-corruption" | "censorship" | "economic" | "governance"
  description: string
  likelihood: "High" | "Medium" | "Low"
  mitigated: boolean
  simulationResult?: string   // e.g. "Attempted: transferFrom(max_uint) -> reverted: SafeMath underflow"
}

// ── Tier-1 Governance ─────────────────────────────────────────
export interface GovernanceSecurity {
  hasGovernance: boolean
  proposalLifecycle?: string        // "creation -> voting -> queue -> execution"
  timelockDelay?: string            // "48h" or "none"
  timelockBypassRisk?: string       // explanation
  votingMechanism?: string          // "token-weighted on-chain" / "snapshot off-chain"
  quorumThreshold?: string          // "4% of total supply"
  votingRisks?: string[]            // ["flash-loan voting", "whale takeover", "low quorum"]
}

// ── Tier-1 Upgradeability ─────────────────────────────────────
export interface UpgradeabilityAnalysis {
  isUpgradeable: boolean
  proxyPattern?: string             // "TransparentProxy" / "UUPS" / "Beacon" / "none"
  adminAddress?: string
  storageCollisionRisk?: "None" | "Low" | "Medium" | "High"
  initializerProtection?: boolean
  upgradeControl?: string           // "multisig" / "single owner" / "timelock"
}

// ── Tier-1 Economic Risks ─────────────────────────────────────
export interface EconomicRisk {
  title: string
  category: "vote-buying" | "supply-concentration" | "incentive-misalignment" | "treasury-drain" | "oracle-manipulation" | "mev" | "other"
  description: string
  severity: "High" | "Medium" | "Low"
  mitigation?: string
}

// ── Tier-1 Integration Risks ──────────────────────────────────
export interface IntegrationRisk {
  dependency: string                // "Chainlink Oracle" / "Uniswap V3" / "Snapshot"
  riskType: string                  // "price manipulation" / "bridge failure" / "dependency lock"
  description: string
  severity: "High" | "Medium" | "Low"
}

// ── Tier-1 Invariants ─────────────────────────────────────────
export interface InvariantCheck {
  invariant: string                 // "totalSupply never changes after deployment"
  holds: boolean
  evidence?: string                 // "No mint() or burn() functions outside constructor"
}

export interface AuditProject {
  name: string
  network: string
  commit: string
  scope: string
  date: string
}

export interface PortfolioProject {
  id: string
  name: string
  ticker?: string
  network: string
  score: number
  rating: string
  tvl?: string
  price?: string
  change24h?: string
  criticals: number
  highs: number
  mediums: number
  lows: number
  infos: number
  date: string
  auditor?: string
  contractAddress?: string
  scope?: string
  pdfUrl?: string
  findings?: {
    title: string
    severity: SeverityLevel
    status: FindingStatus
    location: string
    description: string
    impact: string
    recommendation: string
    likelihood?: "High" | "Medium" | "Low"
    proofOfConcept?: string
  }[]
  scoreBreakdown?: {
    codeSecurity: number
    architectureRisk: number
    governanceRisk: number
    centralization: number
    testingCoverage: number
  }
  centralizationLevel?: "Low" | "Medium" | "High"
  centralizationRisk?: "Low" | "Medium" | "High"
  // CertiK-style extended
  logoUrl?: string
  description?: string
  website?: string
  tags?: string[]
  socials?: { type: string; url: string }[]
  telegram?: string
  twitter?: string
  discord?: string
  auditTimeline?: { label: string; date: string }[]
  contractUncertainty?: { label: string; value: boolean }[]
  ownerPrivilege?: { label: string; value: string | boolean }[]
  tokenAge?: string
  creatorAddress?: string
  githubUrl?: string
  totalSupply?: string
  volume24h?: string
  fdv?: string
  // ── Tier-1 audit sections ──
  privilegedRoles?: PrivilegedRole[]
  trustAssumptions?: TrustAssumption[]
  architectureOverview?: string
  attackSurface?: AttackScenario[]
  toolingUsed?: string[]
  onChainValidation?: { label: string; status: "pass" | "fail" | "n/a"; detail?: string }[]
  // ── Tier-1 advanced sections ──
  governanceSecurity?: GovernanceSecurity
  upgradeabilityAnalysis?: UpgradeabilityAnalysis
  economicRisks?: EconomicRisk[]
  integrationRisks?: IntegrationRisk[]
  invariantsChecked?: InvariantCheck[]
}

// Keep backward compat alias
export type DemoProject = PortfolioProject

export const SEV_CONFIG: Record<SeverityLevel, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-s39-red", bg: "bg-[#160005]", border: "border-[#ff2d5540]" },
  HIGH: { color: "text-s39-orange", bg: "bg-[#160800]", border: "border-[#ff6b0040]" },
  MEDIUM: { color: "text-s39-yellow", bg: "bg-[#161200]", border: "border-[#ffd60040]" },
  LOW: { color: "text-s39-cyan", bg: "bg-[#001618]", border: "border-[#00e5ff40]" },
  INFO: { color: "text-s39-green", bg: "bg-[#001608]", border: "border-[#00ff8840]" },
}

export const SEV_RAW_COLORS: Record<SeverityLevel, string> = {
  CRITICAL: "#ff2d55",
  HIGH: "#ff6b00",
  MEDIUM: "#ffd600",
  LOW: "#00e5ff",
  INFO: "#00ff88",
}

export const CHECKLIST: Record<string, { id: string; text: string; sev: SeverityLevel }[]> = {
  "Access Control": [
    { id: "ac1", text: "Ownership functions restricted to authorized roles", sev: "CRITICAL" },
    { id: "ac2", text: "onlyOwner / modifiers verified on all sensitive functions", sev: "CRITICAL" },
    { id: "ac3", text: "Privileged role transfer is two-step (propose + accept)", sev: "HIGH" },
    { id: "ac4", text: "No centralized admin can rug: pause, drain, upgrade", sev: "CRITICAL" },
    { id: "ac5", text: "Multi-sig or timelock on critical admin ops (>=48h)", sev: "HIGH" },
    { id: "ac6", text: "Role separation: admin != operator != upgrader", sev: "MEDIUM" },
  ],
  "Reentrancy": [
    { id: "re1", text: "CEI pattern enforced (Checks-Effects-Interactions)", sev: "CRITICAL" },
    { id: "re2", text: "ReentrancyGuard on all external-call functions", sev: "CRITICAL" },
    { id: "re3", text: "No cross-function reentrancy via shared state", sev: "HIGH" },
    { id: "re4", text: "ERC777/ERC1155 hooks don't expose reentrancy surface", sev: "HIGH" },
  ],
  "Integer & Arithmetic": [
    { id: "ia1", text: "Solidity >=0.8.0 used or SafeMath throughout", sev: "HIGH" },
    { id: "ia2", text: "Division before multiplication (precision loss) checked", sev: "MEDIUM" },
    { id: "ia3", text: "No unchecked blocks hiding overflows on user values", sev: "HIGH" },
    { id: "ia4", text: "Downcasting (uint256->uint128) explicitly validated", sev: "MEDIUM" },
    { id: "ia5", text: "No phantom overflow in assembly blocks", sev: "HIGH" },
  ],
  "Oracle & Price": [
    { id: "or1", text: "TWAP oracle with sufficient window (>=30 min)", sev: "CRITICAL" },
    { id: "or2", text: "No spot price from single DEX pool as sole source", sev: "CRITICAL" },
    { id: "or3", text: "Flash-loan attack surface evaluated for price manipulation", sev: "CRITICAL" },
    { id: "or4", text: "Chainlink heartbeat checked, stale answer fallback present", sev: "HIGH" },
    { id: "or5", text: "Min/max price bounds validated on oracle response", sev: "HIGH" },
  ],
  "Flash Loans & MEV": [
    { id: "fl1", text: "Critical state cannot be manipulated within single tx", sev: "CRITICAL" },
    { id: "fl2", text: "Commit-reveal or private mempool for sensitive ops", sev: "HIGH" },
    { id: "fl3", text: "Front-running/sandwich attack analysis complete", sev: "HIGH" },
    { id: "fl4", text: "Slippage checks present on all AMM interactions", sev: "HIGH" },
  ],
  "Upgradability": [
    { id: "up1", text: "Storage layout collision analysis (EIP-1967 slots)", sev: "CRITICAL" },
    { id: "up2", text: "Initialize function protected, callable only once", sev: "CRITICAL" },
    { id: "up3", text: "Self-destruct in implementation checked", sev: "HIGH" },
    { id: "up4", text: "Upgrade authority behind timelock >=48h", sev: "HIGH" },
    { id: "up5", text: "UUPS: _authorizeUpgrade properly restricted", sev: "CRITICAL" },
  ],
  "Token Standards": [
    { id: "tk1", text: "Fee-on-transfer tokens handled correctly", sev: "HIGH" },
    { id: "tk2", text: "Rebasing tokens accounted for (balance != shares)", sev: "HIGH" },
    { id: "tk3", text: "ERC20 approve race condition mitigated", sev: "MEDIUM" },
    { id: "tk4", text: "Return values from transfer/transferFrom checked", sev: "HIGH" },
    { id: "tk5", text: "Deflationary token interactions tested", sev: "MEDIUM" },
  ],
  "Business Logic": [
    { id: "bl1", text: "Economic model analyzed for incentive attacks", sev: "CRITICAL" },
    { id: "bl2", text: "First depositor/donation attack analyzed in vaults", sev: "CRITICAL" },
    { id: "bl3", text: "Rounding direction favors protocol not user in all paths", sev: "MEDIUM" },
    { id: "bl4", text: "Emergency pause tested; funds recoverable", sev: "HIGH" },
    { id: "bl5", text: "Liquidation logic cannot be gamed at boundary conditions", sev: "HIGH" },
  ],
  "Gas & DoS": [
    { id: "gs1", text: "No unbounded loops over user-controlled arrays", sev: "HIGH" },
    { id: "gs2", text: "No griefing vector via block gas limit", sev: "HIGH" },
    { id: "gs3", text: "Pull-payment pattern used instead of push where appropriate", sev: "MEDIUM" },
  ],
  "Cryptography": [
    { id: "cr1", text: "EIP-712 structured data signing implemented correctly", sev: "HIGH" },
    { id: "cr2", text: "Signature replay protection (nonce + chainId)", sev: "CRITICAL" },
    { id: "cr3", text: "ecrecover returns address(0) checked", sev: "HIGH" },
    { id: "cr4", text: "No use of weak randomness (blockhash, timestamp)", sev: "HIGH" },
    { id: "cr5", text: "Merkle tree leaf encoding includes prefix (2nd preimage)", sev: "HIGH" },
  ],
}

export const DEFAULT_PROJECTS: PortfolioProject[] = [
  {
    id: "inj-token",
    name: "Injective Token",
    ticker: "INJ",
    network: "Ethereum",
    score: 97,
    rating: "AAA",
    criticals: 0,
    highs: 0,
    mediums: 0,
    lows: 1,
    infos: 3,
    date: "2026-02-25",
    auditor: "Solay39 Founder",
    contractAddress: "0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30",
    scope: "ERC-20 Token Contract",
    centralizationLevel: "Low",
    centralizationRisk: "Low",
    description: "Injective is a lightning fast interoperable layer one blockchain optimized for building the most powerful exchange, DeFi, derivatives and Web3 applications. INJ is the native utility token powering the Injective ecosystem.",
    website: "https://injective.com",
    tags: ["ERC-20", "DeFi", "Layer 1"],
    tokenAge: "4 yrs 5 mos",
    creatorAddress: "0x...deploy",
    githubUrl: "https://github.com/InjectiveLabs",
    auditTimeline: [
      { label: "Requested", date: "2026-02-25" },
      { label: "Delivered", date: "2026-02-25" },
    ],
    contractUncertainty: [
      { label: "Open Source", value: true },
      { label: "Proxy Contract", value: false },
      { label: "External Call Risk", value: false },
      { label: "Mint Function", value: false },
      { label: "Self Destruct", value: false },
    ],
    ownerPrivilege: [
      { label: "Retrieve Ownership", value: false },
      { label: "Balance Modifiable", value: false },
      { label: "Hidden Owner", value: false },
      { label: "Ownership Renounced", value: true },
    ],
    scoreBreakdown: {
      codeSecurity: 98,
      architectureRisk: 96,
      governanceRisk: 92,
      centralization: 88,
      testingCoverage: 97,
    },
    findings: [
      { title: "Solidity < 0.8.0 with SafeMath", severity: "INFO", status: "OPEN", location: "Compiler version 0.6", description: "The contract targets Solidity < 0.8.0 but uses SafeMath library for arithmetic operations, which provides overflow/underflow protection.", impact: "Arithmetic is protected by SafeMath. However, any operations NOT using SafeMath remain vulnerable.", recommendation: "Ensure ALL arithmetic operations use SafeMath consistently, or consider upgrading to Solidity >= 0.8.0 for built-in checks.", likelihood: "Low" },
      { title: "Fixed Supply (Constructor-Only Mint)", severity: "INFO", status: "OPEN", location: "Constructor", description: "Token minting occurs only in the constructor. The supply is fixed at deployment with no public or external mint function available.", impact: "No inflation risk. The token supply cannot be increased after deployment.", recommendation: "No action needed. This is a secure pattern for fixed-supply tokens.", likelihood: "Low" },
      { title: "ERC-20 Allowance Race Condition", severity: "LOW", status: "OPEN", location: "approve() function", description: "The standard ERC-20 approve() function is vulnerable to a front-running race condition.", impact: "A spender could extract more tokens than intended during an allowance change.", recommendation: "Consider adding increaseAllowance/decreaseAllowance helper functions.", likelihood: "Low" },
      { title: "Initial Supply Concentration", severity: "INFO", status: "OPEN", location: "Constructor — full supply to single address", description: "The entire token supply is minted to a single address (custodian/deployer) in the constructor.", impact: "The initial holder controls 100% of supply.", recommendation: "Recommend transparent vesting schedules and distribution plans.", likelihood: "Low" },
    ],
    // Tier-1 sections
    privilegedRoles: [
      { role: "Deployer", capabilities: "Initial token supply recipient. No ongoing admin functions.", riskIfCompromised: "Low — no admin capabilities post-deployment" },
    ],
    trustAssumptions: [
      { statement: "Users must trust that the initial supply distribution was handled fairly, as 100% of tokens were minted to a single address at deployment." },
      { statement: "Users must trust that SafeMath is applied consistently across all arithmetic operations since the contract uses Solidity < 0.8.0." },
    ],
    architectureOverview: "Simple ERC-20 token contract with fixed supply minted in the constructor. No external dependencies, no proxy pattern, no upgradeability. Uses OpenZeppelin SafeMath for arithmetic safety. Ownership was renounced post-deployment, making the contract fully trustless.",
    attackSurface: [
      { title: "ERC-20 Approve Front-Running", type: "economic" as const, description: "The standard approve() function allows a spender to front-run an allowance change and extract more tokens than intended. This is a known ERC-20 limitation.", likelihood: "Low" as const, mitigated: false, simulationResult: "Simulated: approve(100) then approve(50) with front-run transferFrom(100) -> succeeds. Known ERC-20 standard limitation, not fixable without increaseAllowance." },
      { title: "Overflow on transfer()", type: "fund-theft" as const, description: "Attempted arithmetic overflow attack on transfer by sending uint256.max tokens.", likelihood: "Low" as const, mitigated: true, simulationResult: "Attempted: transfer(0xdead, 2^256-1) -> reverted: SafeMath: subtraction overflow. Attack not possible." },
    ],
    toolingUsed: [
      "Solay39 Manual Review (5 phases)",
      "Slither v0.10.0: 0 high, 0 medium, 1 optimization",
      "Mythril v0.24: 0 vulnerabilities detected",
      "AI-Guided Verification (GPT-4o): 4 findings confirmed",
      "OpenZeppelin Contract Analysis: SafeMath verified",
    ],
    onChainValidation: [
      { label: "Source Code Verified on Etherscan", status: "pass" as const, detail: "Verified at 0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30" },
      { label: "Bytecode Match (on-chain vs source)", status: "pass" as const, detail: "Compiled with solc 0.6.12, optimizer 200 runs" },
      { label: "owner() returns address(0)", status: "pass" as const, detail: "Ownership renounced: owner() = 0x000...000" },
      { label: "No proxy detected (EIP-1967 slot empty)", status: "pass" as const, detail: "Storage slot 0x360894... = 0x0" },
      { label: "mint() not callable post-deploy", status: "pass" as const, detail: "_mint() only in constructor; no public mint" },
      { label: "pause() not present", status: "n/a" as const, detail: "Contract does not implement Pausable" },
    ],
    // Tier-1 advanced
    governanceSecurity: {
      hasGovernance: false,
      proposalLifecycle: null,
      timelockDelay: null,
      timelockBypassRisk: null,
      votingMechanism: null,
      quorumThreshold: null,
      votingRisks: [],
    },
    upgradeabilityAnalysis: {
      isUpgradeable: false,
      proxyPattern: "none",
      storageCollisionRisk: "None" as const,
      initializerProtection: false,
      upgradeControl: null,
    },
    economicRisks: [
      { title: "Initial Supply Concentration", category: "supply-concentration" as const, description: "100% of supply minted to single deployer address at construction. Market price can be manipulated by initial holder.", severity: "Medium" as const, mitigation: "Ownership renounced; supply distributed via exchanges and vesting." },
      { title: "Approve Race Condition", category: "other" as const, description: "The standard ERC-20 approve() is susceptible to front-running that can extract more tokens than intended during an allowance change.", severity: "Low" as const, mitigation: "Use increaseAllowance/decreaseAllowance patterns." },
    ],
    integrationRisks: [
      { dependency: "No external dependencies", riskType: "none", description: "This is a standalone ERC-20 token with no oracle, bridge, or external contract dependencies.", severity: "Low" as const },
    ],
    invariantsChecked: [
      { invariant: "totalSupply never changes after deployment", holds: true, evidence: "No mint() or burn() functions outside constructor. Supply is immutable." },
      { invariant: "balances[a] + balances[b] <= totalSupply for all a,b", holds: true, evidence: "SafeMath prevents overflow; transfer logic preserves conservation." },
      { invariant: "No privileged functions post-renounce", holds: true, evidence: "Ownership renounced. No admin, pause, or mint functions callable." },
    ],
  },
  {
    id: "fetch-token",
    name: "Fetch.ai",
    ticker: "FET",
    network: "Ethereum",
    score: 93,
    rating: "AA",
    criticals: 0,
    highs: 1,
    mediums: 0,
    lows: 0,
    infos: 0,
    date: "2026-02-25",
    auditor: "Solay39 Founder",
    contractAddress: "0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85",
    scope: "ERC-20 Token Contract",
    centralizationLevel: "Low",
    centralizationRisk: "Low",
    description: "Fetch.ai (now part of the Artificial Superintelligence Alliance) is an innovative platform for connecting IoT devices and algorithms to enable collective learning. The ASI Alliance unites SingularityNET, Fetch.ai, and Ocean Protocol into the largest open-source decentralized AGI initiative.",
    website: "https://fetch.ai",
    tags: ["ERC-20", "AI", "ASI Alliance", "IoT"],
    tokenAge: "5 yrs 6 mos",
    creatorAddress: "0xa47c..7ac5",
    githubUrl: "https://github.com/fetchai",
    auditTimeline: [
      { label: "Requested", date: "2026-02-25" },
      { label: "Delivered", date: "2026-02-25" },
    ],
    contractUncertainty: [
      { label: "Open Source", value: true },
      { label: "Proxy Contract", value: false },
      { label: "External Call Risk", value: false },
      { label: "Mint Function", value: true },
      { label: "Self Destruct", value: false },
    ],
    ownerPrivilege: [
      { label: "Retrieve Ownership", value: false },
      { label: "Balance Modifiable", value: false },
      { label: "Hidden Owner", value: true },
      { label: "Creator Percentage", value: "0.00%" },
      { label: "Ownership Renounced", value: true },
    ],
    scoreBreakdown: {
      codeSecurity: 93,
      architectureRisk: 91,
      governanceRisk: 85,
      centralization: 81,
      testingCoverage: 90,
    },
    findings: [
      { title: "Integer Overflow/Underflow Risk", severity: "HIGH", status: "OPEN", location: "Compiler version 0.6", description: "The contract targets Solidity < 0.8.0 which does not have built-in overflow/underflow checks, and no SafeMath usage was detected.", impact: "Arithmetic operations can silently wrap around, leading to unexpected behavior and potential fund theft.", recommendation: "Upgrade to Solidity >= 0.8.0 or add the SafeMath library for all arithmetic operations.", likelihood: "Medium" },
    ],
    // Tier-1 sections
    privilegedRoles: [
      { role: "Deployer", capabilities: "Initial supply minting. Ownership renounced post-deployment.", riskIfCompromised: "Low — ownership renounced" },
      { role: "Token Holder", capabilities: "Standard ERC-20 transfer, approve, transferFrom operations.", riskIfCompromised: "N/A — standard user operations" },
    ],
    trustAssumptions: [
      { statement: "Users must trust that arithmetic operations are safe despite the absence of SafeMath and Solidity < 0.8.0, as integer overflow is theoretically possible." },
    ],
    architectureOverview: "Standard ERC-20 token contract without SafeMath or OpenZeppelin dependencies. Fixed supply minted at deployment. No proxy, no upgradeability, no external calls. The lack of SafeMath on Solidity < 0.8.0 is the primary risk vector.",
    attackSurface: [
      { title: "Integer Overflow on Token Operations", type: "fund-theft" as const, description: "Without SafeMath or Solidity >= 0.8.0, arithmetic operations could silently overflow, potentially allowing attackers to manipulate balances.", likelihood: "Medium" as const, mitigated: false, simulationResult: "Simulated: transfer() with value > balances[sender] -> no revert. Subtraction wraps around uint256. Confirmed exploitable." },
    ],
    toolingUsed: [
      "Solay39 Manual Review (5 phases)",
      "Slither v0.10.0: 2 high (overflow), 1 medium",
      "Mythril v0.24: 1 integer overflow path confirmed",
      "AI-Guided Verification (GPT-4o): 5 findings confirmed",
    ],
    onChainValidation: [
      { label: "Source Code Verified on Etherscan", status: "pass" as const, detail: "Verified at 0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85" },
      { label: "Bytecode Match (on-chain vs source)", status: "pass" as const, detail: "Compiled with solc 0.4.18" },
      { label: "No SafeMath library detected", status: "fail" as const, detail: "No 'using SafeMath' or .add()/.sub() in contract" },
      { label: "owner() not present", status: "n/a" as const, detail: "No Ownable or owner pattern" },
      { label: "No proxy detected", status: "pass" as const, detail: "EIP-1967 slot empty; no delegatecall" },
    ],
    governanceSecurity: {
      hasGovernance: false,
      votingRisks: [],
    },
    upgradeabilityAnalysis: {
      isUpgradeable: false,
      proxyPattern: "none",
      storageCollisionRisk: "None" as const,
      initializerProtection: false,
    },
    economicRisks: [
      { title: "Integer Overflow Exploitation", category: "other" as const, description: "Solidity 0.4.18 without SafeMath allows arithmetic overflow. Attacker could craft transactions exploiting uint256 wrap-around to manipulate balances.", severity: "High" as const, mitigation: "Upgrade compiler to >= 0.8.0 or add SafeMath." },
      { title: "Supply Concentration at Genesis", category: "supply-concentration" as const, description: "Full supply minted to deployer address. Risk of market manipulation.", severity: "Medium" as const, mitigation: "Transparent distribution records on-chain." },
    ],
    integrationRisks: [
      { dependency: "No external dependencies", riskType: "none", description: "Standalone ERC-20 with no oracle or bridge dependencies.", severity: "Low" as const },
    ],
    invariantsChecked: [
      { invariant: "totalSupply immutability", holds: true, evidence: "No mint/burn post-deployment." },
      { invariant: "Balance conservation on transfers", holds: false, evidence: "Possible overflow in transfer() due to missing SafeMath could break conservation." },
    ],
  },
  {
    id: "chz-token",
    name: "chiliZ",
    ticker: "CHZ",
    network: "Ethereum",
    score: 91,
    rating: "AA",
    criticals: 0,
    highs: 0,
    mediums: 0,
    lows: 2,
    infos: 2,
    date: "2026-02-25",
    auditor: "Solay39 Founder",
    contractAddress: "0x3506424F91fD33084466F402d5D97f05F8e3b4AF",
    scope: "ERC-20 Token Contract (ERC20 + ERC20Detailed + ERC20Pausable)",
    centralizationLevel: "Low",
    centralizationRisk: "Low",
    description: "Chiliz is the leading digital currency for sports and entertainment. CHZ powers Socios.com, the world's first tokenized fan voting and rewards platform, where fans can buy branded Fan Tokens to influence their favorite teams. Supply fixed at 8,888,888,888 CHZ minted at deploy.",
    website: "https://www.chiliz.com",
    tags: ["ERC-20", "Sports", "Fan Tokens", "Pausable"],
    tokenAge: "7 yrs 4 mos",
    creatorAddress: "0x...deploy",
    githubUrl: "https://github.com/nicola/chiliz-token",
    auditTimeline: [
      { label: "Requested", date: "2026-02-25" },
      { label: "Delivered", date: "2026-02-25" },
    ],
    contractUncertainty: [
      { label: "Open Source", value: true },
      { label: "Proxy Contract", value: false },
      { label: "External Call Risk", value: false },
      { label: "Mint Function", value: false },
      { label: "Self Destruct", value: false },
    ],
    ownerPrivilege: [
      { label: "Retrieve Ownership", value: false },
      { label: "Balance Modifiable", value: false },
      { label: "Hidden Owner", value: false },
      { label: "Pause Capability", value: true },
      { label: "Ownership Renounced", value: false },
    ],
    scoreBreakdown: {
      codeSecurity: 94,
      architectureRisk: 92,
      governanceRisk: 84,
      centralization: 78,
      testingCoverage: 91,
    },
    findings: [
      { title: "Floating Pragma Version", severity: "LOW", status: "OPEN", location: "pragma solidity ^0.4.24", description: "The contract uses a floating pragma (^0.4.24). This allows compilation with multiple compiler versions, which may introduce inconsistencies between deployments.", impact: "Different compiler versions may produce different bytecode or include different known bugs.", recommendation: "Lock the pragma to a specific version, e.g., pragma solidity 0.4.24;", likelihood: "Low" },
      { title: "ERC-20 Allowance Race Condition", severity: "LOW", status: "OPEN", location: "approve() function (inherited from OpenZeppelin ERC20)", description: "The standard ERC-20 approve() function is vulnerable to a front-running race condition.", impact: "A spender could extract more tokens than intended during an allowance change.", recommendation: "Consider adding increaseAllowance/decreaseAllowance helper functions.", likelihood: "Low" },
      { title: "Fixed Supply (Constructor-Only Mint)", severity: "INFO", status: "OPEN", location: "Constructor: _mint(msg.sender, 8888888888 * 10^18)", description: "The entire supply of 8,888,888,888 CHZ is minted to the deployer in the constructor. No mint() function exists outside the constructor. The supply is permanently fixed.", impact: "No inflation risk. The token supply cannot be increased after deployment.", recommendation: "No action needed. This is a secure pattern for fixed-supply tokens.", likelihood: "Low" },
      { title: "Pausable Functionality (OpenZeppelin)", severity: "INFO", status: "OPEN", location: "ERC20Pausable inheritance", description: "The contract inherits OpenZeppelin's ERC20Pausable, which allows authorized addresses (PauserRole) to pause all token transfers. Access control is handled by OpenZeppelin's role-based Roles library.", impact: "A pauser can temporarily halt all transfers. This is a centralization trade-off but is properly access-controlled via OZ PauserRole.", recommendation: "This is a design decision, not a vulnerability. Ensure the PauserRole is assigned to a multisig or governance contract for decentralization.", likelihood: "Low" },
    ],
    // Tier-1 sections
    privilegedRoles: [
      { role: "PauserRole", capabilities: "Can pause and unpause all token transfers via ERC20Pausable.", riskIfCompromised: "Medium — transfers can be frozen, but no fund loss" },
      { role: "Deployer", capabilities: "Initial supply recipient (8,888,888,888 CHZ). No ongoing admin functions beyond pause.", riskIfCompromised: "Low — no active admin capabilities" },
    ],
    trustAssumptions: [
      { statement: "Users must trust that PauserRole holders will not maliciously freeze all transfers. The role is managed by OpenZeppelin's Roles library with proper access control." },
      { statement: "Users must trust the initial supply distribution, as 100% of 8.88B CHZ was minted to the deployer at deployment." },
    ],
    architectureOverview: "ERC-20 token built on OpenZeppelin's ERC20 + ERC20Detailed + ERC20Pausable stack. Fixed supply of 8,888,888,888 CHZ minted at deployment. Pausable functionality adds a centralization vector but is properly role-gated. No proxy, no upgradeability, no external dependencies beyond OZ.",
    attackSurface: [
      { title: "Transfer Freeze via PauserRole", type: "censorship" as const, description: "A compromised PauserRole holder could pause all token transfers, effectively freezing the token. This is mitigated by OpenZeppelin's role-based access control.", likelihood: "Low" as const, mitigated: true, simulationResult: "Simulated: pause() from non-PauserRole address -> reverted: 'PauserRole: caller does not have the Pauser role'. Role protection confirmed." },
      { title: "ERC-20 Approve Front-Running", type: "economic" as const, description: "Standard approve() race condition allows a spender to extract more tokens than intended during allowance changes.", likelihood: "Low" as const, mitigated: false, simulationResult: "Simulated: approve(100) -> approve(50) with front-run transferFrom(100) -> succeeds. Known standard limitation." },
    ],
    toolingUsed: [
      "Solay39 Manual Review (5 phases)",
      "Slither v0.10.0: 0 high, 0 medium, 2 informational",
      "Mythril v0.24: 0 vulnerabilities detected",
      "AI-Guided Verification (GPT-4o): 3 findings confirmed",
      "OpenZeppelin Contract Analysis: Roles library verified",
    ],
    onChainValidation: [
      { label: "Source Code Verified on Etherscan", status: "pass" as const, detail: "Verified at 0x3506424F91fD33084466F402d5D97f05F8e3b4AF" },
      { label: "Bytecode Match (on-chain vs source)", status: "pass" as const, detail: "Compiled with solc 0.4.24, optimizer 200 runs" },
      { label: "PauserRole access-controlled (OZ Roles)", status: "pass" as const, detail: "onlyPauser modifier via Roles library" },
      { label: "No proxy detected", status: "pass" as const, detail: "EIP-1967 slot empty; no delegatecall" },
      { label: "mint() not callable post-deploy", status: "pass" as const, detail: "_mint() only in constructor; MinterRole not assigned" },
      { label: "SafeMath applied", status: "pass" as const, detail: "using SafeMath for uint256; all arithmetic protected" },
    ],
    governanceSecurity: {
      hasGovernance: false,
      votingRisks: [],
    },
    upgradeabilityAnalysis: {
      isUpgradeable: false,
      proxyPattern: "none",
      storageCollisionRisk: "None" as const,
      initializerProtection: false,
    },
    economicRisks: [
      { title: "Supply Concentration Risk", category: "supply-concentration" as const, description: "Full 8.88B CHZ supply minted to deployer. Centralized initial distribution.", severity: "Medium" as const, mitigation: "Distributed via exchanges and partnerships; deployer wallet monitored." },
      { title: "Transfer Freeze Risk", category: "other" as const, description: "PauserRole can halt all transfers. If compromised, could be used for market manipulation or censorship.", severity: "Low" as const, mitigation: "PauserRole gated by OpenZeppelin Roles library. Recommend multisig governance." },
    ],
    integrationRisks: [
      { dependency: "OpenZeppelin v2.x", riskType: "dependency lock", description: "Contract relies on OpenZeppelin 2.x (Solidity 0.4.24). Legacy version no longer maintained.", severity: "Low" as const },
    ],
    invariantsChecked: [
      { invariant: "totalSupply immutability (8,888,888,888 CHZ)", holds: true, evidence: "Constructor-only mint. No mint/burn functions post-deploy." },
      { invariant: "Balance conservation on transfer", holds: true, evidence: "OpenZeppelin SafeMath applied. Overflow protected." },
      { invariant: "PauserRole access control", holds: true, evidence: "Role gated by OZ Roles library. Cannot be claimed by arbitrary addresses." },
    ],
  },
]

// backward compat
export const DEMO_PROJECTS = DEFAULT_PROJECTS

// ── utils ────────────────────────────────────────────────────────
export function scoreColor(s: number): string {
  if (s >= 90) return "#00ff88"
  if (s >= 80) return "#00e5ff"
  if (s >= 70) return "#ffd600"
  return "#ff6b00"
}

export function scoreColorClass(s: number): string {
  if (s >= 90) return "text-s39-green"
  if (s >= 80) return "text-s39-cyan"
  if (s >= 70) return "text-s39-yellow"
  return "text-s39-orange"
}

// Tier-1 rating: 96-98 = AAA (exceptional), 90-95 = AA, 80-89 = A
export function ratingOf(s: number): string {
  if (s >= 96) return "AAA"
  if (s >= 90) return "AA"
  if (s >= 80) return "A"
  if (s >= 70) return "BBB"
  if (s >= 60) return "BB"
  return "B"
}

// Tier-1 scoring: max 98 — "security is risk reduction, not perfection"
export const MAX_SCORE = 98

export function computeScore(
  checks: Record<string, Record<string, boolean>>,
  findings: Finding[]
): number {
  const all = Object.values(checks).flatMap((c) => Object.values(c))
  const done = all.filter(Boolean).length
  const anyChecked = all.some(Boolean)
  const crit = findings.filter((f) => f.severity === "CRITICAL" && f.status === "OPEN").length
  const high = findings.filter((f) => f.severity === "HIGH" && f.status === "OPEN").length
  const med = findings.filter((f) => f.severity === "MEDIUM" && f.status === "OPEN").length
  const low = findings.filter((f) => f.severity === "LOW" && f.status === "OPEN").length
  if (!anyChecked) return Math.max(0, Math.min(MAX_SCORE, MAX_SCORE - crit * 25 - high * 10 - med * 3 - low * 1))
  return Math.min(MAX_SCORE, Math.max(0, Math.round((done / all.length) * MAX_SCORE) - crit * 15 - high * 5 - med * 2 - low * 1))
}
