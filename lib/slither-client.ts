// Client for the Solay39 Slither worker (slither-worker/).
// Server-only: never import from client components.
//
// Two runners, same result shape:
//   1. HTTP worker (Docker):  SLITHER_WORKER_URL + SLITHER_WORKER_API_KEY
//   2. GitHub Actions (free): SLITHER_GITHUB_TOKEN + SLITHER_GITHUB_REPO  -> lib/slither-github.ts
// The HTTP worker wins when both are configured.

import { runSlitherOnGitHub, slitherGitHubConfigured, slitherGitHubHealth } from "./slither-github"

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
  runner?: "http-worker" | "github-actions"
  /** GitHub Actions run (deleted after the result is read unless SLITHER_GITHUB_KEEP_RUNS=1). */
  runUrl?: string
}

export interface SlitherRequest {
  code?: string
  sources?: Record<string, string>
  contractName?: string
  solcVersion?: string
  excludeInformational?: boolean
}

function httpWorkerConfigured(): boolean {
  return Boolean(process.env.SLITHER_WORKER_URL?.trim() && process.env.SLITHER_WORKER_API_KEY?.trim())
}

/** True when any Slither runner (HTTP worker or GitHub Actions) is configured. */
export function slitherWorkerConfigured(): boolean {
  return httpWorkerConfigured() || slitherGitHubConfigured()
}

export function slitherRunnerKind(): "http-worker" | "github-actions" | null {
  return httpWorkerConfigured() ? "http-worker" : slitherGitHubConfigured() ? "github-actions" : null
}

function workerUrl(path: string): string {
  const base = process.env.SLITHER_WORKER_URL!.trim().replace(/\/+$/, "")
  return `${/^https?:\/\//i.test(base) ? base : `https://${base}`}${path}`
}

/** Runs Slither on the worker. Never throws: failures come back as a non-"ok" status. */
export async function runSlither(req: SlitherRequest, timeoutMs?: number): Promise<SlitherRunResult> {
  if (!req.code && !req.sources) {
    return { tool: "slither", status: "error", findings: [], error: "No source code" }
  }
  if (!httpWorkerConfigured()) {
    if (slitherGitHubConfigured()) return runSlitherOnGitHub(req, timeoutMs ?? 240_000)
    return { tool: "slither", status: "unavailable", findings: [], error: "No Slither runner configured (SLITHER_WORKER_URL or SLITHER_GITHUB_REPO)" }
  }
  timeoutMs ??= 150_000
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
    return { ...body, findings: body.findings ?? [], runner: "http-worker" }
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
  if (!httpWorkerConfigured()) return slitherGitHubHealth()
  try {
    const res = await fetch(workerUrl("/health"), { signal: AbortSignal.timeout(8000), cache: "no-store" })
    const body = await res.json()
    return { online: Boolean(res.ok && body.ok), slitherVersion: body.slitherVersion, detectors: body.detectors }
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : String(err) }
  }
}
