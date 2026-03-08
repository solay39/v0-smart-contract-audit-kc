// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Deep Review Engine
// app/api/deep-review/route.ts
//
// Fa esattamente quello che farebbe un revisore manuale:
// 1. Fetcha il codice REALE da Etherscan/BscScan/ecc.
// 2. Legge i finding AI già generati
// 3. Analizza: falsi positivi, finding mancanti, severity errate
// 4. Genera checklist specifica per il codice reale
// 5. Restituisce tutto pronto per approve/reject nel tab Manual Review
// ═══════════════════════════════════════════════════════════════════

export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"

// ── Explorer map (stesso di contract-source/route.ts) ─────────────
const EXPLORER_MAP: Record<string, { apiUrl: string; type: "etherscan" | "solana" | "unsupported" }> = {
  Ethereum:    { apiUrl: "https://api.etherscan.io/api",              type: "etherscan" },
  BSC:         { apiUrl: "https://api.bscscan.com/api",               type: "etherscan" },
  "BNB Chain": { apiUrl: "https://api.bscscan.com/api",               type: "etherscan" },
  Arbitrum:    { apiUrl: "https://api.arbiscan.io/api",               type: "etherscan" },
  Optimism:    { apiUrl: "https://api-optimistic.etherscan.io/api",   type: "etherscan" },
  Polygon:     { apiUrl: "https://api.polygonscan.com/api",           type: "etherscan" },
  Avalanche:   { apiUrl: "https://api.snowscan.xyz/api",              type: "etherscan" },
  Base:        { apiUrl: "https://api.basescan.org/api",              type: "etherscan" },
  Fantom:      { apiUrl: "https://api.ftmscan.com/api",               type: "etherscan" },
  Solana:      { apiUrl: "https://api.solscan.io",                    type: "solana"    },
}

// ── Fetch real source from on-chain explorer ──────────────────────
async function fetchRealSource(address: string, network: string): Promise<{
  source: string
  compiler: string
  contractName: string
  linesOfCode: number
  fetchedFrom: string
} | null> {
  const config = EXPLORER_MAP[network]
  if (!config || config.type === "unsupported") return null

  if (config.type === "solana") {
    try {
      const res = await fetch(`https://api.solscan.io/account/idl?address=${address}`, {
        headers: { "Accept": "application/json", "User-Agent": "Solay39-DeepReview/1.0" },
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.data || data?.idl) {
          const idl = data.data || data.idl
          const source = typeof idl === "string" ? idl : JSON.stringify(idl, null, 2)
          return { source, compiler: "Rust/Anchor", contractName: idl?.name || "Solana Program", linesOfCode: source.split("\n").length, fetchedFrom: "Solscan" }
        }
      }
    } catch { /* continue */ }
    return null
  }

  // EVM: Etherscan-compatible
  try {
    const url = `${config.apiUrl}?module=contract&action=getsourcecode&address=${address}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== "1" || !data.result?.[0]) return null

    const result = data.result[0]
    let source = result.SourceCode || ""

    // Handle multi-file JSON-wrapped source
    if (source.startsWith("{") || source.startsWith("{{")) {
      try {
        const cleaned = source.startsWith("{{") ? source.slice(1, -1) : source
        const parsed = JSON.parse(cleaned)
        if (parsed.sources) {
          source = Object.entries(parsed.sources)
            .map(([name, content]: [string, unknown]) => {
              const src = (content as { content?: string })?.content || ""
              return `// ── File: ${name} ──\n${src}`
            })
            .join("\n\n")
        }
      } catch { /* use raw */ }
    }

    if (!source || source.length < 10) return null

    return {
      source,
      compiler: result.CompilerVersion || "unknown",
      contractName: result.ContractName || "Unknown",
      linesOfCode: source.split("\n").length,
      fetchedFrom: config.apiUrl.includes("etherscan") ? "Etherscan" :
        config.apiUrl.includes("bscscan") ? "BscScan" :
        config.apiUrl.includes("arbiscan") ? "Arbiscan" :
        config.apiUrl.includes("basescan") ? "BaseScan" :
        network + " Explorer",
    }
  } catch {
    return null
  }
}

