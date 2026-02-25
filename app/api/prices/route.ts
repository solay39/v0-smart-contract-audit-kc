// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Live Token Prices via GeckoTerminal API
// ═══════════════════════════════════════════════════════════════════

// Token contract addresses (Ethereum mainnet)
// Base set of known audited tokens
const BASE_TOKENS: Record<string, string> = {
  INJ: "0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30",
  FET: "0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85",
  CHZ: "0x3506424F91fD33084466F402d5D97f05F8e3b4AF",
}

const GECKO_BASE = "https://api.geckoterminal.com/api/v2"

interface TokenPriceData {
  ticker: string
  address: string
  price: string
  priceNum: number
}

// Cache to respect GeckoTerminal 10 calls/min limit
let priceCache: { data: Record<string, TokenPriceData>; timestamp: number; key: string } | null = null
const CACHE_TTL = 60_000 // 60 seconds

export async function GET(req: Request) {
  // Accept extra tokens from query params: ?extra=TICKER:address,TICKER2:address2
  const url = new URL(req.url)
  const extraParam = url.searchParams.get("extra") || ""
  const TOKEN_CONTRACTS: Record<string, string> = { ...BASE_TOKENS }
  if (extraParam) {
    for (const pair of extraParam.split(",")) {
      const [ticker, addr] = pair.split(":")
      if (ticker && addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
        TOKEN_CONTRACTS[ticker.toUpperCase()] = addr
      }
    }
  }

  // Build cache key that includes extras
  const cacheKey = Object.keys(TOKEN_CONTRACTS).sort().join(",")

  // Return cached data if fresh and same token set
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL && priceCache.key === cacheKey) {
    return Response.json({ prices: priceCache.data, cached: true })
  }

  try {
    // GeckoTerminal simple token price endpoint — batch all ETH addresses
    const addresses = Object.values(TOKEN_CONTRACTS).join(",").toLowerCase()
    const url = `${GECKO_BASE}/simple/networks/eth/token_price/${addresses}`

    const res = await fetch(url, {
      headers: { Accept: "application/json;version=20230203" },
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      throw new Error(`GeckoTerminal API responded ${res.status}`)
    }

    const json = await res.json()
    const tokenPrices: Record<string, string> =
      json?.data?.attributes?.token_prices ?? {}

    // Build our price map keyed by ticker
    const prices: Record<string, TokenPriceData> = {}

    for (const [ticker, address] of Object.entries(TOKEN_CONTRACTS)) {
      const addrLower = address.toLowerCase()
      const rawPrice = tokenPrices[addrLower]
      const priceNum = rawPrice ? parseFloat(rawPrice) : 0

      prices[ticker] = {
        ticker,
        address,
        price: priceNum > 0 ? `$${priceNum < 0.01 ? priceNum.toFixed(6) : priceNum < 1 ? priceNum.toFixed(4) : priceNum.toFixed(2)}` : "N/A",
        priceNum,
      }
    }

    // Now fetch 24h pool data for each token to get real % change
    // Use the top pool for each token
    const pricesWithChange = await enrichWith24hChange(prices)

    priceCache = { data: pricesWithChange, timestamp: Date.now(), key: cacheKey }
    return Response.json({ prices: pricesWithChange, cached: false })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Price fetch error:", msg)

    // Return stale cache if available
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
      const poolsUrl = `${GECKO_BASE}/networks/eth/tokens/${data.address.toLowerCase()}/pools?page=1`
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

      enriched[ticker] = {
        ...data,
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
