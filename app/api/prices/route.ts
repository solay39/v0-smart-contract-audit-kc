// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Live Token Prices via GeckoTerminal API (Multi-Chain)
// Efficient: batches by network, limits pool calls, respects rate limits
// ═══════════════════════════════════════════════════════════════════

const GECKO_BASE = "https://api.geckoterminal.com/api/v2"

// Map user-facing network names to GeckoTerminal network IDs
function toGeckoNet(network: string): string {
  const map: Record<string, string> = {
    Ethereum: "eth", eth: "eth",
    BSC: "bsc", "BNB Chain": "bsc", "Binance Smart Chain": "bsc", bsc: "bsc",
    Arbitrum: "arbitrum", "Arbitrum One": "arbitrum", arbitrum: "arbitrum",
    Optimism: "optimism", optimism: "optimism",
    Polygon: "polygon_pos", "Polygon PoS": "polygon_pos", polygon_pos: "polygon_pos",
    Avalanche: "avax", "Avalanche C-Chain": "avax", avax: "avax",
    Base: "base", base: "base",
    Fantom: "ftm", ftm: "ftm",
    Solana: "solana", solana: "solana",
    Tron: "tron", tron: "tron",
  }
  return map[network] || network.toLowerCase().replace(/\s+/g, "-")
}

interface PriceResult {
  ticker: string
  address: string
  network: string
  price: string
  priceNum: number
  change24h?: string
  volume24h?: string
  marketCap?: string
}

// ── In-memory cache (60s TTL) ───────────────────────────────────
let cache: { data: Record<string, PriceResult>; ts: number; key: string } | null = null
const TTL = 60_000

