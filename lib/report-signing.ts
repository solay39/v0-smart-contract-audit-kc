// ================================================================
// SOLAY39 -- Report Signing (ECDSA + SHA-256)
// Firma crittografica verificabile senza dipendenze pesanti
// ================================================================

export interface SignedReport {
  reportHash: string          // SHA-256 del contenuto
  signature: string           // ECDSA signature hex
  auditorAddress: string      // Ethereum address del firmatario
  timestamp: string           // ISO timestamp
  auditId: string
}

export interface VerificationResult {
  valid: boolean
  recoveredAddress: string
  expectedAddress: string
  reportHash: string
  signedAt: string
}

// --- SHA-256 (browser + Node compatibile) ---

export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = encoder.encode(data)
  const hashBuf = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

// --- SIGN (server-side, usa AUDITOR_PRIVATE_KEY da env) ---

export async function signReport(
  reportJson: string,
  auditId: string,
): Promise<SignedReport> {
  const reportHash = await sha256Hex(reportJson)

  // Usa ethers solo server-side (API route)
  const { ethers } = await import("ethers")
  const privateKey = process.env.AUDITOR_PRIVATE_KEY

  if (!privateKey) {
    // Fallback: firma simulata se la chiave non e' configurata
    console.warn("[Solay39] AUDITOR_PRIVATE_KEY not set -- using placeholder signature")
    return {
      reportHash,
      signature: "0x_CONFIGURE_AUDITOR_PRIVATE_KEY_IN_ENV",
      auditorAddress: "0x_NOT_CONFIGURED",
      timestamp: new Date().toISOString(),
      auditId,
    }
  }

  const wallet = new ethers.Wallet(privateKey)

  // Firma il hash come message Ethereum (EIP-191)
  const messageBytes = ethers.getBytes("0x" + reportHash)
  const signature = await wallet.signMessage(messageBytes)

  return {
    reportHash,
    signature,
    auditorAddress: wallet.address,
    timestamp: new Date().toISOString(),
    auditId,
  }
}

// --- VERIFY (client + server) ---

export async function verifyReport(
  reportJson: string,
  signedReport: SignedReport,
): Promise<VerificationResult> {
  const { ethers } = await import("ethers")

  const recomputedHash = await sha256Hex(reportJson)
  const messageBytes = ethers.getBytes("0x" + recomputedHash)

  let recoveredAddress = "0x_INVALID"
  let valid = false

  try {
    recoveredAddress = ethers.verifyMessage(messageBytes, signedReport.signature)
    valid = recoveredAddress.toLowerCase() === signedReport.auditorAddress.toLowerCase()
      && recomputedHash === signedReport.reportHash
  } catch {
    valid = false
  }

  return {
    valid,
    recoveredAddress,
    expectedAddress: signedReport.auditorAddress,
    reportHash: recomputedHash,
    signedAt: signedReport.timestamp,
  }
}

// ================================================================
// MULTI-SIGN ENGINE (Enterprise Dual Review)
// Supports N independent ECDSA signatures on the same report hash
// ================================================================

export interface MultiSignature {
  auditor: string         // Ethereum address
  signature: string       // ECDSA hex
  role: "lead" | "reviewer" | "qa"
  signedAt: string
}

export interface MultiSignedReport {
  reportHash: string
  signatures: MultiSignature[]
  auditId: string
  dualReviewValidated: boolean
  timestamp: string
}

// Sign a report with a specific private key and role
export async function multiSign(
  reportJson: string,
  privateKey: string,
  role: MultiSignature["role"],
  auditId: string,
): Promise<MultiSignature> {
  const { ethers } = await import("ethers")
  const reportHash = await sha256Hex(reportJson)
  const wallet = new ethers.Wallet(privateKey)
  const messageBytes = ethers.getBytes("0x" + reportHash)
  const signature = await wallet.signMessage(messageBytes)

  return {
    auditor: wallet.address,
    signature,
    role,
    signedAt: new Date().toISOString(),
  }
}

// Build a multi-signed report from individual signatures
export async function buildMultiSignedReport(
  reportJson: string,
  signatures: MultiSignature[],
  auditId: string,
): Promise<MultiSignedReport> {
  const reportHash = await sha256Hex(reportJson)
  const validated = validateDualReview(signatures)

  return {
    reportHash,
    signatures,
    auditId,
    dualReviewValidated: validated,
    timestamp: new Date().toISOString(),
  }
}

// ================================================================
// DUAL REVIEW GATE
// Enterprise audit requires 2+ independent signatures from different auditors
// ================================================================

export function validateDualReview(signatures: MultiSignature[]): boolean {
  if (!signatures || signatures.length < 2) return false

  // Must have at least 2 unique auditor addresses
  const uniqueAuditors = new Set(
    signatures.map(s => s.auditor.toLowerCase())
  )
  if (uniqueAuditors.size < 2) return false

  // Must have at least 1 "lead" and 1 "reviewer" role
  const hasLead = signatures.some(s => s.role === "lead")
  const hasReviewer = signatures.some(s => s.role === "reviewer" || s.role === "qa")

  return hasLead && hasReviewer
}

// Verify all signatures in a multi-signed report
export async function verifyMultiSignedReport(
  reportJson: string,
  report: MultiSignedReport,
): Promise<{ valid: boolean; verifiedSigners: string[]; errors: string[] }> {
  const { ethers } = await import("ethers")
  const recomputedHash = await sha256Hex(reportJson)
  const messageBytes = ethers.getBytes("0x" + recomputedHash)

  if (recomputedHash !== report.reportHash) {
    return { valid: false, verifiedSigners: [], errors: ["Report hash mismatch"] }
  }

  const verifiedSigners: string[] = []
  const errors: string[] = []

  for (const sig of report.signatures) {
    try {
      const recovered = ethers.verifyMessage(messageBytes, sig.signature)
      if (recovered.toLowerCase() === sig.auditor.toLowerCase()) {
        verifiedSigners.push(recovered)
      } else {
        errors.push("Signature from " + sig.auditor + " recovered to " + recovered)
      }
    } catch {
      errors.push("Invalid signature from " + sig.auditor)
    }
  }

  const valid = verifiedSigners.length >= 2 &&
    new Set(verifiedSigners.map(a => a.toLowerCase())).size >= 2

  return { valid, verifiedSigners, errors }
}
