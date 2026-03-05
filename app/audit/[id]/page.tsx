import type { Metadata } from "next"
import { DEFAULT_PROJECTS, ratingOf, getWeightedScore, type PortfolioProject } from "@/lib/solay39-constants"
import { list } from "@vercel/blob"
import { AuditDetailClient } from "./client"

// Allow dynamic audit slugs that aren't in generateStaticParams
export const dynamicParams = true

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

// Fetch audit from Vercel Blob (server-side) — fully resilient
async function fetchBlobAudit(id: string): Promise<PortfolioProject | null> {
  try {
    const { blobs } = await list({ prefix: `audits/${id}.json`, limit: 1 })
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return await res.json() as PortfolioProject
  } catch (err) {
    console.error("[Solay39] fetchBlobAudit failed for id:", id, err)
    return null
  }
}

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    const p = projectMap.get(id) || await fetchBlobAudit(id)

    if (!p) {
      return {
        title: "Audit Not Found | Solay39",
        description: "This audit report does not exist.",
      }
    }

    const title = `${p.name}${p.ticker ? ` (${p.ticker})` : ""} Security Audit | Solay39`
    const ws = getWeightedScore(p)
    const wr = ratingOf(ws)
    const criticals = p.criticals ?? 0
    const highs = p.highs ?? 0
    const mediums = p.mediums ?? 0
    const lows = p.lows ?? 0
    const desc = `Score: ${ws}/100 (${wr}) | ${criticals} Critical, ${highs} High, ${mediums} Medium, ${lows} Low findings. ${p.description ? p.description.slice(0, 120) : `Smart contract audit by Solay39 on ${p.network || "BSC"}.`}`

    const url = `https://www.solay39.eu/audit/${id}`

    return {
      title,
      description: desc,
      openGraph: {
        title,
        description: desc,
        url,
        siteName: "Solay39 Skynet",
        type: "article",
        images: [
          {
            url: `/audit/${id}/og`,
            width: 1200,
            height: 630,
            alt: `${p.name} Security Audit by Solay39`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: [`/audit/${id}/og`],
      },
      alternates: {
        canonical: url,
      },
    }
  } catch (err) {
    console.error("[Solay39] generateMetadata failed:", err)
    return {
      title: "Security Audit | Solay39",
      description: "Smart contract security audit by Solay39.",
    }
  }
}

export async function generateStaticParams() {
  return DEFAULT_PROJECTS.map((p) => ({ id: p.id }))
}

export default async function AuditPage({ params }: Props) {
  try {
    const { id } = await params

    // 1. Check hardcoded default projects
    let project: PortfolioProject | null = projectMap.get(id) || null

    // 2. If not found, fetch from Vercel Blob (server-side persistence)
    if (!project) {
      project = await fetchBlobAudit(id)
    }

    // 3. Always render client component — falls back to localStorage / Blob API
    return <AuditDetailClient project={project} auditId={id} />
  } catch (err) {
    console.error("[Solay39] AuditPage render failed:", err)
    // Fallback: render client with null project, it will try client-side fetch
    const { id } = await params
    return <AuditDetailClient project={null} auditId={id} />
  }
}
