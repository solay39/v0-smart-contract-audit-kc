// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Live Token Prices via GeckoTerminal API (Multi-Chain)
// Supports: Ethereum, BSC, Arbitrum, Optimism, Polygon, Base,
//           Avalanche, Fantom, Solana, and all GeckoTerminal chains
// ═══════════════════════════════════════════════════════════════════

// Base set of known audited tokens: TICKER -> { address, network }
const BASE_TOKENS: Record<string, { address: string; network: string }> = {
  INJ: { address: "0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30", network: "eth" },
  FET: { address: "0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85", network: "eth" },
  CHZ: { address: "0x3506424F91fD33084466F402d5D97f05F8e3b4AF", network: "eth" },
}

const GECKO_BASE = "https://api.geckoterminal.com/api/v2"

// Map user-facing network names to GeckoTerminal network IDs
function mapNetworkToGeckoId(network: string): string {
  const map: Record<string, string> = {
    Ethereum: "eth", eth: "eth",
    BSC: "bsc", "BNB Chain": "bsc", "Binance Smart Chain": "bsc", bsc: "bsc",
    Arbitrum: "arbitrum", "Arbitrum One": "arbitrum", arbitrum: "arbitrum",
    Optimism: "optimism", optimism: "optimism",
    Polygon: "polygon_pos", "Polygon PoS": "polygon_pos", polygon_pos: "polygon_pos",
    Avalanche: "avax", "Avalanche C-Chain": "avax", avax: "avax",
    Base: "base", base: "base",
    Fantom: "ftm", ftm: "ftm",
    Cronos: "cro", cro: "cro",
    Gnosis: "xdai", xdai: "xdai",
    Celo: "celo", celo: "celo",
    Mantle: "mantle", mantle: "mantle",
    Linea: "linea", linea: "linea",
    Scroll: "scroll", scroll: "scroll",
    zkSync: "zksync", "zkSync Era": "zksync", zksync: "zksync",
    Blast: "blast", blast: "blast",
    Solana: "solana", solana: "solana",
    Tron: "tron", tron: "tron",
    Moonbeam: "moonbeam", moonbeam: "moonbeam",
  }
  return map[network] || network.toLowerCase().replace(/\s+/g, "-")
}

interface TokenPriceData {
  ticker: string
  address: string
  network: string
  price: string
  priceNum: number
}

// Cache to respect GeckoTerminal 10 calls/min limit
let priceCache: { data: Record<string, TokenPriceData>; timestamp: number; key: string } | null = null
const CACHE_TTL = 60_000 // 60 seconds

export async function GET(req: Request) {
  // Accept extra tokens: ?extra=TICKER:address:network,TICKER2:address2:network2
  // Also supports legacy format: ?extra=TICKER:address (defaults to eth)
  const url = new URL(req.url)
  const extraParam = url.searchParams.get("extra") || ""
  const TOKEN_MAP: Record<string, { address: string; network: string }> = { ...BASE_TOKENS }

  if (extraParam) {
    for (const pair of extraParam.split(",")) {
      const parts = pair.split(":")
      const ticker = parts[0]
      const addr = parts[1]
      const net = parts[2] || "eth" // default to eth for backward compat
      if (ticker && addr) {
        TOKEN_MAP[ticker.toUpperCase()] = {
          address: addr,
          network: mapNetworkToGeckoId(net),
        }
      }
    }
  }

  // Build cache key
  const cacheKey = Object.entries(TOKEN_MAP)
    .map(([t, v]) => `${t}:${v.network}:${v.address}`)
    .sort()
    .join(",")

  // Return cached data if fresh
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL && priceCache.key === cacheKey) {
    return Response.json({ prices: priceCache.data, cached: true })
  }

  try {
    // Group tokens by network for batched GeckoTerminal calls
    const byNetwork: Record<string, { ticker: string; address: string }[]> = {}
    for (const [ticker, { address, network }] of Object.entries(TOKEN_MAP)) {
      if (!byNetwork[network]) byNetwork[network] = []
      byNetwork[network].push({ ticker, address })
    }

    const prices: Record<string, TokenPriceData> = {}

    // Fetch prices per network (GeckoTerminal simple price endpoint)
    for (const [netId, tokens] of Object.entries(byNetwork)) {
      try {
        const addresses = tokens.map(t => t.address.toLowerCase()).join(",")
        const priceUrl = `${GECKO_BASE}/simple/networks/${netId}/token_price/${addresses}`

        const res = await fetch(priceUrl, {
          headers: { Accept: "application/json;version=20230203" },
          next: { revalidate: 60 },
        })

        if (!res.ok) {
          console.error(`[v0] GeckoTerminal ${netId} responded ${res.status}`)
          // Still add tokens with N/A price
          for (const t of tokens) {
            prices[t.ticker] = { ticker: t.ticker, address: t.address, network: netId, price: "N/A", priceNum: 0 }
          }
          continue
        }

        const json = await res.json()
        const tokenPrices: Record<string, string> = json?.data?.attributes?.token_prices ?? {}

        for (const t of tokens) {
          const addrLower = t.address.toLowerCase()
          const rawPrice = tokenPrices[addrLower]
          const priceNum = rawPrice ? parseFloat(rawPrice) : 0

          prices[t.ticker] = {
            ticker: t.ticker,
            address: t.address,
            network: netId,
            price: priceNum > 0
              ? `$${priceNum < 0.01 ? priceNum.toFixed(6) : priceNum < 1 ? priceNum.toFixed(4) : priceNum.toFixed(2)}`
              : "N/A",
            priceNum,
          }
        }
      } catch (e) {
        console.error(`[v0] Price fetch error for network ${netId}:`, e)
        for (const t of tokens) {
          prices[t.ticker] = { ticker: t.ticker, address: t.address, network: netId, price: "N/A", priceNum: 0 }
        }
      }
    }

    // Enrich with 24h change, volume, market cap
    const pricesWithChange = await enrichWith24hChange(prices)

    priceCache = { data: pricesWithChange, timestamp: Date.now(), key: cacheKey }
    return Response.json({ prices: pricesWithChange, cached: false })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Price fetch error:", msg)

    if (priceCache) {
      return Response.json({ prices: priceCache.data, cached: true, stale: true })
    }

    return Response.json({ error: msg, prices: {} }, { status: 500 })
  }
}

