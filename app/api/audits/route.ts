// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Audit Persistence via Supabase (FREE)
// Migrated from Vercel Blob to Supabase to avoid $20/month cost
// ═══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { isFounderRequest, isValidFounderKey, requireFounder } from "@/lib/founder-auth"

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — Save a published audit report (founder-only)
export async function POST(request: NextRequest) {
  const denied = await requireFounder(request)
  if (denied) return denied

  try {
    const body = await request.json()
    const { audit } = body

    if (!audit || !audit.id || !audit.name) {
      return NextResponse.json({ error: "Invalid audit data - missing id or name" }, { status: 400 })
    }

    // Upsert: insert or update if exists
    const { data, error } = await supabase
      .from("audits")
      .upsert({
        id: audit.id,
        name: audit.name,
        data: audit,
      }, { onConflict: "id" })
      .select()
      .single()

    if (error) {
      console.error("[Audits API] Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: audit.id,
    })
  } catch (error) {
    console.error("[Audits API] Save error:", error)
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
      // Fetch a specific audit by ID
      const { data, error } = await supabase
        .from("audits")
        .select("data")
        .eq("id", id)
        .single()

      if (error || !data) {
        return NextResponse.json({ audit: null, error: "Not found" })
      }

      return NextResponse.json({ audit: data.data })
    }

    // List all audits (for portfolio page)
    const { data, error } = await supabase
      .from("audits")
      .select("data")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[Audits API] List error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const audits = data?.map(row => row.data) || []

    return NextResponse.json({
      audits,
      count: audits.length,
    })
  } catch (error) {
    console.error("[Audits API] Load error:", error)
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
    
    if (isValidFounderKey(founderKey)) {
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
    if (!(await isFounderRequest(request, founderKey))) {
      return NextResponse.json({ error: "Unauthorized - invalid founder key" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "Missing audit ID" }, { status: 400 })
    }

    const { error } = await supabase
      .from("audits")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error("[Audits API] Delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete audit" },
      { status: 500 }
    )
  }
}
