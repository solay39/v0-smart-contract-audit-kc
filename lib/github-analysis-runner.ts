import { gzipSync, unzipSync, strFromU8, strToU8 } from "fflate"
import { createHash } from "node:crypto"

// Runs real Slither + Mythril on GitHub Actions (same toolchain as the repo CI),
// replacing the paid container backend. The app dispatches a workflow, then polls
// the run and reads the uploaded artifact.

const WORKFLOW_FILE = "static-analysis-dispatch.yml"
const MAX_INPUT_CHARS = 60_000
const MAX_SOURCE_BYTES = 2 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 32 * 1024 * 1024
export const JOB_ID_PATTERN = /^[a-f0-9-]{36}$/

function repo(): string {
  return (process.env.GITHUB_ANALYSIS_REPO || "solay39/v0-smart-contract-audit-kc").trim()
}

function ref(): string {
  return (process.env.GITHUB_ANALYSIS_REF || "main").trim()
}

function token(): string | null {
  const raw = (process.env.GITHUB_FINE_GRAINED_PAT || process.env.GITHUB_TOKEN)?.trim()
  if (!raw) return null
  return raw.replace(/^(GITHUB_FINE_GRAINED_PAT|GITHUB_TOKEN)\s*=?\s*/i, "").replace(/^["']|["']$/g, "") || null
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
    signal: init?.signal || AbortSignal.timeout(20_000),
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
  if (status === 401) return "GITHUB_FINE_GRAINED_PAT non valido o scaduto (401 Bad credentials). Rigenera il token."
  if (status === 403) return "GITHUB_FINE_GRAINED_PAT senza permesso Actions: Read and write su questo repository."
  if (status === 404) return `Workflow ${WORKFLOW_FILE} non trovato sul branch ${ref()}. Unisci il branch su main.`
  if (status === 422) return `Dispatch rifiutato da GitHub: ${body.slice(0, 200)}`
  return `GitHub API ${status}: ${body.slice(0, 200)}`
}

export async function dispatchStaticAnalysis(code: string, contractName: string, allowPublicSource = false): Promise<string> {
  if (Buffer.byteLength(code, "utf8") > MAX_SOURCE_BYTES) {
    throw new GithubAnalysisError("Il sorgente supera 2 MiB.", 413)
  }
  const encoded = Buffer.from(gzipSync(strToU8(code), { level: 9 })).toString("base64")
  if (encoded.length > MAX_INPUT_CHARS) {
    throw new GithubAnalysisError("Contratto troppo grande per l'esecuzione su GitHub Actions (max ~60KB compresso).", 413)
  }
  const repository = await gh(`/repos/${repo()}`)
  if (!repository.ok) throw new GithubAnalysisError(explain(repository.status, await repository.text()), repository.status)
  const metadata = await repository.json() as { private?: boolean }
  if (typeof metadata.private !== "boolean") throw new GithubAnalysisError("Impossibile verificare la visibilità del repository.", 502)
  if (!metadata.private && !allowPublicSource) {
    throw new GithubAnalysisError("Il repository GitHub è pubblico: conferma esplicitamente la condivisione del sorgente prima dell'analisi.", 409)
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

export interface CiCustomFinding {
  id: string
  check: string
  severity: string
  title: string
  file: string
  line: number
  trace: string[]
  proof_of_concept: string
  reproducible: boolean
  recommendation: string
}

export interface CiAnalysisResult {
  slither: { tool: "slither"; version: string; success: boolean; findings: CiSlitherFinding[]; detectors_run: number; error: string | null }
  mythril: { tool: "mythril"; version: string; success: boolean; findings: CiMythrilFinding[]; error: string | null }
  custom: { tool: "solay39-custom-regression"; version: string; success: boolean; checks: Record<string, boolean>; findings: CiCustomFinding[]; error: string | null }
  foundry: { tool: "foundry"; success: boolean; mode: string; invariants: number; tests_executed?: boolean; fuzzing_executed?: boolean; error: string | null }
  evidenceManifest: {
    source_sha256: string; artifacts: Record<string, string>; schema_version?: number
    github?: { repository?: string; run_id?: string; workflow_sha?: string; run_attempt?: string }
  } | null
  solcVersion: string | null
}

export type CiJobStatus =
  | { state: "queued"; jobId: string }
  | { state: "running"; jobId: string; runUrl: string; startedAt: string }
  | { state: "failed"; jobId: string; runUrl: string; error: string }
  | { state: "completed"; jobId: string; runUrl: string; result: CiAnalysisResult }
export type CiCompletedJob = Extract<CiJobStatus, { state: "completed" }>

interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
  run_started_at: string
  head_sha: string
  run_attempt: number
}

function safeJson<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback
  try {
    const data = JSON.parse(text)
    return data && typeof data === "object" && !Array.isArray(data) ? data as T : fallback
  } catch {
    return fallback
  }
}

function firstLine(text: string | undefined): string {
  return (text || "").split("\n").map((l) => l.trim()).find(Boolean) || "unknown"
}

export function parseArtifact(files: Record<string, Uint8Array>): CiAnalysisResult {
  const read = (name: string) => {
    return files[name] ? strFromU8(files[name]) : undefined
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
  const detectors = slitherRaw.results?.detectors
  const slitherFindings: CiSlitherFinding[] = (Array.isArray(detectors) ? detectors : []).filter(d => d && typeof d === "object").map((d) => ({
    check: d.check,
    impact: d.impact,
    confidence: d.confidence,
    description: typeof d.description === "string" ? d.description.trim() : "",
    elements: (Array.isArray(d.elements) ? d.elements : []).filter(e => e && typeof e === "object").map((e) => ({
      type: e.type,
      name: e.name,
      filename: e.source_mapping?.filename_relative || "Contract.sol",
      lines: Array.isArray(e.source_mapping?.lines) ? e.source_mapping.lines.filter(Number.isInteger) : [],
    })),
  }))
  const slitherOk = slitherRaw.success === true && !!slitherRaw.results &&
    typeof slitherRaw.results === "object" && !Array.isArray(slitherRaw.results) &&
    (detectors === undefined || Array.isArray(detectors) && detectors.every(d =>
      d && ["check", "impact", "confidence", "description"].every(key => typeof d[key as keyof typeof d] === "string") &&
      (d.elements === undefined || Array.isArray(d.elements))))

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
  const mythrilOk = mythrilRaw.success === true && Array.isArray(mythrilRaw.issues) &&
    mythrilRaw.issues.every(issue => issue && typeof issue.title === "string" &&
      typeof issue.severity === "string" && typeof issue.description === "string")
  const mythrilFindings: CiMythrilFinding[] = (Array.isArray(mythrilRaw.issues) ? mythrilRaw.issues : []).filter(i => i && typeof i === "object").map((i) => ({
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
  const mythrilError = !mythrilOk ? mythrilRaw.error || firstLine(read("mythril.log")) : null

  const customRaw = safeJson<{ success?: boolean; tool?: string; version?: string; checks?: Record<string, boolean>; findings?: CiCustomFinding[]; error?: string }>(read("custom.json"), { success: false, error: "custom_report_unavailable" })
  const foundryRaw = safeJson<{ success?: boolean; tool?: string; mode?: string; invariants?: number; tests_executed?: boolean; fuzzing_executed?: boolean; error?: string }>(read("foundry.json"), { success: false, error: "foundry_report_unavailable" })
  const evidenceManifest = safeJson<NonNullable<CiAnalysisResult["evidenceManifest"]> | null>(read("evidence-manifest.json"), null)
  const customOk = customRaw.success === true && Array.isArray(customRaw.findings)
  // This adapter supports compilation only. Unsupported execution claims fail closed.
  const foundryOk = foundryRaw.success === true && foundryRaw.mode === "submitted-contract-compilation" &&
    foundryRaw.tests_executed === false && foundryRaw.fuzzing_executed === false &&
    (foundryRaw.invariants === undefined || foundryRaw.invariants === 0)

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
      success: mythrilOk,
      findings: mythrilFindings,
      error: mythrilError,
    },
    custom: {
      tool: "solay39-custom-regression",
      version: customRaw.version || "unknown",
      success: customOk,
      checks: customRaw.checks || {},
      findings: Array.isArray(customRaw.findings) ? customRaw.findings.filter(f => f && typeof f === "object") : [],
      error: customOk ? null : customRaw.error || "custom regression failed or malformed",
    },
    foundry: {
      tool: "foundry",
      success: foundryOk,
      mode: foundryRaw.mode || "not-run",
      invariants: 0,
      tests_executed: false,
      fuzzing_executed: false,
      error: foundryOk ? null : foundryRaw.error || "foundry compilation failed or unsupported execution claim",
    },
    evidenceManifest: evidenceManifest?.source_sha256 ? {
      source_sha256: evidenceManifest.source_sha256, artifacts: evidenceManifest.artifacts || {},
      schema_version: evidenceManifest.schema_version, github: evidenceManifest.github,
    } : null,
    solcVersion: safeJson<{ solc?: string }>(read("meta.json"), {}).solc || null,
  }
}

export function verifyCiArtifact(files: Record<string, Uint8Array>, jobId: string,
  expected?: { runId: number; headSha: string; runAttempt: number; repository: string }): void {
  type Manifest = NonNullable<CiAnalysisResult["evidenceManifest"]> & {
    job_id?: string; claims?: Record<string, boolean>; tools?: Record<string, { status?: string }>
  }
  const raw = files["evidence-manifest.json"]
  const manifest = raw ? safeJson<Partial<Manifest>>(strFromU8(raw), {}) : {}
  if (manifest.job_id !== jobId || !/^[a-f0-9]{64}$/.test(manifest.source_sha256 || "") ||
    !manifest.artifacts || typeof manifest.artifacts !== "object" || Array.isArray(manifest.artifacts) ||
    Object.keys(manifest.artifacts).length === 0) {
    throw new GithubAnalysisError("CI evidence manifest missing or not bound to this job.", 422)
  }
  if (manifest.schema_version !== 2) throw new GithubAnalysisError("Legacy CI evidence is incomplete. Rerun analysis to obtain source-bound v2 evidence.", 422)
  const required = ["source.sol", "source-layout.json", "meta.json", "slither.json", "mythril.json",
    "custom.json", "foundry.json", "slither-version.txt", "mythril-version.txt", "foundry-version.txt", "pip-freeze.txt", "mythril-pip-freeze.txt"]
  if (required.some(name => !manifest.artifacts?.[name])) throw new GithubAnalysisError("CI evidence is missing a required artifact hash.", 422)
  if (Object.keys(files).some(name => name !== "evidence-manifest.json" &&
    !Object.prototype.hasOwnProperty.call(manifest.artifacts!, name))) {
    throw new GithubAnalysisError("CI evidence includes an unhashed artifact.", 422)
  }
  for (const [name, digest] of Object.entries(manifest.artifacts)) {
    const file = files[name]
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || !/^[a-f0-9]{64}$/.test(digest) ||
      !file || createHash("sha256").update(file).digest("hex") !== digest) {
      throw new GithubAnalysisError(`CI evidence integrity failed for ${name}.`, 422)
    }
  }
  if (createHash("sha256").update(files["source.sol"]).digest("hex") !== manifest.source_sha256 ||
    safeJson<{ source_sha256?: string }>(strFromU8(files["source-layout.json"]), {}).source_sha256 !== manifest.source_sha256) {
    throw new GithubAnalysisError("CI source bytes do not match the declared source digest.", 422)
  }
  if (expected && (String(manifest.github?.run_id) !== String(expected.runId) ||
    manifest.github?.workflow_sha !== expected.headSha || String(manifest.github?.run_attempt) !== String(expected.runAttempt) ||
    manifest.github?.repository !== expected.repository)) {
    throw new GithubAnalysisError("CI evidence is not bound to this GitHub run and workflow revision.", 422)
  }
  const parsed = parseArtifact(files)
  for (const [claim, tool] of [["slither", "slither"], ["mythril", "mythril"],
    ["custom_regression", "custom"], ["foundry_compile", "foundry"]] as const) {
    if (!["COMPLETED", "FAILED", "NOT_RUN", "TIMEOUT"].includes(manifest.tools?.[tool]?.status || "") ||
      manifest.claims?.[claim] !== parsed[tool].success ||
      (manifest.tools?.[tool]?.status === "COMPLETED") !== parsed[tool].success) {
      throw new GithubAnalysisError(`CI tool status contradicts evidence for ${tool}.`, 422)
    }
  }
  if (["protocol_fuzzing", "invariants", "manual_review"].some(claim => manifest.claims?.[claim] !== false)) {
    throw new GithubAnalysisError("CI evidence contains unsupported execution or manual-review claims.", 422)
  }
}

export function unpackCiArchive(archive: Uint8Array): Record<string, Uint8Array> {
  if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new GithubAnalysisError("CI archive exceeds size limit.", 413)
  const names = new Set<string>()
  let total = 0
  return unzipSync(archive, { filter: file => {
    if (!/^[A-Za-z0-9_.-]+$/.test(file.name) || names.has(file.name)) {
      throw new GithubAnalysisError("CI archive contains ambiguous or unsafe filenames.", 422)
    }
    names.add(file.name)
    total += file.originalSize
    if (names.size > 40 || total > MAX_EXTRACTED_BYTES || file.originalSize > 8 * 1024 * 1024) {
      throw new GithubAnalysisError("CI archive exceeds extraction limits.", 413)
    }
    return true
  } })
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
  const artifact = artifacts.find(a => a.name === `static-analysis-${jobId}-attempt-${run.run_attempt}` && !a.expired) ||
    artifacts.find(a => a.name === `static-analysis-${jobId}` && !a.expired)

  if (!artifact) {
    return { state: "failed", jobId, runUrl: run.html_url, error: `Run ${run.conclusion ?? "terminato"} senza report.` }
  }

  // GitHub redirects to signed blob storage; fetch drops Authorization on the cross-origin hop.
  const zipRes = await gh(new URL(artifact.archive_download_url).pathname)
  if (!zipRes.ok) throw new GithubAnalysisError(explain(zipRes.status, await zipRes.text()), zipRes.status)
  const size = Number(zipRes.headers.get("content-length"))
  if (size > MAX_ARCHIVE_BYTES) throw new GithubAnalysisError("CI archive exceeds size limit.", 413)
  // Bound the body while streaming too: Content-Length may be absent or false.
  const reader = zipRes.body?.getReader()
  if (!reader) throw new GithubAnalysisError("Empty CI archive.", 422)
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_ARCHIVE_BYTES) throw new GithubAnalysisError("CI archive exceeds size limit.", 413)
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  const archive = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { archive.set(chunk, offset); offset += chunk.byteLength }
  const files = unpackCiArchive(archive)
  verifyCiArtifact(files, jobId, { runId: run.id, headSha: run.head_sha, runAttempt: run.run_attempt, repository: repo() })
  return { state: "completed", jobId, runUrl: run.html_url, result: parseArtifact(files) }
}
