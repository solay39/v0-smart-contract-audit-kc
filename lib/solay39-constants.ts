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

export interface DemoProject {
  id: string
  name: string
  network: string
  score: number
  rating: string
  tvl: string
  criticals: number
  highs: number
  date: string
}

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

export const DEMO_PROJECTS: DemoProject[] = [
  { id: "p1", name: "ProtocolX Vault", network: "Ethereum", score: 94, rating: "AA", tvl: "$42.3M", criticals: 0, highs: 1, date: "Jan 2026" },
  { id: "p2", name: "LiquidStake", network: "Arbitrum", score: 88, rating: "A", tvl: "$18.7M", criticals: 1, highs: 2, date: "Feb 2026" },
  { id: "p3", name: "CrossBridge V2", network: "Optimism", score: 76, rating: "BBB", tvl: "$9.1M", criticals: 2, highs: 3, date: "Feb 2026" },
  { id: "p4", name: "YieldFarm DAO", network: "BSC", score: 91, rating: "AA", tvl: "$31.4M", criticals: 0, highs: 0, date: "Dec 2025" },
  { id: "p5", name: "ChiliZ Token", network: "Ethereum", score: 98, rating: "AAA", tvl: "$28.9M", criticals: 0, highs: 0, date: "Nov 2025" },
  { id: "p6", name: "Injective Token", network: "Ethereum", score: 97, rating: "AAA", tvl: "$15.2M", criticals: 0, highs: 0, date: "Oct 2025" },
]

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
