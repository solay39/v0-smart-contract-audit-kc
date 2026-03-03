// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — /api/validate
// ═══════════════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from "next/server"
import { validateAuditReport, type AuditReportFields } from "@/lib/audit-validator"

export async function POST(request: NextRequest) {
  try {
    const { sourceCode, reportFields, compilerFromExplorer } = await request.json()

    if (!sourceCode || typeof sourceCode !== "string") {
      return NextResponse.json({ error: "sourceCode mancante" }, { status: 400 })
    }

    if (!reportFields || typeof reportFields !== "object") {
      return NextResponse.json({ error: "reportFields mancante" }, { status: 400 })
    }

    const result = validateAuditReport(
      sourceCode,
      reportFields as AuditReportFields,
      compilerFromExplorer,
    )

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
