import { gzipSync, unzipSync, strFromU8, strToU8 } from "fflate"

// Runs real Slither + Mythril on GitHub Actions (same toolchain as the repo CI),
// replacing the paid container backend. The app dispatches a workflow, then polls
// the run and reads the uploaded artifact.

const WORKFLOW_FILE = "static-analysis-dispatch.yml"
const MAX_INPUT_CHARS = 60_000
export const JOB_ID_PATTERN = /^[a-f0-9-]{36}$/

function repo(): string {
  return (process.env.GITHUB_ANALYSIS_REPO || "solay39/v0-smart-contract-audit-kc").trim()
}

function ref(): string {
  return (process.env.GITHUB_ANALYSIS_REF || "main").trim()
}

function token(): string | null {
  const raw = process.env.GITHUB_TOKEN?.trim()
  if (!raw) return null
  return raw.replace(/^GITHUB_TOKEN\s*=?\s*/i, "").replace(/^["']|["']$/g, "") || null
}

export function isGithubAnalysisConfigured(): boolean {
  return token() !== null
}

async function gh(path: string, init?: RequestInit): Promise<Response> {
  const t = token()
  if (!t) throw new GithubAnalysisError("GITHUB_TOKEN non configurato", 500)
  return fetch(`https://api.github.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${t}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
  })
}

export class GithubAnalysisError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function explain(status: number, body: string): string {
  if (status === 401) return "GITHUB_TOKEN non valido o scaduto (401 Bad credentials). Rigenera il token."
  if (status === 403) return "GITHUB_TOKEN senza permesso Actions: Read and write su questo repository."
  if (status === 404) return `Workflow ${WORKFLOW_FILE} non trovato sul branch ${ref()}. Unisci il branch su main.`
  if (status === 422) return `Dispatch rifiutato da GitHub: ${body.slice(0, 200)}`
  return `GitHub API ${status}: ${body.slice(0, 200)}`
}

export async function dispatchStaticAnalysis(code: string, contractName: string): Promise<string> {
  const encoded = Buffer.from(gzipSync(strToU8(code), { level: 9 })).toString("base64")
  if (encoded.length > MAX_INPUT_CHARS) {
    throw new GithubAnalysisError("Contratto troppo grande per l'esecuzione su GitHub Actions (max ~60KB compresso).", 413)
  }
  const jobId = crypto.randomUUID()
  const res = await gh(`/repos/${repo()}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: ref(),
      inputs: {
        job_id: jobId,
        contract_name: contractName.replace(/[^\w.-]/g, "").slice(0, 64) || "Contract",
        source_gz_b64: encoded,
      },
    }),
  })
  if (!res.ok) throw new GithubAnalysisError(explain(res.status, await res.text()), res.status)
  return jobId
}

export interface CiSlitherFinding {
  check: string
  impact: string
  confidence: string
  description: string
  elements: Array<{ type: string; name: string; filename: string; lines: number[] }>
}

export interface CiMythrilFinding {
  swc_id: string
  swc_title: string
  severity: string
  description: string
  contract: string
  function: string
  lineno: number
  code: string
}

export interface CiAnalysisResult {
  slither: { tool: "slither"; version: string; success: boolean; findings: CiSlitherFinding[]; detectors_run: number; error: string | null }
  mythril: { tool: "mythril"; version: string; success: boolean; findings: CiMythrilFinding[]; error: string | null }
  solcVersion: string | null
}

export type CiJobStatus =
  | { state: "queued"; jobId: string }
  | { state: "running"; jobId: string; runUrl: string; startedAt: string }
  | { state: "failed"; jobId: string; runUrl: string; error: string }
  | { state: "completed"; jobId: string; runUrl: string; result: CiAnalysisResult }

interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
  run_started_at: string
}

function safeJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function firstLine(text: string | undefined): string {
  return (text || "").split("\n").map((l) => l.trim()).find(Boolean) || "unknown"
}

