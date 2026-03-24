// ════════════════════════════════════════════════════════════════
// SOLAY39 — Republish Audit API
// Reads audit from Supabase → Uploads HTML to GitHub
// Use this to sync an existing audit to GitHub with updated data
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"
// Hardcoded founder key - same as all other APIs
const FOUNDER_KEY = "Solay39!Audit#2025"

function generateAuditHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

export async function POST(req: Request) {
  try {
    const { auditId, founderKey } = await req.json()

    // Verify founder key
    if (founderKey !== FOUNDER_KEY) {
      return Response.json({ error: "Invalid founder key" }, { status: 401 })
    }

    if (!auditId) {
      return Response.json({ error: "Missing auditId" }, { status: 400 })
    }

    // ── Step 1: Read audit from Supabase ──────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: audit, error: fetchError } = await supabase
      .from("audits")
      .select("*")
      .eq("id", auditId)
      .single()

    if (fetchError || !audit) {
      return Response.json({ error: `Audit not found: ${fetchError?.message}` }, { status: 404 })
    }

    // Get HTML report from audit data
    const portfolioData = audit.data
    let htmlReport = portfolioData?.htmlReport

    if (!htmlReport || htmlReport.length < 1000) {
      return Response.json({ 
        error: "No HTML report found in audit data. Re-publish from workspace first." 
      }, { status: 400 })
    }

    // Generate new hash
    const auditHash = generateAuditHash(htmlReport)
    
    // Update hash in HTML if not present or different
    if (!htmlReport.includes('name="audit-hash"')) {
      htmlReport = htmlReport.replace(
        /<head>/i,
        `<head>\n    <meta name="audit-hash" content="${auditHash}">\n    <meta name="audit-timestamp" content="${new Date().toISOString()}">\n    <meta name="audit-version" content="1.0.0">`
      )
    }

    const htmlSizeKB = Math.round(htmlReport.length / 1024)
    console.log("[republish] Audit:", audit.name, "- HTML size:", htmlSizeKB, "KB")

    // ── Step 2: Upload to GitHub ──────────────────────────────────
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return Response.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const projectName = portfolioData?.name || audit.name || "Unknown"
    const auditDate = portfolioData?.date || new Date().toISOString().slice(0, 10)
    const fileName = `SOLAY39-${projectName.replace(/\s+/g, "-")}-Audit-${auditDate}.html`
    const path = `audits/${fileName}`

    let githubUrl = ""
    let githubError = ""

    try {
      // Check if file exists (to get SHA for update)
      const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      let existingSha = ""
      if (checkRes.ok) {
        const existingFile = await checkRes.json()
        existingSha = existingFile.sha
        console.log("[republish] File exists, will update. SHA:", existingSha.slice(0, 8))
      }

      // Upload/Update file
      const contentBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")
      const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `[Republish] ${projectName} audit - ${htmlSizeKB}KB - ${new Date().toISOString()}`,
          content: contentBase64,
          ...(existingSha && { sha: existingSha }),
        }),
      })

      if (uploadRes.ok) {
        const rawUrl = `https://github.com/${GITHUB_REPO}/blob/main/${path}`
        githubUrl = `https://htmlpreview.github.io/?${rawUrl}`
        console.log("[republish] GitHub upload successful:", githubUrl)
      } else {
        const errText = await uploadRes.text()
        githubError = `GitHub error (${uploadRes.status}): ${errText}`
        console.error("[republish]", githubError)
      }
    } catch (err) {
      githubError = `GitHub error: ${err instanceof Error ? err.message : String(err)}`
      console.error("[republish]", githubError)
    }

    // ── Step 3: Update Supabase with new GitHub URL ───────────────
    if (githubUrl) {
      const { error: updateError } = await supabase
        .from("audits")
        .update({
          data: {
            ...portfolioData,
            htmlReport,
            auditHash,
            githubUrl,
            lastSyncedAt: new Date().toISOString(),
          },
        })
        .eq("id", auditId)

      if (updateError) {
        console.error("[republish] Supabase update error:", updateError.message)
      }
    }

    return Response.json({
      success: !!githubUrl,
      githubUrl: githubUrl || undefined,
      githubError: githubError || undefined,
      auditHash,
      htmlSizeKB,
      message: githubUrl 
        ? `Synced to GitHub (${htmlSizeKB}KB)`
        : `GitHub sync failed: ${githubError}`,
    })

  } catch (err) {
    console.error("[republish] Error:", err)
    return Response.json({ 
      error: `Server error: ${err instanceof Error ? err.message : String(err)}` 
    }, { status: 500 })
  }
}
