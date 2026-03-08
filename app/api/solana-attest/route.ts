import { NextRequest, NextResponse } from "next/server"
import { registerAuditOnSolana } from "@/lib/solana-attestation"

export async function POST(req: NextRequest) {
  try {
    const { auditId, reportHash, ipfsCid } = await req.json()

    if (!auditId || !reportHash) {
      return NextResponse.json(
        { error: "Missing auditId or reportHash" },
        { status: 400 }
      )
    }

    // Check if Solana is configured
    if (!process.env.SOLANA_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "SOLANA_PRIVATE_KEY not configured" },
        { status: 500 }
      )
    }

    const result = await registerAuditOnSolana(auditId, reportHash, ipfsCid)

    if (!result) {
      return NextResponse.json(
        { error: "Failed to register on Solana" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("[Solana Attest] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