function parseArtifact(files: Record<string, Uint8Array>): CiAnalysisResult {
  const read = (name: string) => {
    const key = Object.keys(files).find((k) => k === name || k.endsWith(`/${name}`))
    return key ? strFromU8(files[key]) : undefined
  }

  type RawSlither = {
    success?: boolean
    error?: string | null
    results?: { detectors?: Array<{
      check: string
      impact: string
      confidence: string
      description: string
      elements?: Array<{ type: string; name: string; source_mapping?: { filename_relative?: string; lines?: number[] } }>
    }> }
  }
  const slitherRaw = safeJson<RawSlither>(read("slither.json"), { success: false, error: "missing report" })
  const slitherLog = read("slither.log") || ""
  const detectorsRun = Number(slitherLog.match(/with (\d+) detectors/)?.[1] || 0)
  const slitherFindings: CiSlitherFinding[] = (slitherRaw.results?.detectors || []).map((d) => ({
    check: d.check,
    impact: d.impact,
    confidence: d.confidence,
    description: d.description?.trim() || "",
    elements: (d.elements || []).map((e) => ({
      type: e.type,
      name: e.name,
      filename: e.source_mapping?.filename_relative || "Contract.sol",
      lines: e.source_mapping?.lines || [],
    })),
  }))
  const slitherOk = slitherRaw.success !== false || slitherFindings.length > 0

  type RawMythril = {
    success?: boolean
    error?: string | null
    issues?: Array<{
      "swc-id"?: string
      title?: string
      severity?: string
      description?: string
      contract?: string
      function?: string
      lineno?: number
      code?: string
    }>
  }
  const mythrilRaw = safeJson<RawMythril>(read("mythril.json"), { success: false, error: "missing report" })
  const mythrilFindings: CiMythrilFinding[] = (mythrilRaw.issues || []).map((i) => ({
    swc_id: i["swc-id"] ? `SWC-${i["swc-id"]}` : "SWC-000",
    swc_title: i.title || "Unknown",
    severity: i.severity || "Medium",
    description: i.description || "",
    contract: i.contract || "",
    function: i.function || "",
    lineno: i.lineno || 0,
    code: i.code || "",
  }))

  const slitherError = slitherOk ? null : slitherRaw.error || firstLine(slitherLog.split("\n").slice(-5).join("\n"))
  const mythrilError = mythrilRaw.success === false ? mythrilRaw.error || firstLine(read("mythril.log")) : null

  return {
    slither: {
      tool: "slither",
      version: firstLine(read("slither-version.txt")),
      success: slitherOk,
      findings: slitherFindings,
      detectors_run: detectorsRun,
      error: slitherError,
    },
    mythril: {
      tool: "mythril",
      version: firstLine(read("mythril-version.txt")).replace(/^Mythril version\s*/i, ""),
      success: mythrilRaw.success !== false,
      findings: mythrilFindings,
      error: mythrilError,
    },
    solcVersion: safeJson<{ solc?: string }>(read("meta.json"), {}).solc || null,
  }
}

export async function getStaticAnalysisJob(jobId: string): Promise<CiJobStatus> {
  const runsRes = await gh(`/repos/${repo()}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=50`)
  if (!runsRes.ok) throw new GithubAnalysisError(explain(runsRes.status, await runsRes.text()), runsRes.status)
  const { workflow_runs = [] } = (await runsRes.json()) as { workflow_runs?: WorkflowRun[] }
  const run = workflow_runs.find((r) => r.name === `static-analysis ${jobId}`)

  if (!run) return { state: "queued", jobId }
  if (run.status !== "completed") {
    return { state: "running", jobId, runUrl: run.html_url, startedAt: run.run_started_at }
  }

  const artRes = await gh(`/repos/${repo()}/actions/runs/${run.id}/artifacts`)
  if (!artRes.ok) throw new GithubAnalysisError(explain(artRes.status, await artRes.text()), artRes.status)
  const { artifacts = [] } = (await artRes.json()) as { artifacts?: Array<{ name: string; archive_download_url: string; expired: boolean }> }
  const artifact = artifacts.find((a) => a.name === `static-analysis-${jobId}` && !a.expired)

  if (!artifact) {
    return { state: "failed", jobId, runUrl: run.html_url, error: `Run ${run.conclusion ?? "terminato"} senza report.` }
  }

  // GitHub redirects to signed blob storage; fetch drops Authorization on the cross-origin hop.
  const zipRes = await gh(new URL(artifact.archive_download_url).pathname)
  if (!zipRes.ok) throw new GithubAnalysisError(explain(zipRes.status, await zipRes.text()), zipRes.status)
  const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()))
  return { state: "completed", jobId, runUrl: run.html_url, result: parseArtifact(files) }
}
