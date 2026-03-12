import type { Metadata } from "next"
import { list } from "@vercel/blob"
import { DEFAULT_PROJECTS, ratingOf, getWeightedScore, type PortfolioProject } from "@/lib/solay39-constants"
import { AuditDetailClient } from "./client"

// Allow dynamic audit slugs not in generateStaticParams
export const dynamicParams = true

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

// Fetch audit from Vercel Blob (server-side) — fully resilient
async function fetchBlobAudit(id: string): Promise<PortfolioProject | null> {
  try {
    // Try exact match first
    let { blobs } = await list({ prefix: `audits/${id}.json`, limit: 1 })
    
    // If not found, try prefix without .json (handles random suffix from Blob)
    if (blobs.length === 0) {
      const prefixResult = await list({ prefix: `audits/${id}`, limit: 10 })
      blobs = prefixResult.blobs.filter(b => b.pathname.includes(id) && b.pathname.endsWith('.json'))
    }
    
    if (blobs.length === 0) {
      console.log(`[audit/${id}] Not found in Blob storage`)
      return null
    }
    
    console.log(`[audit/${id}] Found in Blob:`, blobs[0].pathname)
    const res = await fetch(blobs[0].url, { next: { revalidate: 60 } })
    if (!res.ok) {
      console.log(`[audit/${id}] Blob fetch failed:`, res.status)
      return null
    }
    return (await res.json()) as PortfolioProject
  } catch (err) {
    console.error(`[audit/${id}] Blob error:`, err)
    return null
  }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  
  try {
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
  } catch (err) {
    console.error(`[audit/${id}] Metadata error:`, err)
    return { title: "Solay39 Audit", description: "Smart contract security audit." }
  }
}

export async function generateStaticParams() {
  return DEFAULT_PROJECTS.map((p) => ({ id: p.id }))
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params
  
  try {
    const project: PortfolioProject | null = projectMap.get(id) || (await fetchBlobAudit(id)) || null
    return <AuditDetailClient project={project} auditId={id} />
  } catch (err) {
    console.error(`[audit/${id}] Page render error:`, err)
    return <AuditDetailClient project={null} auditId={id} />
  }
}
