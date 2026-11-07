import { createClient } from "@supabase/supabase-js"
import { DEFAULT_PROJECTS, type PortfolioProject } from "@/lib/solay39-constants"
import { exactAuditBlob, lookupPublishedAudit } from "./published-audit-lookup"

const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

async function fromSupabase(id: string): Promise<PortfolioProject | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await supabase.from("audits").select("data").eq("id", id).maybeSingle()
    return (data?.data as PortfolioProject) ?? null
  } catch {
    return null
  }
}

// Legacy audits published before the Supabase migration still live in Blob.
async function fromBlob(id: string): Promise<PortfolioProject | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { list } = await import("@vercel/blob")
    const { blobs } = await list({ prefix: `audits/${id}.json`, limit: 5 })
    const blob = exactAuditBlob(blobs, id)
    if (!blob) return null
    const res = await fetch(blob.url, { cache: "no-store" })
    return res.ok ? ((await res.json()) as PortfolioProject) : null
  } catch {
    return null
  }
}

export async function getPublishedAudit(id: string): Promise<PortfolioProject | null> {
  return lookupPublishedAudit(id, [
    (candidate) => projectMap.get(candidate) ?? null,
    fromSupabase,
    fromBlob,
  ])
}

/** The public portfolio must list the same persisted records as report lookup. */
export async function listPublishedAudits(): Promise<PortfolioProject[]> {
  const records = new Map(DEFAULT_PROJECTS.map(p => [p.id, p]))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false } })
      const { data, error } = await db.from("audits").select("id,data").order("created_at", { ascending: false }).limit(200)
      if (error) throw error
      for (const row of data ?? []) {
        if (row.data?.id === row.id && !records.has(row.id)) records.set(row.id, row.data as PortfolioProject)
      }
    } catch (error) { console.error("[audits] Database listing unavailable", error instanceof Error ? error.message : "storage error") }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { list } = await import("@vercel/blob")
      const { blobs } = await list({ prefix: "audits/", limit: 200 })
      for (let offset = 0; offset < blobs.length; offset += 10) {
        await Promise.all(blobs.slice(offset, offset + 10).map(async blob => {
          const match = /^audits\/([A-Za-z0-9][A-Za-z0-9_-]{0,199})\.json$/.exec(blob.pathname)
          if (!match || records.has(match[1])) return
          try {
            const res = await fetch(blob.url, { cache: "no-store" })
            const record = res.ok ? await res.json() : null
            if (record?.id === match[1]) records.set(record.id, record)
          } catch { /* A damaged legacy record must not hide other reports. */ }
        }))
      }
    } catch { /* Database and bundled records remain available. */ }
  }
  return [...records.values()]
}
