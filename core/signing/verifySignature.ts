// ═══════════════════════════════════════════════════════════════
// SOLAY39 — Signature Verification
// /core/signing/verifySignature.ts
// Verifies ECDSA signatures on audit reports (client + server)
// ═══════════════════════════════════════════════════════════════

import type { ReportSignature } from "./signReport"

export interface VerificationResult {
  valid: boolean
  recoveredAddress: string
  expectedAddress: string
  hashMatch: boolean
}

/**
 * Verify a single report signature.
 * Recomputes SHA-256 and recovers the signer address via ecrecover.
 */
export async function verifySignature(
  reportJson: string,
  sig: ReportSignature,
): Promise<VerificationResult> {
  const { ethers } = await import("ethers")

  // Recompute SHA-256
  const encoder = new TextEncoder()
  const buf = encoder.encode(reportJson)
  const hashBuf = await crypto.subtle.digest("SHA-256", buf)
  const recomputedHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const hashMatch = recomputedHash === sig.hash
  const messageBytes = ethers.getBytes("0x" + recomputedHash)

  let recoveredAddress = "0x_INVALID"
  let valid = false

  try {
    recoveredAddress = ethers.verifyMessage(messageBytes, sig.signature)
    valid = recoveredAddress.toLowerCase() === sig.auditor.toLowerCase() && hashMatch
  } catch {
    valid = false
  }

  return {
    valid,
    recoveredAddress,
    expectedAddress: sig.auditor,
    hashMatch,
  }
}

/**
 * Verify all signatures in an array (for dual/multi-review).
 */
export async function verifyAllSignatures(
  reportJson: string,
  signatures: ReportSignature[],
): Promise<{ allValid: boolean; results: VerificationResult[] }> {
  const results = await Promise.all(
    signatures.map((sig) => verifySignature(reportJson, sig))
  )

  return {
    allValid: results.every((r) => r.valid),
    results,
  }
}
