// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API (GitHub Upload + Portfolio Store)
// ════════════════════════════════════════════════════════════════

const GITHUB_REPO = "gustavogondek/Solay39-audit"
const GITHUB_API = "https://api.github.com"

export async function POST(req: Request) {
  try {
    const { project, htmlReport, fileName, portfolioData } = await req.json()

    if (!project?.name || !htmlReport || !fileName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // ── Step 1: Convert HTML → real PDF via Puppeteer backend ──
    let pdfBase64 = ""
    let pdfError = ""

    const backendUrl = process.env.STATIC_ANALYSIS_API_URL
    const backendKey = process.env.SECURITY_API_KEY || "solay39-security-key"

    if (backendUrl) {
      try {
        console.log("[v0] Requesting PDF from backend:", backendUrl)
        const pdfRes = await fetch(`${backendUrl}/api/generate-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": backendKey,
          },
          body: JSON.stringify({ html: htmlReport }),
        })

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json()
          pdfBase64 = pdfData.pdfBase64 || ""
          console.log("[v0] PDF generated, base64 length:", pdfBase64.length)
        } else {
          const errText = await pdfRes.text()
          pdfError = `PDF backend error (${pdfRes.status}): ${errText}`
          console.error("[v0]", pdfError)
        }
      } catch (err) {
        pdfError = `PDF backend unreachable: ${err instanceof Error ? err.message : String(err)}`
        console.error("[v0]", pdfError)
      }
    } else {
      // Fallback: encode HTML as base64 if no backend (will upload as .html)
      pdfError = "STATIC_ANALYSIS_API_URL not configured — uploading HTML fallback"
      console.warn("[v0]", pdfError)
      pdfBase64 = Buffer.from(htmlReport).toString("base64")
    }

    if (!pdfBase64) {
      return Response.json({ error: `PDF generation failed: ${pdfError}` }, { status: 500 })
    }

    // ── Step 2: Upload real PDF to GitHub ──
    // Always use .pdf extension — the content is now a real PDF binary
    const pdfFileName = fileName.replace(/\.html$/, ".pdf")

    let githubUrl = ""
    let githubError = ""

    const token = process.env.GITHUB_TOKEN
    if (token) {
      try {
        const path = `audits/${pdfFileName}`

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
            sha = (existing as { sha?: string }).sha
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

        // Verify repo access
        const repoCheck = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        })

        if (!repoCheck.ok) {
          const repoErr = await repoCheck.json().catch(() => ({}))
          throw new Error(`Repository not accessible: ${(repoErr as { message?: string }).message || repoCheck.status}`)
        }

        console.log("[v0] GitHub: Uploading PDF to", path)
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
          githubUrl = (uploadData as { content?: { html_url?: string } }).content?.html_url ||
            `https://github.com/${GITHUB_REPO}/blob/main/${path}`
          console.log("[v0] GitHub: Upload successful:", githubUrl)
        } else {
          const errData = await uploadRes.json().catch(() => null)
          githubError = `GitHub upload failed (${uploadRes.status}): ${(errData as { message?: string })?.message || "Unknown error"}`
          console.error("[v0]", githubError)
        }
      } catch (err) {
        githubError = `GitHub upload error: ${err instanceof Error ? err.message : String(err)}`
        console.error("[v0]", githubError)
      }
    } else {
      githubError = "GITHUB_TOKEN not configured."
    }

    return Response.json({
      success: true,
      githubUrl,
      githubError: githubError || pdfError || undefined,
      portfolioData,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Publish error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
