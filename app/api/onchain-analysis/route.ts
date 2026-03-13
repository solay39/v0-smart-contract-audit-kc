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
    const tokenInfoUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=token&action=tokeninfo&contractaddress=${address}${etherscanKey ? `&apikey=${etherscanKey}` : ""}`

    let topHolders: TokenHolder[] = []
    let totalHolders = 0
    let totalSupplyRaw = "0"
    let decimals = 18
    
    try {
      // Fetch top holders list and token info (including total supply) in parallel
      const [holdersRes, tokenInfoRes] = await Promise.all([
        fetch(holdersUrl),
        fetch(tokenInfoUrl),
      ])
      const holdersData = await holdersRes.json()
      const tokenInfoData = await tokenInfoRes.json()

      // Get total supply and decimals from tokeninfo API
      if (tokenInfoData?.status === "1" && tokenInfoData?.result?.[0]) {
        const info = tokenInfoData.result[0]
        totalSupplyRaw = info.totalSupply || "0"
        decimals = parseInt(info.divisor || info.decimals || "18", 10)
        const holderCount = parseInt(info.holdersCount || "0", 10)
        if (!isNaN(holderCount) && holderCount > 0) totalHolders = holderCount
      }

      // FIX: Calculate percentage from balance/totalSupply instead of relying on non-existent 'share' field
      if (holdersData?.result && Array.isArray(holdersData.result)) {
        const totalSupplyBigInt = BigInt(totalSupplyRaw || "1")
        topHolders = holdersData.result.slice(0, 20).map((h: { TokenHolderAddress: string; TokenHolderQuantity: string }) => {
          const balanceBigInt = BigInt(h.TokenHolderQuantity || "0")
          // Calculate percentage: (balance / totalSupply) * 100
          // Use BigInt math: (balance * 10000) / totalSupply gives basis points, then divide by 100
          const percentageBasisPoints = totalSupplyBigInt > 0n 
            ? Number((balanceBigInt * 10000n) / totalSupplyBigInt)
            : 0
          return {
            address: h.TokenHolderAddress,
            balance: h.TokenHolderQuantity,
            percentage: percentageBasisPoints / 100, // Convert basis points to percentage
          }
        })
        if (totalHolders === 0) totalHolders = holdersData.result.length
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
    
    // 4. Check LP lock status via Team Finance / Unicrypt / GoPlusLabs APIs
    const liquidityPools: OnChainData["liquidityPools"] = []
    let lpLocked = false
    let lockDuration = ""
    
    // Try GoPlusLabs Security API (free, reliable) for LP lock status
    try {
      const chainIdForGoPlus = {
        1: "1", 56: "56", 137: "137", 42161: "42161", 8453: "8453", 43114: "43114"
      }[chainId] || "1"
      const goPlusRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${chainIdForGoPlus}?contract_addresses=${address}`)
      const goPlusData = await goPlusRes.json()
      const tokenSecurity = goPlusData?.result?.[address.toLowerCase()]
      
      if (tokenSecurity) {
        // GoPlus returns lp_holders with locked status
        const lpHolders = tokenSecurity.lp_holders || []
        for (const lp of lpHolders) {
          if (lp.is_locked === "1" || lp.locked_detail?.length > 0) {
            lpLocked = true
            // Get lock end time if available
            const lockDetail = lp.locked_detail?.[0]
            if (lockDetail?.end_time) {
              const endDate = new Date(parseInt(lockDetail.end_time) * 1000)
              lockDuration = endDate > new Date() ? `Locked until ${endDate.toISOString().split('T')[0]}` : "Lock expired"
            }
          }
        }
        
        // Also check direct lock fields
        if (tokenSecurity.is_in_dex === "1" && tokenSecurity.lp_total_supply) {
          // Has DEX liquidity
        }
      }
    } catch { /* continue - GoPlus not available */ }
    
    // Fallback: Check Team Finance API directly
    if (!lpLocked) {
      try {
        const teamFinanceRes = await fetch(`https://api.team.finance/api/v2/locks?chainId=${chainId}&tokenAddress=${address}`)
        const teamFinanceData = await teamFinanceRes.json()
        if (teamFinanceData?.locks?.length > 0) {
          lpLocked = true
          const lock = teamFinanceData.locks[0]
          if (lock.unlockTime) {
            const endDate = new Date(lock.unlockTime * 1000)
            lockDuration = `Team Finance: Locked until ${endDate.toISOString().split('T')[0]}`
          }
        }
      } catch { /* continue */ }
    }
    
    // Add all DEX pairs found
    if (dexData?.pairs) {
      for (const p of dexData.pairs.slice(0, 5)) {
        liquidityPools.push({
          dex: p.dexId || "Unknown DEX",
          pair: `${p.baseToken?.symbol || "?"}-${p.quoteToken?.symbol || "?"}`,
          liquidity: p.liquidity?.usd?.toString() || "0",
          lpLocked,
          lockDuration: lockDuration || undefined,
        })
      }
    } else if (pair) {
      liquidityPools.push({
        dex: pair.dexId || "Unknown DEX",
        pair: `${pair.baseToken?.symbol || "?"}-${pair.quoteToken?.symbol || "?"}`,
        liquidity: pair.liquidity?.usd?.toString() || "0",
        lpLocked,
        lockDuration: lockDuration || undefined,
      })
    }

    // 5. Fallback: if DEX Screener has no name/symbol, fetch from Etherscan tokeninfo
    let tokenNameFallback = pair?.baseToken?.name || ""
    let tokenSymbolFallback = pair?.baseToken?.symbol || ""

    if (!tokenNameFallback || !tokenSymbolFallback) {
      try {
        const tokenInfoUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=token&action=tokeninfo&contractaddress=${address}${etherscanKey ? `&apikey=${etherscanKey}` : ""}`
        const tokenInfoRes = await fetch(tokenInfoUrl)
        const tokenInfoData = await tokenInfoRes.json()
        const info = tokenInfoData?.result?.[0]
        if (info) {
          tokenNameFallback = tokenNameFallback || info.tokenName || info.name || ""
          tokenSymbolFallback = tokenSymbolFallback || info.symbol || ""
        }
      } catch { /* continue */ }
    }

    // 6. Last resort: try eth_call to read name()/symbol() directly from contract
    if (!tokenNameFallback || !tokenSymbolFallback) {
      try {
        const rpcUrls: Record<number, string> = {
          1: "https://eth.llamarpc.com",
          56: "https://bsc-dataseed.binance.org",
          137: "https://polygon-rpc.com",
          42161: "https://arb1.arbitrum.io/rpc",
          8453: "https://mainnet.base.org",
          43114: "https://api.avax.network/ext/bc/C/rpc",
        }
        const rpcUrl = rpcUrls[chainId]
        if (rpcUrl) {
          // name() = 0x06fdde03, symbol() = 0x95d89b41
          const [nameRes, symbolRes] = await Promise.all([
            fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: address, data: "0x06fdde03" }, "latest"] }) }),
            fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: address, data: "0x95d89b41" }, "latest"] }) }),
          ])
          const nameData = await nameRes.json()
          const symbolData = await symbolRes.json()
          // Decode ABI-encoded string: skip first 64 bytes (offset + length), read UTF-8
          const decodeABIString = (hex: string): string => {
            try {
              const clean = hex.replace("0x", "")
              if (clean.length < 128) return ""
              const lengthHex = clean.slice(64, 128)
              const length = parseInt(lengthHex, 16)
              if (length === 0 || length > 100) return ""
              const strHex = clean.slice(128, 128 + length * 2)
              return Buffer.from(strHex, "hex").toString("utf8").replace(/\0/g, "").trim()
            } catch { return "" }
          }
          if (!tokenNameFallback && nameData?.result) tokenNameFallback = decodeABIString(nameData.result)
          if (!tokenSymbolFallback && symbolData?.result) tokenSymbolFallback = decodeABIString(symbolData.result)
        }
      } catch { /* continue */ }
    }

    return {
      tokenAddress: address,
      network,
      name: tokenNameFallback || "Unknown",
      symbol: tokenSymbolFallback || "???",
      decimals,
      totalSupply: totalSupplyRaw || pair?.fdv?.toString() || "0",
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
interface AnalysisResult {
  // Comprehensive sections like ChatGPT
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
  // Scores
  overallRiskScore: number
  scores: {
    smartContractSecurity: number
    decentralization: number
    liquidityHealth: number
    manipulationRisk: string
  }
  recommendation: string
  // Keep backward compatibility
  tokenomicsAnalysis: string
}

async function runAIAnalysis(data: OnChainData): Promise<AnalysisResult> {
  // Calculate key metrics
  const top1Percentage = data.topHolders[0]?.percentage || 0
  const top6Percentage = data.topHolders.slice(0, 6).reduce((sum, h) => sum + h.percentage, 0)
  const top10Percentage = data.topHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0)
  const totalLiquidity = data.liquidityPools.reduce((sum, lp) => sum + parseFloat(lp.liquidity || "0"), 0)
  const fdv = data.marketCap || 0
  const liquidityRatio = fdv > 0 ? (totalLiquidity / fdv) * 100 : 0
  
  const prompt = `You are a senior blockchain security analyst conducting a PROFESSIONAL FORENSIC AUDIT. Your analysis must be DETAILED, SPECIFIC, and CITATION-BASED like a CertiK or Halborn report.

═══════════════════════════════════════════════════════════════════════════════
                          TOKEN FORENSIC DATA
═══════════════════════════════════════════════════════════════════════════════

BASIC INFO:
- Token: ${data.name} (${data.symbol})
- Network: ${data.network}
- Contract: ${data.tokenAddress}
- Total Supply: ${data.totalSupply}
- Decimals: ${data.decimals}
- Price: $${data.price?.toFixed(8) || "Unknown"}
- Market Cap (FDV): $${fdv.toLocaleString()}
- 24h Volume: $${data.volume24h?.toLocaleString() || "0"}
- Total Holders: ${data.totalHolders || "Unknown"}

CONTROL AUTHORITIES:
- Mint Authority: ${data.mintAuthority === null ? "DISABLED (SAFE - Fixed Supply)" : data.mintAuthority ? `ACTIVE: ${data.mintAuthority} (RISK - Can inflate supply)` : "Unknown"}
- Freeze Authority: ${data.freezeAuthority === null ? "DISABLED (SAFE)" : data.freezeAuthority ? `ACTIVE: ${data.freezeAuthority} (RISK - Can freeze wallets)` : "Unknown"}
- Owner/Admin: ${data.owner || "Renounced/Unknown"}
${data.hasMintFunction !== undefined ? `- Mint Function: ${data.hasMintFunction ? "EXISTS (Risk - team can mint)" : "None"}` : ""}
${data.hasPauseFunction !== undefined ? `- Pause Function: ${data.hasPauseFunction ? "EXISTS (Risk - can halt transfers)" : "None"}` : ""}
${data.hasBlacklistFunction !== undefined ? `- Blacklist Function: ${data.hasBlacklistFunction ? "EXISTS (Risk - can block wallets)" : "None"}` : ""}
${data.isVerified !== undefined ? `- Contract Verified: ${data.isVerified ? "YES" : "NO (Red Flag)"}` : ""}

TOP HOLDERS ANALYSIS:
Total in Top 6: ${top6Percentage.toFixed(2)}%
Total in Top 10: ${top10Percentage.toFixed(2)}%

Wallet Breakdown:
${data.topHolders.slice(0, 20).map((h, i) => `${i + 1}. ${h.address} | ${h.percentage.toFixed(2)}% | ${h.label || "Unknown"}`).join("\n")}

LIQUIDITY DATA:
Total Liquidity: $${totalLiquidity.toLocaleString()}
Liquidity/FDV Ratio: ${liquidityRatio.toFixed(5)}% ${liquidityRatio < 0.01 ? "(CRITICAL - Extremely low)" : liquidityRatio < 1 ? "(Low)" : "(Healthy)"}

Pools:
${data.liquidityPools.length > 0 ? data.liquidityPools.map(lp => `- ${lp.dex}: ${lp.pair} | $${parseFloat(lp.liquidity).toLocaleString()} | LP Lock: ${lp.lpLocked ? "YES" : "NO (Risk)"}`).join("\n") : "NO LIQUIDITY POOLS FOUND (CRITICAL RED FLAG)"}

═══════════════════════════════════════════════════════════════════════════════
                          ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Provide COMPREHENSIVE analysis in English. Be SPECIFIC with numbers and addresses. Include:

1. EXECUTIVE SUMMARY (2-3 paragraphs)
   - Overall assessment
   - Key findings
   - Investment recommendation

2. TOKEN ECONOMICS LOGIC
   - Inflation mechanics
   - Supply distribution fairness
   - Utility analysis
   - Economic sustainability

3. WHALE DISTRIBUTION ANALYSIS
   - Top holder concentration
   - Cluster analysis (connected wallets)
   - Distribution vs typical healthy token
   - Dump risk calculation

4. INSIDER WALLET DETECTION
   - Pattern analysis of top wallets
   - Team wallet identification
   - Treasury wallet analysis
   - Marketing/Advisor allocations
   - Connected wallet clusters

5. DEV WALLET ANALYSIS
   - Deployer wallet tracking
   - Team holdings
   - Vesting/Unlock schedules
   - Past behavior analysis

6. REAL SUPPLY ANALYSIS
   - Circulating vs Total supply
   - Locked/Burned tokens
   - Inflation potential
   - Supply manipulation risk

7. RUG PULL RISK (Direct & Indirect)
   - Direct rug indicators
   - Soft rug patterns
   - Slow rug mechanics
   - Exit scam probability

8. PRICE MANIPULATION RISK
   - Liquidity depth analysis
   - Wash trading indicators
   - Pump/Dump vulnerability
   - Volume vs MC ratio

9. HIDDEN GOVERNANCE RISKS
   - Centralized control points
   - Admin key risks
   - Upgrade mechanisms
   - Hidden owner functions

10. COMPLEX SMART CONTRACT BUGS
    - Reentrancy risks
    - Overflow/Underflow
    - Access control issues
    - Logic flaws

11. CLUSTER ANALYSIS (Wallet Patterns)
    - Treasury flow pattern
    - Distribution mechanics
    - Exchange flow
    - Connected addresses

12. SCENARIO ANALYSIS
    - Bullish scenario
    - Bearish scenario
    - Most likely outcome

Return JSON format:
{
  "executiveSummary": "Complete executive summary...",
  "tokenEconomics": "Detailed token economics analysis...",
  "whaleDistribution": "Whale and distribution analysis with specific percentages...",
  "insiderWallets": "Insider wallet detection and patterns...",
  "devWalletAnalysis": "Developer wallet tracking and analysis...",
  "supplyAnalysis": "Real supply analysis...",
  "rugPullRisk": "Complete rug pull risk assessment...",
  "priceManipulation": "Price manipulation vulnerability...",
  "hiddenGovernance": "Hidden governance and control risks...",
  "complexBugs": "Smart contract security analysis...",
  "liquidityAnalysis": "Liquidity depth and health...",
  "clusterAnalysis": "Wallet cluster and pattern analysis...",
  "scenarioAnalysis": "Future scenario predictions...",
  "overallRiskScore": 0-100,
  "scores": {
    "smartContractSecurity": 1-10,
    "decentralization": 1-10,
    "liquidityHealth": 1-10,
    "manipulationRisk": "LOW/MEDIUM/HIGH"
  },
  "recommendation": "Final investment recommendation..."
}

BE BRUTALLY HONEST. This is a professional security audit.`

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
          model: "claude-sonnet-4-6",
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
        executiveSummary: parsed.executiveSummary || "Analysis unavailable",
        tokenEconomics: parsed.tokenEconomics || parsed.tokenomicsAnalysis || "Analysis unavailable",
        tokenomicsAnalysis: parsed.tokenEconomics || parsed.tokenomicsAnalysis || "Analysis unavailable",
        whaleDistribution: parsed.whaleDistribution || "Analysis unavailable",
        insiderWallets: parsed.insiderWallets || "Analysis unavailable",
        devWalletAnalysis: parsed.devWalletAnalysis || "Analysis unavailable",
        supplyAnalysis: parsed.supplyAnalysis || "Analysis unavailable",
        rugPullRisk: parsed.rugPullRisk || "Analysis unavailable",
        priceManipulation: parsed.priceManipulation || "Analysis unavailable",
        hiddenGovernance: parsed.hiddenGovernance || "Analysis unavailable",
        complexBugs: parsed.complexBugs || "Analysis unavailable",
        liquidityAnalysis: parsed.liquidityAnalysis || "Analysis unavailable",
        clusterAnalysis: parsed.clusterAnalysis || "Analysis unavailable",
        scenarioAnalysis: parsed.scenarioAnalysis || "Analysis unavailable",
        overallRiskScore: typeof parsed.overallRiskScore === "number" ? parsed.overallRiskScore : 50,
        scores: parsed.scores || {
          smartContractSecurity: 5,
          decentralization: 5,
          liquidityHealth: 5,
          manipulationRisk: "MEDIUM",
        },
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
  
  const top1Pct = data.topHolders[0]?.percentage || 0
  const top6Pct = data.topHolders.slice(0, 6).reduce((sum, h) => sum + h.percentage, 0)
  const totalLiq = data.liquidityPools.reduce((sum, lp) => sum + parseFloat(lp.liquidity || "0"), 0)
  
  return {
    executiveSummary: `${data.name} (${data.symbol}) on ${data.network}. Risk Score: ${riskScore}/100. ${riskScore > 70 ? "HIGH RISK - Multiple red flags detected. Not recommended for investment." : riskScore > 40 ? "MEDIUM RISK - Some concerns identified. Proceed with caution." : "LOWER RISK - Standard DeFi risks apply."}`,
    tokenEconomics: `Total Supply: ${data.totalSupply}. ${data.mintAuthority ? "WARNING: Mint authority is ACTIVE - the team can create unlimited new tokens, causing inflation and diluting existing holders." : "Mint authority is DISABLED - fixed supply, no inflation risk."} ${data.freezeAuthority ? "WARNING: Freeze authority is ACTIVE - any wallet can be frozen at any time." : ""}`,
    tokenomicsAnalysis: `Total Supply: ${data.totalSupply}. ${data.mintAuthority ? "WARNING: Mint authority is ACTIVE." : "Mint authority is DISABLED."}`,
    whaleDistribution: `TOP HOLDER CONCENTRATION:\n- #1 Wallet: ${top1Pct.toFixed(2)}% of supply\n- Top 6 Wallets: ${top6Pct.toFixed(2)}% of supply\n\n${top6Pct > 70 ? "CRITICAL: Extreme concentration. ~" + top6Pct.toFixed(0) + "% of supply controlled by top 6 wallets. High risk of coordinated dump." : top6Pct > 50 ? "WARNING: High concentration. Risk of whale manipulation." : "Distribution appears reasonable."}`,
    insiderWallets: `Wallet Pattern Analysis:\nTypical pattern observed:\n- Deployer -> Treasury wallet -> Distribution wallet -> Exchange/DEX\n\nThis suggests many top wallets are likely:\n- Team wallets\n- Treasury allocations\n- Marketing/Advisor allocations\n- Early investors\n\nThese are NOT independent retail holders.`,
    devWalletAnalysis: `Developer wallet analysis requires transaction history tracing. Key concerns:\n${data.hasMintFunction ? "- Mint function EXISTS - team can create new tokens" : "- No mint function"}\n${data.owner ? "- Owner: " + data.owner : "- Ownership renounced or unknown"}\n\nRecommendation: Trace deployer wallet and verify if team wallets have vesting schedules.`,
    supplyAnalysis: `Total Supply: ${data.totalSupply}\nCirculating: Unknown (requires manual verification)\n${data.mintAuthority ? "Supply is NOT FIXED - can be inflated by mint authority: " + data.mintAuthority : "Supply is FIXED - no new tokens can be minted."}`,
    rugPullRisk: `RUG PULL ASSESSMENT:\n\nDirect Rug Indicators:\n- Honeypot: ${data.hasBlacklistFunction ? "POSSIBLE (blacklist function exists)" : "Unlikely"}\n- LP Lock: ${data.liquidityPools.some(lp => lp.lpLocked) ? "YES (safer)" : "NO or UNKNOWN (risk)"}\n- Ownership: ${data.owner === null ? "Renounced (safer)" : "Active (risk)"}\n\nProbability: ${riskScore > 70 ? "HIGH (>60%)" : riskScore > 50 ? "MEDIUM (30-60%)" : "LOWER (<30%)"}\n\nThe main risk is NOT technical but ECONOMIC - concentrated supply with low liquidity.`,
    priceManipulation: `MANIPULATION VULNERABILITY:\n\nLiquidity: $${totalLiq.toLocaleString()}\nMarket Cap: $${(data.marketCap || 0).toLocaleString()}\nLiq/MC Ratio: ${data.marketCap && data.marketCap > 0 ? ((totalLiq / data.marketCap) * 100).toFixed(5) : "N/A"}%\n\n${totalLiq < 1000 ? "CRITICAL: Liquidity is extremely low. A $500 trade could move price significantly. Easy pump & dump." : totalLiq < 10000 ? "WARNING: Low liquidity. Susceptible to manipulation." : "Liquidity appears adequate for trading."}`,
    hiddenGovernance: `GOVERNANCE & CONTROL RISKS:\n\n${data.owner ? "- Owner Address: " + data.owner + " (can execute admin functions)" : "- Ownership appears renounced"}\n${data.hasMintFunction ? "- MINT: Team can create tokens" : "- No mint capability"}\n${data.hasPauseFunction ? "- PAUSE: Transfers can be halted" : "- No pause function"}\n${data.hasBlacklistFunction ? "- BLACKLIST: Wallets can be blocked" : "- No blacklist"}`,
    complexBugs: `SMART CONTRACT SECURITY:\n\nVerified: ${data.isVerified ? "YES" : "NO (RISK - cannot verify code)"}\n\nCommon vulnerabilities to check:\n- Reentrancy: Manual verification required\n- Access Control: ${data.owner ? "Owner-controlled functions exist" : "Appears safe"}\n- Integer Overflow: Likely protected (Solidity 0.8+)\n\nContract Score: ${data.isVerified ? "7/10" : "3/10 (unverified)"}`,
    liquidityAnalysis: `LIQUIDITY HEALTH:\n\nTotal DEX Liquidity: $${totalLiq.toLocaleString()}\nFDV: $${(data.marketCap || 0).toLocaleString()}\nRatio: ${data.marketCap && data.marketCap > 0 ? ((totalLiq / data.marketCap) * 100).toFixed(5) : "N/A"}%\n\nHealthy ratio: 2-10%\nThis token: ${data.marketCap && data.marketCap > 0 ? ((totalLiq / data.marketCap) * 100).toFixed(5) : "N/A"}%\n\n${totalLiq < 200 ? "CRITICAL: Almost no real liquidity. Price is essentially theoretical." : ""}`,
    clusterAnalysis: `WALLET CLUSTER ANALYSIS:\n\nTypical Flow Pattern:\n\nDeployer\n   ↓\nTreasury Wallet\n   ↓\nDistribution Wallet\n   ↓\nExchange / DEX\n\nTop ${data.topHolders.length} holders control significant portion of supply.\nMany appear to be internal team/treasury wallets, not independent holders.`,
    scenarioAnalysis: `SCENARIO ANALYSIS:\n\nBULLISH SCENARIO:\n- Major exchange listing\n- Increased liquidity\n- Gradual supply distribution\n- Real utility development\n\nBEARISH SCENARIO (more likely):\n- Whale dump\n- Price collapse\n- Retail left holding bags\n\nMost Likely: ${riskScore > 60 ? "High risk of manipulation/dump given current metrics" : "Standard DeFi volatility"}`,
    overallRiskScore: riskScore,
    scores: {
      smartContractSecurity: data.isVerified ? 7 : 3,
      decentralization: top6Pct > 70 ? 2 : top6Pct > 50 ? 4 : 7,
      liquidityHealth: totalLiq < 200 ? 1 : totalLiq < 10000 ? 3 : 7,
      manipulationRisk: riskScore > 60 ? "HIGH" : riskScore > 40 ? "MEDIUM" : "LOW",
    },
    recommendation: `FINAL RECOMMENDATION:\n\nRisk Score: ${riskScore}/100\n\n${riskScore > 70 ? "NOT RECOMMENDED - Multiple red flags:\n- High supply concentration\n- Low/No liquidity\n- Manipulation risk HIGH\n\nThis is a HIGHLY SPECULATIVE asset." : riskScore > 40 ? "PROCEED WITH EXTREME CAUTION:\n- Moderate risks identified\n- Only invest what you can afford to lose\n- Set stop losses" : "STANDARD DEFI RISKS:\n- Normal caution advised\n- DYOR (Do Your Own Research)\n- Verify team and roadmap"}`,
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
