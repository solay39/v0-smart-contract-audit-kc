import { createClient } from "@supabase/supabase-js"
import { DEFAULT_PROJECTS, type PortfolioProject } from "@/lib/solay39-constants"

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
    const { blobs } = await list({ prefix: `audits/${id}`, limit: 5 })
    const blob = blobs.find((b) => b.pathname === `audits/${id}.json`) ?? blobs.find((b) => b.pathname.endsWith(".json"))
    if (!blob) return null
    const res = await fetch(blob.url, { cache: "no-store" })
    return res.ok ? ((await res.json()) as PortfolioProject) : null
  } catch {
    return null
  }
}

export async function getPublishedAudit(id: string): Promise<PortfolioProject | null> {
  return projectMap.get(id) ?? (await fromSupabase(id)) ?? (await fromBlob(id))
}
