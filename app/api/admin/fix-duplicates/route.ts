// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Admin: Fix duplicate findings in published audits
// app/api/admin/fix-duplicates/route.ts
//
// GET  /api/admin/fix-duplicates?key=YOUR_FOUNDER_KEY
//      → Mostra tutti gli audit con finding duplicati
//
// POST /api/admin/fix-duplicates
//      body: { key: "YOUR_FOUNDER_KEY", auditId?: "specific-id" }
//      → Fixa i duplicati in tutti gli audit (o uno specifico)
// ═══════════════════════════════════════════════════════════════

import { put, list } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"
const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "Solay39!Audit#2025"

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\[slither\]|\[mythril\]|\[ai\]/g, "")
    .replace(/\b(the|a|an|is|are|was|were|has|have|with|without|for|on|in|at|to|of)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isSimilarTitle(a: string, b: string): boolean {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (na === nb) return true
  const wordsA = new Set(na.split(" ").filter(w => w.length > 3))
  const wordsB = new Set(nb.split(" ").filter(w => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return na.includes(nb) || nb.includes(na)
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union > 0.65
}

function deduplicateFindings(findings: Array<{ title: string; [key: string]: unknown }>): {
  cleaned: typeof findings
  removed: number
} {
  const seen: Array<{ title: string }> = []
  const cleaned = findings.filter(f => {
    const isDup = seen.some(s => isSimilarTitle(s.title, f.title))
    if (isDup) return false
    seen.push({ title: f.title })
    return true
  })
  return { cleaned, removed: findings.length - cleaned.length }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")
  if (key !== FOUNDER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX })
    const results = []

    for (const blob of blobs.filter(b => b.pathname.endsWith(".json"))) {
      const res = await fetch(blob.url)
      if (!res.ok) continue
      const audit = await res.json()

      const findings = audit.findings || []
      const { removed } = deduplicateFindings(findings)

      if (removed > 0) {
        results.push({
          id: audit.id,
          name: audit.name,
          totalFindings: findings.length,
          duplicatesFound: removed,
          cleanedCount: findings.length - removed,
        })
      }
    }

    return NextResponse.json({
      auditsWithDuplicates: results.length,
      audits: results,
      message: results.length > 0
        ? `Found ${results.length} audits with duplicates. POST to this endpoint to fix them.`
        : "No duplicates found in any audit.",
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { key, auditId } = body

  if (key !== FOUNDER_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX })
    const targetBlobs = auditId
      ? blobs.filter(b => b.pathname.includes(auditId))
      : blobs.filter(b => b.pathname.endsWith(".json"))

    const fixed = []
    const skipped = []

    for (const blob of targetBlobs) {
      const res = await fetch(blob.url)
      if (!res.ok) continue
      const audit = await res.json()

      const findings = audit.findings || []
      const { cleaned, removed } = deduplicateFindings(findings)

      if (removed === 0) {
        skipped.push({ id: audit.id, name: audit.name, reason: "no duplicates" })
        continue
      }

      // Fix the audit object
      const fixedAudit = {
        ...audit,
        findings: cleaned,
        // Also fix counts in executive summary if present
        executiveSummary: audit.executiveSummary ? {
          ...audit.executiveSummary,
          totalFindings: cleaned.length,
          findingsBySeverity: {
            CRITICAL: cleaned.filter((f: { severity: string }) => f.severity === "CRITICAL").length,
            HIGH: cleaned.filter((f: { severity: string }) => f.severity === "HIGH").length,
            MEDIUM: cleaned.filter((f: { severity: string }) => f.severity === "MEDIUM").length,
            LOW: cleaned.filter((f: { severity: string }) => f.severity === "LOW").length,
            INFO: cleaned.filter((f: { severity: string }) => f.severity === "INFO").length,
          }
        } : audit.executiveSummary,
      }

      // Save back to Vercel Blob (overwrite)
      await put(blob.pathname, JSON.stringify(fixedAudit), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      })

      fixed.push({
        id: audit.id,
        name: audit.name,
        before: findings.length,
        after: cleaned.length,
        removed,
      })
    }

    return NextResponse.json({
      success: true,
      fixed: fixed.length,
      skipped: skipped.length,
      details: fixed,
      message: `Fixed ${fixed.length} audits. ${skipped.length} had no duplicates.`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
