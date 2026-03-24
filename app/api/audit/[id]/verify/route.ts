// ════════════════════════════════════════════════════════════════
// SOLAY39 — Verify Audit Hash API
// Returns SHA256 hash for audit integrity verification
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Database not configured" }, { status: 500 })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: audit, error } = await supabase
      .from("audits")
      .select("id, name, data")
      .eq("id", id)
      .single()

    if (error || !audit) {
      return Response.json({ error: "Audit not found" }, { status: 404 })
    }

    const auditData = audit.data as Record<string, unknown>
    
    // Get stored hash or compute from HTML
    let storedHash = auditData?.auditHash as string | undefined
    let computedHash = ""
    
    if (auditData?.htmlReport) {
      computedHash = createHash("sha256")
        .update(auditData.htmlReport as string, "utf8")
        .digest("hex")
    }

    return Response.json({
      id: audit.id,
      name: audit.name,
      auditHash: storedHash || computedHash,
      auditVersion: auditData?.auditVersion || "1.0.0",
      publishedAt: auditData?.publishedAt,
      githubUrl: auditData?.githubUrl,
      verified: storedHash ? storedHash === computedHash : !!computedHash,
      htmlSizeKB: auditData?.htmlSizeKB,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
