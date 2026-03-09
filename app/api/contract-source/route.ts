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

async function fetchSolanaIDL(address: string): Promise<{ idl: string; programName: string } | null> {
  try {
    // Try Anchor IDL first (most Solana programs use Anchor)
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
        return Response.json({
          source: result.idl,
          contractName: result.programName,
          language: "Rust/Anchor IDL",
          explorerName: "Solscan",
          explorerUrl,
          linesOfCode: result.idl.split("\n").length,
          network: net,
          note: "Solana programs are compiled Rust/Anchor. This is the program IDL (Interface Description Language). The audit will analyze the program interface, instruction handlers, and account constraints.",
        })
      }
      // If no IDL, return helpful info
      return Response.json({
        error: `No verified IDL found for this Solana program. The program may not be open-source or may not use Anchor. Please paste the program source code manually or provide the GitHub repository.`,
        explorerUrl,
        network: net,
        note: "Solana programs are Rust-based, not Solidity. If the source is available on GitHub, paste it in the code editor.",
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
