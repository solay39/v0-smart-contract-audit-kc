// app/api/super-audit/route.ts
// Super Audit API - unified security analysis endpoint

export const runtime = "nodejs"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { runSuperAudit, SuperAuditOptions } from "@/core/pipeline/superAudit"

interface SuperAuditRequest {
  source: string
  name: string
  bytecode?: string
  address?: string
  network?: string
  rpcUrl?: string
  options?: SuperAuditOptions
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuperAuditRequest

    if (!body.source || !body.name) {
      return NextResponse.json(
        { error: "Missing required fields: source, name" },
        { status: 400 }
      )
    }

    // Default options
    const options: SuperAuditOptions = {
      enableFuzzing: body.options?.enableFuzzing ?? false,
      enableSymbolic: body.options?.enableSymbolic ?? false,
      enableAttackSimulation: body.options?.enableAttackSimulation ?? false,
      symbolicTimeout: body.options?.symbolicTimeout ?? 120,
      fuzzRuns: body.options?.fuzzRuns ?? 1000,
    }

    const result = await runSuperAudit(
      {
        source: body.source,
        name: body.name,
        bytecode: body.bytecode,
        address: body.address,
        network: body.network,
        rpcUrl: body.rpcUrl,
      },
      options
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[SuperAudit] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Super audit failed",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    name: "Solay39 Super Audit API",
    version: "1.0.0",
    capabilities: [
      "Static Analysis (pattern-based)",
      "Formal Verification (invariant checking)",
      "Fuzz Testing (Foundry - requires backend setup)",
      "Symbolic Execution (Mythril - requires backend setup)",
      "DeFi Attack Simulation (flash loan, oracle manipulation)",
      "Attack Graph Generation",
      "AI Vulnerability Classification",
      "Risk Score Calculation",
    ],
    usage: {
      method: "POST",
      body: {
        source: "string (Solidity code)",
        name: "string (contract name)",
        bytecode: "string (optional - for symbolic execution)",
        address: "string (optional - for attack simulation)",
        network: "string (optional)",
        rpcUrl: "string (optional - for live analysis)",
        options: {
          enableFuzzing: "boolean (default: false)",
          enableSymbolic: "boolean (default: false)",
          enableAttackSimulation: "boolean (default: false)",
          symbolicTimeout: "number (default: 120)",
          fuzzRuns: "number (default: 1000)",
        },
      },
    },
  })
}
