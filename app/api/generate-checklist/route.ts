// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Dynamic Checklist Generator
// app/api/generate-checklist/route.ts
//
// Genera una checklist SPECIFICA per il contratto in input.
// Non è una lista generica — ogni domanda è calibrata sul codice reale.
// ═══════════════════════════════════════════════════════════════════

export const maxDuration = 30

import { NextRequest, NextResponse } from "next/server"

interface CheckItem {
  id: string
  category: string
  question: string
  why: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  relevantCode?: string
  lineRef?: string
  aiGenerated: true
  status: "pending"
  note: ""
}

// Garantisce almeno 6-10 domande base anche per contratti semplici
function mergeWithBaseChecklist(
  aiChecks: CheckItem[],
  network: string,
  source: string
): CheckItem[] {
  const isSolana = network === "Solana"
  const hasOwner = /onlyOwner|Ownable|owner\(\)/.test(source)
  const hasProxy = /upgradeable|proxy|UUPSUpgradeable/.test(source.toLowerCase())
  const hasMint = /function\s+mint/.test(source)

  // Base questions always present regardless of contract complexity
  const base: CheckItem[] = isSolana ? [
    { id: "base-s1", category: "Signer Verification", question: "Are all state-modifying instructions verifying the signer account explicitly?", why: "Missing signer check is #1 Solana exploit vector", severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    { id: "base-s2", category: "Account Validation", question: "Are account owners verified before reading or writing account data?", why: "Account confusion attacks exploit missing owner checks", severity: "HIGH", aiGenerated: true, status: "pending", note: "" },
    { id: "base-s3", category: "Arithmetic Safety", question: "Are all arithmetic operations using checked_add / checked_sub / checked_mul?", why: "Rust release mode disables overflow panics by default", severity: "MEDIUM", aiGenerated: true, status: "pending", note: "" },
    { id: "base-s4", category: "CPI Security", question: "Are all Cross-Program Invocations verifying the target program ID?", why: "Unverified CPI targets allow calling malicious programs", severity: "HIGH", aiGenerated: true, status: "pending", note: "" },
    { id: "base-s5", category: "PDA Security", question: "Are PDA seeds unique enough to prevent account collisions?", why: "Predictable seeds allow front-running PDA creation", severity: "MEDIUM", aiGenerated: true, status: "pending", note: "" },
  ] : [
    { id: "base-e1", category: "Access Control", question: "Are all state-changing functions restricted to authorized callers only?", why: "Unrestricted functions are the most common exploit entry point", severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e2", category: "Access Control", question: "Is the contract ownership transfer a two-step process (propose + accept)?", why: "One-step ownership transfer risks transferring to wrong address permanently", severity: "HIGH", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e3", category: "Supply Integrity", question: "Is the total supply fixed and immutable as claimed, with no hidden mint path?", why: "Hidden mint functions allow silent supply inflation", severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e4", category: "Token Standard", question: "Do transfer() and transferFrom() correctly return a boolean and revert on failure?", why: "Non-compliant return values cause integration failures with DeFi protocols", severity: "MEDIUM", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e5", category: "Code Quality", question: "Is the Solidity version pinned (not floating ^) to a specific compiler version?", why: "Floating pragma can compile with future incompatible compiler versions", severity: "LOW", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e6", category: "Deployment", question: "Does the deployed bytecode match the verified source on the block explorer?", why: "Mismatched bytecode means the audited code is not what is running on-chain", severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    ...(hasOwner ? [
      { id: "base-e7", category: "Centralization", question: "Is the owner address a multisig or EOA? If EOA, what is the key management policy?", why: "A single compromised EOA gives full admin control", severity: "HIGH", aiGenerated: true as const, status: "pending" as const, note: "" as const },
    ] : []),
    ...(hasProxy ? [
      { id: "base-e8", category: "Upgradeability", question: "Is the upgrade function behind a timelock of at least 48 hours?", why: "Immediate upgrades allow admin to drain funds before users can exit", severity: "HIGH", aiGenerated: true as const, status: "pending" as const, note: "" as const },
      { id: "base-e9", category: "Upgradeability", question: "Is the initialize() function callable only once (Initializable modifier)?", why: "Unprotected initializers allow anyone to reset contract ownership", severity: "CRITICAL", aiGenerated: true as const, status: "pending" as const, note: "" as const },
    ] : []),
    ...(hasMint ? [
      { id: "base-e10", category: "Mint Control", question: "Is the mint function protected by a role check (onlyOwner / onlyMinter)?", why: "Unprotected mint allows infinite token creation by anyone", severity: "CRITICAL", aiGenerated: true as const, status: "pending" as const, note: "" as const },
    ] : []),
  ]

  // Merge: keep AI questions first (more specific), add base ones not already covered
  const existingIds = new Set(aiChecks.map(c => c.id))
  const existingQuestions = aiChecks.map(c => c.question.toLowerCase().slice(0, 40))

  const toAdd = base.filter(b =>
    !existingIds.has(b.id) &&
    !existingQuestions.some(q => q.includes(b.question.toLowerCase().slice(0, 25)))
  )

  return [...aiChecks, ...toAdd]
}

