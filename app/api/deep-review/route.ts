// SOLAY39 — Deep Review Engine (UPGRADE v2 — CertiK-grade)
// app/api/deep-review/route.ts

export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"

const EXPLORER_MAP: Record<string, { apiUrl: string; type: "etherscan" | "solana" | "unsupported" }> = {
  Ethereum:    { apiUrl: "https://api.etherscan.io/api",            type: "etherscan" },
  BSC:         { apiUrl: "https://api.bscscan.com/api",             type: "etherscan" },
  "BNB Chain": { apiUrl: "https://api.bscscan.com/api",             type: "etherscan" },
  Arbitrum:    { apiUrl: "https://api.arbiscan.io/api",             type: "etherscan" },
  Optimism:    { apiUrl: "https://api-optimistic.etherscan.io/api", type: "etherscan" },
  Polygon:     { apiUrl: "https://api.polygonscan.com/api",         type: "etherscan" },
  Avalanche:   { apiUrl: "https://api.snowscan.xyz/api",            type: "etherscan" },
  Base:        { apiUrl: "https://api.basescan.org/api",            type: "etherscan" },
  Fantom:      { apiUrl: "https://api.ftmscan.com/api",             type: "etherscan" },
  Solana:      { apiUrl: "https://api.solscan.io",                  type: "solana"    },
}

