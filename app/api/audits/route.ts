import { NextResponse } from "next/server"
import { getPublishedAudit, listPublishedAudits } from "@/lib/get-published-audit"
import { isPublicAuditId } from "@/lib/published-audit-lookup"
import { requireFounder } from "@/lib/founder-auth"
import { normalizeAuditDraft } from "@/lib/audit-draft"
import { storeAuditDraft } from "@/lib/audit-draft-storage"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim()
  if (!id) return NextResponse.json({ audits: await listPublishedAudits() }, {
    headers: { "Cache-Control": "no-store" },
  })
  if (!isPublicAuditId(id)) return NextResponse.json({ audit: null, error: "invalid audit id" }, { status: 400 })

  const audit = await getPublishedAudit(id)
  if (!audit) return NextResponse.json({ audit: null, error: "audit not found" }, { status: 404 })

  return NextResponse.json({ audit }, { headers: { "Cache-Control": "no-store" } })
}

/** Persist an explicitly preliminary report; final sealed publication stays gated. */
export async function POST(request: Request) {
  const denied = await requireFounder(request)
  if (denied) return denied
  let audit: unknown
  try {
    const body = await request.json()
    audit = normalizeAuditDraft(body.audit)
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Invalid audit" }, { status: 400 })
  }
  try {
    const saved = await storeAuditDraft(audit)
    return NextResponse.json({
      success: true, publicationStatus: "PRELIMINARY", storage: saved.storage,
      publicUrl: `/audit/${saved.audit.id}`, audit: saved.audit,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({
      success: false, publicationStatus: "FAILED",
      error: error instanceof Error ? error.message : "Server persistence failed",
    }, { status: 503 })
  }
}
