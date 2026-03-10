// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Token Metadata from GeckoTerminal + CoinGecko
// Fetches: name, ticker, price, market cap, logo, description,
//          website, socials, contract info — all from blockchain APIs
// ═══════════════════════════════════════════════════════════════════

const GECKO_BASE = "https://api.geckoterminal.com/api/v2"
const COINGECKO_BASE = "https://api.coingecko.com/api/v3"

// Simple in-memory cache (per cold start)
const infoCache = new Map<string, { data: TokenInfo; ts: number }>()
const CACHE_TTL = 300_000 // 5 min

export interface TokenInfo {
  name: string
  ticker: string
  contractAddress: string
  network: string
  price: string
  priceNum: number
  change24h: string
  volume24h: string
  marketCap: string
  fdv: string
  logoUrl: string
  description: string
  website: string
  github: string
  telegram: string
  twitter: string
  discord: string
  tags: string[]
  totalSupply: string
  tokenAge: string
  creatorAddress: string
}

export async function POST(req: Request) {
  try {
    const { address, network } = await req.json()

    if (!address || typeof address !== "string") {
      return Response.json({ error: "Missing contract address" }, { status: 400 })
    }

    const net = network || "Ethereum"
    const netId = mapNetworkToGeckoId(net)
    // Solana/Near/Cosmos addresses are case-sensitive; only lowercase EVM addresses
    const isEvmChain = !["Solana", "Sui", "Aptos", "Cosmos", "Injective", "Sei", "Near", "Ton", "Starknet", "Tron"].includes(net)
    const addrNormalized = isEvmChain ? address.toLowerCase().trim() : address.trim()

    // Check cache
    const cacheKey = `${netId}:${addrNormalized}`
    const cached = infoCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return Response.json({ token: cached.data, cached: true })
    }

    // ── Step 1: GeckoTerminal token info ──
    const geckoInfo = await fetchGeckoTerminalInfo(netId, addrNormalized)

    // ── Step 2: CoinGecko for logo, description, links ──
    const coingeckoInfo = await fetchCoinGeckoInfo(addrNormalized, netId)

    // ── Step 2.5: eth_call fallback if both APIs returned nothing ──
    let fallbackName = coingeckoInfo?.name || geckoInfo?.name || ""
    let fallbackSymbol = coingeckoInfo?.symbol || geckoInfo?.symbol || ""

    if ((!fallbackName || !fallbackSymbol) && !["Solana", "Sui", "Aptos", "Cosmos", "Injective", "Sei", "Near", "Ton", "Starknet", "Tron"].includes(net)) {
      try {
        const rpcUrls: Record<string, string> = {
          eth: "https://eth.llamarpc.com",
          bsc: "https://bsc-dataseed.binance.org",
          polygon_pos: "https://polygon-rpc.com",
          arbitrum: "https://arb1.arbitrum.io/rpc",
          base: "https://mainnet.base.org",
          avax: "https://api.avax.network/ext/bc/C/rpc",
        }
        const rpcUrl = rpcUrls[netId]
        if (rpcUrl) {
          const [nameRes, symbolRes] = await Promise.all([
            fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: addrNormalized, data: "0x06fdde03" }, "latest"] }) }),
            fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_call", params: [{ to: addrNormalized, data: "0x95d89b41" }, "latest"] }) }),
          ])
          const nameData = await nameRes.json()
          const symbolData = await symbolRes.json()
          const decodeABIString = (hex: string): string => {
            try {
              const clean = hex.replace("0x", "")
              if (clean.length < 128) return ""
              const length = parseInt(clean.slice(64, 128), 16)
              if (length === 0 || length > 100) return ""
              return Buffer.from(clean.slice(128, 128 + length * 2), "hex").toString("utf8").replace(/\0/g, "").trim()
            } catch { return "" }
          }
          if (!fallbackName && nameData?.result) fallbackName = decodeABIString(nameData.result)
          if (!fallbackSymbol && symbolData?.result) fallbackSymbol = decodeABIString(symbolData.result)
        }
      } catch { /* continue */ }
    }

    // ── Step 3: Merge all data ──
    const token: TokenInfo = {
      name: fallbackName || "Unknown Token",
      ticker: (fallbackSymbol || "???").toUpperCase(),
      contractAddress: address,
      network: network || "Ethereum",
      price: geckoInfo?.price || "N/A",
      priceNum: geckoInfo?.priceNum || 0,
      change24h: geckoInfo?.change24h || "N/A",
      volume24h: geckoInfo?.volume24h || "N/A",
      marketCap: coingeckoInfo?.marketCap || geckoInfo?.marketCap || "N/A",
      fdv: geckoInfo?.fdv || "N/A",
      logoUrl: coingeckoInfo?.image || "",
      description: coingeckoInfo?.description || "",
      website: coingeckoInfo?.website || "",
      github: coingeckoInfo?.github || "",
      telegram: coingeckoInfo?.telegram || "",
      twitter: coingeckoInfo?.twitter || "",
      discord: coingeckoInfo?.discord || "",
      tags: coingeckoInfo?.categories || geckoInfo?.tags || [],
      totalSupply: coingeckoInfo?.totalSupply || "",
      tokenAge: coingeckoInfo?.genesisDate || "",
      creatorAddress: "",
    }

    infoCache.set(cacheKey, { data: token, ts: Date.now() })

    return Response.json({ token, cached: false })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}

