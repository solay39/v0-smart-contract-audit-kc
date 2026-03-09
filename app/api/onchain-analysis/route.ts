import { NextRequest, NextResponse } from "next/server"

// ══════════════════════════════════════════════════════════════════════════════
// SOLAY39 ON-CHAIN ANALYSIS ENGINE
// Real AI analysis of tokenomics, whale distribution, insider wallets, rug risk
// ══════════════════════════════════════════════════════════════════════════════

interface TokenHolder {
  address: string
  balance: string
  percentage: number
  isContract?: boolean
  label?: string
}

interface OnChainData {
  // Token basics
  tokenAddress: string
  network: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  
  // Authorities (Solana) or Owner (EVM)
  mintAuthority?: string | null
  freezeAuthority?: string | null
  owner?: string | null
  
  // Holders analysis
  topHolders: TokenHolder[]
  totalHolders: number
  
  // Liquidity
  liquidityPools: {
    dex: string
    pair: string
    liquidity: string
    lpLocked: boolean
    lockDuration?: string
  }[]
  
  // Trading
  price?: number
  marketCap?: number
  volume24h?: number
  priceChange24h?: number
  
  // Contract info (EVM)
  isVerified?: boolean
  hasProxyPattern?: boolean
  hasMintFunction?: boolean
  hasPauseFunction?: boolean
  hasBlacklistFunction?: boolean
}

// ── Fetch EVM Token Data ──────────────────────────────────────────────────────
async function fetchEVMTokenData(address: string, network: string): Promise<OnChainData | null> {
  const chainId = {
    "Ethereum": 1,
    "BSC": 56,
    "BNB Chain": 56,
    "Polygon": 137,
    "Arbitrum": 42161,
    "Base": 8453,
    "Avalanche": 43114,
  }[network] || 1

  try {
    // 1. Get token info from DEX Screener (reliable and free)
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
    const dexData = await dexRes.json()
    const pair = dexData?.pairs?.[0]
    
    // 2. Get holder data from blockchain explorer API
    const etherscanKey = process.env.ETHERSCAN_API_KEY || ""
    const holdersUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=100${etherscanKey ? `&apikey=${etherscanKey}` : ""}`
    
    let topHolders: TokenHolder[] = []
    let totalHolders = 0
    
    try {
      const holdersRes = await fetch(holdersUrl)
      const holdersData = await holdersRes.json()
      if (holdersData?.result) {
        topHolders = holdersData.result.slice(0, 20).map((h: { TokenHolderAddress: string; TokenHolderQuantity: string; share?: number }) => ({
          address: h.TokenHolderAddress,
          balance: h.TokenHolderQuantity,
          percentage: h.share || 0,
        }))
        totalHolders = holdersData.result.length
      }
    } catch { /* continue */ }
    
    // 3. Get contract source to check for dangerous functions
    let hasMintFunction = false
    let hasPauseFunction = false
    let hasBlacklistFunction = false
    let isVerified = false
    
    try {
      const sourceUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}${etherscanKey ? `&apikey=${etherscanKey}` : ""}`
      const sourceRes = await fetch(sourceUrl)
      const sourceData = await sourceRes.json()
      const source = sourceData?.result?.[0]?.SourceCode?.toLowerCase() || ""
      isVerified = source.length > 0
      hasMintFunction = source.includes("function mint") || source.includes("function _mint")
      hasPauseFunction = source.includes("pause") || source.includes("whennotpaused")
      hasBlacklistFunction = source.includes("blacklist") || source.includes("isblacklisted") || source.includes("_isexcluded")
    } catch { /* continue */ }
    
    // 4. Check LP lock status via Team Finance / Unicrypt APIs
    const liquidityPools: OnChainData["liquidityPools"] = []
    if (pair) {
      liquidityPools.push({
        dex: pair.dexId || "Unknown DEX",
        pair: `${pair.baseToken?.symbol || "?"}-${pair.quoteToken?.symbol || "?"}`,
        liquidity: pair.liquidity?.usd?.toString() || "0",
        lpLocked: false, // Would need Team Finance API to verify
      })
    }
    
    return {
      tokenAddress: address,
      network,
      name: pair?.baseToken?.name || "Unknown",
      symbol: pair?.baseToken?.symbol || "???",
      decimals: 18,
      totalSupply: pair?.fdv?.toString() || "0",
      topHolders,
      totalHolders,
      liquidityPools,
      price: pair?.priceUsd ? parseFloat(pair.priceUsd) : undefined,
      marketCap: pair?.marketCap || pair?.fdv,
      volume24h: pair?.volume?.h24,
      priceChange24h: pair?.priceChange?.h24,
      isVerified,
      hasMintFunction,
      hasPauseFunction,
      hasBlacklistFunction,
    }
  } catch (error) {
    console.error("EVM fetch error:", error)
    return null
  }
}

