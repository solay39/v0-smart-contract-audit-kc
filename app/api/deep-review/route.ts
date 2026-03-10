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
  const sourceSlice = realSource.slice(0, 14000)

  return `You are performing a real manual smart contract security audit. You think like a senior auditor at Trail of Bits or Halborn — not like a static analysis scanner.

CONTRACT: ${contractName}
ADDRESS: ${address}
NETWORK: ${network}
COMPILER: ${compiler}

SOURCE CODE (fetched directly from on-chain explorer — this is the REAL deployed code):
\`\`\`${isSolana ? "rust" : "solidity"}
${sourceSlice}
\`\`\`

═══════════════════════════════════════════
PHASE 1: READ THE CODE — UNDERSTAND WHAT IT ACTUALLY DOES
═══════════════════════════════════════════

Before analyzing findings, read the full source and answer internally:
- What does this contract actually do? (token? vault? governance? migration? proxy?)
- What are the privileged roles and what can each do?
- Does it call external contracts? Which ones?
- Does it use block.timestamp, block.number, or msg.value anywhere? (search literally)
- Is the pragma floating (^) or pinned (exact version)?
- What is the inheritance chain? (ERC20? Pausable? Ownable? custom?)
- Are there any non-standard patterns? (copy-on-write? lazy minting? weight system?)
- What are the assets at risk and who can move them?

═══════════════════════════════════════════
PHASE 2: VERIFY AI FINDINGS — BE BRUTALLY HONEST ABOUT FALSE POSITIVES
═══════════════════════════════════════════

AI FINDINGS TO VERIFY (${aiFindings.length} total):
${aiFindings.map((f, i) => `
[FINDING ${i + 1}]
ID: ${f.id || `AI-${String(i+1).padStart(3,"0")}`}
Title: ${f.title}
Severity: ${f.severity}
Location: ${f.location}
Description: ${f.description}
`).join("\n")}

For EACH finding, do this:
1. Search the actual source code for the specific pattern mentioned
2. If the pattern does NOT exist in the code → FALSE_POSITIVE (cite exact reason)
3. If the pattern EXISTS but is mitigated → SEVERITY_WRONG (suggest lower severity)
4. If the pattern EXISTS and is a real issue → CONFIRMED
5. If ambiguous → NEEDS_CLARIFICATION

Common AI false positive patterns to watch for:
- "Timestamp Dependence" on contracts with NO block.timestamp usage
- "External ETH Transfer" on pure ERC-20s with no payable/call{value:}
- "Floating Pragma" on contracts with pinned pragma (no ^ symbol)
- "Reentrancy" on contracts with no external calls before state changes
- "Integer Overflow" on Solidity >=0.8.0 (built-in SafeMath)

═══════════════════════════════════════════
PHASE 3: FIND WHAT THE AI MISSED — THINK LIKE AN ATTACKER
═══════════════════════════════════════════

Now search for real vulnerabilities the AI scanner missed. Think through:

ACCESS CONTROL:
- Are there privileged functions (pause, mint, upgrade, drain) with a single EOA as owner?
- Can the owner/admin rug without timelock?
- Is there a role change function that could be front-run?
- Are there multiple roles (owner, pauser, mage, guardian) — can any act without multisig?

BUSINESS LOGIC:
- Are there public functions that should be restricted?
- Are there state machines / phases that can be bypassed?
- Can an attacker call functions in wrong order?
- Are there functions that anyone can call on behalf of others (forcing state changes)?

TOKEN MECHANICS:
- Is balanceOf() reading from an external contract? What if that contract is malicious?
- Is totalSupply() accurate? Can it be manipulated?
- Are there fee-on-transfer or rebasing mechanics that break integrations?
- Can transfers be permanently paused with no timelock?

EXTERNAL DEPENDENCIES:
- Does the contract inherit from or call an external contract?
- Is that external contract immutable? Is its address hardcoded or settable?
- If the external contract has a bug, does it propagate here?

ECONOMIC:
- Is there significant supply concentration (>30% in one address)?
- Are there mechanisms that let insiders exit before others?

For each real finding you discover, quote the exact code as evidence.

═══════════════════════════════════════════
PHASE 4: GENERATE SPECIFIC CHECKLIST
═══════════════════════════════════════════

Create 10-18 checklist items for a human auditor to manually verify.
Each item must reference actual function names, variable names, or patterns from THIS contract.
Do NOT create generic checklist items — every item must be specific to this code.

═══════════════════════════════════════════
OUTPUT — Respond ONLY with valid JSON:
═══════════════════════════════════════════

{
  "contractType": "Brief description of what the contract actually does (e.g. 'ERC-20 governance token with copy-on-write migration from oldRSR')",
  "summary": "2-4 sentence honest assessment based on reading the REAL code. Mention the most important risk.",
  "compilerNote": "Confirm if compiler version in source matches deployed. Note if pragma is pinned or floating.",
  "realLOC": <number of lines in the source provided>,
  "privilegedRoles": [
    { "role": "pauser", "capability": "can pause all transfers", "risk": "HIGH — no timelock" }
  ],
  "findingVerifications": [
    {
      "findingId": "AI-001",
      "verdict": "CONFIRMED|FALSE_POSITIVE|SEVERITY_WRONG|NEEDS_CLARIFICATION",
      "reason": "Specific explanation citing actual code. For FALSE_POSITIVE: quote what is NOT in the code. For CONFIRMED: quote what IS in the code.",
      "suggestedSeverity": "CRITICAL|HIGH|MEDIUM|LOW|INFO"
    }
  ],
  "missingFindings": [
    {
      "id": "MR-001",
      "title": "Concise title max 8 words",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "location": "FunctionName() or FileName.sol:approx line",
      "description": "Specific description of the vulnerability referencing actual code constructs",
      "impact": "Concrete real-world impact: who loses what, how much, under what conditions",
      "recommendation": "Specific actionable fix",
      "codeEvidence": "Exact code snippet from the source that proves this finding"
    }
  ],
  "checklist": [
    {
      "id": "c1",
      "category": "Access Control|Reentrancy|Token Logic|Business Logic|Economic|External Calls|Upgradeability|Arithmetic",
      "question": "Question referencing the ACTUAL function/variable name from this contract",
      "why": "Why this check matters specifically for this contract",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "relevantCode": "Exact snippet from source",
      "lineRef": "~line N or FunctionName()"
    }
  ]
}

ABSOLUTE RULES:
1. Never invent vulnerabilities — every finding needs code evidence
2. Never confirm a finding if the pattern does not exist in the source — mark FALSE_POSITIVE
3. Severity scale: CRITICAL=funds at risk now, HIGH=funds at risk with conditions, MEDIUM=integrity risk, LOW=best practice, INFO=observation
4. Be specific: a finding without a code quote is not a finding
5. The checklist must be usable by a human looking at the code — vague questions are forbidden`
}