async function fetchRealSource(address: string, network: string): Promise<{
  source: string; compiler: string; contractName: string; linesOfCode: number; fetchedFrom: string
} | null> {
  const config = EXPLORER_MAP[network]
  if (!config || config.type === "unsupported") return null

  if (config.type === "solana") {
    try {
      const res = await fetch(`https://api.solscan.io/account/idl?address=${address}`, {
        headers: { "Accept": "application/json", "User-Agent": "Solay39-DeepReview/2.0" },
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

  try {
    const url = `${config.apiUrl}?module=contract&action=getsourcecode&address=${address}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== "1" || !data.result?.[0]) return null
    const result = data.result[0]
    let source = result.SourceCode || ""
    if (source.startsWith("{") || source.startsWith("{{")) {
      try {
        const cleaned = source.startsWith("{{") ? source.slice(1, -1) : source
        const parsed = JSON.parse(cleaned)
        if (parsed.sources) {
          source = Object.entries(parsed.sources)
            .map(([name, content]: [string, unknown]) => `// ── File: ${name} ──\n${(content as { content?: string })?.content || ""}`)
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
        config.apiUrl.includes("basescan") ? "BaseScan" : network + " Explorer",
    }
  } catch { return null }
}

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

  return `You are a senior smart contract security auditor at a Tier-1 firm (CertiK / Trail of Bits / Halborn level).

CONTRACT: ${contractName}
ADDRESS: ${address}
NETWORK: ${network}
COMPILER: ${compiler}

SOURCE CODE (real deployed code):
\`\`\`${isSolana ? "rust" : "solidity"}
${sourceSlice}
\`\`\`

═══════════════════════════════════════════
PHASE 1: UNDERSTAND THE CONTRACT
═══════════════════════════════════════════
Before producing output, read the entire source and determine:
- What does this contract do? (token / vault / governance / proxy / migration?)
- What privileged roles exist and what can each do without timelock?
- Does it read on-chain price data? From AMM spot or TWAP/Chainlink?
- Does it call external contracts? Which addresses? Are they hardcoded?
- Solidity version: is arithmetic safe (>=0.8) or could overflow?
- Does it use block.timestamp, block.number, or msg.value for logic?
- Is the contract upgradeable? What is the upgrade path?
- What assets (ETH, ERC-20) are held or managed?

═══════════════════════════════════════════
PHASE 2: VERIFY AI FINDINGS — BE BRUTALLY HONEST
═══════════════════════════════════════════
AI FINDINGS TO VERIFY (${aiFindings.length} total):
${aiFindings.map((f, i) => `
[FINDING ${i + 1}]
ID: ${f.id || `AI-${String(i + 1).padStart(3, "0")}`}
Title: ${f.title}
Severity: ${f.severity}
Location: ${f.location}
Description: ${f.description}`).join("\n")}

For EACH finding:
1. Search the source for the exact pattern mentioned
2. FALSE_POSITIVE if the pattern is absent — cite why
3. SEVERITY_WRONG if pattern exists but is mitigated — suggest correct severity
4. CONFIRMED if the pattern exists and is a real vulnerability
5. NEEDS_CLARIFICATION if ambiguous

═══════════════════════════════════════════
PHASE 3: FIND WHAT THE AI MISSED
═══════════════════════════════════════════
Think as an attacker. Check:
- Single-owner admin functions callable without multisig/timelock
- Any function that lets owner drain funds in one tx (rug vector)
- ERC-777 tokensReceived / tokensToSend hooks → reentrancy
- ERC-20 allowance front-running (approve race condition)
- Signature replay attacks (missing nonce / chainId / domain separator)
- Flash loan exploitability (spot price reads, single-block price checks)
- Liquidity pool / LP token lock status (unlocked LP = centralization risk)
- Fee-on-transfer or rebasing tokens breaking integrations
- Missing access control on functions that modify critical state
- Block timestamp manipulation for time-locked logic
- Gas griefing / DoS via unbounded loops

For EVERY finding you add, you MUST include:
  - codeEvidence: exact quoted line(s) from the source that prove this finding
  - cvss: a real CVSSv3.1 vector string with base score
  - likelihood: "High", "Medium", or "Low"
  - remediationExample: working Solidity code showing the correct fix
  - foundryPoC: a runnable Foundry forge test (for HIGH and CRITICAL only; null for others)

═══════════════════════════════════════════
PHASE 4: CONTRACT-SPECIFIC CHECKLIST
═══════════════════════════════════════════
10–18 items, each referencing ACTUAL function/variable names from THIS contract.
No generic items.

═══════════════════════════════════════════
OUTPUT — Respond ONLY with valid JSON:
═══════════════════════════════════════════

{
  "contractType": "Brief: what this contract actually does",
  "summary": "2-4 sentence honest security assessment.",
  "compilerNote": "Confirm if pragma is pinned or floating.",
  "realLOC": <number>,
  "privilegedRoles": [
    { "role": "owner", "capability": "can pause all transfers", "risk": "HIGH — no timelock, single EOA" }
  ],
  "findingVerifications": [
    {
      "findingId": "AI-001",
      "verdict": "CONFIRMED|FALSE_POSITIVE|SEVERITY_WRONG|NEEDS_CLARIFICATION",
      "reason": "Cite exact code or explain why pattern is absent",
      "suggestedSeverity": "CRITICAL|HIGH|MEDIUM|LOW|INFO"
    }
  ],
  "missingFindings": [
    {
      "id": "MR-001",
      "title": "Concise title max 8 words",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "location": "FunctionName() or FileName.sol:~line",
      "description": "Technical description referencing real code constructs",
      "impact": "Who loses what, how much, under what conditions",
      "recommendation": "Specific actionable fix",
      "codeEvidence": "REQUIRED: exact quoted line(s) from source proving this finding",
      "cvss": {
        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "baseScore": 9.8,
        "severity": "CRITICAL"
      },
      "likelihood": "High|Medium|Low",
      "remediationExample": "Working Solidity code showing the correct fix",
      "foundryPoC": "Full runnable forge test (HIGH/CRITICAL only, null otherwise)"
    }
  ],
  "checklist": [
    {
      "id": "c1",
      "category": "Access Control|Reentrancy|Token Logic|Business Logic|Economic|External Calls|Upgradeability|Arithmetic",
      "question": "Does FunctionName() validate X before calling Y?",
      "why": "Because if not, attacker can Z — SWC-XXX",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "relevantCode": "Exact snippet from source",
      "lineRef": "~line N or FunctionName()"
    }
  ]
}

ABSOLUTE RULES:
1. NEVER invent a finding without codeEvidence
2. NEVER omit cvss and likelihood for missingFindings
3. foundryPoC must be a complete runnable forge test file
4. remediationExample must be real Solidity code, not prose`
}

async function callAI(prompt: string): Promise<{ success: boolean; text?: string; error?: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const gatewayKey = process.env.AI_GATEWAY_API_KEY

  // Try Claude first (best for security analysis)
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "x-api-key": anthropicKey, 
          "anthropic-version": "2023-06-01" 
        },
        body: JSON.stringify({ 
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000, 
          messages: [{ role: "user", content: prompt }] 
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || ""
        if (text) return { success: true, text }
      } else {
        console.error("[deep-review] Claude API error:", res.status, await res.text().catch(() => ""))
      }
    } catch (e) { 
      console.error("[deep-review] Claude fetch error:", e)
    }
  }

  // Try GPT-4o as fallback
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${openaiKey}` 
        },
        body: JSON.stringify({ 
          model: "gpt-4o", 
          max_tokens: 8000, 
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ""
        if (text) return { success: true, text }
      } else {
        console.error("[deep-review] OpenAI API error:", res.status, await res.text().catch(() => ""))
      }
    } catch (e) { 
      console.error("[deep-review] OpenAI fetch error:", e)
    }
  }

  // Try Vercel AI Gateway as last resort
  if (gatewayKey) {
    try {
      const res = await fetch("https://api.vercel.ai/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${gatewayKey}` 
        },
        body: JSON.stringify({ 
          model: "anthropic/claude-sonnet-4-20250514", 
          max_tokens: 8000, 
          messages: [{ role: "user", content: prompt }] 
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ""
        if (text) return { success: true, text }
      }
    } catch { /* exhausted */ }
  }

  return { 
    success: false, 
    error: "No AI provider available or all failed. Set ANTHROPIC_API_KEY or OPENAI_API_KEY." 
  }
}

