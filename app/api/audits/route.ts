import { NextResponse } from "next/server"
import { getPublishedAudit } from "@/lib/get-published-audit"
import { isPublicAuditId } from "@/lib/published-audit-lookup"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim()
  if (!id) return NextResponse.json({ audit: null, error: "id is required" }, { status: 400 })
  if (!isPublicAuditId(id)) return NextResponse.json({ audit: null, error: "invalid audit id" }, { status: 400 })

  const audit = await getPublishedAudit(id)
  if (!audit) return NextResponse.json({ audit: null, error: "audit not found" }, { status: 404 })

  return NextResponse.json({ audit }, { headers: { "Cache-Control": "no-store" } })
}
