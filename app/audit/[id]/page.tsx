import type { Metadata } from "next"
import { DEFAULT_PROJECTS, ratingOf, getWeightedScore, type PortfolioProject } from "@/lib/solay39-constants"
import { AuditDetailClient } from "./client"

// Allow dynamic audit slugs not in generateStaticParams
export const dynamicParams = true

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = projectMap.get(id)

  if (!p) {
    return { 
      title: `${id} Security Audit | Solay39`, 
      description: "Smart contract security audit by Solay39." 
    }
  }

  const title = `${p.name || "Audit"}${p.ticker ? ` (${p.ticker})` : ""} Security Audit | Solay39`
  const ws = getWeightedScore(p)
  const wr = ratingOf(ws)
  const desc = `Score: ${ws}/100 (${wr}) | ${p.criticals ?? 0} Critical, ${p.highs ?? 0} High, ${p.mediums ?? 0} Medium, ${p.lows ?? 0} Low findings.`
  
  return {
    title,
    description: desc,
    openGraph: {
      title, description: desc, 
      url: `https://www.solay39.eu/audit/${id}`,
      siteName: "Solay39 Skynet", 
      type: "article",
    },
  }
}

export async function generateStaticParams() {
  return DEFAULT_PROJECTS.map((p) => ({ id: p.id }))
}

// Page renders immediately - client fetches blob data
export default async function AuditPage({ params }: Props) {
  const { id } = await params
  const project = projectMap.get(id) || null
  return <AuditDetailClient project={project} auditId={id} />
}
