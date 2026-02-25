import { generateText } from "ai"

/* ───────── static pattern-based analysis (always works, no AI needed) ───────── */

interface Finding {
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
}

function staticAnalysis(code: string): Finding[] {
  const findings: Finding[] = []
  const lines = code.split("\n")

  // Reentrancy: external call before state change
  const hasCall = /\.call\{|\.transfer\(|\.send\(/.test(code)
  const hasStateAfterCall = /\.call\{[\s\S]*?=\s/.test(code)
  if (hasCall) {
    findings.push({
      title: "Potential Reentrancy Vulnerability",
      severity: "HIGH",
      location: "External call detected",
      description:
        "The contract contains external calls (.call, .transfer, or .send). If state changes occur after these calls, the contract may be vulnerable to reentrancy attacks.",
      impact:
        "An attacker could recursively call back into the contract before state is updated, draining funds.",
      recommendation:
        "Apply the Checks-Effects-Interactions pattern: update all state variables before making external calls. Consider using OpenZeppelin's ReentrancyGuard.",
    })
  }

  // tx.origin usage
  if (/tx\.origin/.test(code)) {
    findings.push({
      title: "tx.origin Authentication",
      severity: "CRITICAL",
      location: "tx.origin usage",
      description:
        "The contract uses tx.origin for authorization. This is vulnerable to phishing attacks where an intermediary contract tricks the user into executing a transaction.",
      impact: "An attacker can bypass authorization checks by routing calls through a malicious contract.",
      recommendation: "Replace tx.origin with msg.sender for all authorization checks.",
    })
  }

  // Unchecked return values
  if (/\.send\(/.test(code) && !/require\s*\(.*\.send\(/.test(code)) {
    findings.push({
      title: "Unchecked Send Return Value",
      severity: "HIGH",
      location: ".send() call",
      description: "The return value of .send() is not checked. send() returns false on failure instead of reverting.",
      impact: "Failed transfers will silently continue execution, leading to accounting errors or lost funds.",
      recommendation: "Use .transfer() (which reverts on failure) or check the return value: require(addr.send(amount), 'Send failed');",
    })
  }

  // Floating pragma
  if (/pragma solidity \^/.test(code)) {
    findings.push({
      title: "Floating Pragma Version",
      severity: "LOW",
      location: "pragma solidity directive",
      description: "The contract uses a floating pragma (^). This allows compilation with multiple compiler versions, which may introduce inconsistencies.",
      impact: "Different compiler versions may produce different bytecode or introduce known bugs.",
      recommendation: "Lock the pragma to a specific version, e.g. pragma solidity 0.8.20;",
    })
  }

  // Missing access control
  const publicFunctions = code.match(/function\s+\w+[^)]*\)\s*(public|external)(?!\s+view)(?!\s+pure)/g)
  const hasModifier = /onlyOwner|onlyRole|onlyAdmin|require\(msg\.sender/.test(code)
  if (publicFunctions && publicFunctions.length > 2 && !hasModifier) {
    findings.push({
      title: "Missing Access Control",
      severity: "HIGH",
      location: "Public/external functions",
      description: `Found ${publicFunctions.length} public/external state-changing functions without visible access control modifiers.`,
      impact: "Any address can call these functions, potentially allowing unauthorized state changes or fund extraction.",
      recommendation: "Implement access control using OpenZeppelin's Ownable or AccessControl. Add modifiers like onlyOwner to sensitive functions.",
    })
  }

  // Integer overflow (pre-0.8.0)
  const pragmaMatch = code.match(/pragma solidity\s+[\^~]?(0\.\d+)/)
  if (pragmaMatch) {
    const minor = parseInt(pragmaMatch[1].split(".")[1])
    if (minor < 8) {
      findings.push({
        title: "Integer Overflow/Underflow Risk",
        severity: "HIGH",
        location: "Compiler version < 0.8.0",
        description: "The contract targets Solidity < 0.8.0 which does not have built-in overflow/underflow checks.",
        impact: "Arithmetic operations can silently wrap around, leading to unexpected behavior and potential fund theft.",
        recommendation: "Upgrade to Solidity >= 0.8.0 or use SafeMath library for all arithmetic operations.",
      })
    }
  }

  // Selfdestruct
  if (/selfdestruct|suicide/.test(code)) {
    findings.push({
      title: "Selfdestruct Present",
      severity: "MEDIUM",
      location: "selfdestruct call",
      description: "The contract contains a selfdestruct instruction which permanently destroys the contract and sends remaining ETH to a designated address.",
      impact: "If access control is insufficient, an attacker could destroy the contract permanently.",
      recommendation: "Remove selfdestruct if not strictly needed. If required, ensure it is protected with robust access control and a timelock.",
    })
  }

  // Delegatecall
  if (/delegatecall/.test(code)) {
    findings.push({
      title: "Delegatecall Usage",
      severity: "HIGH",
      location: "delegatecall instruction",
      description: "The contract uses delegatecall, which executes code in the context of the calling contract. This can be extremely dangerous if the target is user-controlled.",
      impact: "A malicious target could overwrite storage variables, steal funds, or destroy the contract.",
      recommendation: "Ensure delegatecall targets are trusted and not user-controllable. Use a whitelist of approved implementation addresses.",
    })
  }

  // Block.timestamp usage
  if (/block\.timestamp/.test(code) && /require.*block\.timestamp|if.*block\.timestamp/.test(code)) {
    findings.push({
      title: "Timestamp Dependence",
      severity: "LOW",
      location: "block.timestamp usage in condition",
      description: "The contract uses block.timestamp in a conditional check. Miners can manipulate the timestamp by a few seconds.",
      impact: "Time-sensitive logic could be exploited by miners manipulating the block timestamp within the allowed drift.",
      recommendation: "Avoid using block.timestamp for critical logic. If needed, allow a tolerance window and avoid using it for randomness.",
    })
  }

  // Large mint / supply
  if (/mint|_mint/.test(code)) {
    findings.push({
      title: "Centralized Minting Authority",
      severity: "MEDIUM",
      location: "Mint function",
      description: "The contract contains minting functionality. If the minting authority is centralized, it creates a single point of failure and trust risk.",
      impact: "A compromised or malicious owner could mint unlimited tokens, diluting existing holders.",
      recommendation: "Implement a cap on total supply, add timelocks or multi-sig requirements for minting operations, or make the supply fixed.",
    })
  }

  // No findings? Add an info note
  if (findings.length === 0) {
    findings.push({
      title: "Basic Static Scan Complete",
      severity: "INFO",
      location: "Full contract",
      description: "No common vulnerability patterns detected by the static analyzer. This does not guarantee the contract is secure.",
      impact: "N/A",
      recommendation: "Consider a full manual audit for complex business logic vulnerabilities, economic attacks, and gas optimization.",
    })
  }

  return findings
}

/* ───────── AI-enhanced analysis (falls back to static if unavailable) ───────── */

const SYSTEM_PROMPT = `You are an elite smart contract security auditor using the Solay39 Manual-First Audit Framework.
Analyze the provided Solidity code and identify security vulnerabilities.

You MUST respond ONLY with a valid JSON object (no markdown, no code fences, no explanation outside JSON).
The JSON must follow this exact structure:
{
  "findings": [
    {
      "title": "string - name of the vulnerability",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "location": "string - function or line where the issue is found",
      "description": "string - detailed explanation of the issue",
      "impact": "string - what could happen if exploited",
      "recommendation": "string - how to fix it"
    }
  ]
}

If no vulnerabilities are found, return: { "findings": [] }
Be thorough but precise. Focus on real vulnerabilities.`

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json({ error: "No code provided" }, { status: 400 })
    }

    const truncatedCode = code.slice(0, 15000)

    // Try AI analysis first
    try {
      console.log("[v0] Attempting AI analysis with openai/gpt-4o-mini...")
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        system: SYSTEM_PROMPT,
        prompt: `Analyze this smart contract for security vulnerabilities:\n\n${truncatedCode}`,
        maxOutputTokens: 4096,
      })

      console.log("[v0] AI response received, length:", result.text.length)
      const text = result.text.trim()

      let parsed: { findings: Finding[] }

      try {
        parsed = JSON.parse(text)
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch?.[1]) {
          parsed = JSON.parse(jsonMatch[1].trim())
        } else {
          const braceStart = text.indexOf("{")
          const braceEnd = text.lastIndexOf("}")
          if (braceStart !== -1 && braceEnd !== -1) {
            parsed = JSON.parse(text.slice(braceStart, braceEnd + 1))
          } else {
            throw new Error("Could not parse AI JSON response")
          }
        }
      }

      const validSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
      const findings = (parsed.findings ?? []).map((f) => ({
        title: String(f.title || "Untitled Finding"),
        severity: validSeverities.includes(f.severity) ? f.severity : "INFO",
        location: String(f.location || "Unknown"),
        description: String(f.description || ""),
        impact: String(f.impact || ""),
        recommendation: String(f.recommendation || ""),
      }))

      console.log("[v0] AI analysis successful, findings:", findings.length)
      return Response.json({ findings, source: "ai" })
    } catch (aiError: unknown) {
      // AI failed — fall back to static analysis
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError)
      console.log("[v0] AI analysis failed, falling back to static analysis. Error:", aiMsg)

      const findings = staticAnalysis(truncatedCode)
      return Response.json({
        findings,
        source: "static",
        note: "Analysis performed using pattern-based static analyzer (AI unavailable).",
      })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Skynet route error:", msg)
    return Response.json(
      { error: `Request failed: ${msg}`, findings: [] },
      { status: 500 }
    )
  }
}
