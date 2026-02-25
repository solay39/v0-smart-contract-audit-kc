import type { Metadata } from "next"
import { DEFAULT_PROJECTS, type PortfolioProject } from "@/lib/solay39-constants"
import { list } from "@vercel/blob"
import { AuditDetailClient } from "./client"

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

// Fetch audit from Vercel Blob (server-side)
async function fetchBlobAudit(id: string): Promise<PortfolioProject | null> {
  try {
    const { blobs } = await list({ prefix: `audits/${id}.json` })
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  // Check default projects first, then Blob
  const p = projectMap.get(id) || await fetchBlobAudit(id)

  if (!p) {
    return {
      title: "Audit Not Found | Solay39",
      description: "This audit report does not exist.",
    }
  }

  const title = `${p.name}${p.ticker ? ` (${p.ticker})` : ""} Security Audit | Solay39`
  const desc = `Score: ${p.score}/100 (${p.rating}) | ${p.criticals} Critical, ${p.highs} High, ${p.mediums} Medium, ${p.lows} Low findings. ${p.description ? p.description.slice(0, 120) : `Smart contract audit by Solay39 on ${p.network}.`}`

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
}

export async function generateStaticParams() {
  return DEFAULT_PROJECTS.map((p) => ({ id: p.id }))
}

export default async function AuditPage({ params }: Props) {
  const { id } = await params

  // 1. Check hardcoded default projects
  let project: PortfolioProject | null = projectMap.get(id) || null

  // 2. If not found, fetch from Vercel Blob (server-side persistence)
  if (!project) {
    project = await fetchBlobAudit(id)
  }

  // 3. Always render client component — falls back to localStorage / Blob API
  return <AuditDetailClient project={project} auditId={id} />
}
