import { NextRequest, NextResponse } from "next/server"
import { put, list } from "@vercel/blob"

/**
 * POST /api/onchain-audit-merge
 *
 * This endpoint is the MISSING BRIDGE between the Manual On-Chain Analysis
 * and the Audit Report. It:
 *   1. Accepts an onchain analysis result (from /api/onchain-analysis)
 *   2. Accepts an audit ID (optional — if the audit already exists in Blob)
 *   3. Maps every onchain section → the corresponding audit section
 *   4. Saves/updates the merged audit in Vercel Blob
 *   5. Returns the full merged audit so the frontend can render it immediately
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnChainAnalysis {
  tokenData: {
    tokenAddress: string
    network: string
    name: string
    symbol: string
    decimals: number
    totalSupply: string
    mintAuthority?: string | null
    freezeAuthority?: string | null
    owner?: string | null
    topHolders: { address: string; balance: string; percentage: number; label?: string }[]
    totalHolders: number
    liquidityPools: { dex: string; pair: string; liquidity: string; lpLocked: boolean }[]
    price?: number
    marketCap?: number
    volume24h?: number
    isVerified?: boolean
    hasMintFunction?: boolean
    hasPauseFunction?: boolean
    hasBlacklistFunction?: boolean
  }
  analysis: {
    executiveSummary: string
    tokenEconomics: string
    whaleDistribution: string
    insiderWallets: string
    devWalletAnalysis: string
    supplyAnalysis: string
    rugPullRisk: string
    priceManipulation: string
    hiddenGovernance: string
    complexBugs: string
    liquidityAnalysis: string
    clusterAnalysis: string
    scenarioAnalysis: string
    overallRiskScore: number
    scores: {
      smartContractSecurity: number
      decentralization: number
      liquidityHealth: number
      manipulationRisk: string
    }
    recommendation: string
  }
  timestamp: string
}

// ── Map onchain analysis → audit finding severity ─────────────────────────────

function riskScoreToSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "info"
}

function scoreToLabel(score: number, max = 10): string {
  const pct = (score / max) * 100
  if (pct <= 30) return "CRITICAL"
  if (pct <= 50) return "HIGH RISK"
  if (pct <= 70) return "MEDIUM"
  return "SAFE"
}

// ── Build audit sections from onchain data ────────────────────────────────────

function buildAuditSections(onchain: OnChainAnalysis) {
  const { tokenData: td, analysis: a } = onchain
  const totalLiquidity = td.liquidityPools.reduce(
    (sum, lp) => sum + parseFloat(lp.liquidity || "0"),
    0
  )

  // ── Findings array (maps to audit finding cards) ──────────────────────────
  const findings = []

  // 1. Mint / Freeze authority
  if (td.mintAuthority) {
    findings.push({
      id: "OC-001",
      title: "Active Mint Authority Detected",
      severity: "high",
      category: "Token Control",
      description: `Mint authority is ACTIVE at ${td.mintAuthority}. The controller can create unlimited new tokens at any time, inflating the supply and diluting all existing holders.`,
      recommendation: "Disable (revoke) the mint authority if a fixed supply is intended. Verify team's stated tokenomics match on-chain reality.",
      section: "tokenEconomics",
      content: a.tokenEconomics,
      status: "open",
      source: "onchain",
    })
  }

  if (td.freezeAuthority) {
    findings.push({
      id: "OC-002",
      title: "Active Freeze Authority Detected",
      severity: "high",
      category: "Token Control",
      description: `Freeze authority is ACTIVE at ${td.freezeAuthority}. Any wallet can be frozen and prevented from transacting at any time.`,
      recommendation: "Disable freeze authority or justify its existence in documentation. Users should be aware of this centralised power.",
      section: "hiddenGovernance",
      content: a.hiddenGovernance,
      status: "open",
      source: "onchain",
    })
  }

  // 2. Whale concentration
  const top6Pct = td.topHolders.slice(0, 6).reduce((sum, h) => sum + h.percentage, 0)
  if (top6Pct > 50) {
    findings.push({
      id: "OC-003",
      title: `High Whale Concentration — Top 6 Hold ${top6Pct.toFixed(1)}%`,
      severity: top6Pct > 70 ? "critical" : "high",
      category: "Decentralisation",
      description: a.whaleDistribution,
      recommendation: "Monitor top wallets for coordinated dumps. Prefer tokens where top 10 hold <30%.",
      section: "whaleDistribution",
      content: a.whaleDistribution,
      status: "open",
      source: "onchain",
    })
  }

  // 3. LP not locked
  const lpLocked = td.liquidityPools.some((lp) => lp.lpLocked)
  if (!lpLocked && totalLiquidity > 0) {
    findings.push({
      id: "OC-004",
      title: "Liquidity Pool NOT Locked",
      severity: "high",
      category: "Liquidity",
      description: `$${totalLiquidity.toLocaleString()} in liquidity is present but LP tokens are NOT locked. Developers can remove all liquidity instantly (direct rug pull vector).`,
      recommendation: "Request team to lock LP via Team Finance, Unicrypt, or similar for ≥6 months. Verify lock on-chain.",
      section: "rugPullRisk",
      content: a.rugPullRisk,
      status: "open",
      source: "onchain",
    })
  }

  if (td.liquidityPools.length === 0) {
    findings.push({
      id: "OC-005",
      title: "No Liquidity Pool Found",
      severity: "critical",
      category: "Liquidity",
      description: "No DEX liquidity pools detected for this token. Trading is impossible or occurs in unknown dark pools.",
      recommendation: "Do not invest. Token has no verifiable liquidity.",
      section: "liquidityAnalysis",
      content: a.liquidityAnalysis,
      status: "open",
      source: "onchain",
    })
  }

  // 4. Blacklist / pause
  if (td.hasBlacklistFunction) {
    findings.push({
      id: "OC-006",
      title: "Blacklist Function in Contract",
      severity: "medium",
      category: "Centralisation",
      description: "The smart contract includes a blacklist function. The owner can block specific wallets from transacting. This is a honeypot vector.",
      recommendation: "Verify if blacklist is used for legitimate compliance purposes or as a trap for unsuspecting traders.",
      section: "hiddenGovernance",
      content: a.hiddenGovernance,
      status: "open",
      source: "onchain",
    })
  }

  if (td.hasPauseFunction) {
    findings.push({
      id: "OC-007",
      title: "Pausable Transfer Function",
      severity: "medium",
      category: "Centralisation",
      description: "Contract can pause all token transfers. In a rug scenario, the team could allow buying while blocking sells.",
      recommendation: "Audit when/how the pause function can be triggered. Prefer renounced ownership.",
      section: "hiddenGovernance",
      content: a.hiddenGovernance,
      status: "open",
      source: "onchain",
    })
  }

  // 5. Unverified contract
  if (td.isVerified === false) {
    findings.push({
      id: "OC-008",
      title: "Smart Contract Not Verified",
      severity: "critical",
      category: "Transparency",
      description: "The smart contract source code is NOT published on the block explorer. It is impossible to audit what the contract actually does.",
      recommendation: "Do not interact with unverified contracts. Request the team to verify the source immediately.",
      section: "complexBugs",
      content: a.complexBugs,
      status: "open",
      source: "onchain",
    })
  }

  // ── Scored sections (maps to the section cards in the audit UI) ──────────
  const sections = [
    {
      id: "onchain-executive",
      title: "Executive Summary (On-Chain)",
      icon: "📋",
      badge: a.overallRiskScore >= 60 ? "WARNING" : a.overallRiskScore >= 30 ? "MEDIUM" : "SAFE",
      severity: riskScoreToSeverity(a.overallRiskScore),
      content: a.executiveSummary,
      score: null,
      source: "onchain",
    },
    {
      id: "onchain-tokeneconomics",
      title: "Token Economics Logic",
      icon: "📊",
      badge: null,
      severity: td.mintAuthority ? "high" : "info",
      content: a.tokenEconomics,
      source: "onchain",
    },
    {
      id: "onchain-whale",
      title: "Whale Distribution Analysis",
      icon: "🐳",
      badge: top6Pct > 50 ? "WARNING" : "SAFE",
      severity: top6Pct > 70 ? "critical" : top6Pct > 50 ? "high" : "info",
      content: a.whaleDistribution,
      source: "onchain",
    },
    {
      id: "onchain-insider",
      title: "Insider Wallets Detection",
      icon: "🔍",
      badge: null,
      severity: "medium",
      content: a.insiderWallets,
      source: "onchain",
    },
    {
      id: "onchain-dev",
      title: "Dev Wallet Analysis",
      icon: "👨‍💻",
      badge: null,
      severity: "medium",
      content: a.devWalletAnalysis,
      source: "onchain",
    },
    {
      id: "onchain-supply",
      title: "Real Supply Analysis",
      icon: "💰",
      badge: "SAFE",
      severity: td.mintAuthority ? "high" : "info",
      content: a.supplyAnalysis,
      source: "onchain",
    },
    {
      id: "onchain-rugpull",
      title: "Rug Pull Risk (Direct & Indirect)",
      icon: "⚠️",
      badge: a.overallRiskScore >= 50 ? "WARNING" : "SAFE",
      severity: riskScoreToSeverity(a.overallRiskScore),
      content: a.rugPullRisk,
      source: "onchain",
    },
    {
      id: "onchain-manipulation",
      title: "Price Manipulation Vulnerability",
      icon: "📉",
      badge: a.scores.manipulationRisk,
      severity: a.scores.manipulationRisk === "HIGH" ? "high" : a.scores.manipulationRisk === "MEDIUM" ? "medium" : "info",
      content: a.priceManipulation,
      source: "onchain",
    },
    {
      id: "onchain-governance",
      title: "Hidden Governance Risks",
      icon: "🏛️",
      badge: td.hasPauseFunction || td.hasBlacklistFunction ? "WARNING" : "SAFE",
      severity: td.hasPauseFunction || td.hasBlacklistFunction ? "medium" : "info",
      content: a.hiddenGovernance,
      source: "onchain",
    },
    {
      id: "onchain-bugs",
      title: "Complex Smart Contract Bugs",
      icon: "🔬",
      badge: scoreToLabel(a.scores.smartContractSecurity),
      severity: a.scores.smartContractSecurity <= 3 ? "critical" : a.scores.smartContractSecurity <= 5 ? "high" : "medium",
      content: a.complexBugs,
      source: "onchain",
    },
    {
      id: "onchain-liquidity",
      title: "Liquidity Health Analysis",
      icon: "💧",
      badge: scoreToLabel(a.scores.liquidityHealth),
      severity: a.scores.liquidityHealth <= 3 ? "critical" : a.scores.liquidityHealth <= 5 ? "high" : "info",
      content: a.liquidityAnalysis,
      source: "onchain",
    },
    {
      id: "onchain-cluster",
      title: "Wallet Cluster Analysis",
      icon: "🕸️",
      badge: null,
      severity: "medium",
      content: a.clusterAnalysis,
      source: "onchain",
    },
    {
      id: "onchain-scenario",
      title: "Scenario Analysis",
      icon: "🔮",
      badge: null,
      severity: "info",
      content: a.scenarioAnalysis,
      source: "onchain",
    },
  ]

  // ── Summary scores to inject into the audit score panel ──────────────────
  const scorePanel = {
    riskScore: a.overallRiskScore,
    riskLabel: a.overallRiskScore >= 70 ? "HIGH RISK" : a.overallRiskScore >= 40 ? "MEDIUM RISK" : "LOW RISK",
    contractScore: `${a.scores.smartContractSecurity}/10`,
    decentralizationScore: `${a.scores.decentralization}/10`,
    liquidityScore: `${a.scores.liquidityHealth}/10`,
    manipulationRisk: a.scores.manipulationRisk,
    marketCap: td.marketCap ? `$${td.marketCap.toLocaleString()}` : "N/A",
    totalHolders: td.totalHolders,
    liquidity: `$${totalLiquidity.toLocaleString()}`,
    lpLocked,
    mintAuthority: td.mintAuthority ?? null,
    freezeAuthority: td.freezeAuthority ?? null,
    recommendation: a.recommendation,
  }

  return { findings, sections, scorePanel }
}

// ── PATCH: update an existing audit blob with onchain data ─────────────────

async function patchAuditBlob(auditId: string, onchainPayload: object): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `audits/${auditId}.json`, limit: 1 })
    if (blobs.length === 0) return false

    const res = await fetch(blobs[0].url)
    if (!res.ok) return false
    const existingAudit = await res.json()

    // Merge onchain data into the audit object
    const merged = {
      ...existingAudit,
      onchainAnalysis: onchainPayload,
      updatedAt: new Date().toISOString(),
    }

    await put(`audits/${auditId}.json`, JSON.stringify(merged), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    })

    return true
  } catch {
    return false
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // body can be:
    // { onchainResult: <full /api/onchain-analysis response>, auditId?: string }
    // OR the raw onchain-analysis response itself (backward compat)
    const onchainResult: OnChainAnalysis = body.onchainResult ?? body

    if (!onchainResult?.tokenData || !onchainResult?.analysis) {
      return NextResponse.json(
        { error: "Missing onchainResult.tokenData or onchainResult.analysis" },
        { status: 400 }
      )
    }

    const auditId: string | undefined = body.auditId

    // Build the structured audit sections
    const { findings, sections, scorePanel } = buildAuditSections(onchainResult)

    const mergedPayload = {
      tokenData: onchainResult.tokenData,
      analysis: onchainResult.analysis,
      findings,
      sections,
      scorePanel,
      mergedAt: new Date().toISOString(),
      source: "onchain-audit-merge",
    }

    // If an auditId is provided, patch the existing blob
    let patched = false
    if (auditId) {
      patched = await patchAuditBlob(auditId, mergedPayload)
    }

    return NextResponse.json({
      success: true,
      auditId: auditId ?? null,
      patched,
      onchainAudit: mergedPayload,
      // Convenience: flat fields the frontend can destructure directly
      findings,
      sections,
      scorePanel,
    })
  } catch (error) {
    console.error("[onchain-audit-merge] Error:", error)
    return NextResponse.json(
      { error: "Merge failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    name: "Solay39 On-Chain Audit Merge API",
    version: "1.0.0",
    description:
      "Bridges the Manual On-Chain Analysis with the Audit Report. " +
      "Call this after /api/onchain-analysis completes to inject all on-chain " +
      "findings (tokenomics, whale distribution, rug risk, etc.) into the audit.",
    usage: {
      method: "POST",
      body: {
        onchainResult: "Full response from /api/onchain-analysis",
        auditId: "(optional) Existing audit ID to patch in Vercel Blob",
      },
    },
  })
}