// ── Main analysis prompt ──────────────────────────────────────────
function buildAnalysisPrompt(params: {
  realSource: string
  compiler: string
  contractName: string
  network: string
  address: string
  aiFindings: Array<{ id?: string; title: string; severity: string; location: string; description: string; impact: string; recommendation: string }>
}): string {
  const { realSource, compiler, contractName, network, address, aiFindings } = params
  const isSolana = network === "Solana"
  const sourceSlice = realSource.slice(0, 12000)

  return `You are a senior smart contract security auditor performing a MANUAL REVIEW of a real deployed contract. Your job is to:

1. Verify each AI finding against the REAL source code — identify FALSE POSITIVES
2. Find MISSING findings the AI did not catch
3. Flag SEVERITY ERRORS (wrong level assigned)
4. Generate a SPECIFIC checklist for human review

CONTRACT: ${contractName}
ADDRESS: ${address}
NETWORK: ${network}
COMPILER: ${compiler}

REAL CONTRACT SOURCE CODE (from on-chain explorer):
\`\`\`${isSolana ? "rust" : "solidity"}
${sourceSlice}
\`\`\`

AI PRE-ANALYSIS FINDINGS (${aiFindings.length} findings to verify):
${aiFindings.map((f, i) => `
[FINDING ${i + 1}]
ID: ${f.id || `AI-${i + 1}`}
Title: ${f.title}
Severity: ${f.severity}
Location: ${f.location}
Description: ${f.description}
Impact: ${f.impact}
`).join("\n")}

YOUR TASK — Respond ONLY with valid JSON matching this exact schema:

{
  "summary": "2-3 sentence honest assessment of the contract's security posture based on the REAL code",
  "compilerNote": "Note if the declared compiler version matches what's actually used, or any version concerns",
  "realLOC": number,
  "findingVerifications": [
    {
      "findingId": "AI-001",
      "verdict": "CONFIRMED" | "FALSE_POSITIVE" | "SEVERITY_WRONG" | "NEEDS_CLARIFICATION",
      "reason": "Specific reason referencing actual code lines or patterns found/not found",
      "suggestedSeverity": "CRITICAL|HIGH|MEDIUM|LOW|INFO" // only if SEVERITY_WRONG
    }
  ],
  "missingFindings": [
    {
      "id": "MR-001",
      "title": "Short, specific title",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "location": "ContractName.sol:functionName or line reference",
      "description": "Specific description referencing actual code",
      "impact": "Concrete impact on users or funds",
      "recommendation": "Specific fix recommendation",
      "codeEvidence": "The exact code snippet that triggered this finding"
    }
  ],
  "checklist": [
    {
      "id": "c1",
      "category": "Access Control",
      "question": "Specific question referencing actual function/variable names in this contract",
      "why": "Why this matters for THIS specific contract",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "relevantCode": "Exact code snippet from the contract",
      "lineRef": "approximate line reference"
    }
  ]
}

IMPORTANT RULES:
- Base EVERY finding on the ACTUAL code provided above — not general knowledge
- For FALSE_POSITIVE: cite exactly why the code does NOT have this vulnerability
- For MISSING findings: quote the actual vulnerable code as codeEvidence
- Checklist must have 8-15 items specific to THIS contract
- If a finding mentions block.timestamp but the contract has NO timestamp logic, mark it FALSE_POSITIVE
- If compiler version in code doesn't match deployed version, note it
- Be a real auditor: be accurate, be specific, don't hallucinate vulnerabilities`
}

