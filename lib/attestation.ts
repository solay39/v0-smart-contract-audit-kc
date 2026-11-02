export interface AttestationSigner {
  name: string
  role: string
  wallet?: string
  signatureHash?: string
  signedAt?: string
}

export interface AuditAttestation {
  auditId: string
  signers: AttestationSigner[]
  reportHash: string
  chainId?: number
  txHash?: string
  timestamp: string
}

export function isMultiSignerValid(attestation: AuditAttestation): boolean {
  return attestation.signers.length >= 2 && Boolean(attestation.reportHash)
}
