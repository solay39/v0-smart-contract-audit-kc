// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (GitHub Upload + Portfolio Store)
// ════════════════════════════════════════════════════════════════

const GITHUB_REPO = "gustavogondek/Solay39-audit"
const GITHUB_API = "https://api.github.com"

export async function POST(req: Request) {
  try {
    const { project, pdfBase64, fileName, portfolioData } = await req.json()

    if (!project?.name || !pdfBase64 || !fileName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    let githubUrl = ""
    let githubError = ""

    // Try to upload to GitHub if token is available
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

        const body: Record<string, string> = {
          message: `[Solay39 Audit] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
          content: pdfBase64,
          branch: "main",
        }
        if (sha) body.sha = sha

        // First verify the repo exists and is accessible
        console.log("[v0] GitHub: Checking repo access for", GITHUB_REPO)
        const repoCheck = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        })
        
        console.log("[v0] GitHub: Repo check status:", repoCheck.status)
        
        if (!repoCheck.ok) {
          const repoErr = await repoCheck.json().catch(() => ({}))
          console.error("[v0] GitHub: Repo not accessible:", repoErr)
          throw new Error(`Repository not accessible: ${repoErr.message || repoCheck.status}`)
        }

        console.log("[v0] GitHub: Uploading to", path)
        const uploadRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        console.log("[v0] GitHub: Upload response status:", uploadRes.status)

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          const rawUrl = `https://github.com/${GITHUB_REPO}/blob/main/${path}`
          githubUrl = `https://htmlpreview.github.io/?${rawUrl}`
          console.log("[v0] GitHub: Upload successful:", githubUrl)
        } else {
          const errData = await uploadRes.json().catch(() => null)
          console.error("[v0] GitHub: Upload failed:", uploadRes.status, errData)
          githubError = `GitHub upload failed (${uploadRes.status}): ${errData?.message || "Unknown error"}`
        }
      } catch (err) {
        githubError = `GitHub upload error: ${err instanceof Error ? err.message : String(err)}`
        console.error("[v0]", githubError)
      }
    } else {
      githubError = "GITHUB_TOKEN not configured. PDF was not uploaded to GitHub."
    }

    return Response.json({
      success: true,
      githubUrl,
      githubError: githubError || undefined,
      portfolioData,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Publish error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
