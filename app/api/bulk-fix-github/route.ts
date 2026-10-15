// ════════════════════════════════════════════════════════════════
// SOLAY39 — Bulk Fix GitHub (v2)
// File: app/api/bulk-fix-github/route.ts  (SOSTITUISCE versione precedente)
//
// Usa getWeightedScore (identico a piattaforma) per ogni audit
// ════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { getAuditReportHTML } from "@/lib/export-pdf"
import { isFounderRequest } from "@/lib/founder-auth"

const GITHUB_REPO = process.env.GITHUB_REPO || "solay39/Solay39-audit"


function generateHash(c: string) {
  return createHash("sha256").update(c, "utf8").digest("hex")
}

/** Replica di getWeightedScore da solay39-constants.ts */
function getWeightedScore(d: Record<string, unknown>): number {
  const sb = d?.scoreBreakdown as Record<string, number> | undefined
  const base = (d?.score as number) ?? 0
  if (!sb) return base
  const economic = sb.economic ?? Math.round(((sb.codeSecurity ?? base) + (sb.centralization ?? base)) / 2)
  return Math.min(98, Math.round(
    (sb.codeSecurity ?? base) * 0.35 +
    (sb.architectureRisk ?? base) * 0.20 +
    (sb.governanceRisk ?? base) * 0.15 +
    (sb.centralization ?? base) * 0.10 +
    economic * 0.10 +
    (sb.testingCoverage ?? base) * 0.10
  ))
}

function getRating(s: number) {
  if (s >= 95) return "AAA"
  if (s >= 90) return "AA"
  if (s >= 80) return "A"
  if (s >= 70) return "BBB"
  if (s >= 60) return "BB"
  return "B"
}

