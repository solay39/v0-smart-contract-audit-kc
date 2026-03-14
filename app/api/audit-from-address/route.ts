export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════════════════
// SOLAY39 — AUDIT FROM BLOCKCHAIN ADDRESS
// Complete audit pipeline: Address → Source → Token Info → On-Chain → Full Audit
// ══════════════════════════════════════════════════════════════════════════════

interface AuditFromAddressRequest {
  address: string
  network?: string
  // Optional: user-provided metadata for new tokens without explorer data
  customMetadata?: {
    name?: string
    symbol?: string
    logoUrl?: string
    description?: string
    website?: string
    twitter?: string
    telegram?: string
    github?: string
  }
}

interface AuditFromAddressResponse {
  success: boolean
  tokenAddress: string
  network: string
  
  // Token metadata (fetched or user-provided)
  metadata: {
    name: string
    symbol: string
    logoUrl: string
    description: string
    website: string
    twitter: string
    telegram: string
    github: string
    totalSupply: string
    decimals: number
    price: string
    marketCap: string
    volume24h: string
    holders: number
  }
  
  // Source code info
  source: {
    code: string
    language: string
    compiler: string
    contractName: string
    linesOfCode: number
    verified: boolean
    explorerUrl: string
  }
  
  // On-chain analysis
  onChain: {
    mintAuthority: string | null
    freezeAuthority: string | null
    owner: string | null
    topHolders: Array<{
      address: string
      balance: string
      percentage: number
      label?: string
    }>
    liquidityPools: Array<{
      dex: string
      pair: string
      liquidity: string
      lpLocked: boolean
      lockDuration?: string
    }>
    hasMintFunction: boolean
    hasPauseFunction: boolean
    hasBlacklistFunction: boolean
  }
  
  // Full audit result (if source available)
  audit?: {
    score: number
    findings: Array<{
      title: string
      severity: string
      description: string
      location: string
      recommendation: string
    }>
    riskLevel: string
    recommendation: string
  }
  
  // Errors if any step failed
  errors: string[]
}

// ── Auto-detect network from address format ──────────────────────────────────
function detectNetwork(address: string): string {
  const trimmed = address.trim()
  
  // Solana: base58, 32-44 chars, no 0x prefix
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return "Solana"
  }
  
  // Tron: starts with T, 34 chars
  if (/^T[a-zA-Z0-9]{33}$/.test(trimmed)) {
    return "Tron"
  }
  
  // Cosmos/Injective: bech32 prefix
  if (/^inj1[a-z0-9]{38,58}$/.test(trimmed)) return "Injective"
  if (/^sei1[a-z0-9]{38,58}$/.test(trimmed)) return "Sei"
  if (/^cosmos1[a-z0-9]{38,58}$/.test(trimmed)) return "Cosmos"
  
  // Near: account names
  if (/^[a-z0-9._-]{2,64}$/.test(trimmed) && !trimmed.startsWith("0x")) {
    return "Near"
  }
  
  // Default: Ethereum (0x address)
  return "Ethereum"
}

// ── Fetch source code from explorer ──────────────────────────────────────────
async function fetchSourceCode(address: string, network: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/contract-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network }),
    })
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { error: err.error || "Source code not available", data: null }
    }
    
    return { error: null, data: await res.json() }
  } catch (e) {
    return { error: `Failed to fetch source: ${e}`, data: null }
  }
}

// ── Fetch token info from APIs ───────────────────────────────────────────────
async function fetchTokenInfo(address: string, network: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/token-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network }),
    })
    
    if (!res.ok) return { error: "Token info not available", data: null }
    
    const json = await res.json()
    return { error: null, data: json.token || json }
  } catch (e) {
    return { error: `Failed to fetch token info: ${e}`, data: null }
  }
}

// ── Fetch on-chain analysis ──────────────────────────────────────────────────
async function fetchOnChainAnalysis(address: string, network: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/onchain-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network }),
    })
    
    if (!res.ok) return { error: "On-chain analysis failed", data: null }
    
    return { error: null, data: await res.json() }
  } catch (e) {
    return { error: `Failed to fetch on-chain data: ${e}`, data: null }
  }
}

