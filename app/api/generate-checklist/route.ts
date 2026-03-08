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

    return NextResponse.json({ checks: sanitized })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[generate-checklist] Error:", msg)
    return NextResponse.json({ checks: [], error: msg })
  }
}