// ── GeckoTerminal: price, volume, market cap from top pool ──
async function fetchGeckoTerminalInfo(netId: string, address: string) {
  try {
    // Token info
    const tokenUrl = `${GECKO_BASE}/networks/${netId}/tokens/${address}`
    const tokenRes = await fetch(tokenUrl, {
      headers: { Accept: "application/json;version=20230203" },
    })
    if (!tokenRes.ok) return null

    const tokenJson = await tokenRes.json()
    const attr = tokenJson?.data?.attributes
    if (!attr) return null

    const priceNum = attr.price_usd ? parseFloat(attr.price_usd) : 0
    const fdvNum = attr.fdv_usd ? parseFloat(attr.fdv_usd) : 0
    const mcapNum = attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : 0

    // Get top pool for 24h change
    let change24h = "N/A"
    let volume24h = "N/A"
    let poolMcap = "N/A"
    try {
      const poolsUrl = `${GECKO_BASE}/networks/${netId}/tokens/${address}/pools?page=1`
      const poolsRes = await fetch(poolsUrl, {
        headers: { Accept: "application/json;version=20230203" },
      })
      if (poolsRes.ok) {
        const poolsJson = await poolsRes.json()
        const top = poolsJson?.data?.[0]?.attributes
        if (top) {
          const ch = top.price_change_percentage?.h24
          if (ch != null) {
            change24h = `${parseFloat(ch) >= 0 ? "+" : ""}${parseFloat(ch).toFixed(2)}%`
          }
          const vol = top.volume_usd?.h24
          if (vol) volume24h = `$${formatCompact(parseFloat(vol))}`
          const mc = top.market_cap_usd ?? top.fdv_usd
          if (mc) poolMcap = `$${formatCompact(parseFloat(mc))}`
        }
      }
    } catch { /* non-critical */ }

    return {
      name: attr.name || "",
      symbol: attr.symbol || "",
      price: priceNum > 0
        ? `$${priceNum < 0.01 ? priceNum.toFixed(6) : priceNum < 1 ? priceNum.toFixed(4) : priceNum.toFixed(2)}`
        : "N/A",
      priceNum,
      change24h,
      volume24h,
      marketCap: mcapNum > 0 ? `$${formatCompact(mcapNum)}` : poolMcap,
      fdv: fdvNum > 0 ? `$${formatCompact(fdvNum)}` : "N/A",
      tags: [] as string[],
    }
  } catch {
    return null
  }
}