// ── POST handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { contractAddress, network, aiFindings, fallbackSource } = await req.json()

    if (!contractAddress) {
      return NextResponse.json({ error: "Missing contractAddress" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 })
    }

    // ── Step 1: Fetch real source from explorer ──────────────────
    let realSourceData = await fetchRealSource(contractAddress, network || "Ethereum")

    // If explorer fetch failed, use the source passed from frontend as fallback
    if (!realSourceData && fallbackSource && fallbackSource.length > 50) {
      realSourceData = {
        source: fallbackSource,
        compiler: "unknown (from editor)",
        contractName: "Contract",
        linesOfCode: fallbackSource.split("\n").length,
        fetchedFrom: "editor (explorer fetch failed)",
      }
    }

    if (!realSourceData) {
      return NextResponse.json({
        error: `Could not fetch contract source from ${network} explorer. The contract may not be verified on-chain.`,
        hint: "Make sure the contract source is verified on the block explorer.",
      }, { status: 404 })
    }

    // ── Step 2: Claude deep analysis ──────────────────────────────
    const prompt = buildAnalysisPrompt({
      realSource: realSourceData.source,
      compiler: realSourceData.compiler,
      contractName: realSourceData.contractName,
      network: network || "Ethereum",
      address: contractAddress,
      aiFindings: (aiFindings || []).slice(0, 15),
    })

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return NextResponse.json({ error: `AI analysis failed: ${err}` }, { status: 500 })
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content?.[0]?.text || ""

    // ── Step 3: Parse response ─────────────────────────────────────
    const jsonStart = rawText.indexOf("{")
    const jsonEnd = rawText.lastIndexOf("}")
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 })
    }

    let analysis: {
      summary: string
      compilerNote: string
      realLOC: number
      findingVerifications: Array<{
        findingId: string
        verdict: "CONFIRMED" | "FALSE_POSITIVE" | "SEVERITY_WRONG" | "NEEDS_CLARIFICATION"
        reason: string
        suggestedSeverity?: string
      }>
      missingFindings: Array<{
        id: string
        title: string
        severity: string
        location: string
        description: string
        impact: string
        recommendation: string
        codeEvidence?: string
      }>
      checklist: Array<{
        id: string
        category: string
        question: string
        why: string
        severity: string
        relevantCode?: string
        lineRef?: string
      }>
    }

    try {
      analysis = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1))
    } catch {
      return NextResponse.json({ error: "Failed to parse AI analysis" }, { status: 500 })
    }

    // ── Step 4: Return enriched result ────────────────────────────
    return NextResponse.json({
      // Source metadata
      realSource: {
        contractName: realSourceData.contractName,
        compiler: realSourceData.compiler,
        linesOfCode: realSourceData.linesOfCode,
        fetchedFrom: realSourceData.fetchedFrom,
        sourcePreview: realSourceData.source.slice(0, 3000),
      },
      // AI analysis results
      summary: analysis.summary || "",
      compilerNote: analysis.compilerNote || "",
      realLOC: analysis.realLOC || realSourceData.linesOfCode,

      // Finding verdicts — what to show in the "AI Findings" sub-tab
      findingVerifications: (analysis.findingVerifications || []).map(v => ({
        findingId: v.findingId,
        verdict: v.verdict,
        reason: v.reason,
        suggestedSeverity: v.suggestedSeverity,
      })),

      // New findings the AI missed — shown as "MISSING" cards to approve
      missingFindings: (analysis.missingFindings || []).map((f, i) => ({
        id: f.id || `MR-${String(i + 1).padStart(3, "0")}`,
        title: f.title,
        severity: f.severity,
        location: f.location,
        description: f.description,
        impact: f.impact,
        recommendation: f.recommendation,
        codeEvidence: f.codeEvidence || "",
        source: "deep-review" as const,
      })),

      // Checklist specific to this contract
      checklist: (analysis.checklist || []).map((c, i) => ({
        id: c.id || `dr${i + 1}`,
        category: c.category,
        question: c.question,
        why: c.why,
        severity: c.severity,
        relevantCode: c.relevantCode,
        lineRef: c.lineRef,
        aiGenerated: true as const,
        status: "pending" as const,
        note: "" as const,
      })),
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[deep-review] Error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}