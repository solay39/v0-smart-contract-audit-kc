// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Audit Persistence via Vercel Blob
// Stores published audit reports as JSON so they survive across
// browsers, devices, and deployments.
// ═══════════════════════════════════════════════════════════════

import { put, list, del } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"

// Founder password for protected operations (delete)
const FOUNDER_KEY = process.env.SOLAY39_FOUNDER_KEY || "solay39-founder-2024"

// POST — Save a published audit report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const audit = body.audit

    if (!audit) {
      console.error("[audits] Missing audit in body:", Object.keys(body))
      return NextResponse.json({ error: "Missing audit object" }, { status: 400 })
    }
    
    if (!audit.id) {
      console.error("[audits] Missing audit.id:", audit)
      return NextResponse.json({ error: "Missing audit.id" }, { status: 400 })
    }

    if (!audit.name) {
      console.error("[audits] Missing audit.name:", audit.id)
      return NextResponse.json({ error: "Missing audit.name" }, { status: 400 })
    }

    const blobPath = `${BLOB_PREFIX}${audit.id}.json`
    console.log("[audits] Saving to Blob:", blobPath)

    // First check if this audit already exists and delete it to update
    try {
      const { blobs: existing } = await list({ prefix: blobPath })
      if (existing.length > 0) {
        console.log("[audits] Deleting existing audit:", existing[0].pathname)
        await del(existing[0].url)
      }
    } catch (delErr) {
      console.warn("[audits] Delete check failed (non-critical):", delErr)
    }

    const blob = await put(blobPath, JSON.stringify(audit), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    })
    
    console.log("[audits] Blob pathname:", blob.pathname)
    console.log("[audits] Blob URL:", blob.url)

    console.log("[audits] Saved successfully:", blob.url)

    return NextResponse.json({
      success: true,
      url: blob.url,
      id: audit.id,
    })
  } catch (error) {
    console.error("[audits] Blob save error:", error)
    return NextResponse.json(
      { error: "Failed to save audit", details: error instanceof Error ? error.message : String(error) },
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
      // Fetch a specific audit by ID
      // Try exact match first, then prefix match (in case of random suffix)
      let { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })
      
      // If exact match fails, try prefix without .json (handles random suffix)
      if (blobs.length === 0) {
        const prefixResult = await list({ prefix: `${BLOB_PREFIX}${id}` })
        blobs = prefixResult.blobs.filter(b => b.pathname.includes(id) && b.pathname.endsWith('.json'))
      }
      
      console.log(`[audits] GET id=${id}, found ${blobs.length} blobs`)

      if (blobs.length === 0) {
        return NextResponse.json({ audit: null })
      }

      // Fetch the JSON content from the blob URL
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
        console.log(`[audits] Blob fetch failed for ${id}:`, res.status)
        return NextResponse.json({ audit: null })
      }

      const audit = await res.json()
      return NextResponse.json({ audit })
    }

    // List all audits (for portfolio page)
    const { blobs } = await list({ prefix: BLOB_PREFIX })

    const audits = await Promise.all(
      blobs
        .filter((b) => b.pathname.endsWith(".json"))
        .map(async (b) => {
          try {
            const res = await fetch(b.url)
            if (!res.ok) return null
            return await res.json()
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

// DELETE — Remove a published audit
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, founderKey, url } = body

    // If founderKey provided, validate it (optional security)
    if (founderKey && founderKey !== FOUNDER_KEY) {
      return NextResponse.json({ error: "Invalid founder key" }, { status: 401 })
    }

    // Support deletion by URL directly or by ID
    if (url) {
      await del(url)
      return NextResponse.json({ success: true, deleted: url })
    }

    if (!id) {
      return NextResponse.json({ error: "Missing audit ID or URL" }, { status: 400 })
    }

    // Find all blobs matching this ID prefix
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}` })

    if (blobs.length === 0) {
      return NextResponse.json({ error: "Audit not found", id }, { status: 404 })
    }

    // Delete all matching blobs
    let deleted = 0
    for (const b of blobs) {
      await del(b.url)
      deleted++
    }

    return NextResponse.json({ success: true, deleted: id, count: deleted })
  } catch (error) {
    console.error("Blob delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete audit", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
