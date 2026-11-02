export type VerificationStatus = "VERIFIED" | "PENDING" | "REJECTED"

export interface AuditEvidence {
  reportHash?: string
  reviewerNames?: string[]
  ciArtifacts?: string[]
  commitHash?: string
  branch?: string
  signedAt?: string
  attestationCount?: number
}

export interface AuditProject {
  id: string
  name: string
  ticker: string
  network: string
  category: string
  score: number | null
  rating: string | null
  status: VerificationStatus
  price: string
  change24h: string
  marketCap: string
  findings: { critical: number; high: number; medium: number; low: number }
  description: string
  evidence: AuditEvidence
  riskLabel: "LOW" | "MEDIUM" | "HIGH"
  scoreBreakdown?: { codeSecurity: number; architecture: number; governance: number; economics: number; onChain: number }
  tags: string[]
}