export async function POST(req: NextRequest) {
  try {
    const { contractAddress, network, aiFindings, fallbackSource } = await req.json()
    if (!contractAddress) return NextResponse.json({ error: "Missing contractAddress" }, { status: 400 })

    let realSourceData = await fetchRealSource(contractAddress, network || "Ethereum")
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
        error: `Could not fetch contract source from ${network} explorer.`,
        hint: "Make sure the contract source is verified on the block explorer.",
      }, { status: 404 })
    }

    const prompt = buildAnalysisPrompt({
      realSource: realSourceData.source,
      compiler: realSourceData.compiler,
      contractName: realSourceData.contractName,
      network: network || "Ethereum",
      address: contractAddress,
      aiFindings: (aiFindings || []).slice(0, 15),
    })

    const aiResult = await callAI(prompt)
    if (!aiResult.success) return NextResponse.json({ error: aiResult.error || "AI analysis failed" }, { status: 503 })

    const rawText = aiResult.text || ""
    const jsonStart = rawText.indexOf("{")
    const jsonEnd = rawText.lastIndexOf("}")
    if (jsonStart === -1 || jsonEnd === -1) return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 })

    let analysis: {
      contractType: string
      summary: string
      compilerNote: string
      realLOC: number
      privilegedRoles: Array<{ role: string; capability: string; risk: string }>
      findingVerifications: Array<{ findingId: string; verdict: string; reason: string; suggestedSeverity?: string }>
      missingFindings: Array<{
        id: string; title: string; severity: string; location: string
        description: string; impact: string; recommendation: string
        codeEvidence?: string
        cvss?: { vectorString: string; baseScore: number; severity: string }
        likelihood?: string
        remediationExample?: string
        foundryPoC?: string | null
      }>
      checklist: Array<{ id: string; category: string; question: string; why: string; severity: string; relevantCode?: string; lineRef?: string }>
    }

    try {
      analysis = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1))
    } catch {
      return NextResponse.json({ error: "Failed to parse AI analysis" }, { status: 500 })
    }

    return NextResponse.json({
      realSource: {
        contractName: realSourceData.contractName,
        compiler: realSourceData.compiler,
        linesOfCode: realSourceData.linesOfCode,
        fetchedFrom: realSourceData.fetchedFrom,
        sourcePreview: realSourceData.source.slice(0, 3000),
      },
      contractType: analysis.contractType || "",
      summary: analysis.summary || "",
      compilerNote: analysis.compilerNote || "",
      realLOC: analysis.realLOC || realSourceData.linesOfCode,
      privilegedRoles: analysis.privilegedRoles || [],
      findingVerifications: (analysis.findingVerifications || []).map(v => ({
        findingId: v.findingId,
        verdict: v.verdict,
        reason: v.reason,
        suggestedSeverity: v.suggestedSeverity,
      })),
      missingFindings: (analysis.missingFindings || []).map((f, i) => ({
        id: f.id || `MR-${String(i + 1).padStart(3, "0")}`,
        title: f.title,
        severity: f.severity,
        location: f.location,
        description: f.description,
        impact: f.impact,
        recommendation: f.recommendation,
        codeEvidence:       f.codeEvidence       || "",
        cvss:               f.cvss               || null,
        likelihood:         f.likelihood          || null,
        remediationExample: f.remediationExample  || null,
        foundryPoC:         f.foundryPoC          || null,
        source: "deep-review" as const,
      })),
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
