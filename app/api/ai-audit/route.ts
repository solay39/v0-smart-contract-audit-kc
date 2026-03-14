/**
 * AI Audit Engine API  (UPGRADE v2 — CertiK-grade output)
 * POST /api/ai-audit
 */

import { NextRequest, NextResponse } from "next/server"
import { runAuditEngine } from "@/core/engine/auditEngine"

export const maxDuration = 60

async function fetchContractSource(address: string, network: string): Promise<string | null> {
  const apiKeys: Record<string, string> = {
    ethereum:  process.env.ETHERSCAN_API_KEY || "",
    bsc:       process.env.BSCSCAN_API_KEY || "",
    polygon:   process.env.POLYGONSCAN_API_KEY || "",
    arbitrum:  process.env.ARBISCAN_API_KEY || "",
    optimism:  process.env.OPSCAN_API_KEY || "",
    base:      process.env.BASESCAN_API_KEY || "",
    avalanche: process.env.SNOWTRACE_API_KEY || "",
  }
  const apiUrls: Record<string, string> = {
    ethereum:  "https://api.etherscan.io/api",
    bsc:       "https://api.bscscan.com/api",
    polygon:   "https://api.polygonscan.com/api",
    arbitrum:  "https://api.arbiscan.io/api",
    optimism:  "https://api-optimistic.etherscan.io/api",
    base:      "https://api.basescan.org/api",
    avalanche: "https://api.snowtrace.io/api",
  }
  const apiUrl = apiUrls[network.toLowerCase()] || apiUrls.ethereum
  const apiKey = apiKeys[network.toLowerCase()] || apiKeys.ethereum
  try {
    const url = `${apiUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.status === "1" && data.result?.[0]?.SourceCode) {
      let source = data.result[0].SourceCode
      if (source.startsWith("{{") || source.startsWith("{")) {
        try {
          const parsed = JSON.parse(source.replace(/^\{\{/, "{").replace(/\}\}$/, "}"))
          const sources = parsed.sources || parsed
          source = Object.values(sources).map((s: unknown) => (s as { content?: string })?.content || s).join("\n\n")
        } catch { /* single file */ }
      }
      return source
    }
    return null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, address, network, contractName, includeAttackSimulation } = body

    let sourceCode = code
    if (address && !code) {
      const fetched = await fetchContractSource(address, network || "ethereum")
      if (!fetched) return NextResponse.json({ error: "Could not fetch contract source from explorer" }, { status: 400 })
      sourceCode = fetched
    }
    if (!sourceCode) return NextResponse.json({ error: "No code or address provided" }, { status: 400 })

    const result = await runAuditEngine(sourceCode, {
      contractName,
      network: network || "ethereum",
      address,
      includeAttackSimulation: includeAttackSimulation !== false,
    })

    return NextResponse.json({
      success: true,
      audit: {
        metadata: result.metadata,
        summary: result.summary,
        staticAnalysis: {
          findings: result.staticAnalysis.findings.map(f => ({
            id:                 f.id,
            title:              f.title,
            severity:           f.severity,
            category:           f.category,
            description:        f.description,
            location:           f.location,
            lineNumber:         f.lineNumber,
            impact:             f.impact,
            recommendation:     f.recommendation,
            swcId:              f.swcId,
            cweId:              f.cweId,
            cvss:               f.cvss              ?? null,
            likelihood:         f.likelihood         ?? null,
            codeEvidence:       f.codeEvidence       ?? null,
            remediationExample: f.remediationExample ?? null,
            foundryPoC:         f.foundryPoC         ?? null,
          })),
          checksRun: result.staticAnalysis.checksRun,
          coverage:  result.staticAnalysis.coverage,
        },
        economic: {
          vulnerabilities: result.economic.vulnerabilities,
          defiPatterns:    result.economic.defiPatterns,
          mevExposure:     result.economic.mevExposure,
          flashLoanRisk:   result.economic.flashLoanRisk,
          tokenomicsRisks: result.economic.tokenomicsRisks,
        },
        crossChain: result.crossChain.protocol ? {
          protocol:         result.crossChain.protocol,
          vulnerabilities:  result.crossChain.vulnerabilities,
          securityFeatures: result.crossChain.securityFeatures,
          recommendations:  result.crossChain.recommendations,
        } : null,
        dependencies: {
          count:           result.dependencies.dependencies.length,
          externalCalls:   result.dependencies.externalCalls.length,
          highRiskDeps:    result.dependencies.dependencies.filter((d: { risk: string }) => d.risk === "high").length,
          recommendations: result.dependencies.recommendations,
        },
        threatModel:       result.threatModel,
        attackSimulations: result.attackSimulations,
        parsing: {
          contracts: result.parsing.contracts.map((c: { name: string; type: string; functions: unknown[]; variables: unknown[]; complexity: number }) => ({
            name:       c.name,
            type:       c.type,
            functions:  c.functions.length,
            variables:  c.variables.length,
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

export async function GET() {
  return NextResponse.json({
    status: "ok",
    engine: "Solay39 AI Audit Engine v2.0",
    capabilities: [
      "Static vulnerability detection with CVSS v3.1 per finding",
      "Likelihood assessment per finding (High / Medium / Low)",
      "Code evidence extraction (exact snippet per finding)",
      "Remediation examples in Solidity",
      "Runnable Foundry PoC for HIGH/CRITICAL findings",
      "Economic attack analysis (flash loan, MEV, sandwich)",
      "Cross-chain security analysis",
      "Dependency scanning",
      "Threat modeling",
      "Attack simulation generation",
    ],
  })
}
