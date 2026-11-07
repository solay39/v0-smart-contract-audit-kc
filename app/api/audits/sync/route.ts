// app/api/audits/sync/route.ts
// Sincronizza un audit dal localStorage al Blob Vercel
// Chiamato automaticamente quando il client trova un audit in localStorage non ancora nel Blob

import { put } from "@vercel/blob"
import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-auth"

const BLOB_PREFIX = "audits/"

export async function POST(request: NextRequest) {
  const denied = await requireFounder(request)
  if (denied) return denied

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.from("audits").upsert({
        id: audit.id,
        name: audit.name,
        data: {
          ...audit,
          publicationSource: "founder-sync",
          syncedAt: new Date().toISOString(),
        },
      }, { onConflict: "id" })
      if (error) throw new Error(`Supabase sync failed: ${error.message}`)
    }
    console.log("[sync] Saved:", audit.id, "->", blob.url)
    return NextResponse.json({ success: true, url: blob.url, id: audit.id, persisted: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