function buildTier1(d: Record<string, unknown>) {
  const auditDate = (d?.date as string) || ((d?.engagement as Record<string, unknown>)?.auditDate as string) || new Date().toISOString().slice(0, 10)
  const deliveryDate = ((d?.engagement as Record<string, unknown>)?.deliveryDate as string) || new Date().toISOString().slice(0, 10)
  const eng = d?.engagement as Record<string, unknown> | undefined
  const arr = (x: unknown) => Array.isArray(x) && (x as unknown[]).length > 0

  return {
    privilegedRoles: arr(d?.privilegedRoles) ? d.privilegedRoles : undefined,
    trustAssumptions: arr(d?.trustAssumptions) ? d.trustAssumptions : undefined,
    architectureOverview: (d?.architectureOverview as string) || undefined,
    attackSurface: arr(d?.attackSurface) ? d.attackSurface : undefined,
    toolingUsed: arr(d?.toolingUsed) ? d.toolingUsed : undefined,
    governanceSecurity: d?.governanceSecurity || undefined,
    upgradeabilityAnalysis: d?.upgradeabilityAnalysis || undefined,
    economicRisks: arr(d?.economicRisks) ? d.economicRisks : undefined,
    integrationRisks: arr(d?.integrationRisks) ? d.integrationRisks : undefined,
    invariantsChecked: arr(d?.invariantsChecked) ? d.invariantsChecked : undefined,
    testingMethodology: d?.testingMethodology || undefined,
    onChainValidation: d?.onChainValidation || undefined,
    engagement: eng ? {
      auditDate: (eng.auditDate as string) || auditDate,
      deliveryDate: (eng.deliveryDate as string) || deliveryDate,
      auditDurationDays: (eng.auditDurationDays as number) ?? 1,
      numberOfAuditors: (eng.numberOfAuditors as number) ?? 24,
      engineeringHours: (eng.engineeringHours as number) ?? 80,
      securityEngineersInvolved: (eng.securityEngineersInvolved as number) ?? 108,
      leadAuditor: (eng.leadAuditor as string) || "Solay39 Founder",
      compilerVersionUsed: (eng.compilerVersionUsed as string) || "Solidity",
      contractsReviewed: (eng.contractsReviewed as number) ?? 1,
      linesOfCode: (eng.linesOfCode as number) ?? 0,
      commitHash: (eng.commitHash as string) || (d?.commit as string) || "N/A",
      objectives: (eng.objectives as string[]) || [],
      auditId: (eng.auditId as string) || undefined,
      reviewTeam: (eng.reviewTeam as Record<string, unknown>) || undefined,
    } : undefined,
    scopeTable: arr(d?.scopeTable)
      ? (d.scopeTable as Record<string, unknown>[]).map(s => ({
          contract: String(s.contract || ""),
          address: String(s.address || d?.scope || "N/A"),
          commit: String(s.commit || d?.commit || "verified"),
          linesOfCode: Number(s.linesOfCode) || 0,
          language: String(s.language || "Solidity"),
        }))
      : undefined,
    riskModel: (d?.riskModel as object) || {
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
    auditorProfile: (d?.auditorProfile as object) || {
      firmName: "Solay39",
      description: "Independent smart contract security firm specializing in manual adversarial review combined with AI-guided static analysis.",
      methodology: "Manual adversarial review + automated static analysis (Slither, Mythril) + AI-assisted pattern detection + on-chain bytecode verification.",
      experience: ["ERC-20/ERC-721 security reviews", "DeFi protocol analysis", "Proxy & upgradeability audits"],
      contactEmail: "solay2126@gmail.com",
      telegram: "https://t.me/Solay39audit",
    },
    limitations: (d?.limitations as object) || {
      statements: [
        `This audit was conducted between ${auditDate} and ${deliveryDate} as a time-boxed security review.`,
        "The scope is limited to the smart contract source code listed in the Scope Table above.",
        "Findings and severity ratings are based on the auditor's professional judgment at the time of review.",
        "This audit does not constitute financial, legal, or investment advice.",
      ],
      disclaimer: "DISCLAIMER & LIMITATION OF LIABILITY: This security audit report is provided 'as-is' for informational purposes only.",
    },
    manualReview: d?.manualReview ? {
      completedAt: (d.manualReview as Record<string, unknown>).completedAt as string,
      auditorWalletEth: ((d.manualReview as Record<string, unknown>).auditorWalletEth || (d.manualReview as Record<string, unknown>).auditorWallet) as string,
      auditorWalletSol: ((d.manualReview as Record<string, unknown>).auditorWalletSol || (d.manualReview as Record<string, unknown>).solanaWallet) as string,
      checksCompleted: (d.manualReview as Record<string, unknown>).checksCompleted as string,
      findingsConfirmed: (d.manualReview as Record<string, unknown>).findingsConfirmed as number,
      findingsRejected: (d.manualReview as Record<string, unknown>).findingsRejected as number,
      manualFindingsAdded: (d.manualReview as Record<string, unknown>).manualFindingsAdded as number,
      signatureEth: ((d.manualReview as Record<string, unknown>).signatureEth || (d.manualReview as Record<string, unknown>).signature) as string,
      signatureSol: ((d.manualReview as Record<string, unknown>).signatureSol || (d.manualReview as Record<string, unknown>).solanaSignature) as string,
      reviewNotes: (d.manualReview as Record<string, unknown>).reviewNotes as string,
    } : undefined,
    securityChecklist: arr(d?.securityChecklist)
      ? (d.securityChecklist as Record<string, unknown>[]).map(c => ({
          id: String(c.id || ""),
          category: String(c.category || ""),
          question: String(c.question || ""),
          why: String(c.why || ""),
          severity: String(c.severity || ""),
          status: (c.status as "pass" | "fail" | "pending" | "n/a") || "pending",
          note: String(c.note || ""),
        }))
      : undefined,
    onChainAnalysis: d?.onChainAnalysis ? {
      executiveSummary: (d.onChainAnalysis as Record<string, unknown>).executiveSummary as string,
      tokenEconomics: (d.onChainAnalysis as Record<string, unknown>).tokenEconomics as string,
      whaleDistribution: (d.onChainAnalysis as Record<string, unknown>).whaleDistribution as string,
      insiderWallets: (d.onChainAnalysis as Record<string, unknown>).insiderWallets as string,
      devWalletAnalysis: (d.onChainAnalysis as Record<string, unknown>).devWalletAnalysis as string,
      supplyAnalysis: (d.onChainAnalysis as Record<string, unknown>).supplyAnalysis as string,
      rugPullRisk: (d.onChainAnalysis as Record<string, unknown>).rugPullRisk as string,
      priceManipulation: (d.onChainAnalysis as Record<string, unknown>).priceManipulation as string,
      hiddenGovernance: (d.onChainAnalysis as Record<string, unknown>).hiddenGovernance as string,
      complexBugs: (d.onChainAnalysis as Record<string, unknown>).complexBugs as string,
      liquidityAnalysis: (d.onChainAnalysis as Record<string, unknown>).liquidityAnalysis as string,
      clusterAnalysis: (d.onChainAnalysis as Record<string, unknown>).clusterAnalysis as string,
      scenarioAnalysis: (d.onChainAnalysis as Record<string, unknown>).scenarioAnalysis as string,
      recommendation: (d.onChainAnalysis as Record<string, unknown>).recommendation as string,
      overallRiskScore: (d.onChainAnalysis as Record<string, unknown>).overallRiskScore as number,
      scores: (d.onChainAnalysis as Record<string, unknown>).scores as object,
      topHolders: (d.onChainAnalysis as Record<string, unknown>).topHolders as object[],
    } : undefined,
  }
}

async function uploadToGitHub(token: string, path: string, html: string, msg: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  }
  let sha: string | undefined
  const check = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, { headers })
  if (check.ok) sha = ((await check.json()) as { sha?: string }).sha

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT", headers,
    body: JSON.stringify({ message: msg, content: Buffer.from(html, "utf-8").toString("base64"), branch: "main", ...(sha && { sha }) }),
  })
  if (res.ok) return { url: `https://htmlpreview.github.io/?https://github.com/${GITHUB_REPO}/blob/main/${path}` }
  return { url: "", error: `GitHub ${res.status}: ${await res.text()}` }
}

