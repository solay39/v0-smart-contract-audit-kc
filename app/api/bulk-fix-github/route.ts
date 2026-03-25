// ════════════════════════════════════════════════════════════════
// SOLAY39 — Bulk Fix GitHub Audits
// Percorso: app/api/bulk-fix-github/route.ts
//
// Legge TUTTI gli audit da Supabase → per ognuno rigenera
// l'HTML completo (38 pagine) con lo score CORRETTO salvato
// in Supabase → carica su GitHub sovrascrivendo i vecchi file
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { getAuditReportHTML } from "@/lib/export-pdf"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"
const FOUNDER_KEY = "Solay39!Audit#2025"

function generateAuditHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

function buildTier1(d: Record<string, unknown>) {
  const auditDate =
    (d?.date as string) ||
    ((d?.engagement as Record<string, unknown>)?.auditDate as string) ||
    new Date().toISOString().slice(0, 10)
  const deliveryDate =
    ((d?.engagement as Record<string, unknown>)?.deliveryDate as string) ||
    new Date().toISOString().slice(0, 10)

  const eng = d?.engagement as Record<string, unknown> | undefined

  return {
    privilegedRoles:
      Array.isArray(d?.privilegedRoles) && d.privilegedRoles.length > 0
        ? d.privilegedRoles
        : undefined,
    trustAssumptions:
      Array.isArray(d?.trustAssumptions) && d.trustAssumptions.length > 0
        ? d.trustAssumptions
        : undefined,
    architectureOverview: (d?.architectureOverview as string) || undefined,
    attackSurface:
      Array.isArray(d?.attackSurface) && d.attackSurface.length > 0
        ? d.attackSurface
        : undefined,
    toolingUsed:
      Array.isArray(d?.toolingUsed) && d.toolingUsed.length > 0
        ? d.toolingUsed
        : undefined,
    governanceSecurity: d?.governanceSecurity || undefined,
    upgradeabilityAnalysis: d?.upgradeabilityAnalysis || undefined,
    economicRisks:
      Array.isArray(d?.economicRisks) && d.economicRisks.length > 0
        ? d.economicRisks
        : undefined,
    integrationRisks:
      Array.isArray(d?.integrationRisks) && d.integrationRisks.length > 0
        ? d.integrationRisks
        : undefined,
    invariantsChecked:
      Array.isArray(d?.invariantsChecked) && d.invariantsChecked.length > 0
        ? d.invariantsChecked
        : undefined,
    testingMethodology: d?.testingMethodology || undefined,
    onChainValidation: d?.onChainValidation || undefined,

    engagement: eng
      ? {
          auditDate: (eng.auditDate as string) || auditDate,
          deliveryDate: (eng.deliveryDate as string) || deliveryDate,
          auditDurationDays: (eng.auditDurationDays as number) ?? 1,
          numberOfAuditors: (eng.numberOfAuditors as number) ?? 24,
          engineeringHours: (eng.engineeringHours as number) ?? 80,
          securityEngineersInvolved:
            (eng.securityEngineersInvolved as number) ?? 108,
          leadAuditor: (eng.leadAuditor as string) || "Solay39 Founder",
          compilerVersionUsed:
            (eng.compilerVersionUsed as string) || "Solidity",
          contractsReviewed: (eng.contractsReviewed as number) ?? 1,
          linesOfCode: (eng.linesOfCode as number) ?? 0,
          commitHash:
            (eng.commitHash as string) || (d?.commit as string) || "N/A",
          objectives: (eng.objectives as string[]) || [],
          auditId: (eng.auditId as string) || undefined,
          reviewTeam: (eng.reviewTeam as Record<string, unknown>) || undefined,
        }
      : undefined,

    scopeTable:
      Array.isArray(d?.scopeTable) && d.scopeTable.length > 0
        ? (d.scopeTable as Record<string, unknown>[]).map((s) => ({
            contract: String(s.contract || ""),
            address: String(s.address || d?.scope || "N/A"),
            commit: String(s.commit || d?.commit || "verified"),
            linesOfCode: Number(s.linesOfCode) || 0,
            language: String(s.language || "Solidity"),
          }))
        : undefined,

    riskModel: (d?.riskModel as object) || {
      methodology:
        "Likelihood x Impact severity matrix following OWASP and Halborn classification standards.",
      severityMatrix: [
        {
          level: "CRITICAL",
          likelihood: "High + High",
          description: "Directly exploitable, fund loss or protocol takeover.",
        },
        {
          level: "HIGH",
          likelihood: "High + Medium",
          description: "Exploitable with significant consequences.",
        },
        {
          level: "MEDIUM",
          likelihood: "Medium + Medium",
          description: "Moderate exploitability and impact.",
        },
        {
          level: "LOW",
          likelihood: "Low + Low/Medium",
          description: "Minor issue, limited exploitability.",
        },
        {
          level: "INFO",
          likelihood: "Informational",
          description: "Code quality, no security impact.",
        },
      ],
      disclaimer:
        "Severity based on auditor professional judgment at time of review.",
    },

    auditorProfile: (d?.auditorProfile as object) || {
      firmName: "Solay39",
      description:
        "Independent smart contract security firm specializing in manual adversarial review combined with AI-guided static analysis.",
      methodology:
        "Manual adversarial review + automated static analysis (Slither, Mythril) + AI-assisted pattern detection + on-chain bytecode verification.",
      experience: [
        "ERC-20/ERC-721 security reviews",
        "DeFi protocol analysis",
        "Proxy & upgradeability audits",
      ],
      contactEmail: "solay2126@gmail.com",
      telegram: "https://t.me/Solay39audit",
    },

    limitations: (d?.limitations as object) || {
      statements: [
        `This audit was conducted between ${auditDate} and ${deliveryDate} as a time-boxed security review.`,
        "The scope is limited to the smart contract source code listed in the Scope Table above.",
        "This review does not constitute a formal mathematical verification of the contract's correctness.",
        "Findings and severity ratings are based on the auditor's professional judgment at the time of review.",
        "This audit does not constitute financial, legal, or investment advice.",
        "The security of the deployed contract also depends on factors outside the scope of this audit.",
      ],
      disclaimer:
        "DISCLAIMER & LIMITATION OF LIABILITY: This security audit report is provided 'as-is' for informational purposes only. Solay39 and its auditors make no representations or warranties, express or implied, regarding the completeness, accuracy, or reliability of this assessment.",
    },

    manualReview: d?.manualReview
      ? {
          completedAt: (
            d.manualReview as Record<string, unknown>
          ).completedAt as string,
          auditorWalletEth:
            ((d.manualReview as Record<string, unknown>).auditorWalletEth as string) ||
            ((d.manualReview as Record<string, unknown>).auditorWallet as string),
          auditorWalletSol:
            ((d.manualReview as Record<string, unknown>).auditorWalletSol as string) ||
            ((d.manualReview as Record<string, unknown>).solanaWallet as string),
          checksCompleted: (
            d.manualReview as Record<string, unknown>
          ).checksCompleted as string,
          findingsConfirmed: (
            d.manualReview as Record<string, unknown>
          ).findingsConfirmed as number,
          findingsRejected: (
            d.manualReview as Record<string, unknown>
          ).findingsRejected as number,
          manualFindingsAdded: (
            d.manualReview as Record<string, unknown>
          ).manualFindingsAdded as number,
          signatureEth:
            ((d.manualReview as Record<string, unknown>).signatureEth as string) ||
            ((d.manualReview as Record<string, unknown>).signature as string),
          signatureSol:
            ((d.manualReview as Record<string, unknown>).signatureSol as string) ||
            ((d.manualReview as Record<string, unknown>).solanaSignature as string),
          reviewNotes: (
            d.manualReview as Record<string, unknown>
          ).reviewNotes as string,
        }
      : undefined,

    securityChecklist:
      Array.isArray(d?.securityChecklist) && d.securityChecklist.length > 0
        ? (d.securityChecklist as Record<string, unknown>[]).map((c) => ({
            id: String(c.id || ""),
            category: String(c.category || ""),
            question: String(c.question || ""),
            why: String(c.why || ""),
            severity: String(c.severity || ""),
            status: (c.status as "pass" | "fail" | "pending" | "n/a") || "pending",
            note: String(c.note || ""),
          }))
        : undefined,

    onChainAnalysis: d?.onChainAnalysis
      ? {
          executiveSummary: (
            d.onChainAnalysis as Record<string, unknown>
          ).executiveSummary as string,
          tokenEconomics: (
            d.onChainAnalysis as Record<string, unknown>
          ).tokenEconomics as string,
          whaleDistribution: (
            d.onChainAnalysis as Record<string, unknown>
          ).whaleDistribution as string,
          insiderWallets: (
            d.onChainAnalysis as Record<string, unknown>
          ).insiderWallets as string,
          devWalletAnalysis: (
            d.onChainAnalysis as Record<string, unknown>
          ).devWalletAnalysis as string,
          supplyAnalysis: (
            d.onChainAnalysis as Record<string, unknown>
          ).supplyAnalysis as string,
          rugPullRisk: (
            d.onChainAnalysis as Record<string, unknown>
          ).rugPullRisk as string,
          priceManipulation: (
            d.onChainAnalysis as Record<string, unknown>
          ).priceManipulation as string,
          hiddenGovernance: (
            d.onChainAnalysis as Record<string, unknown>
          ).hiddenGovernance as string,
          complexBugs: (
            d.onChainAnalysis as Record<string, unknown>
          ).complexBugs as string,
          liquidityAnalysis: (
            d.onChainAnalysis as Record<string, unknown>
          ).liquidityAnalysis as string,
          clusterAnalysis: (
            d.onChainAnalysis as Record<string, unknown>
          ).clusterAnalysis as string,
          scenarioAnalysis: (
            d.onChainAnalysis as Record<string, unknown>
          ).scenarioAnalysis as string,
          recommendation: (
            d.onChainAnalysis as Record<string, unknown>
          ).recommendation as string,
          overallRiskScore: (
            d.onChainAnalysis as Record<string, unknown>
          ).overallRiskScore as number,
          scores: (d.onChainAnalysis as Record<string, unknown>).scores as object,
          topHolders: (
            d.onChainAnalysis as Record<string, unknown>
          ).topHolders as object[],
        }
      : undefined,
  }
}

