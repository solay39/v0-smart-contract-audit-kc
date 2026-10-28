import type { Metadata } from "next"
import { DEFAULT_PROJECTS, ratingOf, getWeightedScore, isVerifiedReport, type PortfolioProject } from "@/lib/solay39-constants"
import { getPublishedAudit } from "@/lib/get-published-audit"
import { AuditDetailClient } from "./client"

// Allow dynamic audit slugs not in generateStaticParams
export const dynamicParams = true

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    const p = await getPublishedAudit(id)

    if (!p) {
      return { title: "Audit Not Found | Solay39", description: "This audit report does not exist." }
    }

    const title = `${p.name || "Audit"}${p.ticker ? ` (${p.ticker})` : ""} Security Audit | Solay39`
    const verified = isVerifiedReport(p)
    const ws = verified ? getWeightedScore(p) : 0
    const wr = verified ? ratingOf(ws) : "PENDING"
    const desc = verified
      ? `Score: ${ws}/100 (${wr}) | ${p.criticals ?? 0} Critical, ${p.highs ?? 0} High, ${p.mediums ?? 0} Medium, ${p.lows ?? 0} Low findings. ${p.description ? p.description.slice(0, 120) : `Smart contract audit by Solay39 on ${p.network || "BSC"}.`}`
      : `Verification pending: source hash, evidence artifacts, and independent reviewer sign-off are required before this report can be used.`
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

function evidenceOnlyServerProject(project: PortfolioProject | null): PortfolioProject | null {
  if (!project) return null
  const integrity = project.reportIntegrity as { sourceSha256?: string; artifacts?: Record<string, string> } | undefined
  const signed = project.engagement?.reviewTeam?.reviewStatus === "SIGNED" && Boolean(project.engagement.reviewTeam?.leadAuditor?.signedOff)
  if (integrity?.sourceSha256 && Object.keys(integrity.artifacts || {}).length > 0 && signed) return project
  return {
    ...project,
    score: 0,
    rating: "PENDING",
    finalAssessment: { ...project.finalAssessment, securityPosture: "Automated scan with pending manual review.", productionReadiness: "Not assessed until evidence and manual sign-off are verified." },
    engagement: project.engagement ? { ...project.engagement, numberOfAuditors: 0, engineeringHours: 0, securityEngineersInvolved: 0, reviewTeam: { ...(project.engagement.reviewTeam || {}), reviewStatus: "AUTOMATED_ANALYSIS_PENDING_MANUAL_REVIEW", leadAuditor: { ...(project.engagement.reviewTeam?.leadAuditor || {}), signedOff: false, name: "Pending reviewer", credentials: "Not verified" } } } : project.engagement,
    testingMethodology: { ...project.testingMethodology, manualReviewHours: 0, fuzzingApplied: false, symbolicExecution: false, reviewPhases: ["Automated analysis", "Evidence pending", "Manual review pending"] },
    manualReview: undefined,
    auditorSignatures: undefined,
    formalVerification: undefined,
  } as PortfolioProject
}

export default async function AuditPage({ params }: Props) {
  try {
    const { id } = await params
    const project = evidenceOnlyServerProject(await getPublishedAudit(id))
    return <AuditDetailClient project={project} auditId={id} />
  } catch {
    const { id } = await params
    return <AuditDetailClient project={null} auditId={id} />
  }
}
