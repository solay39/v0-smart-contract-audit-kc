// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Admin Patch: Fix existing audit blobs
// Corrects SUPPLY badge and DURATION on already-published audits
// ═══════════════════════════════════════════════════════════════

import { list, put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json()

    // Auth check
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { blobs } = await list({ prefix: BLOB_PREFIX })
    const results: { id: string; name: string; fixed: boolean; changes: string[] }[] = []

    for (const blob of blobs) {
      if (!blob.pathname.endsWith(".json")) continue

      const res = await fetch(blob.url)
      if (!res.ok) continue
      const audit = await res.json()

      let changed = false
      const changes: string[] = []

      // ── Fix 1: SUPPLY badge ──
      // contractMeta.hasMint (workspace) = hasMintOutsideConstructor (API)
      // contractMeta.hasConstructorOnlyMint = constructor-only mint (fixed supply)
      const cm = audit.contractMeta
      if (cm) {
        const hasMintFn = cm.hasMint || cm.hasMintOutsideConstructor
        const isConstructorOnly = cm.hasConstructorOnlyMint && !hasMintFn

        // Fix onChainValidation supplyType if it exists
        if (audit.onChainValidation && Array.isArray(audit.onChainValidation)) {
          // The supplyType is stored in the systemArchitecture-like object 
          // that was passed during publish
        }

        // Fix the systemArchitecture.supplyType if present
        if (audit.systemArchitecture?.supplyType) {
          const currentSupply = audit.systemArchitecture.supplyType
          let correctSupply: string

          if (hasMintFn) {
            correctSupply = "MINTABLE"
          } else if (isConstructorOnly || !hasMintFn) {
            correctSupply = cm.hasBurn ? "DEFLATIONARY" : "FIXED"
          } else {
            correctSupply = currentSupply
          }

          if (currentSupply !== correctSupply) {
            audit.systemArchitecture.supplyType = correctSupply
            changed = true
            changes.push(`SUPPLY: ${currentSupply} -> ${correctSupply}`)
          }
        }

        // Also fix the top-level contractInfo supply if present
        if (audit.contractInfo?.supplyType) {
          const hasMint = cm.hasMint || cm.hasMintOutsideConstructor
          const correct = hasMint ? "MINTABLE" : (cm.hasBurn ? "DEFLATIONARY" : "FIXED")
          if (audit.contractInfo.supplyType !== correct) {
            audit.contractInfo.supplyType = correct
            changed = true
            changes.push(`contractInfo.supplyType: -> ${correct}`)
          }
        }
      }

      // ── Fix 2: Duration — recalculate from real dates ──
      const eng = audit.engagement
      if (eng?.auditDate && eng?.deliveryDate) {
        const start = new Date(eng.auditDate)
        const end = new Date(eng.deliveryDate)
        const diffMs = end.getTime() - start.getTime()
        const realDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)

        if (eng.auditDurationDays !== realDays) {
          const oldDays = eng.auditDurationDays
          eng.auditDurationDays = realDays
          changed = true
          changes.push(`DURATION: ${oldDays}d -> ${realDays}d`)
        }

        // Recalculate engineering hours based on corrected days
        const correctHours = realDays * (eng.numberOfAuditors || 1) * 8
        if (eng.engineeringHours !== correctHours) {
          const oldHours = eng.engineeringHours
          eng.engineeringHours = correctHours
          changed = true
          changes.push(`HOURS: ${oldHours}h -> ${correctHours}h`)
        }
      }

      // ── Fix 3: Ensure contractMeta is consistent ──
      if (cm && cm.hasMintOutsideConstructor !== undefined && cm.hasMint === undefined) {
        cm.hasMint = cm.hasMintOutsideConstructor
        changed = true
        changes.push("Added hasMint from hasMintOutsideConstructor")
      }

      if (changed) {
        await put(blob.pathname, JSON.stringify(audit), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        })
        results.push({ id: audit.id || blob.pathname, name: audit.name || "unknown", fixed: true, changes })
      } else {
        results.push({ id: audit.id || blob.pathname, name: audit.name || "unknown", fixed: false, changes: ["No changes needed"] })
      }
    }

    return NextResponse.json({
      success: true,
      totalBlobs: blobs.length,
      patched: results.filter(r => r.fixed).length,
      unchanged: results.filter(r => !r.fixed).length,
      details: results,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[Solay39] Patch error:", msg)
    return NextResponse.json({ error: `Patch failed: ${msg}` }, { status: 500 })
  }
}
