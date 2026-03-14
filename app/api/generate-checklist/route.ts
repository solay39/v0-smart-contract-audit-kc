// SOLAY39 — Dynamic Checklist Generator (UPGRADE v2)
// app/api/generate-checklist/route.ts

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

function mergeWithBaseChecklist(aiChecks: CheckItem[], network: string, source: string): CheckItem[] {
  const isSolana      = network === "Solana"
  const hasOwner      = /onlyOwner|Ownable|owner\(\)/.test(source)
  const hasProxy      = /upgradeable|proxy|UUPSUpgradeable/i.test(source)
  const hasMint       = /function\s+mint/.test(source)
  const hasTransfer   = /\.transfer\(|\.call\{value:/.test(source)
  const hasApprove    = /function\s+approve/.test(source)
  const hasLiquidity  = /addLiquidity|removeLiquidity|pool|swap/i.test(source)
  const hasDelegateCall = /\.delegatecall\(/.test(source)
  const hasBlock      = /block\.timestamp|block\.number/.test(source)
  const pm            = source.match(/pragma\s+solidity\s+([^;]+);/)
  const oldSolidity   = pm && /0\.[0-7]/.test(pm[1])
  const has777        = /ERC777|tokensReceived|tokensToSend/.test(source)
  const hasSig        = /ecrecover|ECDSA/.test(source)

  const base: CheckItem[] = isSolana ? [
    { id: "base-s1", category: "Signer Verification",  question: "Are all state-modifying instructions verifying the signer account explicitly?",    why: "Missing signer check = #1 Solana exploit vector — CWE-284",            severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    { id: "base-s2", category: "Account Validation",   question: "Are account owners verified before reading/writing account data?",                  why: "Account confusion attacks exploit missing owner checks",                 severity: "HIGH",     aiGenerated: true, status: "pending", note: "" },
    { id: "base-s3", category: "Arithmetic Safety",    question: "Are all arithmetic operations using checked_add / checked_sub / checked_mul?",       why: "Rust release mode disables overflow panics — SWC-101",                 severity: "MEDIUM",   aiGenerated: true, status: "pending", note: "" },
    { id: "base-s4", category: "CPI Security",         question: "Are all Cross-Program Invocations verifying the target program ID?",                 why: "Unverified CPI targets allow calling malicious programs",              severity: "HIGH",     aiGenerated: true, status: "pending", note: "" },
    { id: "base-s5", category: "PDA Security",         question: "Are PDA seeds unique enough to prevent account collisions?",                         why: "Predictable seeds allow front-running PDA creation",                   severity: "MEDIUM",   aiGenerated: true, status: "pending", note: "" },
  ] : [
    { id: "base-e1",  category: "Access Control",     question: "Are all privileged functions (pause/mint/upgrade/drain) restricted to authorized callers only?",      why: "Unrestricted privileged functions = most common exploit — SWC-105",    severity: "CRITICAL", aiGenerated: true, status: "pending", note: "" },
    { id: "base-e2",  category: "Access Control",     question: "Is ownership transfer two-step (propose → accept)?",                                                  why: "One-step transfer risks permanent lock from typo — SWC-123",           severity: "HIGH",     aiGenerated: true, status: "pending", note: "" },
    ...(hasTransfer    ? [{ id: "base-e3",  category: "Reentrancy",          question: "Do all ETH-sending functions update state BEFORE the external call (CEI)?",         why: "Post-interaction state = reentrancy — SWC-107, CWE-841",               severity: "CRITICAL" as const, aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasOwner       ? [{ id: "base-e4",  category: "Centralization",      question: "Is the owner a multisig + timelock? Can owner drain funds in one tx?",              why: "Single-EOA no-timelock = rug risk — OC-004",                           severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasMint        ? [{ id: "base-e5",  category: "Token Logic",         question: "Is the mint function supply-capped? Can owner mint unlimited tokens?",               why: "Uncapped mint = infinite inflation — supply manipulation",              severity: "CRITICAL" as const, aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(oldSolidity    ? [{ id: "base-e6",  category: "Arithmetic",          question: "Are all arithmetic operations using SafeMath or Solidity >=0.8.0?",                  why: "Pre-0.8 silently overflows — SWC-101, CWE-190",                        severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasApprove     ? [{ id: "base-e7",  category: "Token Logic",         question: "Does approve() mitigate the front-running race condition?",                          why: "ERC-20 allowance race — SWC-114, CWE-362",                             severity: "LOW" as const,      aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(has777         ? [{ id: "base-e8",  category: "Reentrancy",          question: "Are ERC-777 tokensReceived / tokensToSend hooks guarded against reentrancy?",        why: "ERC-777 hooks fire before transfer completes — SWC-107 variant",       severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasSig         ? [{ id: "base-e9",  category: "Signature",           question: "Do ecrecover / ECDSA.recover calls include nonce, chainId, and domain separator?",   why: "Missing replay protection — SWC-121, CWE-294",                         severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasLiquidity   ? [{ id: "base-e10", category: "Economic",            question: "Is LP token locked? What is the lock duration and can it be unlocked early?",         why: "Unlocked LP = instant rug pull — OC-004 on-chain risk",                severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasDelegateCall? [{ id: "base-e11", category: "Dangerous Functions", question: "Is the delegatecall target immutable or can users supply it?",                        why: "User-controlled delegatecall = arbitrary storage write — SWC-112",     severity: "CRITICAL" as const, aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasBlock       ? [{ id: "base-e12", category: "Oracle",              question: "Is block.timestamp used for time-sensitive logic? Is it manipulatable by validators?",why: "Block timestamp drifts ±12s — SWC-116",                               severity: "MEDIUM" as const,   aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    ...(hasProxy       ? [{ id: "base-e13", category: "Upgradeability",      question: "Is the upgrade function restricted with a timelock before taking effect?",             why: "Instant upgrades by single key allow malicious injection",             severity: "HIGH" as const,     aiGenerated: true as const, status: "pending" as const, note: "" as const }] : []),
    { id: "base-e14", category: "Best Practices", question: "Is the pragma version pinned (no ^ caret) and does bytecode match the explorer source?", why: "Floating pragma risks untested compiler — SWC-103",  severity: "LOW",  aiGenerated: true, status: "pending", note: "" },
    { id: "base-e15", category: "Best Practices", question: "Are events emitted for all critical state changes (ownership, parameter updates)?",       why: "Missing events prevent off-chain monitoring — SWC-129", severity: "LOW", aiGenerated: true, status: "pending", note: "" },
  ]

  const merged = [...aiChecks]
  for (const b of base) {
    const covered = aiChecks.some(a => a.category.toLowerCase() === b.category.toLowerCase() && a.severity === b.severity)
    if (!covered) merged.push(b)
  }
  return merged.slice(0, 22)
}

async function callAI(prompt: string): Promise<{ success: boolean; text?: string; error?: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey    = process.env.OPENAI_API_KEY
  const gatewayKey   = process.env.AI_GATEWAY_API_KEY

  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      })
      if (res.ok) { const d = await res.json(); return { success: true, text: d.content?.[0]?.text || "" } }
    } catch { /* fallback */ }
  }
  if (gatewayKey || openaiKey) {
    try {
      const res = await fetch("https://api.vercel.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gatewayKey || openaiKey}` },
        body: JSON.stringify({ model: "anthropic/claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      })
      if (res.ok) { const d = await res.json(); return { success: true, text: d.choices?.[0]?.message?.content || "" } }
    } catch { /* fallback */ }
  }
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      })
      if (res.ok) { const d = await res.json(); return { success: true, text: d.choices?.[0]?.message?.content || "" } }
    } catch { /* fallback */ }
  }
  return { success: false, error: "No AI provider configured" }
}

export async function POST(req: NextRequest) {
  try {
    const { source, network, contractName } = await req.json()
    if (!source) return NextResponse.json({ error: "Missing source" }, { status: 400 })

    const prompt = `You are a senior Solidity security auditor. Generate a targeted checklist for this contract.

CONTRACT: ${contractName || "Unknown"}
NETWORK: ${network || "Ethereum"}

SOURCE:
\`\`\`solidity
${source.slice(0, 10000)}
\`\`\`

Generate 10–16 checklist items. Rules:
1. Every question must reference ACTUAL function/variable names from THIS contract
2. Include SWC/CWE IDs in the "why" field where applicable
3. severity: CRITICAL (funds at immediate risk), HIGH (with conditions), MEDIUM (integrity), LOW (best practice), INFO
4. relevantCode: exact 1-2 line snippet from the source

Respond ONLY with JSON:
{
  "checklist": [
    {
      "id": "c1",
      "category": "Access Control|Reentrancy|Token Logic|Business Logic|Economic|External Calls|Upgradeability|Arithmetic|Signature|Oracle",
      "question": "Contract-specific question referencing real function/variable",
      "why": "Why this matters — include SWC/CWE",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "relevantCode": "exact 1-2 line snippet from source",
      "lineRef": "~line N or FunctionName()"
    }
  ]
}`

    const aiResult = await callAI(prompt)
    let aiChecks: CheckItem[] = []
    if (aiResult.success && aiResult.text) {
      try {
        const raw = aiResult.text
        const s = raw.indexOf("{"), e = raw.lastIndexOf("}")
        if (s !== -1 && e !== -1) {
          const parsed = JSON.parse(raw.slice(s, e + 1))
          aiChecks = (parsed.checklist || []).map((c: CheckItem, i: number) => ({
            ...c, id: c.id || `ai${i + 1}`, aiGenerated: true as const, status: "pending" as const, note: "" as const,
          }))
        }
      } catch { /* use base */ }
    }

    const merged = mergeWithBaseChecklist(aiChecks, network || "Ethereum", source)
    return NextResponse.json({ checklist: merged, generated: aiChecks.length, total: merged.length })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
