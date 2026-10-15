import type { PortfolioProject } from "@/lib/solay39-constants"

// Uses the Supabase REST API directly so it also works in the Edge runtime (OG image route).
export async function getPublishedAudit(id: string): Promise<PortfolioProject | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!baseUrl || !key || !id) return null

  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/audits?select=data&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { data: PortfolioProject | null }[]
    return rows[0]?.data ?? null
  } catch {
    return null
  }
}
