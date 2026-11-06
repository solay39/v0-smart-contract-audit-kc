import { NextResponse } from "next/server"
import { getPublishedAudit } from "@/lib/get-published-audit"
import { isPublicAuditId } from "@/lib/published-audit-lookup"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!isPublicAuditId(id)) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 })
    const audit = await getPublishedAudit(id)
    if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
    return NextResponse.json(audit, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error fetching audit:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
