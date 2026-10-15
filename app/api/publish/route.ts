// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API with SHA256 Hash (Anti-Tampering)
// 1. Generate SHA256 hash → embedded in HTML meta tag
// 2. HTML report → GitHub (public verification + download)
// 3. Audit metadata + hash → Supabase DB (source of truth)
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { requireFounder } from "@/lib/founder-auth"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"

// Generate SHA256 hash for audit integrity verification
function generateAuditHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

export async function POST(req: Request) {
  const denied = await requireFounder(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const { project, portfolioData } = body

    // Support both old format (htmlReport) and new format (files array)
    const files: { path: string; content: string; message: string }[] = body.files || []
    const htmlReport: string | undefined = body.htmlReport

    if (!project?.name) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // If old format (single htmlReport), convert to files array
    if (htmlReport && files.length === 0) {
      const htmlFileName = body.fileName?.replace(/\.(pdf|json)$/, ".html") || 
        `SOLAY39-${project.name.replace(/\s+/g, "-")}-Audit-${new Date().toISOString().slice(0, 10)}.html`
      files.push({
        path: `audits/${htmlFileName}`,
        content: Buffer.from(htmlReport, "utf-8").toString("base64"),
        message: `[Solay39] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
      })
    }

    if (files.length === 0) {
      return Response.json({ error: "No files to publish" }, { status: 400 })
    }

    // Find the HTML file content for hash generation
    const htmlFile = files.find(f => f.path.endsWith(".html"))
    const htmlContent = htmlFile ? decodeURIComponent(escape(atob(htmlFile.content))) : ""
    const auditHash = htmlContent ? generateAuditHash(htmlContent) : ""

    // Inject hash into HTML meta tag
    if (htmlFile && auditHash) {
      const htmlWithHash = htmlContent.replace(
        /<head>/i,
        `<head>\n    <meta name="audit-hash" content="${auditHash}">\n    <meta name="audit-timestamp" content="${new Date().toISOString()}">\n    <meta name="audit-version" content="1.0.0">`
      )
      htmlFile.content = Buffer.from(htmlWithHash, "utf-8").toString("base64")
    }

    const htmlSizeKB = htmlContent ? Math.round(htmlContent.length / 1024) : 0
    console.log("[publish] Starting publish:", project.name, `(${files.length} files)`)
    console.log("[publish] SHA256 hash:", auditHash)

    let githubUrl = ""
    let githubError = ""

    // ── Step 1: Upload all files to GitHub ──────────────────
    const token = process.env.GITHUB_TOKEN
    if (token) {
      for (const file of files) {
        try {
          // Check if file exists (get sha for update)
          let sha: string | undefined
          const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${file.path}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          })
          if (checkRes.ok) {
            const existing = await checkRes.json() as { sha?: string }
            sha = existing.sha
          }

          const uploadBody: Record<string, string> = {
            message: file.message,
            content: file.content,
            branch: "main",
          }
          if (sha) uploadBody.sha = sha

          const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${file.path}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(uploadBody),
          })

          if (uploadRes.ok) {
            // Set githubUrl to the HTML preview link
            if (file.path.endsWith(".html")) {
              githubUrl = `https://htmlpreview.github.io/?https://github.com/${GITHUB_REPO}/blob/main/${file.path}`
            }
            console.log("[publish] GitHub upload success:", file.path)
          } else {
            const errData = await uploadRes.json().catch(() => ({})) as { message?: string }
            githubError = `GitHub (${uploadRes.status}): ${errData?.message || "Upload failed"} [${file.path}]`
            console.error("[publish]", githubError)
          }
        } catch (err) {
          githubError = err instanceof Error ? err.message : String(err)
          console.error("[publish] GitHub error:", githubError)
        }
      }
    } else {
      githubError = "GITHUB_TOKEN not configured"
    }

    // ── Step 2: Save FULL audit to Supabase DB ────────────────
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
            auditHash,
            auditVersion: "1.0.0",
            githubUrl,
            publishedAt: new Date().toISOString(),
            htmlSizeKB,
          },
        }, { onConflict: "id" })

        if (dbError) {
          console.error("[publish] Supabase DB error:", dbError.message)
        } else {
          supabaseSaved = true
          console.log("[publish] Saved to Supabase:", portfolioData.id)
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
      auditHash,
      htmlSizeKB,
      filesUploaded: files.length,
      message: githubUrl 
        ? `Published ${files.length} files with SHA256: ${auditHash.slice(0, 16)}...`
        : supabaseSaved 
          ? `Saved to Supabase. GitHub: ${githubError}`
          : "Publish failed",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[publish] Fatal error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
