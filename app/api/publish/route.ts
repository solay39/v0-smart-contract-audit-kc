// ════════════════════════════════════════════════════════════════
// SOLAY39 — Publish Audit API
// 1. HTML → PDF via Railway backend (WeasyPrint)
// 2. PDF → GitHub (binary upload)
// 3. Audit data → Supabase (persistence)
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"

const GITHUB_REPO = "gustavogondek/Solay39-audit"
const GITHUB_API = "https://api.github.com"

export async function POST(req: Request) {
  try {
    const { project, pdfBase64: clientPdfBase64, htmlReport, fileName, portfolioData } = await req.json()

    if (!project?.name || !fileName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Ensure .pdf extension
    const pdfFileName = fileName.endsWith(".pdf") ? fileName : fileName.replace(/\.(html|json)$/, ".pdf")

    // ── Step 1: Convert HTML to PDF ──────
    // Priority: 1) Railway backend (WeasyPrint) 2) Client jsPDF 3) HTML fallback
    let pdfBase64 = ""
    let pdfError = ""
    let usedMethod = ""

    // Method 1: Railway backend (produces best quality multi-page PDFs)
    if (htmlReport) {
      const backendUrl = process.env.STATIC_ANALYSIS_API_URL
      const backendKey = process.env.STATIC_ANALYSIS_API_KEY || process.env.SECURITY_API_KEY || "solay39-analysis-key"

      if (backendUrl) {
        try {
          console.log("[publish] Requesting PDF from Railway backend:", backendUrl)
          const pdfRes = await fetch(`${backendUrl}/api/generate-pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": backendKey,
            },
            body: JSON.stringify({ html: htmlReport }),
            signal: AbortSignal.timeout(30000), // 30s timeout
          })

          if (pdfRes.ok) {
            const pdfData = await pdfRes.json() as { pdfBase64?: string; sizeBytes?: number }
            if (pdfData.pdfBase64 && pdfData.pdfBase64.length > 10000) {
              pdfBase64 = pdfData.pdfBase64
              usedMethod = "railway"
              console.log(`[publish] PDF generated via Railway, size: ${pdfData.sizeBytes} bytes`)
            }
          } else {
            const errText = await pdfRes.text()
            pdfError = `Railway: ${pdfRes.status}`
            console.warn("[publish] Railway PDF failed:", errText)
          }
        } catch (err) {
          pdfError = `Railway unreachable`
          console.warn("[publish] Railway backend error:", err instanceof Error ? err.message : String(err))
        }
      }
    }

    // Method 2: Use client-generated PDF (jsPDF) - only if Railway failed and PDF is substantial
    if (!pdfBase64 && clientPdfBase64 && clientPdfBase64.length > 50000) {
      pdfBase64 = clientPdfBase64
      usedMethod = "jspdf"
      console.log(`[publish] Using client jsPDF (${Math.round(clientPdfBase64.length / 1024)}KB)`)
    }

    // Method 3: HTML fallback (last resort - readable but not PDF)
    let isFallback = false
    if (!pdfBase64 && htmlReport) {
      pdfBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")
      usedMethod = "html"
      isFallback = true
      console.warn("[publish] Using HTML fallback - no PDF backend available")
    }

    if (!pdfBase64) {
      return Response.json({ error: "No PDF or HTML content provided" }, { status: 400 })
    }

    const uploadFileName = isFallback ? pdfFileName.replace(/\.pdf$/, ".html") : pdfFileName
    const uploadContent = pdfBase64
    console.log(`[publish] Upload: ${uploadFileName} (${usedMethod}, ${Math.round(pdfBase64.length / 1024)}KB)`)

    // ── Step 2: Upload to GitHub ──────────────────────────────────
    let githubUrl = ""
    let githubError = ""

    const token = process.env.GITHUB_TOKEN
    if (token) {
      try {
        const path = `audits/${uploadFileName}`

        // Get existing file sha if it exists (needed for updates)
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
        } catch { /* file doesn't exist yet */ }

        const body: Record<string, string> = {
          message: `[Solay39 Audit] ${project.name} - ${new Date().toISOString().slice(0, 10)}`,
          content: uploadContent,
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
          const uploadData = await uploadRes.json() as { content?: { html_url?: string } }
          githubUrl = uploadData.content?.html_url ||
            `https://github.com/${GITHUB_REPO}/blob/main/${path}`
          console.log("[publish] GitHub upload successful:", githubUrl)
        } else {
          const errData = await uploadRes.json().catch(() => null) as { message?: string } | null
          githubError = `GitHub upload failed (${uploadRes.status}): ${errData?.message || "Unknown error"}`
          console.error("[publish]", githubError)
        }
      } catch (err) {
        githubError = `GitHub upload error: ${err instanceof Error ? err.message : String(err)}`
        console.error("[publish]", githubError)
      }
    } else {
      githubError = "GITHUB_TOKEN not configured"
    }

    // ── Step 3: Save audit data to Supabase ───────────────────────
    if (portfolioData && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        await supabase.from("audits").upsert(
          { id: portfolioData.id, name: portfolioData.name, data: { ...portfolioData, githubUrl } },
          { onConflict: "id" }
        )
        console.log("[publish] Supabase audit saved:", portfolioData.id)
      } catch (err) {
        console.error("[publish] Supabase save error:", err)
      }
    }

    return Response.json({
      success: true,
      githubUrl,
      githubError: githubError || (isFallback ? `PDF engine unavailable — uploaded as HTML. To enable PDF: deploy Railway backend with WeasyPrint. Error: ${pdfError}` : undefined),
      portfolioData,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[publish] Fatal error:", msg)
    return Response.json({ error: `Publish failed: ${msg}` }, { status: 500 })
  }
}
