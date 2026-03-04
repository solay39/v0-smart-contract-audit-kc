// ================================================================
// SOLAY39 -- On-Chain Audit Registry
// Registra audit su BSC/ETH via API -- no Hardhat necessario
// ================================================================

import { NextRequest, NextResponse } from "next/server"

// ABI minimo del contratto Solay39AuditRegistry (single-auditor)
const REGISTRY_ABI = [
  "function registerAudit(string projectName, string reportHash, string commitHash) public",
  "function verifyAudit(bytes32 auditId) public view returns (tuple(string projectName, string reportHash, string commitHash, address auditor, uint256 timestamp))",
  "event AuditRegistered(bytes32 indexed auditId, string projectName, address auditor)",
]

// ABI del contratto Solay39Attestation (multi-auditor)
const ATTESTATION_ABI = [
  "function attestAudit(string project, string reportHash, string commitHash, address[] auditors) public returns (bytes32)",
  "function verifyAttestation(bytes32 id) public view returns (string project, string reportHash, string commitHash, address[] auditors, uint256 timestamp, bool dualReview)",
  "function verifyByReportHash(string reportHash) public view returns (bool found, bytes32 id)",
  "event AuditAttested(bytes32 indexed id, string project, string reportHash, address[] auditors, bool dualReview, uint256 timestamp)",
]

// ABI del contratto Solay39EnterpriseRegistry (publishAudit con address[] auditors)
const ENTERPRISE_ABI = [
  "function publishAudit(string project, string reportHash, string commitHash, address[] auditors) public returns (bytes32)",
  "function verifyAudit(bytes32 id) external view returns (string project, string reportHash, string commitHash, address[] auditors, uint256 timestamp)",
  "function verifyByReportHash(string reportHash) external view returns (bool found, bytes32 id)",
  "event AuditPublished(bytes32 indexed id, string project)",
]

// Indirizzi dei contratti deployati (da env)
const REGISTRY_ADDRESS = process.env.AUDIT_REGISTRY_ADDRESS ?? ""
const ATTESTATION_ADDRESS = process.env.ATTESTATION_CONTRACT_ADDRESS ?? ""
const ENTERPRISE_ADDRESS = process.env.ENTERPRISE_REGISTRY_ADDRESS ?? ""
const AUDITOR_PRIVATE_KEY = process.env.AUDITOR_PRIVATE_KEY ?? ""
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL ?? "https://bsc-dataseed.binance.org/"