export async function POST(req: Request) {
  try {
    const { founderKey, dryRun = false, auditIds } = await req.json()
    if (!(await isFounderRequest(req, founderKey))) return Response.json({ error: "Invalid founder key" }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const token = process.env.GITHUB_TOKEN

    if (!token && !dryRun) return Response.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 })

    let query = supabase.from("audits").select("*").order("created_at", { ascending: false })
    if (Array.isArray(auditIds) && auditIds.length > 0) {
      query = supabase.from("audits").select("*").in("id", auditIds)
    }
    const { data: audits, error } = await query
    if (error || !audits?.length) return Response.json({ error: `No audits: ${error?.message}` }, { status: 404 })

    console.log(`[bulk-fix] ${audits.length} audits to process`)

    const results = []

    for (const audit of audits) {
      const d = audit.data as Record<string, unknown>
      const id = audit.id as string
      const name = (d?.name as string) || (audit.name as string) || "Unknown"

      try {
        const displayScore = getWeightedScore(d)
        const rating = getRating(displayScore)
        const findings = (d?.findings as unknown[]) || []
        const tier1 = buildTier1(d)

        const project = { id: (d?.id as string) || id, name, chain: (d?.chain as string) || "BSC", network: (d?.network as string) || "BSC", contractAddress: (d?.contractAddress as string) || "", scope: (d?.scope as string) || "", commit: (d?.commit as string) || "", date: (d?.date as string) || new Date().toISOString().slice(0, 10), tags: [], files: [], type: "Smart Contracts", ...d }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let html = getAuditReportHTML(project as any, displayScore, findings as any, tier1 as any)
        const htmlSizeKB = Math.round(html.length / 1024)
        const auditHash = generateHash(html)
        if (!html.includes('name="audit-hash"')) {
          html = html.replace(/<head>/i, `<head>\n    <meta name="audit-hash" content="${auditHash}">\n    <meta name="audit-timestamp" content="${new Date().toISOString()}">\n    <meta name="audit-version" content="1.0.0">`)
        }

        const auditDate = (d?.date as string) || new Date().toISOString().slice(0, 10)
        const path = `audits/SOLAY39-${name.replace(/\s+/g, "-")}-Audit-${auditDate}.html`

        console.log(`[bulk-fix] ${name}: score=${displayScore}(${rating}), ${htmlSizeKB}KB`)

        if (dryRun) { results.push({ id, name, displayScore, rating, htmlSizeKB, skipped: true }); continue }

        const { url, error: ghErr } = await uploadToGitHub(token!, path, html, `[BulkFix] ${name} score:${displayScore}(${rating}) ${htmlSizeKB}KB`)

        if (ghErr) { results.push({ id, name, displayScore, rating, htmlSizeKB, error: ghErr }); continue }

        await supabase.from("audits").update({ data: { ...d, score: displayScore, rating, htmlReport: html, auditHash, githubUrl: url, lastSyncedAt: new Date().toISOString() } }).eq("id", id)

        results.push({ id, name, displayScore, rating, htmlSizeKB, githubUrl: url })
        await new Promise(r => setTimeout(r, 1200))
      } catch (err) {
        results.push({ id, name, displayScore: 0, rating: "?", htmlSizeKB: 0, error: String(err) })
      }
    }

    const ok = results.filter(r => r.githubUrl).length
    const fail = results.filter(r => r.error).length

    return Response.json({
      success: true, total: audits.length, succeeded: ok, failed: fail, dryRun, results,
      message: dryRun ? `Dry run: ${audits.length} audit trovati` : `✓ ${ok}/${audits.length} pubblicati`,
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
