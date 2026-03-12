// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (Vercel Blob + GitHub Upload)
// Saves the audit JSON to Vercel Blob for persistence
// ════════════════════════════════════════════════════════════════

import { put, list, del } from "@vercel/blob"

const GITHUB_REPO = "sanettanammurata-max/Solay39-"
const GITHUB_API = "https://api.github.com"
const BLOB_PREFIX = "audits/"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Support multiple payload formats:
    // 1. { audit: {...} } - direct audit save
    // 2. { project, pdfBase64, fileName, portfolioData } - full publish with PDF
    const audit = body.audit ?? body.portfolioData ?? body.project
    const { pdfBase64, fileName } = body

    // ── Save audit JSON to Vercel Blob (REQUIRED) ─────────────
    let blobUrl = ""
    let blobError = ""
    
    if (audit?.id && audit?.name) {
      const blobPath = `${BLOB_PREFIX}${audit.id}.json`
      
      try {
        // Delete existing blob to allow overwrite
        const { blobs: existing } = await list({ prefix: blobPath })
        if (existing.length > 0) {
          await del(existing[0].url)
        }
        
        // Save to Vercel Blob
        const blob = await put(blobPath, JSON.stringify(audit), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        })
        
        blobUrl = blob.url
        console.log("[publish] Audit saved to Blob:", blobUrl)
      } catch (err) {
        blobError = `Blob save error: ${err instanceof Error ? err.message : String(err)}`
        console.error("[publish]", blobError)
      }
    } else {
      blobError = "Missing audit.id or audit.name - audit not saved to Blob"
      console.warn("[publish]", blobError)
    }

    // ── Upload PDF to GitHub (OPTIONAL) ───────────────────────
    let githubUrl = ""
    let githubError = ""

    if (pdfBase64 && fileName && audit?.name) {
      const token = process.env.GITHUB_TOKEN
      if (token) {
        try {
          const path = `audits/${fileName}`

          // Check if file already exists (to get sha for update)
          let sha: string | undefined
          try {
            const checkRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            })
            if (checkRes.ok) {
              const existing = await checkRes.json()
              sha = existing.sha
            }
          } catch {
            // File doesn't exist, that's fine
          }

          const ghBody: Record<string, string> = {
            message: `[Solay39 Audit] ${audit.name} - ${new Date().toISOString().slice(0, 10)}`,
            content: pdfBase64,
            branch: "main",
          }
          if (sha) ghBody.sha = sha

          const uploadRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(ghBody),
          })

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            githubUrl = uploadData.content?.html_url || `https://github.com/${GITHUB_REPO}/blob/main/${path}`
          } else {
            const errData = await uploadRes.json().catch(() => null)
            githubError = `GitHub upload failed (${uploadRes.status}): ${errData?.message || "Unknown error"}`
          }
        } catch (err) {
          githubError = `GitHub upload error: ${err instanceof Error ? err.message : String(err)}`
        }
      } else {
        githubError = "GITHUB_TOKEN not configured"
      }
    }

    return Response.json({
      success: !!blobUrl,
      id: audit?.id,
      blobUrl,
      blobError: blobError || undefined,
      githubUrl,
      githubError: githubError || undefined,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[publish] Error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}

// GET — Health check
export async function GET() {
  return Response.json({
    status: "ok",
    route: "/api/publish",
    description: "POST an audit object to save it to Vercel Blob and optionally GitHub.",
  })
}
