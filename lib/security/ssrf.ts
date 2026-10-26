const ALLOWED_EXTERNAL_ORIGINS = new Set([
  "https://api.geckoterminal.com",
  "https://api.coingecko.com",
])

export function safeExternalUrl(rawUrl: string, expectedOrigin: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== "https:") return null
    if (url.origin !== expectedOrigin) return null
    if (!ALLOWED_EXTERNAL_ORIGINS.has(url.origin)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function safeRpcUrl(rawUrl: string, allowedOrigins: readonly string[]): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== "https:") return null
    return allowedOrigins.includes(url.origin) ? url.toString() : null
  } catch {
    return null
  }
}
