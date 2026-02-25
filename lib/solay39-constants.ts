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
  description?: string
  website?: string
  tags?: string[]
  socials?: { type: string; url: string }[]
  auditTimeline?: { label: string; date: string }[]
  contractUncertainty?: { label: string; value: boolean }[]
  ownerPrivilege?: { label: string; value: string | boolean }[]
  tokenAge?: string
  creatorAddress?: string
  githubUrl?: string
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
    score: 100,
    rating: "AAA",
    tvl: "$315.2M",
    price: "$12.84",
    change24h: "+3.42%",
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
    description: "Injective is a lightning fast interoperable layer one blockchain optimized for building premier Web3 finance applications. INJ is the native utility token powering the Injective ecosystem.",
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
      codeSecurity: 100,
      architectureRisk: 100,
      governanceRisk: 92,
      centralization: 88,
      testingCoverage: 100,
    },
    findings: [
      { title: "Solidity < 0.8.0 with SafeMath", severity: "INFO", status: "OPEN", location: "Compiler version 0.6", description: "The contract targets Solidity < 0.8.0 but uses SafeMath library for arithmetic operations, which provides overflow/underflow protection.", impact: "Arithmetic is protected by SafeMath. However, any operations NOT using SafeMath remain vulnerable.", recommendation: "Ensure ALL arithmetic operations use SafeMath consistently, or consider upgrading to Solidity >= 0.8.0 for built-in checks." },
      { title: "Fixed Supply (Constructor-Only Mint)", severity: "INFO", status: "OPEN", location: "Constructor", description: "Token minting occurs only in the constructor. The supply is fixed at deployment with no public or external mint function available.", impact: "No inflation risk. The token supply cannot be increased after deployment.", recommendation: "No action needed. This is a secure pattern for fixed-supply tokens." },
      { title: "ERC-20 Allowance Race Condition", severity: "LOW", status: "OPEN", location: "approve() function", description: "The standard ERC-20 approve() function is vulnerable to a front-running race condition.", impact: "A spender could extract more tokens than intended during an allowance change.", recommendation: "Consider adding increaseAllowance/decreaseAllowance helper functions." },
      { title: "Initial Supply Concentration", severity: "INFO", status: "OPEN", location: "Constructor — full supply to single address", description: "The entire token supply is minted to a single address (custodian/deployer) in the constructor.", impact: "The initial holder controls 100% of supply.", recommendation: "Recommend transparent vesting schedules and distribution plans." },
    ],
  },
  {
    id: "fetch-token",
    name: "Fetch.ai",
    ticker: "FET",
    network: "Ethereum",
    score: 93,
    rating: "AA",
    tvl: "$3.1B",
    price: "$1.21",
    change24h: "+5.40%",
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
    description: "Fetch.ai is an innovative platform for connecting IoT devices and algorithms to enable collective learning. Built on a high throughput sharded ledger, the Fetch.ai architecture delivers a unique smart contract capability to deploy ML/AI solutions for decentralized problem solving.",
    website: "https://fetch.ai",
    tags: ["ERC-20", "AI", "IoT", "BSC", "Cosmos"],
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
      codeSecurity: 95,
      architectureRisk: 93,
      governanceRisk: 85,
      centralization: 81,
      testingCoverage: 94,
    },
    findings: [
      { title: "Integer Overflow/Underflow Risk", severity: "HIGH", status: "OPEN", location: "Compiler version 0.6", description: "The contract targets Solidity < 0.8.0 which does not have built-in overflow/underflow checks, and no SafeMath usage was detected.", impact: "Arithmetic operations can silently wrap around, leading to unexpected behavior and potential fund theft.", recommendation: "Upgrade to Solidity >= 0.8.0 or add the SafeMath library for all arithmetic operations." },
    ],
  },
  {
    id: "protocolx-vault",
    name: "ProtocolX Vault",
    ticker: "PXV",
    network: "Ethereum",
    score: 94,
    rating: "AA",
    tvl: "$42.3M",
    price: "$8.21",
    change24h: "+1.87%",
    criticals: 0,
    highs: 1,
    mediums: 0,
    lows: 2,
    infos: 1,
    date: "2026-01-15",
    auditor: "Solay39 Founder",
    centralizationLevel: "Low",
    centralizationRisk: "Low",
    scoreBreakdown: { codeSecurity: 96, architectureRisk: 94, governanceRisk: 90, centralization: 88, testingCoverage: 95 },
  },
  {
    id: "liquidstake",
    name: "LiquidStake",
    ticker: "LST",
    network: "Arbitrum",
    score: 88,
    rating: "A",
    tvl: "$18.7M",
    price: "$2.44",
    change24h: "-0.63%",
    criticals: 1,
    highs: 2,
    mediums: 1,
    lows: 3,
    infos: 2,
    date: "2026-02-01",
    auditor: "Solay39 Founder",
    centralizationLevel: "Medium",
    centralizationRisk: "Medium",
    scoreBreakdown: { codeSecurity: 82, architectureRisk: 88, governanceRisk: 84, centralization: 78, testingCoverage: 90 },
  },
  {
    id: "crossbridge-v2",
    name: "CrossBridge V2",
    ticker: "CBR",
    network: "Optimism",
    score: 76,
    rating: "BBB",
    tvl: "$9.1M",
    price: "$0.87",
    change24h: "+5.21%",
    criticals: 2,
    highs: 3,
    mediums: 2,
    lows: 1,
    infos: 0,
    date: "2026-02-10",
    auditor: "Solay39 Founder",
    centralizationLevel: "High",
    centralizationRisk: "Medium",
    scoreBreakdown: { codeSecurity: 70, architectureRisk: 76, governanceRisk: 72, centralization: 68, testingCoverage: 80 },
  },
  {
    id: "yieldfarm-dao",
    name: "YieldFarm DAO",
    ticker: "YFD",
    network: "BSC",
    score: 91,
    rating: "AA",
    tvl: "$31.4M",
    price: "$4.16",
    change24h: "+0.92%",
    criticals: 0,
    highs: 0,
    mediums: 1,
    lows: 2,
    infos: 3,
    date: "2025-12-20",
    auditor: "Solay39 Founder",
    centralizationLevel: "Low",
    centralizationRisk: "Low",
    scoreBreakdown: { codeSecurity: 94, architectureRisk: 90, governanceRisk: 88, centralization: 86, testingCoverage: 92 },
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

export function ratingOf(s: number): string {
  if (s >= 95) return "AAA"
  if (s >= 90) return "AA"
  if (s >= 80) return "A"
  if (s >= 70) return "BBB"
  if (s >= 60) return "BB"
  return "B"
}

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
  if (!anyChecked) return Math.max(0, 100 - crit * 25 - high * 10 - med * 3)
  return Math.min(100, Math.max(0, Math.round((done / all.length) * 100) - crit * 15 - high * 5 - med * 2))
}
