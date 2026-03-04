// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Report Signing (ECDSA + SHA-256)
// /core/signing/signReport.ts
// Enterprise-grade digital signature for audit reports
// ═══════════════════════════════════════════════════════════════

export interface ReportSignature {
  auditor: string       // Ethereum address
  hash: string          // SHA-256 hex of the report content
  signature: string     // ECDSA hex
  signedAt: string      // ISO timestamp
}

/**
 * SHA-256 hash of arbitrary content (browser + Node compatible).
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = encoder.encode(data)
  const hashBuf = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Sign a report's JSON content with a private key (server-side).
 * Uses EIP-191 personal_sign for Ethereum-compatible verification.
 */
export async function signReport(
  reportJson: string,
  privateKey: string,
): Promise<ReportSignature> {
  const { ethers } = await import("ethers")

  const hash = await sha256Hex(reportJson)
  const wallet = new ethers.Wallet(privateKey)
  const messageBytes = ethers.getBytes("0x" + hash)
  const signature = await wallet.signMessage(messageBytes)

  return {
    auditor: wallet.address,
    hash,
    signature,
    signedAt: new Date().toISOString(),
  }
}

/**
 * Sign a PDF/binary file by hashing its content.
 * For server-side use with fs access.
 */
export async function signPDF(
  fileBuffer: ArrayBuffer | Uint8Array,
  privateKey: string,
): Promise<ReportSignature> {
  const { ethers } = await import("ethers")

  const hashBuf = await crypto.subtle.digest("SHA-256", fileBuffer)
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const wallet = new ethers.Wallet(privateKey)
  const messageBytes = ethers.getBytes("0x" + hash)
  const signature = await wallet.signMessage(messageBytes)

  return {
    auditor: wallet.address,
    hash,
    signature,
    signedAt: new Date().toISOString(),
  }
}
