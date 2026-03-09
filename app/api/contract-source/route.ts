// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Multi-Chain Contract Source Code Fetcher
// Supports: Etherscan (EVM), Solscan (Solana), BscScan, Arbiscan, etc.
// ═══════════════════════════════════════════════════════════════════

interface ExplorerConfig {
  chainId: number
  type: "etherscan" | "solana" | "unsupported"
}

// Etherscan V2 API - unified endpoint with chainid
const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"

const EXPLORER_MAP: Record<string, ExplorerConfig> = {
  Ethereum:    { chainId: 1, type: "etherscan" },
  BSC:         { chainId: 56, type: "etherscan" },
  "BNB Chain": { chainId: 56, type: "etherscan" },
  Arbitrum:    { chainId: 42161, type: "etherscan" },
  Optimism:    { chainId: 10, type: "etherscan" },
  Polygon:     { chainId: 137, type: "etherscan" },
  Avalanche:   { chainId: 43114, type: "etherscan" },
  Base:        { chainId: 8453, type: "etherscan" },
  Fantom:      { chainId: 250, type: "etherscan" },
  Cronos:      { chainId: 25, type: "etherscan" },
  Gnosis:      { chainId: 100, type: "etherscan" },
  Linea:       { chainId: 59144, type: "etherscan" },
  Scroll:      { chainId: 534352, type: "etherscan" },
  Blast:       { chainId: 81457, type: "etherscan" },
  zkSync:      { chainId: 324, type: "etherscan" },
  Moonbeam:    { chainId: 1284, type: "etherscan" },
  Celo:        { chainId: 42220, type: "etherscan" },
  Mantle:      { chainId: 5000, type: "etherscan" },
  // Non-EVM
  Solana:      { chainId: 0, type: "solana" },
  Sui:         { chainId: 0, type: "unsupported" },
  Aptos:       { chainId: 0, type: "unsupported" },
  Tron:        { chainId: 0, type: "unsupported" },
  Near:        { chainId: 0, type: "unsupported" },
  Cosmos:      { chainId: 0, type: "unsupported" },
  Injective:   { chainId: 0, type: "unsupported" },
  Ton:         { chainId: 0, type: "unsupported" },
  Starknet:    { chainId: 0, type: "unsupported" },
}

function getExplorerUrl(network: string, address: string): string {
  const map: Record<string, string> = {
    Ethereum:  `https://etherscan.io/address/${address}#code`,
    BSC:       `https://bscscan.com/address/${address}#code`,
    "BNB Chain": `https://bscscan.com/address/${address}#code`,
    Arbitrum:  `https://arbiscan.io/address/${address}#code`,
    Optimism:  `https://optimistic.etherscan.io/address/${address}#code`,
    Polygon:   `https://polygonscan.com/address/${address}#code`,
    Avalanche: `https://snowscan.xyz/address/${address}#code`,
    Base:      `https://basescan.org/address/${address}#code`,
    Fantom:    `https://ftmscan.com/address/${address}#code`,
    Cronos:    `https://cronoscan.com/address/${address}#code`,
    Gnosis:    `https://gnosisscan.io/address/${address}#code`,
    Linea:     `https://lineascan.build/address/${address}#code`,
    Scroll:    `https://scrollscan.com/address/${address}#code`,
    Blast:     `https://blastscan.io/address/${address}#code`,
    zkSync:    `https://era.zksync.network/address/${address}#code`,
    Moonbeam:  `https://moonscan.io/address/${address}`,
    Celo:      `https://celoscan.io/address/${address}#code`,
    Mantle:    `https://mantlescan.xyz/address/${address}#code`,
    Solana:    `https://solscan.io/account/${address}`,
    Sui:       `https://suiscan.xyz/mainnet/account/${address}`,
    Aptos:     `https://explorer.aptoslabs.com/account/${address}`,
    Tron:      `https://tronscan.org/#/contract/${address}`,
    Near:      `https://nearblocks.io/address/${address}`,
    Injective: `https://explorer.injective.network/contract/${address}`,
    Ton:       `https://tonviewer.com/${address}`,
    Starknet:  `https://starkscan.co/contract/${address}`,
  }
  return map[network] || `https://etherscan.io/address/${address}`
}

