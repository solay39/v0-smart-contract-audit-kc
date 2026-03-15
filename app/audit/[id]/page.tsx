import type { Metadata } from "next"
import { DEFAULT_PROJECTS, ratingOf, getWeightedScore, type PortfolioProject } from "@/lib/solay39-constants"
import { AuditDetailClient } from "./client"

// Allow dynamic audit slugs not in generateStaticParams
export const dynamicParams = true

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

// Fetch audit from Vercel Blob (server-side) — fully resilient
async function fetchBlobAudit(id: string): Promise<PortfolioProject | null> {
  try {
    const { list } = await import("@vercel/blob")
    
    // Try exact match first
    let { blobs } = await list({ prefix: `audits/${id}.json`, limit: 1 })
    
    // If not found, try without .json (in case it's stored differently)
    if (blobs.length === 0) {
      const result = await list({ prefix: `audits/${id}`, limit: 5 })
      blobs = result.blobs.filter(b => b.pathname.endsWith('.json'))
    }
    
    // If still not found, search all audits and match by ID
    if (blobs.length === 0) {
      const allResult = await list({ prefix: `audits/` })
      const matchingBlob = allResult.blobs.find(b => 
        b.pathname.includes(id) || 
        b.pathname.replace('audits/', '').replace('.json', '') === id
      )
      if (matchingBlob) {
        blobs = [matchingBlob]
      }
    }
    
    if (blobs.length === 0) {
      console.log("[v0] Audit not found in Blob:", id)
      return null
    }
    
    const res = await fetch(blobs[0].url, { cache: 'no-store' })
    if (!res.ok) {
      console.log("[v0] Failed to fetch blob content:", res.status)
      return null
    }
    
    const audit = await res.json() as PortfolioProject
    console.log("[v0] Found audit:", audit.name, audit.id)
    return audit
  } catch (err) {
    console.error("[v0] fetchBlobAudit error:", err)
    return null
  }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    const p = projectMap.get(id) || (await fetchBlobAudit(id))

    if (!p) {
      return { title: "Audit Not Found | Solay39", description: "This audit report does not exist." }
    }

    const title = `${p.name || "Audit"}${p.ticker ? ` (${p.ticker})` : ""} Security Audit | Solay39`
    const ws = getWeightedScore(p)
    const wr = ratingOf(ws)
    const desc = `Score: ${ws}/100 (${wr}) | ${p.criticals ?? 0} Critical, ${p.highs ?? 0} High, ${p.mediums ?? 0} Medium, ${p.lows ?? 0} Low findings. ${p.description ? p.description.slice(0, 120) : `Smart contract audit by Solay39 on ${p.network || "BSC"}.`}`
    const url = `https://www.solay39.eu/audit/${id}`

    const ogImage = `https://www.solay39.eu/audit/${id}/og`
    
    return {
      title,
      description: desc,
      openGraph: {
        title, description: desc, url, siteName: "Solay39 Skynet", type: "article",
        images: [{ url: ogImage, width: 1200, height: 630, alt: `${p.name} Security Audit by Solay39` }],
      },
      twitter: { card: "summary_large_image", title, description: desc, images: [ogImage] },
      alternates: { canonical: url },
    }
  } catch {
    return { title: "Solay39 Audit", description: "Smart contract security audit." }
  }
}

export async function generateStaticParams() {
  return DEFAULT_PROJECTS.map((p) => ({ id: p.id }))
}

export default async function AuditPage({ params }: Props) {
  try {
    const { id } = await params
    const project: PortfolioProject | null = projectMap.get(id) || (await fetchBlobAudit(id)) || null
    return <AuditDetailClient project={project} auditId={id} />
  } catch {
    const { id } = await params
    return <AuditDetailClient project={null} auditId={id} />
  }
}
