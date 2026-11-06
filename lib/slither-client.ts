// Client for the Solay39 Slither worker (slither-worker/).
// Server-only: never import from client components.
//
// Env:
//   SLITHER_WORKER_URL       e.g. https://solay39-slither.fly.dev
//   SLITHER_WORKER_API_KEY   shared secret, same value as on the worker

export type SlitherImpact = "High" | "Medium" | "Low" | "Informational" | "Optimization"
export type SlitherConfidence = "High" | "Medium" | "Low"

export interface SlitherWorkerFinding {
  id: string
  check: string
  impact: SlitherImpact
  confidence: SlitherConfidence
  title: string
  description: string
  markdown?: string
  recommendation?: string | null
  wikiUrl?: string | null
  file: string
  contract?: string | null
  function?: string | null
  lines: number[]
  startLine: number | null
  endLine: number | null
  snippet: string
}

export type SlitherRunStatus = "ok" | "compile_error" | "timeout" | "error" | "unavailable"

export interface SlitherRunResult {
  tool: "slither"
  status: SlitherRunStatus
  slitherVersion?: string
  solcVersion?: string
  sourceSha256?: string
  files?: string[]
  remappings?: string[]
  detectorsRun?: number
  durationMs?: number
  findings: SlitherWorkerFinding[]
  error?: string
}

export interface SlitherRequest {
  code?: string
  sources?: Record<string, string>
  contractName?: string
  solcVersion?: string
  excludeInformational?: boolean
}

export function slitherWorkerConfigured(): boolean {
  return Boolean(process.env.SLITHER_WORKER_URL?.trim() && process.env.SLITHER_WORKER_API_KEY?.trim())
}

function workerUrl(path: string): string {
  const base = process.env.SLITHER_WORKER_URL!.trim().replace(/\/+$/, "")
  return `${/^https?:\/\//i.test(base) ? base : `https://${base}`}${path}`
}

/** Runs Slither on the worker. Never throws: failures come back as a non-"ok" status. */
export async function runSlither(req: SlitherRequest, timeoutMs = 150_000): Promise<SlitherRunResult> {
  if (!slitherWorkerConfigured()) {
    return { tool: "slither", status: "unavailable", findings: [], error: "SLITHER_WORKER_URL / SLITHER_WORKER_API_KEY not configured" }
  }
  if (!req.code && !req.sources) {
    return { tool: "slither", status: "error", findings: [], error: "No source code" }
  }
  try {
    const res = await fetch(workerUrl("/v1/analyze"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.SLITHER_WORKER_API_KEY!.trim() },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })
    const body = (await res.json().catch(() => null)) as (SlitherRunResult & { detail?: string }) | null
    if (!res.ok || !body) {
      return { tool: "slither", status: "error", findings: [], error: body?.detail || `Worker HTTP ${res.status}` }
    }
    return { ...body, findings: body.findings ?? [] }
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")
    return {
      tool: "slither",
      status: timeout ? "timeout" : "error",
      findings: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function slitherWorkerHealth(): Promise<{ online: boolean; slitherVersion?: string; detectors?: number; error?: string }> {
  if (!slitherWorkerConfigured()) return { online: false, error: "not configured" }
  try {
    const res = await fetch(workerUrl("/health"), { signal: AbortSignal.timeout(8000), cache: "no-store" })
    const body = await res.json()
    return { online: Boolean(res.ok && body.ok), slitherVersion: body.slitherVersion, detectors: body.detectors }
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : String(err) }
  }
}