async function fetchEVMSource(config: ExplorerConfig, address: string): Promise<{ source: string; compiler: string; contractName: string; abi: string } | null> {
  try {
  // Etherscan V2 API - unified endpoint with chainid
  const apiKey = process.env.ETHERSCAN_API_KEY || ""
  const url = `${ETHERSCAN_V2_BASE}?chainid=${config.chainId}&module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ""}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
    
    if (data.status !== "1" || !data.result?.[0]) return null
    const result = data.result[0]
    
    let source = result.SourceCode || ""
    
    // Handle JSON-wrapped multi-file source (Etherscan format)
    if (source.startsWith("{") || source.startsWith("{{")) {
      try {
        const cleaned = source.startsWith("{{") ? source.slice(1, -1) : source
        const parsed = JSON.parse(cleaned)
        if (parsed.sources) {
          // Multi-file source: concatenate all files
          source = Object.entries(parsed.sources)
            .map(([name, content]: [string, unknown]) => {
              const src = (content as { content?: string })?.content || ""
              return `// ── File: ${name} ──\n${src}`
            })
            .join("\n\n")
        }
      } catch {
        // Not JSON, use as-is
      }
    }
    
    if (!source || source.length < 10) return null
    
    return {
      source,
      compiler: result.CompilerVersion || "unknown",
      contractName: result.ContractName || "Unknown",
      abi: result.ABI || "",
    }
  } catch {
    return null
  }
}

interface SolanaTokenInfo {
  source: string
  tokenName: string
  symbol: string
  decimals: number
  supply: string
  mintAuthority: string | null
  freezeAuthority: string | null
  isInitialized: boolean
  metadata?: {
    name?: string
    symbol?: string
    uri?: string
    description?: string
  }
  holders?: number
  securityAnalysis: string
}

