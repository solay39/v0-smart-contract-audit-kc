// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (Simplified)
// 1. HTML report → Supabase Storage (download link)
// 2. HTML report → GitHub (public verification)
// 3. Audit metadata → Supabase DB
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"
const GITHUB_API = "https://api.github.com"

export async function POST(req: Request) {
  try {
    const { project, htmlReport, fileName, portfolioData } = await req.json()

    if (!project?.name || !htmlReport) {
      return Response.json({ error: "Missing required fields (project name or htmlReport)" }, { status: 400 })
    }

    // Use .html extension - clients can print to PDF from browser
    const htmlFileName = fileName?.replace(/\.(pdf|json)$/, ".html") || 
      `SOLAY39-${project.name.replace(/\s+/g, "-")}-Audit-${new Date().toISOString().slice(0, 10)}.html`

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Step 1: Save HTML to Supabase Storage ─────────────────────
    let storageUrl = ""
    let storageError = ""

    try {
      const htmlBuffer = Buffer.from(htmlReport, "utf-8")
      const storagePath = `audits/${htmlFileName}`

      // Upload to Supabase Storage (bucket: audit-reports)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audit-reports")
        .upload(storagePath, htmlBuffer, {
          contentType: "text/html",
          upsert: true,
        })

      if (uploadError) {
        // Try to create bucket if it doesn't exist
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          await supabase.storage.createBucket("audit-reports", { public: true })
          // Retry upload
          const { data: retryData, error: retryError } = await supabase.storage
            .from("audit-reports")
            .upload(storagePath, htmlBuffer, {
              contentType: "text/html",
              upsert: true,
            })
          if (retryError) throw retryError
          if (retryData) {
            const { data: urlData } = supabase.storage.from("audit-reports").getPublicUrl(storagePath)
            storageUrl = urlData.publicUrl
          }
        } else {
          throw uploadError
        }
      } else if (uploadData) {
        const { data: urlData } = supabase.storage.from("audit-reports").getPublicUrl(storagePath)
        storageUrl = urlData.publicUrl
      }

      console.log("[publish] Supabase Storage upload:", storageUrl)
    } catch (err) {
      storageError = err instanceof Error ? err.message : String(err)
      console.error("[publish] Supabase Storage error:", storageError)
    }

    // ── Step 2: Upload to GitHub ──────────────────────────────────
    let githubUrl = ""
    let githubError = ""

    const token = process.env.GITHUB_TOKEN
    if (token) {
      try {
        const path = `audits/${htmlFileName}`
        const contentBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")

        // Check if file exists (get sha for update)
        let sha: string | undefined
        try {
          const checkRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          })
          if (checkRes.ok) {
            const existing = await checkRes.json() as { sha?: string }
            sha = existing.sha
          }
        } catch { /* file doesn't exist */ }

        const body: Record<string, string> = {
          message: `[Solay39 Audit] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
          content: contentBase64,
          branch: "main",
        }
        if (sha) body.sha = sha

        const uploadRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        if (uploadRes.ok) {
          // Use htmlpreview for direct viewing
          githubUrl = `https://htmlpreview.github.io/?https://github.com/${GITHUB_REPO}/blob/main/${path}`
          console.log("[publish] GitHub upload successful:", githubUrl)
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

    // ── Step 3: Save audit metadata to Supabase DB ────────────────
    if (portfolioData) {
      try {
        const { error: dbError } = await supabase.from("audits").upsert({
          id: portfolioData.id,
          name: portfolioData.name,
          data: {
            ...portfolioData,
            storageUrl,
            githubUrl,
            publishedAt: new Date().toISOString(),
          },
        }, { onConflict: "id" })

        if (dbError) console.error("[publish] Supabase DB error:", dbError)
        else console.log("[publish] Audit metadata saved:", portfolioData.id)
      } catch (err) {
        console.error("[publish] DB save error:", err)
      }
    }

    return Response.json({
      success: true,
      storageUrl,     // Supabase Storage URL for download
      githubUrl,      // GitHub URL for public verification
      githubError: githubError || undefined,
      storageError: storageError || undefined,
      message: storageUrl 
        ? "Report published! Open in browser and use Ctrl+P to save as PDF."
        : "Published to GitHub only.",
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[publish] Fatal error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
