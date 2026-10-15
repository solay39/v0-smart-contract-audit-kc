// Single source of truth for the Slither/Mythril/Foundry backend URL.
// The env value has been seen stored as "STATIC_ANALYSIS_API_URL=https://..."
// (name pasted into the value), so the prefix is stripped defensively.

export function getStaticBackendUrl(): string | null {
  const raw = process.env.STATIC_ANALYSIS_API_URL?.trim()
  if (!raw) return null
  let url = raw.replace(/^STATIC_ANALYSIS_API_URL\s*=?\s*/i, "").replace(/^["']|["']$/g, "").replace(/\/+$/, "")
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  // The Railway deployment was shut down (free plan expired); ignoring it avoids
  // multi-second timeouts on every audit and keeps the pattern-based fallback.
  if (/railway\.app/i.test(url)) return null
  return url
}

export function staticBackendHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.STATIC_ANALYSIS_API_KEY || ""}`,
  }
}

export interface StaticBackendHealth {
  configured: boolean
  online: boolean
  tools: Record<string, { available: boolean; version: string }>
  error?: string
}

let healthCache: { at: number; value: StaticBackendHealth } | null = null

export async function checkStaticBackendHealth(timeoutMs = 8000): Promise<StaticBackendHealth> {
  if (healthCache && Date.now() - healthCache.at < 60_000) return healthCache.value
  const url = getStaticBackendUrl()
  let value: StaticBackendHealth
  if (!url) {
    value = { configured: false, online: false, tools: {}, error: "STATIC_ANALYSIS_API_URL not set" }
  } else {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" })
      const body = await res.json().catch(() => null)
      value = res.ok && body?.status === "ok"
        ? { configured: true, online: true, tools: body.tools ?? {} }
        : { configured: true, online: false, tools: {}, error: body?.message || `HTTP ${res.status}` }
    } catch (err) {
      value = { configured: true, online: false, tools: {}, error: err instanceof Error ? err.message : String(err) }
    }
  }
  healthCache = { at: Date.now(), value }
  return value
}
