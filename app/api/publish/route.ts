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
      
      // Validate required fields for rendering
      const requiredFields = ['id', 'name', 'score', 'criticals', 'highs', 'mediums', 'lows']
      const missingFields = requiredFields.filter(f => audit[f] === undefined)
      if (missingFields.length > 0) {
        console.warn("[publish] Audit missing fields:", missingFields.join(', '))
      }
      
      console.log("[publish] Saving audit:", audit.id, audit.name, "score:", audit.score)
      
      try {
        // Delete ALL existing blobs with this prefix (handles random suffix issue)
        const { blobs: existing } = await list({ prefix: `${BLOB_PREFIX}${audit.id}` })
        for (const blob of existing) {
          try {
            await del(blob.url)
            console.log("[publish] Deleted existing blob:", blob.pathname)
          } catch {
            // Ignore delete errors
          }
        }
        
        // Ensure audit has all required fields with defaults
        const auditToSave = {
          ...audit,
          score: audit.score ?? 0,
          criticals: audit.criticals ?? 0,
          highs: audit.highs ?? 0,
          mediums: audit.mediums ?? 0,
          lows: audit.lows ?? 0,
          infos: audit.infos ?? 0,
          date: audit.date ?? new Date().toISOString().slice(0, 10),
        }
        
        // Save to Vercel Blob (public store)
        const blob = await put(blobPath, JSON.stringify(auditToSave), {
          access: "public",
          contentType: "application/json",
          addRandomSuffix: false,
        })
        
        blobUrl = blob.url
        console.log("[publish] Audit saved to Blob:", blob.pathname, "URL:", blobUrl)
      } catch (err) {
        blobError = `Blob save error: ${err instanceof Error ? err.message : String(err)}`
        console.error("[publish]", blobError)
      }
    } else {
      blobError = `Missing audit.id (${audit?.id}) or audit.name (${audit?.name}) - audit not saved to Blob`
      console.error("[publish]", blobError, "audit keys:", audit ? Object.keys(audit) : "null")
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

// GET — Health check or list all audits
export async function GET(req: Request) {
  const url = new URL(req.url)
  const listAll = url.searchParams.get("list") === "true"
  
  if (listAll) {
    try {
      const { blobs } = await list({ prefix: BLOB_PREFIX })
      return Response.json({
        count: blobs.length,
        audits: blobs.map(b => ({
          pathname: b.pathname,
          url: b.url,
          uploadedAt: b.uploadedAt,
          size: b.size,
        })),
      })
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 })
    }
  }
  
  return Response.json({
    status: "ok",
    route: "/api/publish",
    description: "POST to save audit, DELETE to remove, GET?list=true to list all.",
  })
}

// DELETE — Remove an audit from Vercel Blob
export async function DELETE(req: Request) {
  try {
    const { id, url: blobUrl } = await req.json()
    
    if (!id && !blobUrl) {
      return Response.json({ error: "Provide 'id' or 'url' to delete" }, { status: 400 })
    }

    let deleted = 0
    
    if (blobUrl) {
      // Delete by URL directly
      await del(blobUrl)
      deleted = 1
    } else if (id) {
      // Delete by ID - find all matching blobs
      const { blobs } = await list({ prefix: `${BLOB_PREFIX}${id}` })
      for (const blob of blobs) {
        await del(blob.url)
        deleted++
      }
    }

    return Response.json({
      success: deleted > 0,
      deleted,
      id,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: `Delete failed: ${msg}` }, { status: 500 })
  }
}