async function fetchSolanaToken(address: string): Promise<SolanaTokenInfo | null> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
  
  try {
    // 1. Get token mint info via RPC
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
    
    if (!parsedInfo) {
      return null
    }
    
    const mintAuthority = parsedInfo.mintAuthority || null
    const freezeAuthority = parsedInfo.freezeAuthority || null
    const supply = parsedInfo.supply || "0"
    const decimals = parsedInfo.decimals || 0
    
    // 2. Try to get token metadata from Metaplex
    let metadata: SolanaTokenInfo["metadata"] = {}
    try {
      // Derive Metaplex metadata PDA
      const METAPLEX_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      const metadataRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getProgramAccounts",
          params: [
            METAPLEX_PROGRAM,
            {
              encoding: "jsonParsed",
              filters: [
                { memcmp: { offset: 33, bytes: address } },
              ],
            },
          ],
        }),
      })
      const metaData = await metadataRes.json()
      if (metaData?.result?.[0]?.account?.data) {
        // Parse metadata from account data
        const accountData = metaData.result[0].account.data
        if (typeof accountData === "object" && accountData.parsed) {
          metadata = accountData.parsed.info || {}
        }
      }
    } catch { /* metadata optional */ }
    
    // 3. Try multiple APIs for token name/symbol (Jupiter is most reliable)
    let holders = 0
    let tokenName = metadata?.name || ""
    let symbol = metadata?.symbol || ""
    
    // 3a. Jupiter API - most reliable for Solana tokens
    try {
      const jupiterRes = await fetch(`https://api.jup.ag/tokens/v1/${address}`, {
        headers: { "Accept": "application/json" },
      })
      if (jupiterRes.ok) {
        const jupData = await jupiterRes.json()
        if (jupData) {
          tokenName = jupData.name || tokenName
          symbol = jupData.symbol || symbol
        }
      }
    } catch { /* continue */ }
    
    // 3b. Jupiter strict list fallback
    if (!tokenName || tokenName === "Unknown Token") {
      try {
        const strictRes = await fetch("https://tokens.jup.ag/tokens?tags=verified", {
          headers: { "Accept": "application/json" },
        })
        if (strictRes.ok) {
          const tokens = await strictRes.json()
          const match = tokens.find((t: { address: string }) => t.address === address)
          if (match) {
            tokenName = match.name || tokenName
            symbol = match.symbol || symbol
          }
        }
      } catch { /* continue */ }
    }
    
    // 3c. Solscan API for holders count
    try {
      const solscanRes = await fetch(`https://api-v2.solscan.io/v2/token/meta?address=${address}`, {
        headers: { "Accept": "application/json", "User-Agent": "Solay39/1.0" },
      })
      if (solscanRes.ok) {
        const solscanData = await solscanRes.json()
        if (solscanData?.data) {
          if (!tokenName) tokenName = solscanData.data.name || ""
          if (!symbol) symbol = solscanData.data.symbol || ""
          holders = solscanData.data.holder || 0
        }
      }
    } catch { /* continue */ }
    
    // Fallback if still no name
    if (!tokenName) tokenName = "Solana Token"
    if (!symbol) symbol = address.slice(0, 4).toUpperCase()
    
    // 4. Try Helius API if available
    const heliusKey = process.env.HELIUS_API_KEY
    if (heliusKey) {
      try {
        const heliusRes = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${heliusKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mintAccounts: [address] }),
        })
        if (heliusRes.ok) {
          const heliusData = await heliusRes.json()
          if (heliusData?.[0]) {
            const h = heliusData[0]
            tokenName = h.onChainMetadata?.metadata?.data?.name || tokenName
            symbol = h.onChainMetadata?.metadata?.data?.symbol || symbol
            metadata = {
              ...metadata,
              uri: h.onChainMetadata?.metadata?.data?.uri,
              description: h.offChainMetadata?.description,
            }
          }
        }
      } catch { /* continue */ }
    }
    
    // 5. Generate security analysis
    const securityIssues: string[] = []
    const securityPasses: string[] = []
    
    // Mint Authority Check
    if (mintAuthority) {
      securityIssues.push(`[HIGH] Mint Authority is ACTIVE (${mintAuthority.slice(0, 8)}...) - Owner can mint unlimited tokens`)
    } else {
      securityPasses.push("[SAFE] Mint Authority is DISABLED - No new tokens can be minted")
    }
    
    // Freeze Authority Check
    if (freezeAuthority) {
      securityIssues.push(`[MEDIUM] Freeze Authority is ACTIVE (${freezeAuthority.slice(0, 8)}...) - Owner can freeze any wallet`)
    } else {
      securityPasses.push("[SAFE] Freeze Authority is DISABLED - Wallets cannot be frozen")
    }
    
    // Supply Analysis
    const supplyNum = BigInt(supply) / BigInt(10 ** decimals)
    securityPasses.push(`[INFO] Total Supply: ${supplyNum.toLocaleString()} ${symbol}`)
    securityPasses.push(`[INFO] Decimals: ${decimals}`)
    if (holders > 0) {
      securityPasses.push(`[INFO] Holders: ${holders.toLocaleString()}`)
    }
    
    // Generate comprehensive source analysis
    const securityAnalysis = `
// ═══════════════════════════════════════════════════════════════════════
// SOLAY39 SOLANA TOKEN SECURITY ANALYSIS
// Token: ${tokenName} (${symbol})
// Mint Address: ${address}
// ═══════════════════════════════════════════════════════════════════════

// ── TOKEN CONFIGURATION ────────────────────────────────────────────────
const TOKEN_CONFIG = {
  name: "${tokenName}",
  symbol: "${symbol}",
  decimals: ${decimals},
  totalSupply: "${supply}",
  mintAuthority: ${mintAuthority ? `"${mintAuthority}"` : "null"}, // ${mintAuthority ? "ACTIVE - CAN MINT" : "DISABLED - FIXED SUPPLY"}
  freezeAuthority: ${freezeAuthority ? `"${freezeAuthority}"` : "null"}, // ${freezeAuthority ? "ACTIVE - CAN FREEZE" : "DISABLED - SAFE"}
  isInitialized: true,
  holders: ${holders || "unknown"},
};

// ── SECURITY FINDINGS ──────────────────────────────────────────────────
/*
${securityIssues.length > 0 ? securityIssues.join("\n") : "[SAFE] No critical security issues detected"}

${securityPasses.join("\n")}
*/

// ── MINT AUTHORITY ANALYSIS ────────────────────────────────────────────
/*
${mintAuthority ? `
CRITICAL: Mint Authority is ACTIVE
- Authority Address: ${mintAuthority}
- Risk: The owner can mint unlimited new tokens at any time
- Impact: Token holders can be diluted infinitely
- Recommendation: Verify if mintAuthority is a multisig or timelock
- For investors: HIGH RISK - Potential for inflation attack or rug pull
` : `
SAFE: Mint Authority is DISABLED (null)
- The token has a fixed supply
- No new tokens can ever be minted
- This is the safest configuration for investors
`}
*/

// ── FREEZE AUTHORITY ANALYSIS ──────────────────────────────────────────
/*
${freezeAuthority ? `
WARNING: Freeze Authority is ACTIVE
- Authority Address: ${freezeAuthority}
- Risk: Any token holder's wallet can be frozen
- Impact: Users may lose access to their tokens
- Recommendation: Verify if this is necessary for compliance
- For investors: MEDIUM RISK - Owner can freeze your tokens
` : `
SAFE: Freeze Authority is DISABLED (null)
- No wallet can be frozen
- All holders retain full control of their tokens
- This is the safest configuration for users
`}
*/

// ── TOKEN STANDARD ─────────────────────────────────────────────────────
/*
This is a Solana SPL Token using the standard Token Program.
- Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
- Standard: SPL Token (equivalent to ERC-20 on Ethereum)
- Upgradeable: No (SPL Token program is immutable)
*/

// ── METADATA ───────────────────────────────────────────────────────────
const TOKEN_METADATA = ${JSON.stringify(metadata, null, 2)};

// ── AUDIT CHECKLIST FOR MANUAL REVIEW ──────────────────────────────────
/*
[ ] Verify mint authority owner (is it a multisig? timelock? EOA?)
[ ] Check token distribution (top holders concentration)
[ ] Verify LP is locked (if DEX trading is enabled)
[ ] Check if token has been audited before
[ ] Review social presence and team transparency
[ ] Verify metadata URI points to legitimate content
[ ] Check for any associated programs (staking, vesting, etc.)
${mintAuthority ? "[ ] CRITICAL: Investigate why mint authority is still enabled" : ""}
${freezeAuthority ? "[ ] WARNING: Investigate why freeze authority is enabled" : ""}
*/

// ═══════════════════════════════════════════════════════════════════════
// END OF SOLAY39 ANALYSIS
// ═══════════════════════════════════════════════════════════════════════
`
    
    return {
      source: securityAnalysis,
      tokenName,
      symbol,
      decimals,
      supply,
      mintAuthority,
      freezeAuthority,
      isInitialized: true,
      metadata,
      holders,
      securityAnalysis,
    }
    
  } catch (error) {
    console.error("Solana fetch error:", error)
    return null
  }
}

