// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (Simplified - GitHub Only)
// 1. HTML report → GitHub (public verification + download)
// 2. Audit metadata → Supabase DB
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"

export async function POST(req: Request) {
  try {
    const { project, htmlReport, fileName, portfolioData } = await req.json()

    if (!project?.name || !htmlReport) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Use .html extension - viewable via htmlpreview.github.io
    const htmlFileName = fileName?.replace(/\.(pdf|json)$/, ".html") || 
      `SOLAY39-${project.name.replace(/\s+/g, "-")}-Audit-${new Date().toISOString().slice(0, 10)}.html`

    const htmlSizeKB = Math.round(htmlReport.length / 1024)
    console.log("[publish] Starting publish:", project.name, "- HTML size:", htmlSizeKB, "KB")

    let githubUrl = ""
    let githubError = ""

    // ── Step 1: Upload HTML to GitHub ──────────────────────────────
    const token = process.env.GITHUB_TOKEN
    if (token) {
      try {
        const path = `audits/${htmlFileName}`
        const contentBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")

        // Check if file exists (get sha for update)
        let sha: string | undefined
        const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        })
        if (checkRes.ok) {
          const existing = await checkRes.json() as { sha?: string }
          sha = existing.sha
        }

        const body: Record<string, string> = {
          message: `[Solay39] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
          content: contentBase64,
          branch: "main",
        }
        if (sha) body.sha = sha

        const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        if (uploadRes.ok) {
          githubUrl = `https://htmlpreview.github.io/?https://github.com/${GITHUB_REPO}/blob/main/${path}`
          console.log("[publish] GitHub upload success:", githubUrl)
        } else {
          const errData = await uploadRes.json().catch(() => ({})) as { message?: string }
          githubError = `GitHub (${uploadRes.status}): ${errData?.message || "Upload failed"}`
          console.error("[publish]", githubError)
        }
      } catch (err) {
        githubError = err instanceof Error ? err.message : String(err)
        console.error("[publish] GitHub error:", githubError)
      }
    } else {
      githubError = "GITHUB_TOKEN not configured"
    }

    // ── Step 2: Save FULL audit to Supabase DB (including HTML report) ────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let supabaseSaved = false
    
    if (supabaseUrl && supabaseKey && portfolioData) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { error: dbError } = await supabase.from("audits").upsert({
          id: portfolioData.id,
          name: portfolioData.name,
          data: {
            ...portfolioData,
            // Include the full HTML report for persistence
            htmlReport,
            githubUrl,
            publishedAt: new Date().toISOString(),
            htmlSizeKB,
          },
        }, { onConflict: "id" })

        if (dbError) {
          console.error("[publish] Supabase DB error:", dbError.message)
        } else {
          supabaseSaved = true
          console.log("[publish] Saved to Supabase:", portfolioData.id, "with HTML report")
        }
      } catch (err) {
        console.error("[publish] Supabase save error:", err)
      }
    }

    return Response.json({
      success: !!githubUrl || supabaseSaved,
      githubUrl: githubUrl || undefined,
      githubError: githubError || undefined,
      supabaseSaved,
      htmlSizeKB,
      message: githubUrl 
        ? `Report published (${htmlSizeKB}KB). Saved to Supabase${supabaseSaved ? " ✓" : " (failed)"}. Open GitHub link and use Ctrl+P to save as PDF.`
        : supabaseSaved 
          ? `Report saved to Supabase (${htmlSizeKB}KB). GitHub upload failed.`
          : "Publish failed",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[publish] Fatal error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
