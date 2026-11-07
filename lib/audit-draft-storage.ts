import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { getPublishedAudit } from "./get-published-audit"
import { normalizeAuditDraft } from "./audit-draft"
import { DEFAULT_PROJECTS, isVerifiedReport, type PortfolioProject } from "./solay39-constants"
import { getStaticAnalysisJob, JOB_ID_PATTERN } from "./github-analysis-runner"

type StoredDraft = PortfolioProject & { draftRevision: string }

export async function storeAuditDraft(value: unknown) {
  const draft = normalizeAuditDraft(value)
  if (draft.ciAnalysis) {
    if (!JOB_ID_PATTERN.test(draft.ciAnalysis.jobId)) throw new Error("Invalid CI job identity")
    const job = await getStaticAnalysisJob(draft.ciAnalysis.jobId)
    const claimed = draft.reportIntegrity?.sourceSha256
    if (job.state !== "completed" || !claimed || claimed !== job.result.evidenceManifest?.source_sha256) {
      throw new Error("CI evidence does not match this draft source")
    }
    // Do not trust success flags, findings or run URLs supplied by the browser.
    draft.ciAnalysis = { jobId: job.jobId, runUrl: job.runUrl, result: job.result }
  }
  if (DEFAULT_PROJECTS.some(p => p.id === draft.id)) throw new Error("Bundled report IDs cannot be overwritten by a draft")
  const existing = await getPublishedAudit(draft.id)
  if (existing && isVerifiedReport(existing)) throw new Error("A verified report cannot be overwritten by a draft")
  const record: StoredDraft = { ...draft, draftRevision: randomUUID() }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  const failures: string[] = []
  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false } })
      const { error } = await db.from("audits").upsert({
        id: record.id, name: record.name, data: record,
      }, { onConflict: "id" })
      if (error) throw error
      const confirmed = await getPublishedAudit(record.id) as StoredDraft | null
      if (confirmed?.draftRevision === record.draftRevision) return { audit: record, storage: "supabase" }
      failures.push("Supabase read-back did not confirm the saved revision")
    } catch { failures.push("Supabase save failed") }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob")
      await put(`audits/${record.id}.json`, JSON.stringify(record), {
        access: "public", contentType: "application/json", addRandomSuffix: false,
        allowOverwrite: true, cacheControlMaxAge: 0,
      })
      const confirmed = await getPublishedAudit(record.id) as StoredDraft | null
      if (confirmed?.draftRevision === record.draftRevision) return { audit: record, storage: "blob" }
      failures.push("Blob read-back did not confirm the saved revision")
    } catch { failures.push("Blob save failed") }
  }
  throw new Error(failures.join("; ") || "Server storage is not configured. A Supabase server key or Blob token is required.")
}