async function fetchSolanaIDL(address: string): Promise<{ idl: string; programName: string } | null> {
  // First try to fetch as SPL token
  const tokenInfo = await fetchSolanaToken(address)
  if (tokenInfo) {
    return {
      idl: tokenInfo.source,
      programName: `${tokenInfo.tokenName} (${tokenInfo.symbol})`,
    }
  }
  
  // If not a token, try Anchor IDL
  try {
    const idlUrl = `https://api.solscan.io/account/idl?address=${address}`
    const res = await fetch(idlUrl, {
      headers: { "Accept": "application/json", "User-Agent": "Solay39-Auditor/1.0" },
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.data || data?.idl) {
        const idl = data.data || data.idl
        return {
          idl: typeof idl === "string" ? idl : JSON.stringify(idl, null, 2),
          programName: idl?.name || "Solana Program",
        }
      }
    }
  } catch { /* continue */ }

  // Fallback: try to get account info from Solana FM
  try {
    const fmUrl = `https://api.solana.fm/v0/accounts/${address}`
    const res = await fetch(fmUrl, {
      headers: { "Accept": "application/json" },
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.result?.data) {
        return {
          idl: JSON.stringify(data.result, null, 2),
          programName: data.result?.accountLabel || "Solana Program",
        }
      }
    }
  } catch { /* continue */ }

  return null
}

