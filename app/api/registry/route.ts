// ================================================================
// SOLAY39 -- On-Chain Audit Registry
// Registra audit su BSC/ETH via API -- no Hardhat necessario
// ================================================================

import { NextRequest, NextResponse } from "next/server"

// ABI minimo del contratto Solay39AuditRegistry
const REGISTRY_ABI = [
  "function registerAudit(string projectName, string reportHash, string commitHash) public",
  "function verifyAudit(bytes32 auditId) public view returns (tuple(string projectName, string reportHash, string commitHash, address auditor, uint256 timestamp))",
  "event AuditRegistered(bytes32 indexed auditId, string projectName, address auditor)",
]

// Indirizzo del contratto deployato (da env)
const REGISTRY_ADDRESS = process.env.AUDIT_REGISTRY_ADDRESS ?? ""
const AUDITOR_PRIVATE_KEY = process.env.AUDITOR_PRIVATE_KEY ?? ""
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL ?? "https://bsc-dataseed.binance.org/"

export async function POST(req: NextRequest) {
  try {
    const { projectName, reportHash, commitHash, auditId } = await req.json()

    if (!projectName || !reportHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Se il registry non e' configurato, ritorna un placeholder verificabile
    if (!REGISTRY_ADDRESS || !AUDITOR_PRIVATE_KEY) {
      console.warn("[Registry] On-chain registry not configured -- returning off-chain record")
      return NextResponse.json({
        success: true,
        onChain: false,
        message: "Registry contract not configured. Set AUDIT_REGISTRY_ADDRESS and AUDITOR_PRIVATE_KEY in env.",
        offChainRecord: {
          auditId,
          projectName,
          reportHash,
          timestamp: new Date().toISOString(),
          verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
        }
      })
    }

    const { ethers } = await import("ethers")
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(AUDITOR_PRIVATE_KEY, provider)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet)

    // Stima gas prima di inviare
    const gasEstimate = await registry.registerAudit.estimateGas(
      projectName, reportHash, commitHash ?? reportHash
    )

    const tx = await registry.registerAudit(
      projectName,
      reportHash,
      commitHash ?? reportHash,
      { gasLimit: (gasEstimate * BigInt(12)) / BigInt(10) } // +20% buffer
    )

    const receipt = await tx.wait()

    // Estrai auditId dall'evento
    const event = receipt.logs
      .map((log: { topics: string[]; data: string }) => {
        try { return registry.interface.parseLog(log) } catch { return null }
      })
      .find((e: { name: string } | null) => e?.name === "AuditRegistered")

    return NextResponse.json({
      success: true,
      onChain: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      onChainAuditId: event?.args?.auditId ?? null,
      explorerUrl: "https://bscscan.com/tx/" + receipt.hash,
      verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
    })

  } catch (error) {
    console.error("[Registry] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auditId = searchParams.get("auditId")

  if (!auditId) {
    return NextResponse.json({ error: "auditId required" }, { status: 400 })
  }

  if (!REGISTRY_ADDRESS) {
    return NextResponse.json({
      onChain: false,
      message: "Registry not configured"
    })
  }

  try {
    const { ethers } = await import("ethers")
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)

    const bytes32Id = ethers.id(auditId) // keccak256 dell'auditId stringa
    const record = await registry.verifyAudit(bytes32Id)

    return NextResponse.json({
      onChain: true,
      record: {
        projectName: record.projectName,
        reportHash: record.reportHash,
        commitHash: record.commitHash,
        auditor: record.auditor,
        timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
      }
    })
  } catch (error) {
    return NextResponse.json({
      onChain: false,
      error: error instanceof Error ? error.message : "Not found"
    }, { status: 404 })
  }
}