// ── CoinGecko: logo, description, links, categories ──
async function fetchCoinGeckoInfo(address: string, netId: string) {
  try {
    const platformMap: Record<string, string> = {
      eth: "ethereum",
      bsc: "binance-smart-chain",
      arbitrum: "arbitrum-one",
      optimism: "optimistic-ethereum",
      polygon_pos: "polygon-pos",
      avax: "avalanche",
      base: "base",
      ftm: "fantom",
      cro: "cronos",
      xdai: "xdai",
      celo: "celo",
      mantle: "mantle",
      linea: "linea",
      scroll: "scroll",
      zksync: "zksync",
      blast: "blast",
      solana: "solana",
      tron: "tron",
      near: "near-protocol",
    }
    const platform = platformMap[netId] || netId
    const url = `${COINGECKO_BASE}/coins/${platform}/contract/${address}`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()

    const links = data.links || {}
    const website = links.homepage?.find((u: string) => u?.length > 0) || ""
    const github = links.repos_url?.github?.find((u: string) => u?.length > 0) || ""
    const telegram = links.telegram_channel_identifier
      ? `https://t.me/${links.telegram_channel_identifier}`
      : ""
    const twitter = links.twitter_screen_name
      ? `https://twitter.com/${links.twitter_screen_name}`
      : ""
    const discord = links.chat_url?.find((u: string) => u?.includes("discord")) || ""

    const mcData = data.market_data
    const mcap = mcData?.market_cap?.usd
    const totalSupply = mcData?.total_supply

    // Clean description (remove HTML) and truncate at sentence boundary
    const rawDesc = data.description?.en || ""
    const stripped = rawDesc.replace(/<[^>]*>/g, "")
    let cleanDesc = stripped
    if (stripped.length > 500) {
      // Find the last sentence-ending punctuation before 500 chars
      const truncated = stripped.slice(0, 500)
      const lastSentence = Math.max(
        truncated.lastIndexOf(". "),
        truncated.lastIndexOf("! "),
        truncated.lastIndexOf("? ")
      )
      cleanDesc = lastSentence > 100 ? truncated.slice(0, lastSentence + 1) : truncated.slice(0, truncated.lastIndexOf(" ")) + "..."
    }

    // Genesis date
    const genesis = data.genesis_date || ""

    return {
      name: data.name || "",
      symbol: data.symbol || "",
      image: data.image?.large || data.image?.small || "",
      description: cleanDesc,
      website,
      github,
      telegram,
      twitter,
      discord,
      categories: (data.categories || []).filter((c: string) => c && c !== "null"),
      marketCap: mcap ? `$${formatCompact(mcap)}` : "",
      totalSupply: totalSupply ? formatCompact(totalSupply) : "",
      genesisDate: genesis,
    }
  } catch {
    return null
  }
}

function mapNetworkToGeckoId(network: string): string {
  const map: Record<string, string> = {
    // EVM chains
    Ethereum: "eth",
    BSC: "bsc",
    "BNB Chain": "bsc",
    "Binance Smart Chain": "bsc",
    Arbitrum: "arbitrum",
    "Arbitrum One": "arbitrum",
    Optimism: "optimism",
    Polygon: "polygon_pos",
    "Polygon PoS": "polygon_pos",
    Avalanche: "avax",
    "Avalanche C-Chain": "avax",
    Base: "base",
    Fantom: "ftm",
    Cronos: "cro",
    Gnosis: "xdai",
    Celo: "celo",
    Mantle: "mantle",
    Linea: "linea",
    Scroll: "scroll",
    zkSync: "zksync",
    "zkSync Era": "zksync",
    Blast: "blast",
    Mode: "mode",
    Manta: "manta-pacific",
    Metis: "metis",
    // Non-EVM
    Solana: "solana",
    Sui: "sui-network",
    Aptos: "aptos",
    Tron: "tron",
    Near: "near",
    Cosmos: "cosmos",
    Injective: "injective",
    Sei: "sei-network",
    Ton: "ton",
    Starknet: "starknet-alpha",
    // L2s
    "Polygon zkEVM": "polygon-zkevm",
    "Arbitrum Nova": "arbitrum-nova",
    Moonbeam: "moonbeam",
    Moonriver: "moonriver",
  }
  return map[network] || network.toLowerCase().replace(/\s+/g, "-")
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K"
  return n.toFixed(2)
}