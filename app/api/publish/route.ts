// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (GitHub Upload + Portfolio Store)
// ════════════════════════════════════════════════════════════════

const GITHUB_REPO = "sanettanammurata-max/Solay39-"
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
          const uploadData = await uploadRes.json()
          githubUrl = uploadData.content?.html_url || `https://github.com/${GITHUB_REPO}/blob/main/${path}`
        } else {
          const errData = await uploadRes.json().catch(() => null)
          githubError = `GitHub upload failed (${uploadRes.status}): ${errData?.message || "Unknown error"}`
          console.error("[v0] GitHub upload error:", githubError)
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