// ── AI Provider selection ─────────────────────────────────────────
async function callAI(prompt: string): Promise<{ success: boolean; text?: string; error?: string }> {
  // Priority: Anthropic direct > AI Gateway > OpenAI
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const gatewayEnabled = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY

  // Try Anthropic first
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return { success: true, text: data.content?.[0]?.text || "" }
      }
    } catch { /* fallback */ }
  }

  // Try Vercel AI Gateway
  if (gatewayEnabled) {
    try {
      const res = await fetch("https://api.vercel.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-6",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return { success: true, text: data.choices?.[0]?.message?.content || "" }
      }
    } catch { /* fallback */ }
  }

  // Try OpenAI directly as last resort
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return { success: true, text: data.choices?.[0]?.message?.content || "" }
      }
    } catch { /* fallback */ }
  }

  return { success: false, error: "No AI provider available. Set ANTHROPIC_API_KEY, AI_GATEWAY_API_KEY, or OPENAI_API_KEY." }
}

// ── POST handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { contractAddress, network, aiFindings, fallbackSource } = await req.json()

    if (!contractAddress) {
      return NextResponse.json({ error: "Missing contractAddress" }, { status: 400 })
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

    // ── Step 2: AI deep analysis ──────────────────────────────
    const prompt = buildAnalysisPrompt({
      realSource: realSourceData.source,
      compiler: realSourceData.compiler,
      contractName: realSourceData.contractName,
      network: network || "Ethereum",
      address: contractAddress,
      aiFindings: (aiFindings || []).slice(0, 15),
    })

    const aiResult = await callAI(prompt)
    if (!aiResult.success) {
      return NextResponse.json({ error: aiResult.error || "AI analysis failed" }, { status: 503 })
    }

    const rawText = aiResult.text || ""

    // ── Step 3: Parse response ─────────────────────────────────────
    const jsonStart = rawText.indexOf("{")
    const jsonEnd = rawText.lastIndexOf("}")
    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 })
    }

    let analysis: {
      contractType: string
      summary: string
      compilerNote: string
      realLOC: number
      privilegedRoles: Array<{ role: string; capability: string; risk: string }>
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
      contractType: analysis.contractType || "",
      summary: analysis.summary || "",
      compilerNote: analysis.compilerNote || "",
      realLOC: analysis.realLOC || realSourceData.linesOfCode,
      privilegedRoles: analysis.privilegedRoles || [],

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