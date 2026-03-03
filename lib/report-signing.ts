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