export async function POST(req: NextRequest) {
  const { contractSource, contractAddress, network, aiFindings } = await req.json()

  if (!contractSource) {
    return NextResponse.json({ error: "Missing contractSource" }, { status: 400 })
  }

  const isSolana = network === "Solana"

  // Costruiamo il prompt per la checklist dinamica
  const prompt = `You are a senior smart contract security auditor creating a SPECIFIC manual review checklist for this contract.

Network: ${network}
Contract: ${contractAddress}
Language: ${isSolana ? "Rust/Anchor" : "Solidity"}

CONTRACT SOURCE (first 6000 chars):
${contractSource.slice(0, 6000)}

AI PRE-ANALYSIS found these potential findings:
${(aiFindings || []).slice(0, 8).map((f: { severity: string; title: string; location: string }) => `- [${f.severity}] ${f.title} at ${f.location}`).join("\n") || "None"}

Generate a checklist of 15-25 specific questions for a HUMAN AUDITOR to manually verify.

Rules:
1. Questions must be specific to THIS contract — not generic
2. If the contract has a mint function, ask about mint authority specifically
3. If it has CPI calls (Solana) or external calls (EVM), ask about those specifically
4. Reference actual function names and line patterns from the code
5. Group by category
6. Each question should take 2-5 minutes to verify manually
7. Focus on what AI might miss: business logic, economic attacks, edge cases

${isSolana ? `
Solana-specific categories to include:
- Signer Verification, Account Validation, CPI Security, PDA Derivation, Token Operations, Arithmetic Safety
` : `
EVM-specific categories to include:
- Access Control, Reentrancy, Arithmetic, External Calls, Token Logic, Business Logic, Upgradeability (if proxy)
`}

Respond ONLY with valid JSON array:
[
  {
    "id": "c1",
    "category": "Access Control",
    "question": "Is the withdraw() function at line 42 restricted to the authority account only?",
    "why": "Missing authority check allows any caller to drain the vault",
    "severity": "CRITICAL",
    "relevantCode": "pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {",
    "lineRef": "lib.rs:42-48",
    "aiGenerated": true,
    "status": "pending",
    "note": ""
  }
]`

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback senza AI
      return NextResponse.json({ checks: [], fallback: true })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ checks: [], error: "AI unavailable" })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ""

    // Parse JSON dalla risposta
    const jsonStart = text.indexOf("[")
    const jsonEnd = text.lastIndexOf("]")

    if (jsonStart === -1 || jsonEnd === -1) {
      return NextResponse.json({ checks: [], error: "Invalid AI response" })
    }

    const checks: CheckItem[] = JSON.parse(text.slice(jsonStart, jsonEnd + 1))

    // Valida e sanitizza
    const sanitized = checks
      .filter(c => c.question && c.category && c.severity)
      .map((c, i) => ({
        id: c.id || `c${i + 1}`,
        category: String(c.category),
        question: String(c.question),
        why: String(c.why || ""),
        severity: (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(c.severity) ? c.severity : "MEDIUM") as CheckItem["severity"],
        relevantCode: c.relevantCode ? String(c.relevantCode) : undefined,
        lineRef: c.lineRef ? String(c.lineRef) : undefined,
        aiGenerated: true as const,
        status: "pending" as const,
        note: "" as const,
      }))
      .slice(0, 30) // max 30 items

    // Sempre garantire almeno 6-10 domande base anche per contratti semplici
    const merged = mergeWithBaseChecklist(sanitized, network, contractSource)
    return NextResponse.json({ checks: merged })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[generate-checklist] Error:", msg)
    return NextResponse.json({ checks: [], error: msg })
  }
}
