import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Static Analysis API - Runs real Slither and Mythril analysis
 * 
 * This endpoint proxies to external analysis services since Vercel
 * cannot run Python tools directly. Configure one of these backends:
 * 
 * 1. STATIC_ANALYSIS_API_URL - Custom hosted service (recommended)
 * 2. Uses simulation mode if no backend is configured
 */

interface SlitherFinding {
  check: string
  impact: string
  confidence: string
  description: string
  elements: Array<{
    type: string
    name: string
    filename: string
    lines: number[]
  }>
}

interface MythrilFinding {
  swc_id: string
  swc_title: string
  severity: string
  description: string
  contract: string
  function: string
  lineno: number
  code: string
}

interface AnalysisResult {
  slither: {
    tool: "slither"
    version: string
    success: boolean
    findings: SlitherFinding[]
    detectors_run: number
    error: string | null
  }
  mythril: {
    tool: "mythril"
    version: string
    success: boolean
    findings: MythrilFinding[]
    error: string | null
  }
}

// Real analysis using external service (Railway backend)
async function runRealAnalysis(code: string, contractName: string, includeHalmos = false): Promise<AnalysisResult | null> {
  const apiUrl = process.env.STATIC_ANALYSIS_API_URL
  
  if (!apiUrl) {
    return null
  }
  
  try {
    // Call Railway backend (/analyze endpoint - no /api prefix)
    const analyzeUrl = apiUrl.endsWith("/") ? `${apiUrl}analyze` : `${apiUrl}/analyze`
    
    const tools = ["slither", "mythril", "foundry"]
    if (includeHalmos) {
      tools.push("halmos")
    }
    
    const response = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STATIC_ANALYSIS_API_KEY || ""}`,
      },
      body: JSON.stringify({
        code,
        contractName,
        tools,
      }),
    })
    
    if (!response.ok) {
      console.error("[StaticAnalysis] API error:", response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error("[StaticAnalysis] API call failed:", error)
    return null
  }
}

// Pattern-based analysis when external service unavailable
// FIXED: Smarter patterns to reduce false positives and add missing checks
function runPatternAnalysis(code: string): AnalysisResult {
  const findings: SlitherFinding[] = []
  const mythrilFindings: MythrilFinding[] = []
  const lines = code.split("\n")

  // Helper functions
  function addSlither(line: number, check: string, impact: string, desc: string) {
    findings.push({
      check, impact, confidence: "MEDIUM", description: desc,
      elements: [{ type: "node", name: "", filename: "Contract.sol", lines: [line] }],
    })
  }
  function addMythril(line: number, swc_id: string, title: string, sev: string, codeSnip: string) {
    mythrilFindings.push({
      swc_id, swc_title: title, severity: sev,
      description: `Potential ${title} detected`,
      contract: "Contract", function: "", lineno: line,
      code: codeSnip.trim().slice(0, 100),
    })
  }

  lines.forEach((line, idx) => {
    const n = idx + 1

    // Pragma version
    if (/pragma\s+solidity\s*\^/.test(line)) {
      addSlither(n, "solc-version", "INFORMATIONAL", "Floating pragma version detected")
    }

    // Low-level calls
    if (/\.call\{.*value:/.test(line)) {
      addSlither(n, "low-level-calls", "INFORMATIONAL", "Low level ETH transfer call")
    }

    // tx.origin
    if (/tx\.origin/.test(line) && /require|==|!=/.test(line)) {
      addSlither(n, "tx-origin", "MEDIUM", "Dangerous usage of tx.origin for authorization")
      addMythril(n, "SWC-115", "Authorization through tx.origin", "MEDIUM", line)
    }

    // FIX: Timestamp — only flag if suspicious context (not permit deadline)
    if (/block\.timestamp|now\b/.test(line)) {
      const isLegitDeadline = /deadline|expir|lock|until|PERMIT|permit/.test(line.toLowerCase())
      const isSuspicious = /lottery|random|seed|winner|entropy/.test(line.toLowerCase())

      if (isSuspicious) {
        addSlither(n, "timestamp", "LOW", "block.timestamp used for game/random logic — miner-influenceable")
        addMythril(n, "SWC-116", "Block values as proxy for randomness", "LOW", line)
      } else if (!isLegitDeadline) {
        addSlither(n, "timestamp", "INFORMATIONAL", "block.timestamp usage — verify not used for critical decisions")
      }
      // isLegitDeadline → NO finding (permit deadline, lock period = legitimate)
    }

    // delegatecall
    if (/\.delegatecall\(/.test(line)) {
      addSlither(n, "controlled-delegatecall", "HIGH", "Controlled delegatecall destination")
      addMythril(n, "SWC-112", "Delegatecall to Untrusted Callee", "HIGH", line)
    }

    // selfdestruct
    if (/selfdestruct\(|suicide\(/.test(line)) {
      addSlither(n, "suicidal", "HIGH", "Contract can be self-destructed")
      addMythril(n, "SWC-106", "Unprotected SELFDESTRUCT", "HIGH", line)
    }

    // assembly
    if (/assembly\s*\{/.test(line)) {
      addSlither(n, "assembly", "INFORMATIONAL", "Inline assembly usage")
    }

    // FIX: unchecked — only flag if non-standard context
    if (/unchecked\s*\{/.test(line)) {
      const context = lines.slice(Math.max(0, idx - 3), idx + 5).join(" ")
      const isStandardBalance = /balanceOf|totalSupply/.test(context)
      const isSimpleCounter = /\+\+\s*$|-- $/.test(context) && !/transfer|withdraw|value/.test(context)

      if (!isStandardBalance && !isSimpleCounter) {
        addSlither(n, "unchecked-arithmetic", "MEDIUM",
          "Unchecked arithmetic in non-standard context — verify overflow impossibility")
      }
      // Standard usage (ERC-20 balance, counter) → no finding
    }

    // NEW: EIP-2612 permit analysis
    if (/function\s+permit\s*\(/.test(line)) {
      const fullCode = code
      const hasDomainSep = /DOMAIN_SEPARATOR|computeDomainSeparator/.test(fullCode)
      const hasChainId = /block\.chainid|INITIAL_CHAIN_ID/.test(fullCode)
      const hasNonces = /nonces\[/.test(fullCode)

      if (!hasDomainSep) {
        addSlither(n, "eip2612-no-domain-separator", "HIGH",
          "permit() function without DOMAIN_SEPARATOR — signatures valid on all chains")
        addMythril(n, "SWC-121", "Missing Protection against Signature Replay", "HIGH", line)
      } else if (!hasChainId) {
        addSlither(n, "eip2612-no-chainid", "MEDIUM",
          "DOMAIN_SEPARATOR does not include chainId — cross-chain replay possible")
      }
      if (!hasNonces) {
        addSlither(n, "eip2612-no-nonces", "HIGH",
          "permit() without nonce tracking — signature replay possible")
      }
    }

    // NEW: mint + supply cap check
    if (/function\s+mint\s*\(/.test(line)) {
      const mintSignature = lines.slice(idx, idx + 3).join(" ")
      const isProtected = /onlyOwner|onlyRole|onlyMinter/.test(mintSignature)
      const hasSupplyCap = /MAX_SUPPLY|maxSupply|totalSupply.*<=|<= MAX/.test(code)

      if (!isProtected) {
        addSlither(n, "unprotected-mint", "HIGH",
          "mint() function lacks access control — anyone can inflate supply")
        addMythril(n, "SWC-105", "Unprotected Ether Withdrawal (mint equivalent)", "HIGH", line)
      } else if (!hasSupplyCap) {
        addSlither(n, "uncapped-mint", "MEDIUM",
          "mint() has access control but no supply cap — compromised owner can inflate unboundedly")
      }
    }

    // FIX: Reentrancy — correct multi-line check
    if (/\.call\{value:|\.call\(/.test(line)) {
      const nextLines = lines.slice(idx + 1, idx + 15).join("\n")
      const hasStateChange = /\w+\s*=\s*[^=]|\.push\(|delete\s/.test(nextLines)
      const hasGuard = /nonReentrant|ReentrancyGuard/.test(code)

      if (hasStateChange && !hasGuard) {
        addSlither(n, "reentrancy-eth", "HIGH",
          "State change after external call — potential reentrancy (no ReentrancyGuard detected)")
        addMythril(n, "SWC-107", "Reentrancy", "HIGH", line)
      }
    }

    // NEW: transferOwnership zero-address
    if (/function\s+transferOwnership\s*\(/.test(line)) {
      const funcBody = lines.slice(idx, idx + 10).join("\n")
      const hasZeroCheck = /address\(0\)|!=\s*address/.test(funcBody)
      if (!hasZeroCheck) {
        addSlither(n, "missing-zero-check", "LOW",
          "transferOwnership() without zero-address validation — accidental lock possible")
      }
    }
  })

  // Deduplicate by check+line
  const seenSlither = new Set<string>()
  const uniqueSlither = findings.filter(f => {
    const key = `${f.check}-${f.elements[0].lines[0]}`
    if (seenSlither.has(key)) return false
    seenSlither.add(key)
    return true
  })

  const seenMythril = new Set<string>()
  const uniqueMythril = mythrilFindings.filter(f => {
    const key = `${f.swc_id}-${f.lineno}`
    if (seenMythril.has(key)) return false
    seenMythril.add(key)
    return true
  })

  return {
    slither: {
      tool: "slither",
      version: "0.11.5-pattern-fixed",
      success: true,
      findings: uniqueSlither,
      detectors_run: 14,
      error: null,
    },
    mythril: {
      tool: "mythril",
      version: "0.24.x-pattern-fixed",
      success: true,
      findings: uniqueMythril,
      error: null,
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, contractName = "Contract", includeHalmos = false } = await req.json()
    
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'code' parameter" },
        { status: 400 }
      )
    }
    
    // Check if code is Solidity
    const isSolidity = /pragma\s+solidity|contract\s+\w+|function\s+\w+/.test(code)
    
    if (!isSolidity) {
      return NextResponse.json({
        error: "Slither and Mythril only support Solidity code",
        supported: false,
        suggestion: "Use language-specific tools for non-Solidity code"
      }, { status: 400 })
    }
    
    // Try real analysis first (includes Halmos if requested)
    let result = await runRealAnalysis(code, contractName, includeHalmos)
    
    // Fallback to pattern analysis
    if (!result) {
      result = runPatternAnalysis(code)
      result.slither.version += " (pattern-based fallback)"
      result.mythril.version += " (pattern-based fallback)"
    }
    
    return NextResponse.json({
      success: true,
      analysisMode: process.env.STATIC_ANALYSIS_API_URL ? "real" : "pattern-based",
      ...result
    })
    
  } catch (error) {
    console.error("[StaticAnalysis] Error:", error)
    return NextResponse.json(
      { error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const hasExternalService = !!process.env.STATIC_ANALYSIS_API_URL
  
  return NextResponse.json({
    service: "Solay39 Static Analysis + Formal Verification",
    tools: ["slither", "mythril", "foundry", "halmos"],
    mode: hasExternalService ? "real" : "pattern-based",
    configured: hasExternalService,
    capabilities: {
      slither: "Static analysis with 90+ detectors",
      mythril: "Symbolic execution for deep bug finding",
      foundry: "Fuzz testing with 5000+ runs",
      halmos: "Formal verification - mathematical proofs (a16z)"
    },
    setupInstructions: hasExternalService ? null : {
      message: "Configure STATIC_ANALYSIS_API_URL for real tool execution",
      railway: "Deploy railway-backend/ to Railway.app",
      options: [
        "Deploy railway-backend/ to Railway with Docker",
        "Tools: slither-analyzer, mythril, foundry, halmos",
        "Halmos uses Z3 solver for bounded model checking"
      ]
    }
  })
}
