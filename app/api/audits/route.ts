// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Audit Persistence via Vercel Blob
// Stores published audit reports as JSON so they survive across
// browsers, devices, and deployments.
// ═══════════════════════════════════════════════════════════════

import { put, list, del, get } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"

// Founder password for protected operations (delete)
// Primary: env var, Fallback: hardcoded founder password
const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "Solay39!Audit#2025"

// POST — Save a published audit report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audit } = body

    if (!audit || !audit.id || !audit.name) {
      console.error("[Audits API] Invalid audit data:", { hasAudit: !!audit, id: audit?.id, name: audit?.name })
      return NextResponse.json({ error: "Invalid audit data - missing id or name" }, { status: 400 })
    }

    const blobPath = `${BLOB_PREFIX}${audit.id}.json`
    console.log("[Audits API] Saving audit to Blob:", blobPath)

    // Try public first, fall back to private if store type mismatches
    let blob
    try {
      blob = await put(blobPath, JSON.stringify(audit), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      })
    } catch (publicError) {
      // If public fails, try private access
      console.log("[Audits API] Public access failed, trying private:", publicError)
      blob = await put(blobPath, JSON.stringify(audit), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      })
    }

    console.log("[Audits API] Audit saved successfully:", blob.url)

    return NextResponse.json({
      success: true,
      url: blob.url,
      id: audit.id,
    })
  } catch (error) {
    console.error("[Audits API] Blob save error:", error)
    return NextResponse.json(
      { error: "Failed to save audit: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// GET — Load a published audit by ID, or list all audits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      // Fetch a specific audit by ID - try multiple search strategies
      let { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })

      // If not found, try without .json
      if (blobs.length === 0) {
        const result = await list({ prefix: `${BLOB_PREFIX}${id}` })
        blobs = result.blobs.filter(b => b.pathname.endsWith('.json'))
      }

      // If still not found, search all and match
      if (blobs.length === 0) {
        const allResult = await list({ prefix: BLOB_PREFIX })
        const matchingBlob = allResult.blobs.find(b => 
          b.pathname.includes(id) || 
          b.pathname.replace(BLOB_PREFIX, '').replace('.json', '') === id
        )
        if (matchingBlob) {
          blobs = [matchingBlob]
        }
      }

      if (blobs.length === 0) {
        return NextResponse.json({ audit: null, error: "Not found" })
      }

      // Fetch the JSON content - try public URL first, then private get()
      let audit
      try {
        const res = await fetch(blobs[0].url, { cache: 'no-store' })
        if (res.ok) {
          audit = await res.json()
        } else {
          throw new Error("Public fetch failed")
        }
      } catch {
        // Try private access
        try {
          const result = await get(blobs[0].pathname, { access: 'private' })
          if (result && result.stream) {
            const text = await new Response(result.stream).text()
            audit = JSON.parse(text)
          }
        } catch {
          return NextResponse.json({ audit: null, error: "Fetch failed" })
        }
      }
      
      if (!audit) {
        return NextResponse.json({ audit: null, error: "Parse failed" })
      }
      
      return NextResponse.json({ audit })
    }

    // List all audits (for portfolio page)
    const { blobs } = await list({ prefix: BLOB_PREFIX })

    const audits = await Promise.all(
      blobs
        .filter((b) => b.pathname.endsWith(".json"))
        .map(async (b) => {
          try {
            // Try public URL first
            const res = await fetch(b.url, { cache: 'no-store' })
            if (res.ok) {
              return await res.json()
            }
            // Fall back to private get()
            const result = await get(b.pathname, { access: 'private' })
            if (result && result.stream) {
              const text = await new Response(result.stream).text()
              return JSON.parse(text)
            }
            return null
          } catch {
            return null
          }
        })
    )

    return NextResponse.json({
      audits: audits.filter(Boolean),
      count: audits.filter(Boolean).length,
    })
  } catch (error) {
    console.error("Blob load error:", error)
    return NextResponse.json(
      { error: "Failed to load audits" },
      { status: 500 }
    )
  }
}

// PATCH — Verify founder key (for frontend auth)
export async function PATCH(request: NextRequest) {
  try {
    const { founderKey } = await request.json()
    
    if (founderKey === FOUNDER_KEY) {
      return NextResponse.json({ valid: true })
    }
    
    return NextResponse.json({ valid: false }, { status: 401 })
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 })
  }
}

// DELETE — Remove a published audit (founder-only)
export async function DELETE(request: NextRequest) {
  try {
    const { id, founderKey } = await request.json()

    // Authenticate founder
    if (founderKey !== FOUNDER_KEY) {
      return NextResponse.json({ error: "Unauthorized - invalid founder key" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "Missing audit ID" }, { status: 400 })
    }

    // Find the blob by prefix
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })

    if (blobs.length === 0) {
      // Try without .json suffix (in case ID already includes it)
      const { blobs: altBlobs } = await list({ prefix: `${BLOB_PREFIX}${id}` })
      
      if (altBlobs.length === 0) {
        return NextResponse.json({ error: "Audit not found in Blob storage" }, { status: 404 })
      }
      
      // Delete alt blobs
      await Promise.all(altBlobs.map((b) => del(b.url)))
      return NextResponse.json({ success: true, deleted: id })
    }

    // Delete all matching blobs (usually just one)
    await Promise.all(blobs.map((b) => del(b.url)))

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error("[v0] Blob delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete audit: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
