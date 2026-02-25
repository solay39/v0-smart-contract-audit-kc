// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Multi-Chain Contract Source Code Fetcher
// Supports: Etherscan (EVM), Solscan (Solana), BscScan, Arbiscan, etc.
// ═══════════════════════════════════════════════════════════════════

interface ExplorerConfig {
  apiUrl: string
  apiKeyParam?: string
  apiKeyEnv?: string
  sourceAction: string
  type: "etherscan" | "solana" | "unsupported"
}

const EXPLORER_MAP: Record<string, ExplorerConfig> = {
  Ethereum:    { apiUrl: "https://api.etherscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  BSC:         { apiUrl: "https://api.bscscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  "BNB Chain": { apiUrl: "https://api.bscscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  Arbitrum:    { apiUrl: "https://api.arbiscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  Optimism:    { apiUrl: "https://api-optimistic.etherscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  Polygon:     { apiUrl: "https://api.polygonscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  Avalanche:   { apiUrl: "https://api.snowscan.xyz/api", sourceAction: "getsourcecode", type: "etherscan" },
  Base:        { apiUrl: "https://api.basescan.org/api", sourceAction: "getsourcecode", type: "etherscan" },
  Fantom:      { apiUrl: "https://api.ftmscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  Cronos:      { apiUrl: "https://api.cronoscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  Gnosis:      { apiUrl: "https://api.gnosisscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  Linea:       { apiUrl: "https://api.lineascan.build/api", sourceAction: "getsourcecode", type: "etherscan" },
  Scroll:      { apiUrl: "https://api.scrollscan.com/api", sourceAction: "getsourcecode", type: "etherscan" },
  Blast:       { apiUrl: "https://api.blastscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  zkSync:      { apiUrl: "https://api-era.zksync.network/api", sourceAction: "getsourcecode", type: "etherscan" },
  Moonbeam:    { apiUrl: "https://api-moonbeam.moonscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  Celo:        { apiUrl: "https://api.celoscan.io/api", sourceAction: "getsourcecode", type: "etherscan" },
  Mantle:      { apiUrl: "https://api.mantlescan.xyz/api", sourceAction: "getsourcecode", type: "etherscan" },
  // Non-EVM
  Solana:      { apiUrl: "https://api.solscan.io", sourceAction: "account", type: "solana" },
  Sui:         { apiUrl: "", sourceAction: "", type: "unsupported" },
  Aptos:       { apiUrl: "", sourceAction: "", type: "unsupported" },
  Tron:        { apiUrl: "", sourceAction: "", type: "unsupported" },
  Near:        { apiUrl: "", sourceAction: "", type: "unsupported" },
  Cosmos:      { apiUrl: "", sourceAction: "", type: "unsupported" },
  Injective:   { apiUrl: "", sourceAction: "", type: "unsupported" },
  Ton:         { apiUrl: "", sourceAction: "", type: "unsupported" },
  Starknet:    { apiUrl: "", sourceAction: "", type: "unsupported" },
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
    const url = `${config.apiUrl}?module=contract&action=${config.sourceAction}&address=${address}`
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
      return Response.json({
        source: result.source,
        compiler: result.compiler,
        contractName: result.contractName,
        language: "solidity",
        explorerUrl,
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
          language: "rust-anchor-idl",
          explorerUrl,
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
