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
    const { audit } = await request.json()

    if (!audit || !audit.id || !audit.name) {
      return NextResponse.json({ error: "Invalid audit data" }, { status: 400 })
    }

    const blobPath = `${BLOB_PREFIX}${audit.id}.json`

    const blob = await put(blobPath, JSON.stringify(audit), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      id: audit.id,
    })
  } catch (error) {
    console.error("Blob save error:", error)
    return NextResponse.json(
      { error: "Failed to save audit" },
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
      const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })

      if (blobs.length === 0) {
        return NextResponse.json({ audit: null })
      }

      // Fetch the JSON content from the blob URL
      const res = await fetch(blobs[0].url)
      if (!res.ok) {
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

// DELETE — Remove a published audit (founder-only)
export async function DELETE(request: NextRequest) {
  try {
    const { id, founderKey } = await request.json()

    console.log("[v0] DELETE audit request - id:", id, "keyProvided:", !!founderKey)
    console.log("[v0] FOUNDER_KEY configured:", !!FOUNDER_KEY, "matches:", founderKey === FOUNDER_KEY)

    // Authenticate founder
    if (founderKey !== FOUNDER_KEY) {
      console.log("[v0] Auth failed - provided:", founderKey?.slice(0, 5) + "...", "expected:", FOUNDER_KEY?.slice(0, 5) + "...")
      return NextResponse.json({ error: "Unauthorized - invalid founder key" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "Missing audit ID" }, { status: 400 })
    }

    // Find the blob by prefix
    console.log("[v0] Searching for blob:", `${BLOB_PREFIX}${id}.json`)
    const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}.json` })
    console.log("[v0] Found blobs:", blobs.length, blobs.map(b => b.pathname))

    if (blobs.length === 0) {
      // Try without .json suffix (in case ID already includes it)
      const { blobs: altBlobs } = await list({ prefix: `${BLOB_PREFIX}${id}` })
      console.log("[v0] Alt search found:", altBlobs.length)
      
      if (altBlobs.length === 0) {
        return NextResponse.json({ error: "Audit not found in Blob storage" }, { status: 404 })
      }
      
      // Delete alt blobs
      await Promise.all(altBlobs.map((b) => del(b.url)))
      console.log("[v0] Deleted alt blobs for:", id)
      return NextResponse.json({ success: true, deleted: id })
    }

    // Delete all matching blobs (usually just one)
    await Promise.all(blobs.map((b) => del(b.url)))
    console.log("[v0] Successfully deleted audit:", id)

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error("[v0] Blob delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete audit: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
