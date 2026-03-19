/**
 * SOLAY39 Reputation & Track Record System
 * 
 * Verifiable on-chain reputation with:
 * - Ethereum Attestation Service (EAS) integration
 * - IPFS-pinned audit reports
 * - Transparent metrics and statistics
 * - Auditor credentials and certifications
 * - Protocol-level trust scoring
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AuditRecord {
  id: string
  projectName: string
  projectLogo?: string
  chain: string
  contractAddress?: string
  auditDate: Date
  publishDate: Date
  
  // Scores
  finalScore: number
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  
  // Findings
  totalFindings: number
  criticalFindings: number
  highFindings: number
  mediumFindings: number
  lowFindings: number
  infoFindings: number
  
  // Verification
  reportHash: string
  ipfsHash?: string
  txHash?: string // On-chain attestation tx
  
  // TVL at audit time
  tvlAtAudit?: string
  currentTVL?: string
  
  // Post-audit status
  exploited: boolean
  exploitDate?: Date
  exploitLoss?: string
  
  // Signatures
  auditorSignatures: string[]
  
  // Tags
  tags: string[]
}

export interface AuditorCredential {
  id: string
  name: string
  type: 'CERTIFICATION' | 'EDUCATION' | 'EXPERIENCE' | 'ACHIEVEMENT'
  issuer: string
  issueDate: Date
  expiryDate?: Date
  verificationUrl?: string
  attestationId?: string
}

export interface AuditorProfile {
  id: string
  name: string
  avatar?: string
  bio: string
  
  // Credentials
  credentials: AuditorCredential[]
  
  // Statistics
  totalAudits: number
  criticalFindings: number
  highFindings: number
  accuracy: number // Percentage of findings confirmed
  avgReviewTime: number // Hours
  
  // Track record
  exploitsPrevented: number
  totalTVLSecured: string
  projectsAudited: string[]
  
  // On-chain
  walletAddress?: string
  easAttestations?: string[]
  
  // Social
  twitter?: string
  github?: string
}

export interface ReputationScore {
  overall: number // 0-100
  components: {
    accuracy: number // Finding accuracy rate
    coverage: number // Vulnerability coverage
    speed: number // Review speed
    volume: number // Number of audits
    impact: number // TVL secured / exploits prevented
    consistency: number // Score variance
  }
  level: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'UNRANKED'
  badges: ReputationBadge[]
}

export interface ReputationBadge {
  id: string
  name: string
  description: string
  icon: string
  earnedDate: Date
  rarity: 'LEGENDARY' | 'EPIC' | 'RARE' | 'COMMON'
}

// ============================================================================
// TRACK RECORD SYSTEM
// ============================================================================

export class TrackRecordSystem {
  private audits: Map<string, AuditRecord> = new Map()
  private auditors: Map<string, AuditorProfile> = new Map()
  
  constructor() {
    this.initializeSampleData()
  }
  
  /**
   * Initialize with sample track record data
   */
  private initializeSampleData() {
    // Sample audits demonstrating track record
    const sampleAudits: AuditRecord[] = [
      {
        id: 'audit-001',
        projectName: 'AeroSwap DEX',
        chain: 'Ethereum',
        contractAddress: '0x1234...5678',
        auditDate: new Date('2024-01-15'),
        publishDate: new Date('2024-01-20'),
        finalScore: 92,
        riskLevel: 'LOW',
        totalFindings: 8,
        criticalFindings: 0,
        highFindings: 1,
        mediumFindings: 3,
        lowFindings: 2,
        infoFindings: 2,
        reportHash: 'sha256:abc123...',
        ipfsHash: 'QmXyz...',
        tvlAtAudit: '$50M',
        currentTVL: '$120M',
        exploited: false,
        auditorSignatures: ['sig:marco...', 'sig:sofia...'],
        tags: ['DEX', 'AMM', 'DeFi']
      },
      {
        id: 'audit-002',
        projectName: 'VaultGuard',
        chain: 'Arbitrum',
        auditDate: new Date('2024-02-10'),
        publishDate: new Date('2024-02-15'),
        finalScore: 78,
        riskLevel: 'MEDIUM',
        totalFindings: 15,
        criticalFindings: 1,
        highFindings: 3,
        mediumFindings: 5,
        lowFindings: 4,
        infoFindings: 2,
        reportHash: 'sha256:def456...',
        ipfsHash: 'QmAbc...',
        tvlAtAudit: '$25M',
        currentTVL: '$45M',
        exploited: false,
        auditorSignatures: ['sig:marco...'],
        tags: ['Yield', 'Vault', 'DeFi']
      },
      {
        id: 'audit-003',
        projectName: 'BridgeX',
        chain: 'Multi-chain',
        auditDate: new Date('2024-03-01'),
        publishDate: new Date('2024-03-10'),
        finalScore: 65,
        riskLevel: 'HIGH',
        totalFindings: 22,
        criticalFindings: 2,
        highFindings: 5,
        mediumFindings: 8,
        lowFindings: 5,
        infoFindings: 2,
        reportHash: 'sha256:ghi789...',
        ipfsHash: 'QmDef...',
        tvlAtAudit: '$100M',
        exploited: false,
        auditorSignatures: ['sig:marco...', 'sig:sofia...', 'sig:alex...'],
        tags: ['Bridge', 'Cross-chain']
      }
    ]
    
    for (const audit of sampleAudits) {
      this.audits.set(audit.id, audit)
    }
    
    // Sample auditor profiles
    const sampleAuditors: AuditorProfile[] = [
      {
        id: 'auditor-001',
        name: 'Marco Rossi',
        bio: 'Lead Security Researcher with 5+ years in smart contract auditing. Previously at Trail of Bits.',
        credentials: [
          {
            id: 'cred-001',
            name: 'Certified Smart Contract Auditor',
            type: 'CERTIFICATION',
            issuer: 'Secureum',
            issueDate: new Date('2022-06-01'),
            verificationUrl: 'https://secureum.xyz/verify/marco'
          },
          {
            id: 'cred-002',
            name: 'Top 10 Immunefi Bounty Hunter',
            type: 'ACHIEVEMENT',
            issuer: 'Immunefi',
            issueDate: new Date('2023-12-01')
          }
        ],
        totalAudits: 150,
        criticalFindings: 45,
        highFindings: 180,
        accuracy: 97,
        avgReviewTime: 8,
        exploitsPrevented: 12,
        totalTVLSecured: '$2.5B',
        projectsAudited: ['Uniswap V3 Fork', 'Compound Fork', '50+ DeFi Protocols'],
        twitter: '@marco_security',
        github: 'marcorossi'
      },
      {
        id: 'auditor-002',
        name: 'Sofia Chen',
        bio: 'Bridge and cross-chain security specialist. PhD in Cryptography from ETH Zurich.',
        credentials: [
          {
            id: 'cred-003',
            name: 'PhD in Applied Cryptography',
            type: 'EDUCATION',
            issuer: 'ETH Zurich',
            issueDate: new Date('2021-09-01')
          },
          {
            id: 'cred-004',
            name: 'Bridge Security Expert',
            type: 'CERTIFICATION',
            issuer: 'Layer Zero',
            issueDate: new Date('2023-03-01')
          }
        ],
        totalAudits: 120,
        criticalFindings: 38,
        highFindings: 145,
        accuracy: 95,
        avgReviewTime: 10,
        exploitsPrevented: 8,
        totalTVLSecured: '$1.8B',
        projectsAudited: ['Multiple Bridge Protocols', 'Cross-chain DEXs'],
        twitter: '@sofia_crypto',
        github: 'sofiachen'
      }
    ]
    
    for (const auditor of sampleAuditors) {
      this.auditors.set(auditor.id, auditor)
    }
  }
  
  /**
   * Add new audit record
   */
  addAuditRecord(record: AuditRecord): void {
    this.audits.set(record.id, record)
  }
  
  /**
   * Get all audit records
   */
  getAllAudits(): AuditRecord[] {
    return Array.from(this.audits.values())
      .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime())
  }
  
  /**
   * Get audits by chain
   */
  getAuditsByChain(chain: string): AuditRecord[] {
    return this.getAllAudits().filter(a => 
      a.chain.toLowerCase() === chain.toLowerCase()
    )
  }
  
  /**
   * Get auditor profile
   */
  getAuditorProfile(id: string): AuditorProfile | undefined {
    return this.auditors.get(id)
  }
  
  /**
   * Get all auditors
   */
  getAllAuditors(): AuditorProfile[] {
    return Array.from(this.auditors.values())
  }
  
  /**
   * Calculate reputation score
   */
  calculateReputationScore(): ReputationScore {
    const audits = this.getAllAudits()
    const totalAudits = audits.length
    
    if (totalAudits === 0) {
      return {
        overall: 0,
        components: {
          accuracy: 0,
          coverage: 0,
          speed: 0,
          volume: 0,
          impact: 0,
          consistency: 0
        },
        level: 'UNRANKED',
        badges: []
      }
    }
    
    // Calculate component scores
    const exploitedCount = audits.filter(a => a.exploited).length
    const accuracy = Math.round((1 - exploitedCount / totalAudits) * 100)
    
    const avgFindings = audits.reduce((sum, a) => sum + a.totalFindings, 0) / totalAudits
    const coverage = Math.min(100, Math.round(avgFindings * 5)) // More findings = better coverage
    
    const auditors = this.getAllAuditors()
    const avgSpeed = auditors.reduce((sum, a) => sum + a.avgReviewTime, 0) / (auditors.length || 1)
    const speed = Math.round(Math.max(0, 100 - avgSpeed * 5)) // Lower time = higher score
    
    const volume = Math.min(100, Math.round(totalAudits * 2)) // More audits = higher score
    
    const totalCriticals = audits.reduce((sum, a) => sum + a.criticalFindings, 0)
    const totalHighs = audits.reduce((sum, a) => sum + a.highFindings, 0)
    const impact = Math.min(100, Math.round((totalCriticals * 10 + totalHighs * 5)))
    
    const scores = audits.map(a => a.finalScore)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length
    const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance)))
    
    // Overall score
    const overall = Math.round(
      accuracy * 0.30 +
      coverage * 0.15 +
      speed * 0.10 +
      volume * 0.15 +
      impact * 0.20 +
      consistency * 0.10
    )
    
    // Determine level
    let level: ReputationScore['level']
    if (overall >= 90) level = 'PLATINUM'
    else if (overall >= 75) level = 'GOLD'
    else if (overall >= 60) level = 'SILVER'
    else if (overall >= 40) level = 'BRONZE'
    else level = 'UNRANKED'
    
    // Generate badges
    const badges = this.generateBadges(audits, accuracy, totalCriticals)
    
    return {
      overall,
      components: { accuracy, coverage, speed, volume, impact, consistency },
      level,
      badges
    }
  }
  
  /**
   * Generate earned badges
   */
  private generateBadges(
    audits: AuditRecord[],
    accuracy: number,
    criticals: number
  ): ReputationBadge[] {
    const badges: ReputationBadge[] = []
    
    if (accuracy >= 99) {
      badges.push({
        id: 'badge-perfect',
        name: 'Perfect Record',
        description: 'No audited project has been exploited',
        icon: 'shield-check',
        earnedDate: new Date(),
        rarity: 'LEGENDARY'
      })
    }
    
    if (criticals >= 50) {
      badges.push({
        id: 'badge-hunter',
        name: 'Critical Hunter',
        description: 'Found 50+ critical vulnerabilities',
        icon: 'bug',
        earnedDate: new Date(),
        rarity: 'EPIC'
      })
    }
    
    if (audits.length >= 100) {
      badges.push({
        id: 'badge-veteran',
        name: 'Veteran Auditor',
        description: 'Completed 100+ security audits',
        icon: 'award',
        earnedDate: new Date(),
        rarity: 'EPIC'
      })
    }
    
    const bridgeAudits = audits.filter(a => a.tags.includes('Bridge') || a.tags.includes('Cross-chain'))
    if (bridgeAudits.length >= 10) {
      badges.push({
        id: 'badge-bridge',
        name: 'Bridge Guardian',
        description: 'Specialized in cross-chain security',
        icon: 'link',
        earnedDate: new Date(),
        rarity: 'RARE'
      })
    }
    
    const defiAudits = audits.filter(a => a.tags.includes('DeFi'))
    if (defiAudits.length >= 25) {
      badges.push({
        id: 'badge-defi',
        name: 'DeFi Expert',
        description: 'Deep expertise in DeFi protocols',
        icon: 'coins',
        earnedDate: new Date(),
        rarity: 'RARE'
      })
    }
    
    if (audits.length >= 10) {
      badges.push({
        id: 'badge-trusted',
        name: 'Trusted Auditor',
        description: 'Established track record',
        icon: 'verified',
        earnedDate: new Date(),
        rarity: 'COMMON'
      })
    }
    
    return badges
  }
  
  /**
   * Get aggregated statistics
   */
  getAggregatedStats(): TrackRecordStats {
    const audits = this.getAllAudits()
    const auditors = this.getAllAuditors()
    
    const totalFindings = audits.reduce((sum, a) => sum + a.totalFindings, 0)
    const totalCriticals = audits.reduce((sum, a) => sum + a.criticalFindings, 0)
    const totalHighs = audits.reduce((sum, a) => sum + a.highFindings, 0)
    const exploitedCount = audits.filter(a => a.exploited).length
    
    // Calculate total TVL secured
    let totalTVL = 0
    for (const audit of audits) {
      if (audit.currentTVL) {
        const match = audit.currentTVL.match(/\$?([\d.]+)([MBK])?/i)
        if (match) {
          let value = parseFloat(match[1])
          const unit = match[2]?.toUpperCase()
          if (unit === 'B') value *= 1000
          else if (unit === 'K') value /= 1000
          totalTVL += value
        }
      }
    }
    
    // Chain distribution
    const chainCounts = new Map<string, number>()
    for (const audit of audits) {
      chainCounts.set(audit.chain, (chainCounts.get(audit.chain) || 0) + 1)
    }
    
    return {
      totalAudits: audits.length,
      totalAuditors: auditors.length,
      totalFindings,
      totalCriticals,
      totalHighs,
      exploitsPrevented: audits.filter(a => !a.exploited && a.criticalFindings > 0).length,
      totalTVLSecured: `$${totalTVL.toFixed(0)}M`,
      accuracyRate: audits.length > 0 ? Math.round((1 - exploitedCount / audits.length) * 100) : 100,
      avgAuditScore: audits.length > 0 ? Math.round(audits.reduce((sum, a) => sum + a.finalScore, 0) / audits.length) : 0,
      chainDistribution: Object.fromEntries(chainCounts),
      monthlyAudits: this.getMonthlyAuditCounts(),
      reputation: this.calculateReputationScore()
    }
  }
  
  /**
   * Get monthly audit counts for the last 12 months
   */
  private getMonthlyAuditCounts(): { month: string; count: number }[] {
    const counts: { month: string; count: number }[] = []
    const now = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' })
      
      const count = this.getAllAudits().filter(a => {
        const auditDate = new Date(a.publishDate)
        return auditDate.getMonth() === date.getMonth() && 
               auditDate.getFullYear() === date.getFullYear()
      }).length
      
      counts.push({ month: monthStr, count })
    }
    
    return counts
  }
  
  /**
   * Generate EAS attestation data
   */
  generateEASAttestation(auditId: string): EASAttestation | null {
    const audit = this.audits.get(auditId)
    if (!audit) return null
    
    return {
      schema: 'SOLAY39_AUDIT_V1',
      data: {
        projectName: audit.projectName,
        chain: audit.chain,
        auditDate: audit.auditDate.toISOString(),
        finalScore: audit.finalScore,
        riskLevel: audit.riskLevel,
        totalFindings: audit.totalFindings,
        criticalFindings: audit.criticalFindings,
        reportHash: audit.reportHash,
        ipfsHash: audit.ipfsHash || '',
        auditorSignatures: audit.auditorSignatures
      },
      recipient: audit.contractAddress || '0x0000000000000000000000000000000000000000',
      expirationTime: 0, // Never expires
      revocable: false
    }
  }
  
  /**
   * Verify audit authenticity
   */
  verifyAudit(auditId: string, providedHash: string): VerificationResult {
    const audit = this.audits.get(auditId)
    if (!audit) {
      return { valid: false, reason: 'Audit not found' }
    }
    
    if (audit.reportHash !== providedHash) {
      return { valid: false, reason: 'Report hash mismatch' }
    }
    
    return {
      valid: true,
      audit: {
        projectName: audit.projectName,
        auditDate: audit.auditDate,
        finalScore: audit.finalScore,
        signaturesCount: audit.auditorSignatures.length
      }
    }
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface TrackRecordStats {
  totalAudits: number
  totalAuditors: number
  totalFindings: number
  totalCriticals: number
  totalHighs: number
  exploitsPrevented: number
  totalTVLSecured: string
  accuracyRate: number
  avgAuditScore: number
  chainDistribution: Record<string, number>
  monthlyAudits: { month: string; count: number }[]
  reputation: ReputationScore
}

export interface EASAttestation {
  schema: string
  data: {
    projectName: string
    chain: string
    auditDate: string
    finalScore: number
    riskLevel: string
    totalFindings: number
    criticalFindings: number
    reportHash: string
    ipfsHash: string
    auditorSignatures: string[]
  }
  recipient: string
  expirationTime: number
  revocable: boolean
}

export interface VerificationResult {
  valid: boolean
  reason?: string
  audit?: {
    projectName: string
    auditDate: Date
    finalScore: number
    signaturesCount: number
  }
}

// Export singleton instance
export const trackRecordSystem = new TrackRecordSystem()
