import { generateText } from "ai"

/* ───────── types ───────── */

interface Finding {
  title: string
  severity: string
  location: string
  description: string
  impact: string
  recommendation: string
}

/* ───────── context-aware static analysis ───────── */

function staticAnalysis(code: string): Finding[] {
  const findings: Finding[] = []

  /* ── detect contract context to avoid false positives ── */
  const isERC20 = /is\s+(ERC20|IERC20|BEP20)|function\s+transfer\s*\(.*address.*uint/.test(code)
    && /function\s+approve\s*\(/.test(code)
    && /balances|_balances|balanceOf/.test(code)

  const hasSafeMath = /SafeMath|using\s+SafeMath|\.add\(|\.sub\(|\.mul\(|\.div\(/.test(code)

  const hasConstructorOnlyMint = (() => {
    if (!/_mint|mint/.test(code)) return false
    const mintOutsideConstructor = code.replace(
      /constructor\s*\([^)]*\)\s*(public|internal)?\s*[^{]*\{[^}]*\}/gs,
      ""
    )
    return !(/function\s+\w*[Mm]int\s*\(/.test(mintOutsideConstructor))
  })()

  const hasExternalCall = /\.call\{value|\.call\(|address\(.*\)\.call/.test(code)
  const hasTransferETH = /\.transfer\(|\.send\(/.test(code)
  const hasOnlyMappingOps = (() => {
    if (!hasExternalCall && !hasTransferETH) return true
    return false
  })()

  const hasDangerousFunctions = /pause|blacklist|setTax|setFee|forceTrans|rescue|withdraw.*only/.test(code)
  const hasOwnable = /onlyOwner|Ownable|AccessControl|onlyRole|onlyAdmin/.test(code)
  const hasRequireSender = /require\s*\(\s*msg\.sender/.test(code)

  /* ── 1. Reentrancy ── */
  if (hasExternalCall || hasTransferETH) {
    // Only flag if there are REAL external calls, not just ERC-20 transfer mapping updates
    if (!isERC20 || !hasOnlyMappingOps) {
      // Check if state changes happen AFTER external calls (the actual vulnerability pattern)
      const callThenState = /\.(call|transfer|send)\s*[\({][\s\S]{0,200}(balances\[|_balances\[|\w+\s*=\s)/.test(code)
      if (callThenState) {
        findings.push({
          title: "Potential Reentrancy Vulnerability",
          severity: "HIGH",
          location: "External call with subsequent state modification",
          description: "An external call is followed by state variable modification. If the called contract is malicious, it can re-enter this function before state is updated.",
          impact: "An attacker could recursively call back into the contract before state is updated, potentially draining funds.",
          recommendation: "Apply the Checks-Effects-Interactions pattern: update all state variables before making external calls. Consider using OpenZeppelin's ReentrancyGuard.",
        })
      } else if (hasTransferETH) {
        findings.push({
          title: "External ETH Transfer Detected",
          severity: "LOW",
          location: ".transfer() or .send() usage",
          description: "The contract sends ETH via .transfer() or .send(). While .transfer() is safe against reentrancy (2300 gas limit), .send() does not revert on failure.",
          impact: "If using .send() without checking the return value, failed transfers will silently continue.",
          recommendation: "Prefer .transfer() over .send(), or use .call{value: amount}('') with reentrancy guards.",
        })
      }
    }
  }

  /* ── 2. tx.origin ── */
  if (/tx\.origin/.test(code)) {
    findings.push({
      title: "tx.origin Used for Authorization",
      severity: "CRITICAL",
      location: "tx.origin usage",
      description: "The contract uses tx.origin for authorization. This is vulnerable to phishing attacks where a malicious intermediary contract tricks the user into executing a transaction.",
      impact: "An attacker can bypass authorization checks by routing calls through a malicious contract that the user interacts with.",
      recommendation: "Replace tx.origin with msg.sender for all authorization checks.",
    })
  }

  /* ── 3. Unchecked send return value ── */
  if (/\.send\(/.test(code) && !/require\s*\(.*\.send\(/.test(code)) {
    findings.push({
      title: "Unchecked Send Return Value",
      severity: "HIGH",
      location: ".send() call",
      description: "The return value of .send() is not checked. send() returns false on failure instead of reverting the transaction.",
      impact: "Failed transfers will silently continue execution, leading to accounting errors or lost funds.",
      recommendation: "Use .transfer() (which reverts on failure) or check the return value with require(addr.send(amount), 'Send failed').",
    })
  }

  /* ── 4. Floating pragma ── */
  if (/pragma solidity \^/.test(code)) {
    findings.push({
      title: "Floating Pragma Version",
      severity: "LOW",
      location: "pragma solidity directive",
      description: "The contract uses a floating pragma (^). This allows compilation with multiple compiler versions, which may introduce inconsistencies between deployments.",
      impact: "Different compiler versions may produce different bytecode or include different known bugs.",
      recommendation: "Lock the pragma to a specific version, e.g., pragma solidity 0.8.20;",
    })
  }

  /* ── 5. Access control — context-aware ── */
  if (!isERC20 || hasDangerousFunctions) {
    // For standard ERC-20 tokens without admin functions, access control is NOT needed
    // Only flag if there are dangerous owner-style functions without modifiers
    const publicStateFns = code.match(
      /function\s+\w+[^)]*\)\s*(public|external)(?!\s+view)(?!\s+pure)/g
    )
    if (hasDangerousFunctions && !hasOwnable && !hasRequireSender) {
      findings.push({
        title: "Missing Access Control on Sensitive Functions",
        severity: "HIGH",
        location: "Privileged functions (pause, blacklist, setFee, etc.)",
        description: `The contract has sensitive administrative functions without visible access control modifiers (onlyOwner, AccessControl, etc.).`,
        impact: "Any address can call these privileged functions, potentially allowing unauthorized pausing, blacklisting, or fee manipulation.",
        recommendation: "Implement access control using OpenZeppelin's Ownable or AccessControl. Add modifiers like onlyOwner to all sensitive functions.",
      })
    } else if (!isERC20 && publicStateFns && publicStateFns.length > 3 && !hasOwnable && !hasRequireSender) {
      findings.push({
        title: "Consider Adding Access Control",
        severity: "MEDIUM",
        location: "Public/external state-changing functions",
        description: `Found ${publicStateFns.length} public/external state-changing functions. Depending on the contract's purpose, some may need access restrictions.`,
        impact: "Without access control, any address can call state-modifying functions.",
        recommendation: "Review each public function and determine if it should be restricted. Use OpenZeppelin's Ownable or AccessControl for protected functions.",
      })
    }
  }

  /* ── 6. Integer overflow (pre-0.8.0) — context-aware ── */
  const pragmaMatch = code.match(/pragma solidity\s+[\^~]?(0\.(\d+))/)
  if (pragmaMatch) {
    const minor = parseInt(pragmaMatch[2])
    if (minor < 8) {
      if (hasSafeMath) {
        findings.push({
          title: "Solidity < 0.8.0 with SafeMath",
          severity: "INFO",
          location: `Compiler version ${pragmaMatch[1]}`,
          description: "The contract targets Solidity < 0.8.0 but uses SafeMath library for arithmetic operations, which provides overflow/underflow protection.",
          impact: "Arithmetic is protected by SafeMath. However, any operations NOT using SafeMath remain vulnerable.",
          recommendation: "Ensure ALL arithmetic operations use SafeMath consistently, or consider upgrading to Solidity >= 0.8.0 for built-in checks.",
        })
      } else {
        findings.push({
          title: "Integer Overflow/Underflow Risk",
          severity: "HIGH",
          location: `Compiler version ${pragmaMatch[1]}`,
          description: "The contract targets Solidity < 0.8.0 which does not have built-in overflow/underflow checks, and no SafeMath usage was detected.",
          impact: "Arithmetic operations can silently wrap around, leading to unexpected behavior and potential fund theft.",
          recommendation: "Upgrade to Solidity >= 0.8.0 or add the SafeMath library for all arithmetic operations.",
        })
      }
    }
  }

  /* ── 7. Selfdestruct ── */
  if (/selfdestruct|suicide/.test(code)) {
    findings.push({
      title: "Selfdestruct Present",
      severity: "MEDIUM",
      location: "selfdestruct instruction",
      description: "The contract contains a selfdestruct (or deprecated suicide) instruction which permanently destroys the contract and sends remaining ETH to a designated address.",
      impact: "If access control is insufficient, an attacker could permanently destroy the contract.",
      recommendation: "Remove selfdestruct if not strictly needed. If required, ensure it is protected with robust access control and a timelock.",
    })
  }

  /* ── 8. Delegatecall ── */
  if (/delegatecall/.test(code)) {
    findings.push({
      title: "Delegatecall Usage",
      severity: "HIGH",
      location: "delegatecall instruction",
      description: "The contract uses delegatecall, which executes code in the context of the calling contract. This is extremely dangerous if the target address is user-controlled.",
      impact: "A malicious target could overwrite storage variables, steal funds, or destroy the contract.",
      recommendation: "Ensure delegatecall targets are trusted, verified contracts. Use a whitelist of approved implementation addresses.",
    })
  }

  /* ── 9. Timestamp dependence ── */
  if (/block\.timestamp/.test(code) && /require.*block\.timestamp|if.*block\.timestamp/.test(code)) {
    findings.push({
      title: "Timestamp Dependence",
      severity: "LOW",
      location: "block.timestamp usage in conditional logic",
      description: "The contract uses block.timestamp in conditional checks. Miners can manipulate the block timestamp by approximately 15 seconds.",
      impact: "Time-sensitive logic could be manipulated by miners within the allowed drift window.",
      recommendation: "Avoid using block.timestamp for critical logic. Allow a tolerance window if time checks are necessary.",
    })
  }

  /* ── 10. Minting — context-aware ── */
  if (/mint|_mint/.test(code)) {
    if (hasConstructorOnlyMint) {
      // Mint is ONLY in the constructor — fixed supply, no risk
      findings.push({
        title: "Fixed Supply (Constructor-Only Mint)",
        severity: "INFO",
        location: "Constructor",
        description: "Token minting occurs only in the constructor. The supply is fixed at deployment with no public or external mint function available.",
        impact: "No inflation risk. The token supply cannot be increased after deployment.",
        recommendation: "No action needed. This is a secure pattern for fixed-supply tokens.",
      })
    } else {
      // There IS an exposed mint function
      const hasMintGuard = /onlyOwner|onlyRole|onlyMinter/.test(code) && /function\s+\w*[Mm]int/.test(code)
      if (!hasMintGuard) {
        findings.push({
          title: "Unrestricted Minting Function",
          severity: "CRITICAL",
          location: "Public/external mint function",
          description: "A mint function is exposed without visible access control. Any address may be able to mint new tokens.",
          impact: "An attacker could mint unlimited tokens, destroying the token's value for all holders.",
          recommendation: "Add strict access control (onlyOwner, onlyMinter) to the mint function. Consider adding a supply cap.",
        })
      } else {
        findings.push({
          title: "Centralized Minting Authority",
          severity: "MEDIUM",
          location: "Mint function with access control",
          description: "The contract has a mint function restricted by access control. While not exploitable by the public, a compromised owner/minter can inflate supply.",
          impact: "A compromised or malicious owner could mint additional tokens, diluting existing holders.",
          recommendation: "Consider implementing a supply cap, timelocks, or multi-sig requirements for minting operations.",
        })
      }
    }
  }

  /* ── 11. Allowance race condition (ERC-20 specific) ── */
  if (isERC20 && /function\s+approve/.test(code) && !/increaseAllowance|decreaseAllowance/.test(code)) {
    findings.push({
      title: "ERC-20 Allowance Race Condition",
      severity: "LOW",
      location: "approve() function",
      description: "The standard ERC-20 approve() function is vulnerable to a front-running race condition. If a user changes an allowance from N to M, a spender can front-run and spend both N and M.",
      impact: "A spender could extract more tokens than intended during an allowance change.",
      recommendation: "This is a known ERC-20 limitation. Consider adding increaseAllowance/decreaseAllowance helper functions, or instruct users to set allowance to 0 before changing it.",
    })
  }

  /* ── 12. Custodian concentration (ERC-20) ── */
  if (isERC20 && hasConstructorOnlyMint) {
    findings.push({
      title: "Initial Supply Concentration",
      severity: "INFO",
      location: "Constructor — full supply to single address",
      description: "The entire token supply is minted to a single address (custodian/deployer) in the constructor. This is standard for ERC-20 launches but creates concentration risk.",
      impact: "The initial holder controls 100% of supply. If tokens are not distributed, this creates market dump risk and governance centralization.",
      recommendation: "This is an economic/governance consideration, not a smart contract vulnerability. Recommend transparent vesting schedules and distribution plans.",
    })
  }

  /* ── If no findings at all ── */
  if (findings.length === 0) {
    findings.push({
      title: "Static Analysis Complete — No Issues Detected",
      severity: "INFO",
      location: "Full contract",
      description: "No common vulnerability patterns were detected by the static analyzer. This does not guarantee the contract is free of vulnerabilities.",
      impact: "N/A",
      recommendation: "Consider a full manual audit for complex business logic vulnerabilities, economic attacks, and gas optimization.",
    })
  }

  return findings
}

/* ───────── AI prompt (context-aware, anti false-positive) ───────── */

const SYSTEM_PROMPT = `You are an elite smart contract security auditor using the Solay39 Manual-First Audit Framework.

CRITICAL RULES — you MUST follow these to avoid false positives:

1. UNDERSTAND THE CONTRACT TYPE FIRST. Before listing any findings, determine:
   - Is it a standard ERC-20/BEP-20? (has transfer, approve, balanceOf, allowance)
   - Is it upgradeable? (has delegatecall, proxy pattern, EIP-1967 slots)
   - Does it handle ETH? (has payable, .call{value}, .transfer, .send)
   - Does it have admin functions? (pause, blacklist, setFee, mint outside constructor)

2. DO NOT FLAG as vulnerabilities:
   - "Missing access control" on standard ERC-20 functions (transfer, approve, transferFrom) — these are SUPPOSED to be public
   - "Reentrancy" on contracts that only update mappings and emit events without external calls
   - "Centralized minting" if _mint() is ONLY called inside the constructor (fixed supply)
   - "Integer overflow" if the contract uses SafeMath or targets Solidity >= 0.8.0
   - Known ERC-20 limitations as HIGH/CRITICAL (e.g., approve race condition is LOW at most)

3. Each finding MUST be unique. Never repeat the same finding twice.

4. For simple, standard ERC-20 tokens with no admin functions, no proxy, no external calls:
   - The attack surface is VERY LOW
   - Only report genuine issues (floating pragma, known ERC-20 limitations, supply concentration)
   - Use appropriate severity: INFO for known standard limitations, LOW for minor issues

You MUST respond ONLY with valid JSON (no markdown, no code fences):
{
  "findings": [
    {
      "title": "string",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "location": "string — specific function or line",
      "description": "string — detailed technical explanation",
      "impact": "string — what could happen if exploited",
      "recommendation": "string — how to fix"
    }
  ]
}

Be thorough but PRECISE. Quality over quantity. A report with 2 real findings is better than 7 false positives.`

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json({ error: "No code provided" }, { status: 400 })
    }

    const truncatedCode = code.slice(0, 15000)

    // Try AI analysis first
    try {
      const result = await generateText({
        model: "openai/gpt-4o-mini",
        system: SYSTEM_PROMPT,
        prompt: `Analyze this Solidity smart contract for security vulnerabilities. Remember: identify the contract type first, avoid false positives, and never duplicate findings.\n\n${truncatedCode}`,
        maxOutputTokens: 4096,
      })

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

      // Deduplicate by title
      const validSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
      const seen = new Set<string>()
      const findings = (parsed.findings ?? [])
        .map((f) => ({
          title: String(f.title || "Untitled Finding"),
          severity: validSeverities.includes(f.severity) ? f.severity : "INFO",
          location: String(f.location || "Unknown"),
          description: String(f.description || ""),
          impact: String(f.impact || ""),
          recommendation: String(f.recommendation || ""),
        }))
        .filter((f) => {
          const key = f.title.toLowerCase().trim()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

      return Response.json({ findings, source: "ai" })
    } catch (aiError: unknown) {
      // AI failed — fall back to static analysis (which is now context-aware)
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError)
      console.log("[v0] AI unavailable, using static analysis. Reason:", aiMsg)

      const findings = staticAnalysis(truncatedCode)
      return Response.json({
        findings,
        source: "static",
        note: "Analysis performed using Solay39 pattern-based static analyzer (AI model unavailable).",
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