async function enrichWith24hChange(
  prices: Record<string, TokenPriceData>
): Promise<Record<string, TokenPriceData & { change24h?: string; volume24h?: string; marketCap?: string }>> {
  const enriched: Record<string, TokenPriceData & { change24h?: string; volume24h?: string; marketCap?: string }> = { ...prices }

  for (const [ticker, data] of Object.entries(prices)) {
    try {
      // Use the correct network for pool lookup
      const netId = data.network || "eth"
      const poolsUrl = `${GECKO_BASE}/networks/${netId}/tokens/${data.address.toLowerCase()}/pools?page=1`
      const poolsRes = await fetch(poolsUrl, {
        headers: { Accept: "application/json;version=20230203" },
        next: { revalidate: 60 },
      })

      if (!poolsRes.ok) continue

      const poolsJson = await poolsRes.json()
      const topPool = poolsJson?.data?.[0]?.attributes
      if (!topPool) continue

      const change = topPool.price_change_percentage?.h24
      const vol = topPool.volume_usd?.h24
      const mcap = topPool.market_cap_usd ?? topPool.fdv_usd

      // Fallback: if simple price endpoint returned N/A, extract price from pool data
      let finalPrice = data.price
      let finalPriceNum = data.priceNum
      if (data.priceNum === 0 || data.price === "N/A") {
        // Try base_token_price_usd first (if our token is the base token)
        // Check which side of the pool our token is on
        const poolBaseAddr = poolsJson?.data?.[0]?.relationships?.base_token?.data?.id || ""
        const poolQuoteAddr = poolsJson?.data?.[0]?.relationships?.quote_token?.data?.id || ""
        const ourAddrLower = data.address.toLowerCase()

        let poolPrice: number | null = null
        if (poolBaseAddr.toLowerCase().includes(ourAddrLower)) {
          poolPrice = parseFloat(topPool.base_token_price_usd || "0")
        } else if (poolQuoteAddr.toLowerCase().includes(ourAddrLower)) {
          poolPrice = parseFloat(topPool.quote_token_price_usd || "0")
        } else {
          // Try both, pick the non-zero one
          poolPrice = parseFloat(topPool.base_token_price_usd || "0") || parseFloat(topPool.quote_token_price_usd || "0")
        }

        if (poolPrice && poolPrice > 0) {
          finalPriceNum = poolPrice
          finalPrice = `$${poolPrice < 0.0001 ? poolPrice.toFixed(8) : poolPrice < 0.01 ? poolPrice.toFixed(6) : poolPrice < 1 ? poolPrice.toFixed(4) : poolPrice.toFixed(2)}`
        }
      }

      enriched[ticker] = {
        ...data,
        price: finalPrice,
        priceNum: finalPriceNum,
        change24h: change != null ? `${parseFloat(change) >= 0 ? "+" : ""}${parseFloat(change).toFixed(2)}%` : undefined,
        volume24h: vol ? `$${formatCompact(parseFloat(vol))}` : undefined,
        marketCap: mcap ? `$${formatCompact(parseFloat(mcap))}` : undefined,
      }
    } catch {
      // Individual pool fetch failure is non-critical
    }
  }

  return enriched
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K"
  return n.toFixed(2)
}