// ── Run full audit on source code ────────────────────────────────────────────
async function runFullAudit(code: string, contractName: string, network: string, baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/skynet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        projectName: contractName,
        network,
      }),
    })
    
    if (!res.ok) return { error: "Audit failed", data: null }
    
    return { error: null, data: await res.json() }
  } catch (e) {
    return { error: `Audit error: ${e}`, data: null }
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const errors: string[] = []
  
  try {
    const body: AuditFromAddressRequest = await req.json()
    const { address, customMetadata } = body
    
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Missing contract address" }, { status: 400 })
    }
    
    const trimmedAddress = address.trim()
    const network = body.network || detectNetwork(trimmedAddress)
    
    // Base URL for internal API calls
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    
    // ── Step 1: Fetch all data in parallel ───────────────────────────────────
    const [sourceResult, tokenResult, onChainResult] = await Promise.all([
      fetchSourceCode(trimmedAddress, network, baseUrl),
      fetchTokenInfo(trimmedAddress, network, baseUrl),
      fetchOnChainAnalysis(trimmedAddress, network, baseUrl),
    ])
    
    if (sourceResult.error) errors.push(sourceResult.error)
    if (tokenResult.error) errors.push(tokenResult.error)
    if (onChainResult.error) errors.push(onChainResult.error)
    
    // ── Step 2: Build metadata (API data + custom overrides) ─────────────────
    const tokenData = tokenResult.data || {}
    const onChainData = onChainResult.data?.data || onChainResult.data || {}
    const sourceData = sourceResult.data || {}
    
    const metadata = {
      name: customMetadata?.name || tokenData.name || onChainData.name || sourceData.contractName || "Unknown Token",
      symbol: customMetadata?.symbol || tokenData.ticker || onChainData.symbol || "???",
      logoUrl: customMetadata?.logoUrl || tokenData.logoUrl || "",
      description: customMetadata?.description || tokenData.description || "",
      website: customMetadata?.website || tokenData.website || "",
      twitter: customMetadata?.twitter || tokenData.twitter || "",
      telegram: customMetadata?.telegram || tokenData.telegram || "",
      github: customMetadata?.github || tokenData.github || "",
      totalSupply: onChainData.totalSupply || tokenData.totalSupply || "0",
      decimals: onChainData.decimals || 18,
      price: tokenData.price || onChainData.price?.toString() || "N/A",
      marketCap: tokenData.marketCap || onChainData.marketCap?.toString() || "N/A",
      volume24h: tokenData.volume24h || onChainData.volume24h?.toString() || "N/A",
      holders: onChainData.totalHolders || onChainData.holders || 0,
    }
    
    // ── Step 3: Build source info ────────────────────────────────────────────
    const source = {
      code: sourceData.source || "",
      language: sourceData.language || (network === "Solana" ? "Rust/Anchor" : "Solidity"),
      compiler: sourceData.compiler || "unknown",
      contractName: sourceData.contractName || metadata.name,
      linesOfCode: sourceData.linesOfCode || (sourceData.source?.split("\n").length || 0),
      verified: !!sourceData.source && sourceData.source.length > 100,
      explorerUrl: sourceData.explorerUrl || "",
    }
    
    // ── Step 4: Build on-chain info ──────────────────────────────────────────
    const onChain = {
      mintAuthority: onChainData.mintAuthority ?? null,
      freezeAuthority: onChainData.freezeAuthority ?? null,
      owner: onChainData.owner ?? null,
      topHolders: (onChainData.topHolders || []).slice(0, 20),
      liquidityPools: onChainData.liquidityPools || [],
      hasMintFunction: onChainData.hasMintFunction ?? false,
      hasPauseFunction: onChainData.hasPauseFunction ?? false,
      hasBlacklistFunction: onChainData.hasBlacklistFunction ?? false,
    }
    
    // ── Step 5: Run full audit if source code available ──────────────────────
    let audit: AuditFromAddressResponse["audit"] = undefined
    
    if (source.code && source.code.length > 100) {
      const auditResult = await runFullAudit(source.code, source.contractName, network, baseUrl)
      
      if (auditResult.error) {
        errors.push(auditResult.error)
      } else if (auditResult.data) {
        const auditData = auditResult.data
        audit = {
          score: auditData.score || auditData.overall || 0,
          findings: (auditData.findings || []).map((f: Record<string, unknown>) => ({
            title: f.title || "",
            severity: f.severity || "INFO",
            description: f.description || "",
            location: f.location || "",
            recommendation: f.recommendation || "",
          })),
          riskLevel: auditData.riskLevel || auditData.verdict || "Unknown",
          recommendation: auditData.recommendation || auditData.finalAssessment?.recommendation || "",
        }
      }
    } else {
      errors.push("Source code not verified on explorer - manual code paste required for full audit")
    }
    
    const duration = Date.now() - startTime
    
    const response: AuditFromAddressResponse = {
      success: errors.length === 0 || (errors.length > 0 && (metadata.name !== "Unknown Token" || onChain.topHolders.length > 0)),
      tokenAddress: trimmedAddress,
      network,
      metadata,
      source,
      onChain,
      audit,
      errors,
    }
    
    return NextResponse.json({
      ...response,
      _meta: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      }
    })
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: msg,
      errors: [msg],
    }, { status: 500 })
  }
}

// ── GET: API info ────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    service: "Solay39 Audit From Address",
    version: "1.0.0",
    description: "Complete audit pipeline from blockchain address",
    usage: {
      endpoint: "POST /api/audit-from-address",
      body: {
        address: "0x... or Solana address (required)",
        network: "Ethereum | BSC | Polygon | Arbitrum | Base | Solana | ... (auto-detected if omitted)",
        customMetadata: {
          name: "Token name (optional - for new tokens)",
          symbol: "Symbol (optional)",
          logoUrl: "https://... (optional - for new tokens without CoinGecko listing)",
          description: "Token description (optional)",
          website: "https://... (optional)",
          twitter: "https://twitter.com/... (optional)",
          telegram: "https://t.me/... (optional)",
          github: "https://github.com/... (optional)",
        }
      }
    },
    supportedNetworks: [
      "Ethereum", "BSC", "Polygon", "Arbitrum", "Base", "Optimism", "Avalanche",
      "Fantom", "Cronos", "Gnosis", "Linea", "Scroll", "Blast", "zkSync",
      "Solana", "Sui", "Aptos", "Tron", "Near", "Injective", "Sei"
    ],
    pipeline: [
      "1. Fetch source code from blockchain explorer (Etherscan V2 API)",
      "2. Fetch token metadata from GeckoTerminal + CoinGecko",
      "3. Fetch on-chain data: holders, liquidity, authorities",
      "4. Run full Skynet audit on verified source code",
      "5. Generate comprehensive report with findings, score, and recommendations",
    ],
    example: {
      request: {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        network: "Ethereum"
      },
      description: "Audit USDT on Ethereum"
    }
  })
}