export async function POST(req: NextRequest) {
  try {
    const { projectName, reportHash, commitHash, auditId, auditors } = await req.json()

    if (!projectName || !reportHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const auditorList: string[] = Array.isArray(auditors) && auditors.length > 0
      ? auditors
      : []

    // Se nessun registry e' configurato, ritorna un record off-chain verificabile
    if (!AUDITOR_PRIVATE_KEY || (!REGISTRY_ADDRESS && !ATTESTATION_ADDRESS && !ENTERPRISE_ADDRESS)) {
      console.warn("[Registry] On-chain registry not configured -- returning off-chain record")
      return NextResponse.json({
        success: true,
        onChain: false,
        message: "Registry contract not configured. Set AUDIT_REGISTRY_ADDRESS or ATTESTATION_CONTRACT_ADDRESS in env.",
        offChainRecord: {
          auditId,
          projectName,
          reportHash,
          auditors: auditorList,
          dualReview: auditorList.length >= 2,
          timestamp: new Date().toISOString(),
          verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
        }
      })
    }

    const { ethers } = await import("ethers")
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(AUDITOR_PRIVATE_KEY, provider)

    // ── STRATEGY: Enterprise > Attestation > Registry (in priority order) ──

    // 1st priority: Solay39EnterpriseRegistry (publishAudit with address[] auditors)
    if (ENTERPRISE_ADDRESS && auditorList.length > 0) {
      const enterprise = new ethers.Contract(ENTERPRISE_ADDRESS, ENTERPRISE_ABI, wallet)

      const gasEstimate = await enterprise.publishAudit.estimateGas(
        projectName, reportHash, commitHash ?? reportHash, auditorList
      )

      const tx = await enterprise.publishAudit(
        projectName,
        reportHash,
        commitHash ?? reportHash,
        auditorList,
        { gasLimit: (gasEstimate * BigInt(12)) / BigInt(10) }
      )

      const receipt = await tx.wait()

      const event = receipt.logs
        .map((log: { topics: string[]; data: string }) => {
          try { return enterprise.interface.parseLog(log) } catch { return null }
        })
        .find((e: { name: string } | null) => e?.name === "AuditPublished")

      return NextResponse.json({
        success: true,
        onChain: true,
        contractType: "enterprise",
        dualReview: auditorList.length >= 2,
        auditors: auditorList,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        onChainAuditId: event?.args?.id ?? null,
        explorerUrl: "https://bscscan.com/tx/" + receipt.hash,
        verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
      })
    }

    // 2nd priority: Solay39Attestation (multi-auditor attestation)
    if (ATTESTATION_ADDRESS && auditorList.length > 0) {
      // Multi-auditor attestation
      const attestation = new ethers.Contract(ATTESTATION_ADDRESS, ATTESTATION_ABI, wallet)

      const gasEstimate = await attestation.attestAudit.estimateGas(
        projectName, reportHash, commitHash ?? reportHash, auditorList
      )

      const tx = await attestation.attestAudit(
        projectName,
        reportHash,
        commitHash ?? reportHash,
        auditorList,
        { gasLimit: (gasEstimate * BigInt(12)) / BigInt(10) }
      )

      const receipt = await tx.wait()

      const event = receipt.logs
        .map((log: { topics: string[]; data: string }) => {
          try { return attestation.interface.parseLog(log) } catch { return null }
        })
        .find((e: { name: string } | null) => e?.name === "AuditAttested")

      return NextResponse.json({
        success: true,
        onChain: true,
        contractType: "attestation",
        dualReview: event?.args?.dualReview ?? auditorList.length >= 2,
        auditors: auditorList,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        onChainAuditId: event?.args?.id ?? null,
        explorerUrl: "https://bscscan.com/tx/" + receipt.hash,
        verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
      })
    }

    // Fallback: single-auditor registry
    if (REGISTRY_ADDRESS) {
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet)

      const gasEstimate = await registry.registerAudit.estimateGas(
        projectName, reportHash, commitHash ?? reportHash
      )

      const tx = await registry.registerAudit(
        projectName,
        reportHash,
        commitHash ?? reportHash,
        { gasLimit: (gasEstimate * BigInt(12)) / BigInt(10) }
      )

      const receipt = await tx.wait()

      const event = receipt.logs
        .map((log: { topics: string[]; data: string }) => {
          try { return registry.interface.parseLog(log) } catch { return null }
        })
        .find((e: { name: string } | null) => e?.name === "AuditRegistered")

      return NextResponse.json({
        success: true,
        onChain: true,
        contractType: "registry",
        dualReview: false,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        onChainAuditId: event?.args?.auditId ?? null,
        explorerUrl: "https://bscscan.com/tx/" + receipt.hash,
        verificationUrl: "https://www.solay39.eu/verify/" + (auditId || "unknown"),
      })
    }

    return NextResponse.json({
      success: false,
      error: "No contract address configured"
    }, { status: 500 })

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
  const reportHash = searchParams.get("reportHash")

  if (!auditId && !reportHash) {
    return NextResponse.json({ error: "auditId or reportHash required" }, { status: 400 })
  }

  if (!REGISTRY_ADDRESS && !ATTESTATION_ADDRESS && !ENTERPRISE_ADDRESS) {
    return NextResponse.json({ onChain: false, message: "Registry not configured" })
  }

  try {
    const { ethers } = await import("ethers")
    const provider = new ethers.JsonRpcProvider(RPC_URL)

    // Try Enterprise registry first (publishAudit with address[] auditors)
    if (ENTERPRISE_ADDRESS && reportHash) {
      const enterprise = new ethers.Contract(ENTERPRISE_ADDRESS, ENTERPRISE_ABI, provider)
      const [found, id] = await enterprise.verifyByReportHash(reportHash)
      if (found) {
        const [project, hash, commit, auditors, timestamp] =
          await enterprise.verifyAudit(id)
        return NextResponse.json({
          onChain: true,
          contractType: "enterprise",
          record: {
            project,
            reportHash: hash,
            commitHash: commit,
            auditors,
            dualReview: auditors.length >= 2,
            timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          }
        })
      }
    }

    // Try Attestation contract (multi-auditor)
    if (ATTESTATION_ADDRESS && reportHash) {
      const attestation = new ethers.Contract(ATTESTATION_ADDRESS, ATTESTATION_ABI, provider)
      const [found, id] = await attestation.verifyByReportHash(reportHash)
      if (found) {
        const [project, hash, commit, auditors, timestamp, dualReview] =
          await attestation.verifyAttestation(id)
        return NextResponse.json({
          onChain: true,
          contractType: "attestation",
          record: {
            project,
            reportHash: hash,
            commitHash: commit,
            auditors,
            dualReview,
            timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          }
        })
      }
    }

    // Fallback: single-auditor registry
    if (REGISTRY_ADDRESS && auditId) {
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)
      const bytes32Id = ethers.id(auditId)
      const record = await registry.verifyAudit(bytes32Id)

      return NextResponse.json({
        onChain: true,
        contractType: "registry",
        record: {
          projectName: record.projectName,
          reportHash: record.reportHash,
          commitHash: record.commitHash,
          auditor: record.auditor,
          timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
        }
      })
    }

    return NextResponse.json({ onChain: false, error: "Not found" }, { status: 404 })
  } catch (error) {
    return NextResponse.json({
      onChain: false,
      error: error instanceof Error ? error.message : "Not found"
    }, { status: 404 })
  }
}