// ── Fetch Solana Token Data ───────────────────────────────────────────────────
async function fetchSolanaTokenData(address: string): Promise<OnChainData | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
  
  try {
    // 1. Get token mint info
    const mintRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [address, { encoding: "jsonParsed" }],
      }),
    })
    const mintData = await mintRes.json()
    const parsedInfo = mintData?.result?.value?.data?.parsed?.info
    
    if (!parsedInfo) return null
    
    const mintAuthority = parsedInfo.mintAuthority || null
    const freezeAuthority = parsedInfo.freezeAuthority || null
    const supply = parsedInfo.supply || "0"
    const decimals = parsedInfo.decimals || 0
    
    // 2. Get token name from Jupiter
    let tokenName = "Solana Token"
    let symbol = address.slice(0, 4).toUpperCase()
    
    try {
      const jupRes = await fetch(`https://api.jup.ag/tokens/v1/${address}`)
      if (jupRes.ok) {
        const jupData = await jupRes.json()
        tokenName = jupData.name || tokenName
        symbol = jupData.symbol || symbol
      }
    } catch { /* continue */ }
    
    // 3. Get top holders from Helius or Solscan
    let topHolders: TokenHolder[] = []
    let totalHolders = 0
    
    const heliusKey = process.env.HELIUS_API_KEY
    if (heliusKey) {
      try {
        const holdersRes = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${heliusKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mintAccounts: [address], includeOffChain: true }),
        })
        if (holdersRes.ok) {
          const holdersData = await holdersRes.json()
          // Parse holders from response
        }
      } catch { /* continue */ }
    }
    
    // Fallback: Get largest accounts
    try {
      const largestRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getTokenLargestAccounts",
          params: [address],
        }),
      })
      const largestData = await largestRes.json()
      if (largestData?.result?.value) {
        const totalSupplyNum = BigInt(supply)
        topHolders = largestData.result.value.slice(0, 20).map((h: { address: string; amount: string }) => {
          const balance = BigInt(h.amount)
          const percentage = totalSupplyNum > 0 ? Number((balance * BigInt(10000)) / totalSupplyNum) / 100 : 0
          return {
            address: h.address,
            balance: h.amount,
            percentage,
          }
        })
      }
    } catch { /* continue */ }
    
    // 4. Get DEX data from Jupiter/Birdeye
    let price: number | undefined
    let marketCap: number | undefined
    let volume24h: number | undefined
    
    try {
      const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${address}`)
      if (priceRes.ok) {
        const priceData = await priceRes.json()
        price = priceData?.data?.[address]?.price
        if (price) {
          const supplyNum = Number(BigInt(supply) / BigInt(10 ** decimals))
          marketCap = price * supplyNum
        }
      }
    } catch { /* continue */ }
    
    // 5. Get LP info from Raydium
    const liquidityPools: OnChainData["liquidityPools"] = []
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
      const dexData = await dexRes.json()
      if (dexData?.pairs) {
        for (const pair of dexData.pairs.slice(0, 3)) {
          liquidityPools.push({
            dex: pair.dexId || "Raydium",
            pair: `${pair.baseToken?.symbol}-${pair.quoteToken?.symbol}`,
            liquidity: pair.liquidity?.usd?.toString() || "0",
            lpLocked: false,
          })
        }
        if (!price && dexData.pairs[0]?.priceUsd) {
          price = parseFloat(dexData.pairs[0].priceUsd)
        }
        volume24h = dexData.pairs[0]?.volume?.h24
      }
    } catch { /* continue */ }
    
    return {
      tokenAddress: address,
      network: "Solana",
      name: tokenName,
      symbol,
      decimals,
      totalSupply: supply,
      mintAuthority,
      freezeAuthority,
      topHolders,
      totalHolders: topHolders.length,
      liquidityPools,
      price,
      marketCap,
      volume24h,
    }
  } catch (error) {
    console.error("Solana fetch error:", error)
    return null
  }
}

// ── AI Analysis Engine ────────────────────────────────────────────────────────
async function runAIAnalysis(data: OnChainData): Promise<{
  tokenomicsAnalysis: string
  whaleDistribution: string
  insiderWallets: string
  devWalletAnalysis: string
  supplyAnalysis: string
  rugPullRisk: string
  priceManipulation: string
  overallRiskScore: number
  recommendation: string
}> {
  const prompt = `You are a senior blockchain security analyst at a top-tier audit firm. Analyze this token's on-chain data and provide a comprehensive security assessment.

TOKEN DATA:
- Name: ${data.name} (${data.symbol})
- Network: ${data.network}
- Address: ${data.tokenAddress}
- Total Supply: ${data.totalSupply}
- Decimals: ${data.decimals}
- Price: $${data.price?.toFixed(8) || "Unknown"}
- Market Cap: $${data.marketCap?.toLocaleString() || "Unknown"}
- 24h Volume: $${data.volume24h?.toLocaleString() || "Unknown"}
- Total Holders: ${data.totalHolders || "Unknown"}

AUTHORITIES/OWNERSHIP:
- Mint Authority: ${data.mintAuthority === null ? "DISABLED (Safe)" : data.mintAuthority || "Unknown"}
- Freeze Authority: ${data.freezeAuthority === null ? "DISABLED (Safe)" : data.freezeAuthority || "Unknown"}
- Owner/Admin: ${data.owner || "N/A"}
${data.hasMintFunction !== undefined ? `- Has Mint Function: ${data.hasMintFunction ? "YES (Risk)" : "No"}` : ""}
${data.hasPauseFunction !== undefined ? `- Has Pause Function: ${data.hasPauseFunction ? "YES (Risk)" : "No"}` : ""}
${data.hasBlacklistFunction !== undefined ? `- Has Blacklist Function: ${data.hasBlacklistFunction ? "YES (Risk)" : "No"}` : ""}
${data.isVerified !== undefined ? `- Contract Verified: ${data.isVerified ? "Yes" : "NO (Risk)"}` : ""}

TOP HOLDERS (${data.topHolders.length} wallets):
${data.topHolders.slice(0, 15).map((h, i) => `${i + 1}. ${h.address.slice(0, 8)}...${h.address.slice(-6)} - ${h.percentage.toFixed(2)}%${h.label ? ` (${h.label})` : ""}`).join("\n")}

LIQUIDITY POOLS:
${data.liquidityPools.length > 0 ? data.liquidityPools.map(lp => `- ${lp.dex}: ${lp.pair} - $${parseFloat(lp.liquidity).toLocaleString()} ${lp.lpLocked ? "(LP LOCKED)" : "(LP NOT LOCKED - Risk)"}`).join("\n") : "No liquidity pools found (CRITICAL RISK)"}

Provide your analysis in the following JSON format:
{
  "tokenomicsAnalysis": "Detailed analysis of token economics, supply distribution, inflation risk...",
  "whaleDistribution": "Analysis of whale concentration, top holder risks, distribution fairness...",
  "insiderWallets": "Identification of potential insider wallets, connected addresses, suspicious patterns...",
  "devWalletAnalysis": "Analysis of developer/team wallet holdings, vesting, unlock schedules...",
  "supplyAnalysis": "Real circulating supply vs total supply, locked tokens, burn mechanics...",
  "rugPullRisk": "Assessment of rug pull probability based on liquidity, ownership, holder patterns...",
  "priceManipulation": "Risk of price manipulation, wash trading indicators, liquidity depth...",
  "overallRiskScore": 0-100 (0=safest, 100=highest risk),
  "recommendation": "Final investment recommendation with key action items..."
}

Be specific, cite actual data, and be brutally honest about risks. This is a professional audit.`

  // Try Claude first, then OpenAI
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  
  let aiResponse = ""
  
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        aiResponse = data.content?.[0]?.text || ""
      }
    } catch { /* try OpenAI */ }
  }
  
  if (!aiResponse && openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        aiResponse = data.choices?.[0]?.message?.content || ""
      }
    } catch { /* continue */ }
  }
  
  // Parse JSON from AI response
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        tokenomicsAnalysis: parsed.tokenomicsAnalysis || "Analysis unavailable",
        whaleDistribution: parsed.whaleDistribution || "Analysis unavailable",
        insiderWallets: parsed.insiderWallets || "Analysis unavailable",
        devWalletAnalysis: parsed.devWalletAnalysis || "Analysis unavailable",
        supplyAnalysis: parsed.supplyAnalysis || "Analysis unavailable",
        rugPullRisk: parsed.rugPullRisk || "Analysis unavailable",
        priceManipulation: parsed.priceManipulation || "Analysis unavailable",
        overallRiskScore: typeof parsed.overallRiskScore === "number" ? parsed.overallRiskScore : 50,
        recommendation: parsed.recommendation || "Analysis unavailable",
      }
    }
  } catch { /* return defaults */ }
  
  // Calculate risk score manually if AI failed
  let riskScore = 30
  if (data.mintAuthority) riskScore += 25
  if (data.freezeAuthority) riskScore += 15
  if (data.topHolders[0]?.percentage > 50) riskScore += 20
  if (data.liquidityPools.length === 0) riskScore += 30
  if (!data.liquidityPools.some(lp => lp.lpLocked)) riskScore += 15
  if (data.hasMintFunction) riskScore += 10
  if (data.hasBlacklistFunction) riskScore += 10
  riskScore = Math.min(100, riskScore)
  
  return {
    tokenomicsAnalysis: `Token ${data.name} has a total supply of ${data.totalSupply}. ${data.mintAuthority ? "WARNING: Mint authority is active - unlimited inflation possible." : "Mint authority is disabled - fixed supply."}`,
    whaleDistribution: `Top holder owns ${data.topHolders[0]?.percentage.toFixed(2) || 0}% of supply. ${data.topHolders[0]?.percentage > 20 ? "HIGH concentration risk." : "Distribution appears reasonable."}`,
    insiderWallets: "Manual verification required to identify insider wallets through transaction pattern analysis.",
    devWalletAnalysis: "Developer wallet identification requires transaction history analysis.",
    supplyAnalysis: `Total supply: ${data.totalSupply}. ${data.mintAuthority ? "Supply is NOT fixed - can be inflated." : "Supply is fixed."}`,
    rugPullRisk: riskScore > 70 ? "HIGH RISK - Multiple red flags detected." : riskScore > 40 ? "MEDIUM RISK - Some concerns identified." : "LOW RISK - No major red flags.",
    priceManipulation: `Liquidity: $${data.liquidityPools.reduce((sum, lp) => sum + parseFloat(lp.liquidity || "0"), 0).toLocaleString()}. ${data.volume24h && data.marketCap && data.volume24h > data.marketCap * 0.5 ? "WARNING: Unusually high volume may indicate wash trading." : "Volume appears normal."}`,
    overallRiskScore: riskScore,
    recommendation: riskScore > 70 ? "NOT RECOMMENDED - High risk investment" : riskScore > 40 ? "PROCEED WITH CAUTION - Moderate risks present" : "Relatively safe - Standard DeFi risks apply",
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { address, network } = await req.json()
    
    if (!address) {
      return NextResponse.json({ error: "Missing token address" }, { status: 400 })
    }
    
    // Detect network from address format if not provided
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !address.startsWith("0x")
    const finalNetwork = network || (isSolana ? "Solana" : "Ethereum")
    
    // Fetch on-chain data
    let onChainData: OnChainData | null = null
    
    if (isSolana || finalNetwork === "Solana") {
      onChainData = await fetchSolanaTokenData(address)
    } else {
      onChainData = await fetchEVMTokenData(address, finalNetwork)
    }
    
    if (!onChainData) {
      return NextResponse.json({ error: "Failed to fetch token data from blockchain" }, { status: 500 })
    }
    
    // Run AI analysis
    const analysis = await runAIAnalysis(onChainData)
    
    return NextResponse.json({
      success: true,
      tokenData: onChainData,
      analysis,
      timestamp: new Date().toISOString(),
      analyzedBy: "Solay39 AI Security Engine",
      engineVersion: "2.0",
    })
    
  } catch (error) {
    console.error("On-chain analysis error:", error)
    return NextResponse.json({ 
      error: "Analysis failed: " + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 })
  }
}
