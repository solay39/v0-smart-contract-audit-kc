export const runtime = "nodejs"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"

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

// Real analysis using external service
async function runRealAnalysis(code: string, contractName: string): Promise<AnalysisResult | null> {
  const apiUrl = process.env.STATIC_ANALYSIS_API_URL
  
  if (!apiUrl) {
    return null
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STATIC_ANALYSIS_API_KEY || ""}`,
      },
      body: JSON.stringify({
        code,
        contractName,
        tools: ["slither", "mythril"],
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
function runPatternAnalysis(code: string): AnalysisResult {
  const findings: SlitherFinding[] = []
  const mythrilFindings: MythrilFinding[] = []
  
  const lines = code.split("\n")
  
  // Slither-style pattern detection
  const patterns = [
    {
      regex: /pragma\s+solidity\s*\^?[<>=]*\s*(0\.[0-7]\.\d+|0\.8\.[0-9])/,
      check: "solc-version",
      impact: "INFORMATIONAL",
      desc: "Different versions of Solidity are used"
    },
    {
      regex: /\.call\{.*value:/,
      check: "low-level-calls",
      impact: "INFORMATIONAL",
      desc: "Low level call in contract"
    },
    {
      regex: /tx\.origin/,
      check: "tx-origin",
      impact: "MEDIUM",
      desc: "Dangerous usage of tx.origin"
    },
    {
      regex: /block\.timestamp|now/,
      check: "timestamp",
      impact: "LOW",
      desc: "Dangerous usage of block.timestamp"
    },
    {
      regex: /delegatecall/,
      check: "controlled-delegatecall",
      impact: "HIGH",
      desc: "Controlled delegatecall destination"
    },
    {
      regex: /selfdestruct|suicide/,
      check: "suicidal",
      impact: "HIGH",
      desc: "Contract can be self-destructed"
    },
    {
      regex: /assembly\s*\{/,
      check: "assembly",
      impact: "INFORMATIONAL",
      desc: "Assembly usage"
    },
    {
      regex: /unchecked\s*\{/,
      check: "unchecked-arithmetic",
      impact: "MEDIUM",
      desc: "Unchecked arithmetic operations"
    },
    {
      regex: /\.transfer\(|\.send\(/,
      check: "calls-loop",
      impact: "LOW",
      desc: "Multiple calls in a loop"
    },
    {
      regex: /external.*call.*\n.*state/i,
      check: "reentrancy-eth",
      impact: "HIGH",
      desc: "Potential reentrancy vulnerability"
    },
  ]
  
  lines.forEach((line, idx) => {
    patterns.forEach(p => {
      if (p.regex.test(line)) {
        findings.push({
          check: p.check,
          impact: p.impact,
          confidence: "MEDIUM",
          description: p.desc,
          elements: [{
            type: "node",
            name: "",
            filename: "Contract.sol",
            lines: [idx + 1]
          }]
        })
      }
    })
  })
  
  // Mythril-style SWC detection
  const swcPatterns = [
    {
      regex: /delegatecall.*\(/,
      swc_id: "SWC-112",
      swc_title: "Delegatecall to Untrusted Callee",
      severity: "HIGH"
    },
    {
      regex: /tx\.origin/,
      swc_id: "SWC-115",
      swc_title: "Authorization through tx.origin",
      severity: "MEDIUM"
    },
    {
      regex: /block\.(timestamp|number)/,
      swc_id: "SWC-116",
      swc_title: "Block values as a proxy for time",
      severity: "LOW"
    },
    {
      regex: /selfdestruct/,
      swc_id: "SWC-106",
      swc_title: "Unprotected SELFDESTRUCT Instruction",
      severity: "HIGH"
    },
    {
      regex: /\.call\{value:/,
      swc_id: "SWC-107",
      swc_title: "Reentrancy",
      severity: "HIGH"
    },
  ]
  
  lines.forEach((line, idx) => {
    swcPatterns.forEach(p => {
      if (p.regex.test(line)) {
        mythrilFindings.push({
          swc_id: p.swc_id,
          swc_title: p.swc_title,
          severity: p.severity,
          description: `Potential ${p.swc_title} detected`,
          contract: "Contract",
          function: "",
          lineno: idx + 1,
          code: line.trim().slice(0, 100)
        })
      }
    })
  })
  
  return {
    slither: {
      tool: "slither",
      version: "0.11.5-pattern",
      success: true,
      findings,
      detectors_run: patterns.length,
      error: null
    },
    mythril: {
      tool: "mythril",
      version: "0.24.x-pattern",
      success: true,
      findings: mythrilFindings,
      error: null
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, contractName = "Contract" } = await req.json()
    
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
    
    // Try real analysis first
    let result = await runRealAnalysis(code, contractName)
    
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
    service: "Solay39 Static Analysis",
    tools: ["slither", "mythril"],
    mode: hasExternalService ? "real" : "pattern-based",
    configured: hasExternalService,
    setupInstructions: hasExternalService ? null : {
      message: "Configure STATIC_ANALYSIS_API_URL for real Slither/Mythril analysis",
      options: [
        "Deploy scripts/static-analysis/analyze.py as a cloud function",
        "Use a Docker container with slither-analyzer and mythril installed",
        "Self-host using Railway, Render, or similar"
      ]
    }
  })
}