export async function POST(req: Request) {
  try {
    const { address, network } = await req.json()

    if (!address || typeof address !== "string") {
      return Response.json({ error: "Missing contract address" }, { status: 400 })
    }

    const net = network || "Ethereum"
    const config = EXPLORER_MAP[net]
    const explorerUrl = getExplorerUrl(net, address)

    if (!config) {
      return Response.json({
        error: `Network "${net}" is not yet supported for auto-fetch.`,
        explorerUrl,
        network: net,
      }, { status: 400 })
    }

    // ── EVM chains (Etherscan-compatible APIs) ──
    if (config.type === "etherscan") {
      const result = await fetchEVMSource(config, address)
      if (!result || !result.source) {
        return Response.json({
          error: `Contract source not verified on ${net} explorer. Please paste the source code manually.`,
          explorerUrl,
          network: net,
        }, { status: 404 })
      }
      const linesOfCode = result.source.split("\n").length
      const explorerName = config.apiUrl.includes("etherscan") ? "Etherscan" :
        config.apiUrl.includes("bscscan") ? "BscScan" :
        config.apiUrl.includes("arbiscan") ? "Arbiscan" :
        config.apiUrl.includes("polygonscan") ? "PolygonScan" :
        config.apiUrl.includes("basescan") ? "BaseScan" :
        config.apiUrl.includes("snowscan") ? "Snowscan" :
        net + " Explorer"
      return Response.json({
        source: result.source,
        compiler: result.compiler,
        contractName: result.contractName,
        language: "Solidity " + (result.compiler || ""),
        explorerName,
        explorerUrl,
        linesOfCode,
        network: net,
      })
    }

    // ── Solana ──
    if (config.type === "solana") {
      const result = await fetchSolanaIDL(address)
      if (result) {
        // Determine if this is an SPL token analysis or program IDL
        const isTokenAnalysis = result.idl.includes("SOLAY39 SOLANA TOKEN SECURITY ANALYSIS")
        return Response.json({
          source: result.idl,
          contractName: result.programName,
          language: isTokenAnalysis ? "SPL Token (Security Analysis)" : "Rust/Anchor IDL",
          explorerName: "Solscan",
          explorerUrl,
          linesOfCode: result.idl.split("\n").length,
          network: net,
          isSolanaToken: isTokenAnalysis,
          note: isTokenAnalysis 
            ? "This is a Solana SPL Token. The analysis includes mint authority, freeze authority, supply, and security findings. Review the AUDIT CHECKLIST section for manual review items."
            : "Solana programs are compiled Rust/Anchor. This is the program IDL (Interface Description Language). The audit will analyze the program interface, instruction handlers, and account constraints.",
        })
      }
      // If no IDL, return helpful info
      return Response.json({
        error: `Could not fetch token/program data from Solana. This may be a non-standard program or the RPC may be rate-limited. Please try again or paste the program source code manually.`,
        explorerUrl,
        network: net,
        note: "Solana programs are Rust-based. For SPL tokens, ensure the mint address is correct. For custom programs, provide the Anchor IDL or source code.",
      }, { status: 404 })
    }

    // ── Unsupported chains ──
    return Response.json({
      error: `Auto-fetch is not yet available for ${net}. Please paste the contract source code manually.`,
      explorerUrl,
      network: net,
    }, { status: 400 })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