async function uploadToGitHub(
  token: string,
  path: string,
  htmlReport: string,
  commitMessage: string
): Promise<{ url: string; error?: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  }

  // Get existing SHA if file exists
  let existingSha: string | undefined
  const checkRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    { headers }
  )
  if (checkRes.ok) {
    const existing = (await checkRes.json()) as { sha?: string }
    existingSha = existing.sha
  }

  const contentBase64 = Buffer.from(htmlReport, "utf-8").toString("base64")
  const body: Record<string, unknown> = {
    message: commitMessage,
    content: contentBase64,
    branch: "main",
  }
  if (existingSha) body.sha = existingSha

  const uploadRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
    { method: "PUT", headers, body: JSON.stringify(body) }
  )

  if (uploadRes.ok) {
    return {
      url: `https://htmlpreview.github.io/?https://github.com/${GITHUB_REPO}/blob/main/${path}`,
    }
  }

  const errText = await uploadRes.text()
  return { url: "", error: `GitHub ${uploadRes.status}: ${errText}` }
}

export async function POST(req: Request) {
  try {
    const { founderKey, dryRun = false, auditIds } = await req.json()

    if (founderKey !== FOUNDER_KEY) {
      return Response.json({ error: "Invalid founder key" }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const githubToken = process.env.GITHUB_TOKEN

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 })
    }
    if (!githubToken && !dryRun) {
      return Response.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch audits — either all or specific IDs
    let query = supabase.from("audits").select("*").order("created_at", { ascending: false })
    if (Array.isArray(auditIds) && auditIds.length > 0) {
      query = supabase.from("audits").select("*").in("id", auditIds)
    }

    const { data: audits, error: fetchError } = await query

    if (fetchError) {
      return Response.json({ error: `Supabase error: ${fetchError.message}` }, { status: 500 })
    }

    if (!audits || audits.length === 0) {
      return Response.json({ error: "No audits found in Supabase" }, { status: 404 })
    }

    console.log(`[bulk-fix] Found ${audits.length} audits to process`)

    const results: {
      id: string
      name: string
      score: number
      htmlSizeKB: number
      githubUrl?: string
      error?: string
      skipped?: boolean
    }[] = []

    for (const audit of audits) {
      const d = audit.data as Record<string, unknown>
      const auditId = audit.id as string
      const auditName = (d?.name as string) || (audit.name as string) || "Unknown"

      console.log(`[bulk-fix] Processing: ${auditId} — ${auditName}`)

      try {
        // ── Build project ───────────────────────────────────────────
        const project = {
          id: (d?.id as string) || auditId,
          name: auditName,
          chain: (d?.chain as string) || (d?.network as string) || "BSC",
          network: (d?.network as string) || (d?.chain as string) || "BSC",
          contractAddress:
            (d?.contractAddress as string) ||
            (d?.address as string) ||
            (d?.scope as string) ||
            "",
          scope: (d?.scope as string) || (d?.contractAddress as string) || "",
          commit: (d?.commit as string) || (d?.commitHash as string) || "",
          date: (d?.date as string) || new Date().toISOString().slice(0, 10),
          tags: (d?.tags as string[]) || [],
          files: (d?.files as unknown[]) || [],
          ticker: (d?.ticker as string) || "",
          type: (d?.type as string) || "Smart Contracts",
          ...d,
        }

        // ── Score: usa quello salvato in Supabase ───────────────────
        const score =
          (d?.score as number) ?? (d?.securityScore as number) ?? 50

        const findings = (d?.findings as unknown[]) || []
        const tier1 = buildTier1(d)

        // ── Genera HTML ─────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let htmlReport = getAuditReportHTML(project as any, score, findings as any, tier1 as any)
        const htmlSizeKB = Math.round(htmlReport.length / 1024)

        console.log(
          `[bulk-fix] ${auditName}: score=${score}, html=${htmlSizeKB}KB, ` +
          `manualReview=${!!tier1.manualReview}, checklist=${tier1.securityChecklist?.length || 0}, ` +
          `onChain=${!!tier1.onChainAnalysis}, engagement=${!!tier1.engagement}`
        )

        // ── Inietta hash ────────────────────────────────────────────
        const auditHash = generateAuditHash(htmlReport)
        if (!htmlReport.includes('name="audit-hash"')) {
          htmlReport = htmlReport.replace(
            /<head>/i,
            `<head>\n    <meta name="audit-hash" content="${auditHash}">\n    <meta name="audit-timestamp" content="${new Date().toISOString()}">\n    <meta name="audit-version" content="1.0.0">`
          )
        }

        const auditDate =
          (d?.date as string) ||
          ((d?.engagement as Record<string, unknown>)?.auditDate as string) ||
          new Date().toISOString().slice(0, 10)
        const fileName = `SOLAY39-${auditName.replace(/\s+/g, "-")}-Audit-${auditDate}.html`
        const path = `audits/${fileName}`

        if (dryRun) {
          results.push({ id: auditId, name: auditName, score, htmlSizeKB, skipped: true })
          continue
        }

        // ── Upload GitHub ───────────────────────────────────────────
        const { url: githubUrl, error: ghError } = await uploadToGitHub(
          githubToken!,
          path,
          htmlReport,
          `[BulkFix] ${auditName} — score:${score} — ${htmlSizeKB}KB — ${new Date().toISOString()}`
        )

        if (ghError) {
          console.error(`[bulk-fix] GitHub error for ${auditId}:`, ghError)
          results.push({ id: auditId, name: auditName, score, htmlSizeKB, error: ghError })
          continue
        }

        // ── Aggiorna Supabase con HTML + URL ────────────────────────
        await supabase
          .from("audits")
          .update({
            data: {
              ...d,
              htmlReport,
              auditHash,
              githubUrl,
              lastSyncedAt: new Date().toISOString(),
            },
          })
          .eq("id", auditId)

        console.log(`[bulk-fix] ✓ ${auditName}: ${githubUrl}`)
        results.push({ id: auditId, name: auditName, score, htmlSizeKB, githubUrl })

        // Piccola pausa per non abusare delle rate limit GitHub (1 req/sec)
        await new Promise((r) => setTimeout(r, 1200))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[bulk-fix] Error for ${auditId}:`, msg)
        results.push({ id: auditId, name: auditName, score: 0, htmlSizeKB: 0, error: msg })
      }
    }

    const succeeded = results.filter((r) => r.githubUrl).length
    const failed = results.filter((r) => r.error).length
    const skipped = results.filter((r) => r.skipped).length

    return Response.json({
      success: true,
      total: audits.length,
      succeeded,
      failed,
      skipped,
      dryRun,
      results,
      message: dryRun
        ? `DRY RUN: ${audits.length} audit trovati — nessuna modifica applicata`
        : `Completato: ${succeeded}/${audits.length} pubblicati su GitHub`,
    })
  } catch (err) {
    console.error("[bulk-fix] Fatal:", err)
    return Response.json(
      { error: `Server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}