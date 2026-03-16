// app/api/audits/sync/route.ts
// Sincronizza un audit dal localStorage al Blob Vercel
// Chiamato automaticamente quando il client trova un audit in localStorage non ancora nel Blob

import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

const BLOB_PREFIX = "audits/"

export async function POST(request: NextRequest) {
  try {
    const { audit } = await request.json()
    if (!audit?.id || !audit?.name) {
      return NextResponse.json({ error: "Invalid audit data" }, { status: 400 })
    }
    const blob = await put(
      `${BLOB_PREFIX}${audit.id}.json`,
      JSON.stringify(audit),
      { access: "public", contentType: "application/json", addRandomSuffix: false }
    )
    console.log("[sync] Saved:", audit.id, "->", blob.url)
    return NextResponse.json({ success: true, url: blob.url, id: audit.id })
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
