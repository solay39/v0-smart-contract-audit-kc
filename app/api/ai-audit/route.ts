/**
 * AI Audit Engine API - Full pipeline endpoint
 * POST /api/ai-audit
 */

import { NextRequest, NextResponse } from "next/server"
import { runAuditEngine } from "@/core/engine/auditEngine"

export const maxDuration = 60

// Fetch contract from Etherscan/BSCScan
async function fetchContractSource(address: string, network: string): Promise<string | null> {
  const apiKeys: Record<string, string> = {
    ethereum: process.env.ETHERSCAN_API_KEY || "",
    bsc: process.env.BSCSCAN_API_KEY || "",
    polygon: process.env.POLYGONSCAN_API_KEY || "",
    arbitrum: process.env.ARBISCAN_API_KEY || "",
    optimism: process.env.OPSCAN_API_KEY || "",
    base: process.env.BASESCAN_API_KEY || "",
    avalanche: process.env.SNOWTRACE_API_KEY || "",
  }

  const apiUrls: Record<string, string> = {
    ethereum: "https://api.etherscan.io/api",
    bsc: "https://api.bscscan.com/api",
    polygon: "https://api.polygonscan.com/api",
    arbitrum: "https://api.arbiscan.io/api",
    optimism: "https://api-optimistic.etherscan.io/api",
    base: "https://api.basescan.org/api",
    avalanche: "https://api.snowtrace.io/api",
  }

  const apiUrl = apiUrls[network.toLowerCase()] || apiUrls.ethereum
  const apiKey = apiKeys[network.toLowerCase()] || apiKeys.ethereum

  try {
    const url = `${apiUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status === "1" && data.result?.[0]?.SourceCode) {
      let source = data.result[0].SourceCode
      // Handle JSON format (multi-file)
      if (source.startsWith("{{") || source.startsWith("{")) {
        try {
          const parsed = JSON.parse(source.replace(/^\{\{/, "{").replace(/\}\}$/, "}"))
          const sources = parsed.sources || parsed
          source = Object.values(sources).map((s: any) => s.content || s).join("\n\n")
        } catch {
          // Single file format
        }
      }
      return source
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, address, network, contractName, includeAttackSimulation } = body

    let sourceCode = code

    // If address provided but no code, fetch from explorer
    if (address && !code) {
      const fetchedCode = await fetchContractSource(address, network || "ethereum")
      if (!fetchedCode) {
        return NextResponse.json({ error: "Could not fetch contract source from explorer" }, { status: 400 })
      }
      sourceCode = fetchedCode
    }

    if (!sourceCode) {
      return NextResponse.json({ error: "No code or address provided" }, { status: 400 })
    }

    // Run the full audit engine
    const result = await runAuditEngine(sourceCode, {
      contractName,
      network: network || "ethereum",
      address,
      includeAttackSimulation: includeAttackSimulation !== false,
    })

    // Format response
    return NextResponse.json({
      success: true,
      audit: {
        metadata: result.metadata,
        summary: result.summary,
        staticAnalysis: {
          findings: result.staticAnalysis.findings,
          checksRun: result.staticAnalysis.checksRun,
          coverage: result.staticAnalysis.coverage,
        },
        economic: {
          vulnerabilities: result.economic.vulnerabilities,
          defiPatterns: result.economic.defiPatterns,
          mevExposure: result.economic.mevExposure,
          flashLoanRisk: result.economic.flashLoanRisk,
          tokenomicsRisks: result.economic.tokenomicsRisks,
        },
        crossChain: result.crossChain.protocol ? {
          protocol: result.crossChain.protocol,
          vulnerabilities: result.crossChain.vulnerabilities,
          securityFeatures: result.crossChain.securityFeatures,
          recommendations: result.crossChain.recommendations,
        } : null,
        dependencies: {
          count: result.dependencies.dependencies.length,
          externalCalls: result.dependencies.externalCalls.length,
          highRiskDeps: result.dependencies.dependencies.filter(d => d.risk === "high").length,
          recommendations: result.dependencies.recommendations,
        },
        threatModel: result.threatModel,
        attackSimulations: result.attackSimulations,
        parsing: {
          contracts: result.parsing.contracts.map(c => ({
            name: c.name,
            type: c.type,
            functions: c.functions.length,
            variables: c.variables.length,
            complexity: c.complexity,
          })),
          warnings: result.parsing.warnings,
        },
      },
    })
  } catch (error) {
    console.error("AI Audit Engine error:", error)
    return NextResponse.json(
      { error: "Audit engine failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET - Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    engine: "Solay39 AI Audit Engine v1.0",
    capabilities: [
      "Code parsing and AST analysis",
      "Static vulnerability detection (10+ checks)",
      "Economic attack analysis (flash loan, MEV, sandwich)",
      "Cross-chain security (LayerZero, Wormhole, Axelar)",
      "Dependency scanning",
      "Threat modeling",
      "Attack simulation generation",
    ],
  })
}
