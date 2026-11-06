// Runs Slither on GitHub Actions in a PRIVATE runner repository (see slither-worker/README.md).
// Server-only. Flow: workflow_dispatch -> poll run -> download artifact -> delete artifact + run.
//
// Env:
//   SLITHER_GITHUB_TOKEN   fine-grained PAT, only the runner repo, permission "Actions: Read and write"
//   SLITHER_GITHUB_REPO    e.g. solay39/solay39-slither-runner
//   SLITHER_GITHUB_REF     optional, default "main"
//   SLITHER_GITHUB_KEEP_RUNS=1  optional, keep runs/artifacts (debug only: they contain the source)
//   SLITHER_GITHUB_API_URL      optional, default https://api.github.com

import { gzipSync } from "node:zlib"
import { randomUUID } from "node:crypto"
import { unzipSync, strFromU8 } from "fflate"
import type { SlitherRequest, SlitherRunResult } from "./slither-client"

const API = () => (process.env.SLITHER_GITHUB_API_URL?.trim() || "https://api.github.com").replace(/\/+$/, "")
const WORKFLOW = "analyze.yml"
const MAX_PAYLOAD_CHARS = 60_000 // GitHub limit for all workflow_dispatch inputs is 65,535

export function slitherGitHubConfigured(): boolean {
  return Boolean(process.env.SLITHER_GITHUB_TOKEN?.trim() && /^[\w.-]+\/[\w.-]+$/.test(process.env.SLITHER_GITHUB_REPO?.trim() ?? ""))
}

function gh(path: string, init: RequestInit = {}): Promise<Response> {
  if (path.startsWith("https://api.github.com/")) path = API() + path.slice("https://api.github.com".length)
  return fetch(path.startsWith("http") ? path : `${API()}/repos/${process.env.SLITHER_GITHUB_REPO!.trim()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.SLITHER_GITHUB_TOKEN!.trim()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })
}

const fail = (status: SlitherRunResult["status"], error: string, extra: Partial<SlitherRunResult> = {}): SlitherRunResult => ({
  tool: "slither", status, findings: [], error, runner: "github-actions", ...extra,
})

export function encodeSlitherPayload(req: SlitherRequest): string {
  return gzipSync(Buffer.from(JSON.stringify(req)), { level: 9 }).toString("base64")
}

export function readResultZip(zip: Uint8Array): SlitherRunResult {
  const files = unzipSync(zip)
  const entry = files["result.json"]
  if (!entry) throw new Error("result.json missing from artifact")
  return JSON.parse(strFromU8(entry)) as SlitherRunResult
}

async function cleanup(runId: number, artifactId?: number) {
  if (process.env.SLITHER_GITHUB_KEEP_RUNS === "1") return
  if (artifactId) await gh(`/actions/artifacts/${artifactId}`, { method: "DELETE" }).catch(() => {})
  // Deleting the run also removes its inputs (the encoded source) from GitHub.
  for (let i = 0; i < 3; i++) {
    const r = await gh(`/actions/runs/${runId}`, { method: "DELETE" }).catch(() => null)
    if (!r || r.status === 204 || r.status === 404) return
    await new Promise((res) => setTimeout(res, 1500))
  }
}

/** Never throws: failures come back as a non-"ok" status. */
export async function runSlitherOnGitHub(req: SlitherRequest, timeoutMs = 240_000): Promise<SlitherRunResult> {
  if (!slitherGitHubConfigured()) return fail("unavailable", "SLITHER_GITHUB_TOKEN / SLITHER_GITHUB_REPO not configured")
  const deadline = Date.now() + timeoutMs
  const payload = encodeSlitherPayload(req)
  if (payload.length > MAX_PAYLOAD_CHARS) {
    return fail("error", `Source too large for the GitHub runner (${payload.length} > ${MAX_PAYLOAD_CHARS} chars compressed)`)
  }
  const jobId = randomUUID()
  let runId: number | undefined
  let runUrl: string | undefined
  try {
    const dispatch = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      body: JSON.stringify({
        ref: process.env.SLITHER_GITHUB_REF?.trim() || "main",
        inputs: { job_id: jobId, payload },
        return_run_details: true,
      }),
    })
    if (dispatch.status !== 200) {
      const text = await dispatch.text().catch(() => "")
      return fail("error", `GitHub dispatch HTTP ${dispatch.status}: ${text.slice(0, 200)}`)
    }
    const details = (await dispatch.json()) as { workflow_run_id: number; html_url: string }
    runId = details.workflow_run_id
    runUrl = details.html_url

    // Poll the run.
    let conclusion: string | null = null
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 3000))
      const r = await gh(`/actions/runs/${runId}`)
      if (!r.ok) continue
      const run = (await r.json()) as { status: string; conclusion: string | null }
      if (run.status === "completed") { conclusion = run.conclusion; break }
    }
    if (conclusion === null) {
      await gh(`/actions/runs/${runId}/cancel`, { method: "POST" }).catch(() => {})
      return fail("timeout", `GitHub run did not finish within ${Math.round(timeoutMs / 1000)}s`, { runUrl })
    }
    if (conclusion !== "success") {
      return fail("error", `GitHub run ${conclusion}`, { runUrl })
    }

    const list = await gh(`/actions/runs/${runId}/artifacts?name=slither-result`)
    const artifact = ((await list.json()) as { artifacts?: { id: number; archive_download_url: string }[] }).artifacts?.[0]
    if (!artifact) return fail("error", "Result artifact not found", { runUrl })
    // GitHub answers 302 to a signed storage URL: follow it WITHOUT the GitHub token.
    let zip = await gh(artifact.archive_download_url, { redirect: "manual" })
    const location = zip.headers.get("location")
    if (zip.status >= 300 && zip.status < 400 && location) zip = await fetch(location, { cache: "no-store" })
    if (!zip.ok) return fail("error", `Artifact download HTTP ${zip.status}`, { runUrl })
    const result = readResultZip(new Uint8Array(await zip.arrayBuffer()))
    await cleanup(runId, artifact.id)
    runId = undefined
    return { ...result, findings: result.findings ?? [], runner: "github-actions", runUrl }
  } catch (err) {
    return fail("error", err instanceof Error ? err.message : String(err), { runUrl })
  } finally {
    if (runId) await cleanup(runId)
  }
}

export async function slitherGitHubHealth(): Promise<{ online: boolean; error?: string }> {
  if (!slitherGitHubConfigured()) return { online: false, error: "not configured" }
  try {
    const r = await gh(`/actions/workflows/${WORKFLOW}`)
    if (!r.ok) return { online: false, error: `GitHub HTTP ${r.status}` }
    const wf = (await r.json()) as { state: string }
    return { online: wf.state === "active", error: wf.state === "active" ? undefined : `workflow ${wf.state}` }
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : String(err) }
  }
}
