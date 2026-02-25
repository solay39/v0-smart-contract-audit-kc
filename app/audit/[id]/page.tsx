import type { Metadata } from "next"
import { DEFAULT_PROJECTS, scoreColor } from "@/lib/solay39-constants"
import { AuditDetailClient } from "./client"

// Build a lookup map at module scope
const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = projectMap.get(id)

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
  const project = projectMap.get(id) || null

  // Always render the client component — it can find published audits in localStorage
  // even when the server doesn't know about them (user-published audits)
  return <AuditDetailClient project={project} auditId={id} />
}
