import { NextResponse } from "next/server"
import { list } from "@vercel/blob"
import { DEFAULT_PROJECTS, type PortfolioProject } from "@/lib/solay39-constants"

const projectMap = new Map(DEFAULT_PROJECTS.map((p) => [p.id, p]))

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // First check static projects
    const staticProject = projectMap.get(id)
    if (staticProject) {
      return NextResponse.json(staticProject, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      })
    }
    
    // Fetch from Blob
    const { blobs } = await list({ prefix: `audits/${id}.json`, limit: 1 })
    if (blobs.length === 0) {
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    }
    
    const res = await fetch(blobs[0].url)
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch audit" }, { status: 500 })
    }
    
    const project = (await res.json()) as PortfolioProject
    
    return NextResponse.json(project, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    })
  } catch (error) {
    console.error("Error fetching audit:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