export async function GET(req: Request) {
  const url = new URL(req.url)
  const extraParam = url.searchParams.get("extra") || ""

  // Parse tokens from ?extra=TICKER:address:network,...
  const tokens: { ticker: string; address: string; network: string }[] = []

  if (extraParam) {
    for (const pair of extraParam.split(",")) {
      const parts = pair.split(":")
      if (parts.length >= 2 && parts[0] && parts[1]) {
        tokens.push({
          ticker: parts[0].toUpperCase(),
          address: parts[1],
          network: toGeckoNet(parts[2] || "eth"),
        })
      }
    }
  }

  if (tokens.length === 0) {
    return Response.json({ prices: {}, cached: false })
  }

  // Cache key
  const cacheKey = tokens.map(t => `${t.ticker}:${t.network}:${t.address}`).sort().join("|")
  if (cache && Date.now() - cache.ts < TTL && cache.key === cacheKey) {
    return Response.json({ prices: cache.data, cached: true })
  }

  const prices: Record<string, PriceResult> = {}

  try {
    // ── Step 1: Group by network ────────────────────────────────
    const byNet: Record<string, typeof tokens> = {}
    for (const t of tokens) {
      if (!byNet[t.network]) byNet[t.network] = []
      byNet[t.network].push(t)
    }

    // ── Step 2: Batch simple price per network ──────────────────
    // GeckoTerminal allows up to 30 addresses per call
    const simplePromises: Promise<void>[] = []

    // GeckoTerminal allows ~30 addresses per simple price call but some
    // chains have issues with large batches. Chunk into groups of 8 max.
    const CHUNK = 8

    for (const [netId, netTokens] of Object.entries(byNet)) {
      const caseSensitive = netId === "solana" || netId === "tron"

      for (let ci = 0; ci < netTokens.length; ci += CHUNK) {
        const chunk = netTokens.slice(ci, ci + CHUNK)
        simplePromises.push((async () => {
          try {
            const addrs = chunk.map(t => caseSensitive ? t.address : t.address.toLowerCase()).join(",")
            const res = await fetch(
              `${GECKO_BASE}/simple/networks/${netId}/token_price/${addrs}`,
              { headers: { Accept: "application/json;version=20230203" }, next: { revalidate: 60 } }
            )
            if (!res.ok) throw new Error(`${res.status}`)
          const json = await res.json()
          const priceMap: Record<string, string> = json?.data?.attributes?.token_prices ?? {}

          for (const t of chunk) {
            const raw = priceMap[t.address] ?? priceMap[t.address.toLowerCase()]
            const num = raw ? parseFloat(raw) : 0
              prices[t.ticker] = {
                ticker: t.ticker, address: t.address, network: netId,
                price: num > 0 ? fmtPrice(num) : "N/A",
                priceNum: num,
              }
            }
          } catch {
            for (const t of chunk) {
              if (!prices[t.ticker]) {
                prices[t.ticker] = { ticker: t.ticker, address: t.address, network: netId, price: "N/A", priceNum: 0 }
              }
            }
          }
        })())
      }
    }

    // Run simple price fetches in parallel (max ~3 concurrent)
    await Promise.all(simplePromises)

    // ── Step 3: Enrich with pool data ───────────────────────────
    // Only fetch pool data for tokens that need it:
    // - All tokens get change24h / volume / mcap from pools
    // - N/A tokens get price fallback from pool data
    // Process max 4 at a time to respect GeckoTerminal 30 req/min limit
    const allTickers = Object.keys(prices)
    const POOL_BATCH = 4
    for (let i = 0; i < allTickers.length; i += POOL_BATCH) {
      const batch = allTickers.slice(i, i + POOL_BATCH)
      await Promise.all(batch.map(async (ticker) => {
        const d = prices[ticker]
        try {
          const caseSensitive = d.network === "solana" || d.network === "tron"
          const addrForUrl = caseSensitive ? d.address : d.address.toLowerCase()
          const res = await fetch(
            `${GECKO_BASE}/networks/${d.network}/tokens/${addrForUrl}/pools?page=1`,
            { headers: { Accept: "application/json;version=20230203" }, next: { revalidate: 60 } }
          )
          if (!res.ok) return
          const json = await res.json()
          const pool = json?.data?.[0]
          const attr = pool?.attributes
          if (!attr) return

          // Extract 24h data
          const change = attr.price_change_percentage?.h24
          const vol = attr.volume_usd?.h24
          const mcap = attr.market_cap_usd ?? attr.fdv_usd

          // Price fallback from pool if simple endpoint failed
          let price = d.price
          let priceNum = d.priceNum
          if (priceNum === 0 || price === "N/A") {
            // Determine which side of the pool our token is on
            const baseId = pool?.relationships?.base_token?.data?.id || ""
            const quoteId = pool?.relationships?.quote_token?.data?.id || ""

            const isBase = baseId.includes(d.address) || baseId.toLowerCase().includes(d.address.toLowerCase())
            const isQuote = quoteId.includes(d.address) || quoteId.toLowerCase().includes(d.address.toLowerCase())

            let pp = 0
            if (isBase) pp = parseFloat(attr.base_token_price_usd || "0")
            else if (isQuote) pp = parseFloat(attr.quote_token_price_usd || "0")
            else pp = parseFloat(attr.base_token_price_usd || "0") || parseFloat(attr.quote_token_price_usd || "0")

            if (pp > 0) { priceNum = pp; price = fmtPrice(pp) }
          }

          prices[ticker] = {
            ...d, price, priceNum,
            change24h: change != null ? `${parseFloat(change) >= 0 ? "+" : ""}${parseFloat(change).toFixed(2)}%` : undefined,
            volume24h: vol ? `$${fmtCompact(parseFloat(vol))}` : undefined,
            marketCap: mcap ? `$${fmtCompact(parseFloat(mcap))}` : undefined,
          }
        } catch { /* non-critical */ }
      }))

      // Delay between pool batches to stay within rate limits
      if (i + POOL_BATCH < allTickers.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    cache = { data: prices, ts: Date.now(), key: cacheKey }
    return Response.json({ prices, cached: false })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (cache) return Response.json({ prices: cache.data, cached: true, stale: true })
    return Response.json({ error: msg, prices: {} }, { status: 500 })
  }
}

function fmtPrice(n: number): string {
  if (n < 0.0001) return `$${n.toFixed(8)}`
  if (n < 0.01) return `$${n.toFixed(6)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function fmtCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M"
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K"
  return n.toFixed(2)
}
