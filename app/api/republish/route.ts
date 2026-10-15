// ════════════════════════════════════════════════════════════════
// SOLAY39 — Republish Audit API (FIXED)
// Reads audit from Supabase → Uses stored htmlReport (full 38 pages)
// Falls back to full regeneration with ALL tier1 data if missing
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { getAuditReportHTML } from "@/lib/export-pdf"
import { isFounderRequest } from "@/lib/founder-auth"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"


function generateAuditHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

export async function POST(req: Request) {
  try {
    const { auditId, founderKey } = await req.json()

    if (!(await isFounderRequest(req, founderKey))) {
      return Response.json({ error: "Invalid founder key" }, { status: 401 })
    }

    if (!auditId) {
      return Response.json({ error: "Missing auditId" }, { status: 400 })
    }

    // ── Step 1: Read full audit from Supabase ─────────────────────
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

    const portfolioData = audit.data
    let htmlReport: string = portfolioData?.htmlReport || ""
    let regenerated = false

    // ── Step 2: Use stored HTML if valid (this is the real 38-page report) ──
    // The stored htmlReport was generated at publish time with ALL tier1 data.
    // Only regenerate if it's missing or clearly truncated.
    const MIN_FULL_REPORT_SIZE = 50_000 // ~50KB minimum for a real full report

    if (!htmlReport || htmlReport.length < MIN_FULL_REPORT_SIZE) {
      console.log(
        `[republish] Stored HTML missing or too small (${htmlReport.length} bytes). Regenerating from full audit data...`
      )

      // Build the project object exactly as audit-workspace.tsx does
      const project = {
        id: portfolioData?.id || audit.id,
        name: portfolioData?.name || audit.name,
        chain: portfolioData?.chain || portfolioData?.network || "BSC",
        network: portfolioData?.network || portfolioData?.chain || "BSC",
        contractAddress: portfolioData?.contractAddress || portfolioData?.address || portfolioData?.scope || "",
        scope: portfolioData?.scope || portfolioData?.contractAddress || "",
        commit: portfolioData?.commit || portfolioData?.commitHash || "",
        date: portfolioData?.date || new Date().toISOString().slice(0, 10),
        tags: portfolioData?.tags || [],
        files: portfolioData?.files || [],
        ticker: portfolioData?.ticker || "",
        ...portfolioData,
      }

      const score: number = portfolioData?.score ?? portfolioData?.securityScore ?? 50
      const findings = portfolioData?.findings || []

      // ── Build FULL tier1 — mirrors audit-workspace.tsx tier1ForPDF exactly ──
      const tier1 = {
        privilegedRoles: portfolioData?.privilegedRoles?.length > 0 ? portfolioData.privilegedRoles : undefined,
        trustAssumptions: portfolioData?.trustAssumptions?.length > 0 ? portfolioData.trustAssumptions : undefined,
        architectureOverview: portfolioData?.architectureOverview || undefined,
        attackSurface: portfolioData?.attackSurface?.length > 0 ? portfolioData.attackSurface : undefined,
        toolingUsed: portfolioData?.toolingUsed?.length > 0 ? portfolioData.toolingUsed : undefined,
        governanceSecurity: portfolioData?.governanceSecurity || undefined,
        upgradeabilityAnalysis: portfolioData?.upgradeabilityAnalysis || undefined,
        economicRisks: portfolioData?.economicRisks?.length > 0 ? portfolioData.economicRisks : undefined,
        integrationRisks: portfolioData?.integrationRisks?.length > 0 ? portfolioData.integrationRisks : undefined,
        invariantsChecked: portfolioData?.invariantsChecked?.length > 0 ? portfolioData.invariantsChecked : undefined,
        testingMethodology: portfolioData?.testingMethodology || undefined,

        // ── Engagement (Section 1 — critical for page count) ────────
        engagement: portfolioData?.engagement
          ? {
              auditDate: portfolioData.engagement.auditDate || portfolioData.date || new Date().toISOString().slice(0, 10),
              deliveryDate: portfolioData.engagement.deliveryDate || new Date().toISOString().slice(0, 10),
              auditDurationDays: portfolioData.engagement.auditDurationDays || 1,
              numberOfAuditors: portfolioData.engagement.numberOfAuditors || 24,
              engineeringHours: portfolioData.engagement.engineeringHours || 80,
              securityEngineersInvolved: portfolioData.engagement.securityEngineersInvolved || 108,
              leadAuditor: portfolioData.engagement.leadAuditor || "Solay39 Founder",
              compilerVersionUsed: portfolioData.engagement.compilerVersionUsed || "Solidity",
              contractsReviewed: portfolioData.engagement.contractsReviewed || 1,
              linesOfCode: portfolioData.engagement.linesOfCode || 0,
              commitHash: portfolioData.engagement.commitHash || portfolioData.commit || "N/A",
              objectives: portfolioData.engagement.objectives || [],
              auditId: portfolioData.engagement.auditId || undefined,
              reviewTeam: portfolioData.engagement.reviewTeam || undefined,
            }
          : undefined,

        // ── Scope table ──────────────────────────────────────────────
        scopeTable: portfolioData?.scopeTable?.length > 0
          ? portfolioData.scopeTable.map((s: Record<string, unknown>) => ({
              contract: String(s.contract || ""),
              address: String(s.address || portfolioData.scope || "N/A"),
              commit: String(s.commit || portfolioData.commit || "verified"),
              linesOfCode: Number(s.linesOfCode) || 0,
              language: String(s.language || "Solidity"),
            }))
          : undefined,

        // ── Risk model ───────────────────────────────────────────────
        riskModel: portfolioData?.riskModel || {
          methodology: "Likelihood x Impact severity matrix following OWASP and Halborn classification standards.",
          severityMatrix: [
            { level: "CRITICAL", likelihood: "High + High", description: "Directly exploitable, fund loss or protocol takeover." },
            { level: "HIGH", likelihood: "High + Medium", description: "Exploitable with significant consequences." },
            { level: "MEDIUM", likelihood: "Medium + Medium", description: "Moderate exploitability and impact." },
            { level: "LOW", likelihood: "Low + Low/Medium", description: "Minor issue, limited exploitability." },
            { level: "INFO", likelihood: "Informational", description: "Code quality, no security impact." },
          ],
          disclaimer: "Severity based on auditor professional judgment at time of review.",
        },

        // ── Auditor profile ──────────────────────────────────────────
        auditorProfile: portfolioData?.auditorProfile || {
          firmName: "Solay39",
          description:
            "Independent smart contract security firm specializing in manual adversarial review combined with AI-guided static analysis.",
          methodology:
            "Manual adversarial review + automated static analysis (Slither, Mythril) + AI-assisted pattern detection + on-chain bytecode verification.",
          experience: ["ERC-20/ERC-721 security reviews", "DeFi protocol analysis", "Proxy & upgradeability audits"],
          contactEmail: "solay2126@gmail.com",
          telegram: "https://t.me/Solay39audit",
        },

        // ── Limitations ──────────────────────────────────────────────
        limitations: portfolioData?.limitations || {
          statements: [
            `This audit was conducted between ${portfolioData?.date || new Date().toISOString().slice(0, 10)} and ${new Date().toISOString().slice(0, 10)} as a time-boxed security review.`,
            "The scope is limited to the smart contract source code listed in the Scope Table above.",
            "This review does not constitute a formal mathematical verification of the contract's correctness.",
            "Findings and severity ratings are based on the auditor's professional judgment at the time of review.",
            "This audit does not constitute financial, legal, or investment advice.",
            "The security of the deployed contract also depends on factors outside the scope of this audit.",
          ],
          disclaimer:
            "DISCLAIMER & LIMITATION OF LIABILITY: This security audit report is provided 'as-is' for informational purposes only. Solay39 and its auditors make no representations or warranties, express or implied, regarding the completeness, accuracy, or reliability of this assessment.",
        },

        // ── Manual review session (Section 14) ──────────────────────
        manualReview: portfolioData?.manualReview
          ? {
              completedAt: portfolioData.manualReview.completedAt,
              auditorWalletEth: portfolioData.manualReview.auditorWalletEth || portfolioData.manualReview.auditorWallet,
              auditorWalletSol: portfolioData.manualReview.auditorWalletSol || portfolioData.manualReview.solanaWallet,
              checksCompleted: portfolioData.manualReview.checksCompleted,
              findingsConfirmed: portfolioData.manualReview.findingsConfirmed,
              findingsRejected: portfolioData.manualReview.findingsRejected,
              manualFindingsAdded: portfolioData.manualReview.manualFindingsAdded,
              signatureEth: portfolioData.manualReview.signatureEth || portfolioData.manualReview.signature,
              signatureSol: portfolioData.manualReview.signatureSol || portfolioData.manualReview.solanaSignature,
              reviewNotes: portfolioData.manualReview.reviewNotes,
            }
          : undefined,

        // ── Security checklist (Section 15) ─────────────────────────
        securityChecklist: portfolioData?.securityChecklist?.length > 0
          ? portfolioData.securityChecklist.map((c: Record<string, unknown>) => ({
              id: String(c.id || ""),
              category: String(c.category || ""),
              question: String(c.question || ""),
              why: String(c.why || ""),
              severity: String(c.severity || ""),
              status: (c.status as "pass" | "fail" | "pending" | "n/a") || "pending",
              note: String(c.note || ""),
            }))
          : undefined,

        // ── On-chain analysis (Section 16) ───────────────────────────
        onChainAnalysis:
          portfolioData?.onChainAnalysis
            ? {
                executiveSummary: portfolioData.onChainAnalysis.executiveSummary,
                tokenEconomics: portfolioData.onChainAnalysis.tokenEconomics,
                whaleDistribution: portfolioData.onChainAnalysis.whaleDistribution,
                insiderWallets: portfolioData.onChainAnalysis.insiderWallets,
                devWalletAnalysis: portfolioData.onChainAnalysis.devWalletAnalysis,
                supplyAnalysis: portfolioData.onChainAnalysis.supplyAnalysis,
                rugPullRisk: portfolioData.onChainAnalysis.rugPullRisk,
                priceManipulation: portfolioData.onChainAnalysis.priceManipulation,
                hiddenGovernance: portfolioData.onChainAnalysis.hiddenGovernance,
                complexBugs: portfolioData.onChainAnalysis.complexBugs,
                liquidityAnalysis: portfolioData.onChainAnalysis.liquidityAnalysis,
                clusterAnalysis: portfolioData.onChainAnalysis.clusterAnalysis,
                scenarioAnalysis: portfolioData.onChainAnalysis.scenarioAnalysis,
                recommendation: portfolioData.onChainAnalysis.recommendation,
                overallRiskScore: portfolioData.onChainAnalysis.overallRiskScore,
                scores: portfolioData.onChainAnalysis.scores,
                topHolders: portfolioData.onChainAnalysis.topHolders,
              }
            : undefined,
      }

      try {
        htmlReport = getAuditReportHTML(project, score, findings, tier1)
        regenerated = true
        console.log("[republish] HTML regenerated:", htmlReport?.length || 0, "bytes")
      } catch (err) {
        console.error("[republish] Failed to regenerate HTML:", err)
        return Response.json(
          { error: "Failed to regenerate HTML report. Audit data may be incomplete." },
          { status: 400 }
        )
      }

      if (!htmlReport || htmlReport.length < 1000) {
        return Response.json(
          { error: "Generated HTML report is too small. Audit data may be incomplete." },
          { status: 400 }
        )
      }
    } else {
      console.log(`[republish] Using stored HTML report: ${Math.round(htmlReport.length / 1024)}KB`)
    }

    // ── Step 3: Generate/update hash ──────────────────────────────
    const auditHash = generateAuditHash(htmlReport)

    if (!htmlReport.includes('name="audit-hash"')) {
      htmlReport = htmlReport.replace(
        /<head>/i,
        `<head>\n    <meta name="audit-hash" content="${auditHash}">\n    <meta name="audit-timestamp" content="${new Date().toISOString()}">\n    <meta name="audit-version" content="1.0.0">`
      )
    }

    const htmlSizeKB = Math.round(htmlReport.length / 1024)
    console.log(`[republish] Audit: ${audit.name} — HTML: ${htmlSizeKB}KB`)

    // ── Step 4: Upload to GitHub with SOLAY39 naming convention ──
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return Response.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const projectName = portfolioData?.name || audit.name || "Unknown"
    const auditDate = portfolioData?.date || portfolioData?.engagement?.auditDate || new Date().toISOString().slice(0, 10)
    const fileName = `SOLAY39-${projectName.replace(/\s+/g, "-")}-Audit-${auditDate}.html`
    const path = `audits/${fileName}`

    let githubUrl = ""
    let githubError = ""

    try {
      // Check if file already exists (need SHA for update)
      const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      let existingSha = ""
      if (checkRes.ok) {
        const existing = await checkRes.json() as { sha?: string }
        existingSha = existing.sha || ""
        console.log(`[republish] File exists on GitHub, will update. SHA: ${existingSha.slice(0, 8)}`)
      }

      const contentBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")
      const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `[Republish] ${projectName} audit — ${htmlSizeKB}KB — ${new Date().toISOString()}`,
          content: contentBase64,
          branch: "main",
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

    // ── Step 5: Update Supabase with new GitHub URL + refreshed HTML ─
    if (githubUrl) {
      const { error: updateError } = await supabase
        .from("audits")
        .update({
          data: {
            ...portfolioData,
            // Store the final HTML (with hash injected) so future republishes use it directly
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
      regenerated,
      message: githubUrl
        ? `Synced to GitHub (${htmlSizeKB}KB)${regenerated ? " — HTML regenerated from full audit data" : " — used stored HTML"}`
        : `GitHub sync failed: ${githubError}`,
    })
  } catch (err) {
    console.error("[republish] Error:", err)
    return Response.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
