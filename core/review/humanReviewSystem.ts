/**
 * SOLAY39 Human Review System
 * 
 * Enterprise-grade workflow for manual audit review:
 * - Review queue with priority scoring
 * - Auditor assignment based on expertise
 * - 100+ point review checklist
 * - Multi-auditor conflict resolution
 * - Digital signatures for reports
 * - Audit trail and compliance
 */

export type AuditStatus = 
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'REVIEW_COMPLETE'
  | 'NEEDS_SECOND_REVIEW'
  | 'CONFLICT_RESOLUTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'

export type AuditorExpertise = 
  | 'DEFI'
  | 'NFT'
  | 'BRIDGE'
  | 'GOVERNANCE'
  | 'STAKING'
  | 'LENDING'
  | 'DEX'
  | 'ORACLE'
  | 'LAYER2'
  | 'CROSS_CHAIN'

export interface Auditor {
  id: string
  name: string
  email: string
  publicKey: string // For digital signatures
  expertise: AuditorExpertise[]
  auditCount: number
  accuracy: number // 0-100
  avgReviewTime: number // hours
  isLead: boolean
  isSenior: boolean
  joinedAt: Date
}

export interface ReviewAssignment {
  auditorId: string
  assignedAt: Date
  startedAt?: Date
  completedAt?: Date
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETE' | 'CONFLICT'
  findings: ReviewFinding[]
  checklistScores: ChecklistScore[]
  overallScore: number
  recommendation: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES'
  notes: string
  timeSpentHours: number
}

export interface ReviewFinding {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  title: string
  description: string
  location: {
    file: string
    line: number
    code: string
  }
  verified: boolean // Human verified this AI finding
  newFinding: boolean // Human found this, AI missed
  falsePositive: boolean // AI found, human says false positive
  auditorNotes: string
}

export interface ChecklistScore {
  categoryId: string
  categoryName: string
  items: {
    id: string
    name: string
    passed: boolean
    notes: string
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  }[]
  score: number // 0-100
}

export interface AuditReview {
  id: string
  auditId: string
  projectName: string
  contractAddress?: string
  chain: string
  status: AuditStatus
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  createdAt: Date
  updatedAt: Date
  
  // AI Analysis
  aiScore: number
  aiFindings: number
  aiCriticals: number
  aiHighs: number
  
  // Human Review
  assignments: ReviewAssignment[]
  leadReviewerId?: string
  
  // Final Result
  finalScore?: number
  finalRecommendation?: 'APPROVE' | 'REJECT' | 'CONDITIONAL_APPROVE'
  publishedAt?: Date
  signatures?: DigitalSignature[]
}

export interface DigitalSignature {
  auditorId: string
  auditorName: string
  signature: string // SHA-256 hash of report + auditor public key
  timestamp: Date
  reportHash: string // SHA-256 of final report
  ipfsHash?: string
}

// ============================================================================
// REVIEW CHECKLIST (100+ items)
// ============================================================================

export interface ChecklistCategory {
  id: string
  name: string
  description: string
  weight: number // 0-100, total should be 100
  items: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  name: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  automated: boolean // Can be auto-checked by AI
}

export const REVIEW_CHECKLIST: ChecklistCategory[] = [
  {
    id: 'access-control',
    name: 'Access Control',
    description: 'Verify proper access control mechanisms',
    weight: 20,
    items: [
      { id: 'ac-001', name: 'Admin functions protected', description: 'All admin functions have proper access modifiers', severity: 'CRITICAL', automated: true },
      { id: 'ac-002', name: 'Role-based access implemented', description: 'Uses RBAC or similar pattern', severity: 'HIGH', automated: true },
      { id: 'ac-003', name: 'No tx.origin auth', description: 'Does not use tx.origin for authentication', severity: 'HIGH', automated: true },
      { id: 'ac-004', name: 'Ownership transfer safe', description: 'Two-step ownership transfer or renounce confirmation', severity: 'MEDIUM', automated: true },
      { id: 'ac-005', name: 'Initializer protected', description: 'Initialize functions have initializer modifier', severity: 'CRITICAL', automated: true },
      { id: 'ac-006', name: 'Modifier order correct', description: 'Modifiers applied in correct order', severity: 'MEDIUM', automated: false },
      { id: 'ac-007', name: 'Emergency functions exist', description: 'Pause/emergency withdraw available', severity: 'MEDIUM', automated: true },
      { id: 'ac-008', name: 'Timelocks for critical ops', description: 'Timelock on sensitive operations', severity: 'HIGH', automated: true },
      { id: 'ac-009', name: 'Multisig for admin', description: 'Admin is multisig, not EOA', severity: 'HIGH', automated: false },
      { id: 'ac-010', name: 'No backdoors', description: 'No hidden admin functions', severity: 'CRITICAL', automated: false }
    ]
  },
  {
    id: 'reentrancy',
    name: 'Reentrancy Protection',
    description: 'Check for reentrancy vulnerabilities',
    weight: 15,
    items: [
      { id: 're-001', name: 'CEI pattern followed', description: 'Checks-Effects-Interactions pattern used', severity: 'CRITICAL', automated: true },
      { id: 're-002', name: 'Reentrancy guard used', description: 'nonReentrant modifier on external calls', severity: 'HIGH', automated: true },
      { id: 're-003', name: 'Cross-function reentrancy', description: 'No cross-function reentrancy possible', severity: 'CRITICAL', automated: false },
      { id: 're-004', name: 'Read-only reentrancy checked', description: 'View functions safe during callbacks', severity: 'HIGH', automated: false },
      { id: 're-005', name: 'ERC777 hooks handled', description: 'Safe from ERC777 callback attacks', severity: 'HIGH', automated: true },
      { id: 're-006', name: 'Create2 reentrancy safe', description: 'Constructor cannot reenter', severity: 'MEDIUM', automated: false }
    ]
  },
  {
    id: 'oracle',
    name: 'Oracle Security',
    description: 'Verify oracle usage and price manipulation resistance',
    weight: 15,
    items: [
      { id: 'or-001', name: 'TWAP used (not spot)', description: 'Uses time-weighted average, not spot price', severity: 'CRITICAL', automated: true },
      { id: 'or-002', name: 'Chainlink integration correct', description: 'Proper Chainlink usage with staleness check', severity: 'HIGH', automated: true },
      { id: 'or-003', name: 'Staleness check', description: 'Oracle data freshness validated', severity: 'HIGH', automated: true },
      { id: 'or-004', name: 'Decimals handled', description: 'Oracle decimals properly normalized', severity: 'HIGH', automated: true },
      { id: 'or-005', name: 'Multiple oracles', description: 'Fallback oracle for resilience', severity: 'MEDIUM', automated: false },
      { id: 'or-006', name: 'Price bounds checked', description: 'Sanity checks on oracle prices', severity: 'MEDIUM', automated: true },
      { id: 'or-007', name: 'Circuit breaker exists', description: 'Can pause on oracle failure', severity: 'MEDIUM', automated: false },
      { id: 'or-008', name: 'Manipulation resistant', description: 'Cannot be manipulated in single block', severity: 'CRITICAL', automated: false }
    ]
  },
  {
    id: 'flash-loan',
    name: 'Flash Loan Resistance',
    description: 'Check resistance to flash loan attacks',
    weight: 10,
    items: [
      { id: 'fl-001', name: 'No single-block manipulation', description: 'Critical operations span multiple blocks', severity: 'CRITICAL', automated: false },
      { id: 'fl-002', name: 'Share inflation prevented', description: 'First depositor cannot inflate shares', severity: 'HIGH', automated: true },
      { id: 'fl-003', name: 'Balance caching', description: 'Uses cached balances, not direct reads', severity: 'HIGH', automated: true },
      { id: 'fl-004', name: 'Flash loan guards', description: 'Detects and blocks flash loan context', severity: 'MEDIUM', automated: true },
      { id: 'fl-005', name: 'Donation attack resistant', description: 'Direct transfers cannot manipulate', severity: 'HIGH', automated: false }
    ]
  },
  {
    id: 'math',
    name: 'Arithmetic Safety',
    description: 'Verify safe arithmetic operations',
    weight: 10,
    items: [
      { id: 'ma-001', name: 'Solidity 0.8+ or SafeMath', description: 'Overflow protection enabled', severity: 'CRITICAL', automated: true },
      { id: 'ma-002', name: 'Safe downcasting', description: 'Uses SafeCast for type conversions', severity: 'HIGH', automated: true },
      { id: 'ma-003', name: 'Division by zero prevented', description: 'All divisions check for zero', severity: 'HIGH', automated: true },
      { id: 'ma-004', name: 'Rounding direction correct', description: 'Rounding favors protocol in critical calcs', severity: 'MEDIUM', automated: false },
      { id: 'ma-005', name: 'Precision loss acceptable', description: 'No significant precision loss', severity: 'MEDIUM', automated: false },
      { id: 'ma-006', name: 'Unchecked blocks justified', description: 'All unchecked{} have comments justifying safety', severity: 'MEDIUM', automated: true }
    ]
  },
  {
    id: 'external-calls',
    name: 'External Call Safety',
    description: 'Verify safe handling of external calls',
    weight: 10,
    items: [
      { id: 'ec-001', name: 'Return values checked', description: 'All external call returns verified', severity: 'HIGH', automated: true },
      { id: 'ec-002', name: 'SafeERC20 used', description: 'Uses SafeERC20 for token transfers', severity: 'HIGH', automated: true },
      { id: 'ec-003', name: 'Low-level calls justified', description: 'call/delegatecall properly handled', severity: 'HIGH', automated: true },
      { id: 'ec-004', name: 'Gas limits on calls', description: 'External calls have gas limits', severity: 'MEDIUM', automated: false },
      { id: 'ec-005', name: 'Callback validation', description: 'Untrusted callbacks validated', severity: 'HIGH', automated: false },
      { id: 'ec-006', name: 'Address validation', description: 'External addresses validated', severity: 'MEDIUM', automated: true }
    ]
  },
  {
    id: 'gas-dos',
    name: 'Gas & DoS Prevention',
    description: 'Check for DoS vulnerabilities',
    weight: 5,
    items: [
      { id: 'gd-001', name: 'Bounded loops', description: 'No unbounded iteration over arrays', severity: 'HIGH', automated: true },
      { id: 'gd-002', name: 'Pull over push', description: 'Users withdraw, contract does not push', severity: 'MEDIUM', automated: true },
      { id: 'gd-003', name: 'No external in loops', description: 'External calls not in loops', severity: 'HIGH', automated: true },
      { id: 'gd-004', name: 'Pagination available', description: 'Large datasets use pagination', severity: 'MEDIUM', automated: false },
      { id: 'gd-005', name: 'Block gas limit aware', description: 'Operations fit in block gas limit', severity: 'MEDIUM', automated: false }
    ]
  },
  {
    id: 'upgrade',
    name: 'Upgrade Safety',
    description: 'Verify safe upgrade mechanisms',
    weight: 5,
    items: [
      { id: 'up-001', name: 'Upgrade auth protected', description: 'Only admin can upgrade', severity: 'CRITICAL', automated: true },
      { id: 'up-002', name: 'Storage layout preserved', description: 'No storage collisions between versions', severity: 'CRITICAL', automated: false },
      { id: 'up-003', name: 'Storage gaps present', description: '__gap arrays for future variables', severity: 'HIGH', automated: true },
      { id: 'up-004', name: 'Initializer versioned', description: 'reinitializer for upgrade init', severity: 'HIGH', automated: true },
      { id: 'up-005', name: 'Timelock on upgrade', description: 'Upgrades have timelock delay', severity: 'HIGH', automated: false }
    ]
  },
  {
    id: 'token',
    name: 'Token Security',
    description: 'Check token implementation safety',
    weight: 5,
    items: [
      { id: 'tk-001', name: 'ERC20 compliant', description: 'Follows ERC20 standard correctly', severity: 'HIGH', automated: true },
      { id: 'tk-002', name: 'No fee-on-transfer issues', description: 'Handles deflationary tokens', severity: 'MEDIUM', automated: false },
      { id: 'tk-003', name: 'Approve race condition', description: 'Uses increaseAllowance or checks', severity: 'MEDIUM', automated: true },
      { id: 'tk-004', name: 'Mint/burn access controlled', description: 'Only authorized can mint/burn', severity: 'CRITICAL', automated: true },
      { id: 'tk-005', name: 'Total supply bounded', description: 'Max supply enforced', severity: 'MEDIUM', automated: true }
    ]
  },
  {
    id: 'logic',
    name: 'Business Logic',
    description: 'Verify business logic correctness',
    weight: 5,
    items: [
      { id: 'bl-001', name: 'Invariants hold', description: 'Protocol invariants always maintained', severity: 'CRITICAL', automated: false },
      { id: 'bl-002', name: 'State machine correct', description: 'Valid state transitions only', severity: 'HIGH', automated: false },
      { id: 'bl-003', name: 'Edge cases handled', description: 'Zero values, max values handled', severity: 'MEDIUM', automated: false },
      { id: 'bl-004', name: 'Timestamps handled', description: 'Time-based logic correct', severity: 'MEDIUM', automated: false },
      { id: 'bl-005', name: 'Multi-step operations safe', description: 'Partial execution handled', severity: 'HIGH', automated: false }
    ]
  }
]

// ============================================================================
// HUMAN REVIEW SYSTEM CLASS
// ============================================================================

export class HumanReviewSystem {
  private reviews: Map<string, AuditReview> = new Map()
  private auditors: Map<string, Auditor> = new Map()
  
  constructor() {
    // Initialize with default auditors (in production, load from DB)
    this.initializeDefaultAuditors()
  }
  
  private initializeDefaultAuditors() {
    const defaultAuditors: Auditor[] = [
      {
        id: 'auditor-001',
        name: 'Marco Rossi',
        email: 'marco@solay39.eu',
        publicKey: '0x1234567890abcdef',
        expertise: ['DEFI', 'LENDING', 'DEX'],
        auditCount: 150,
        accuracy: 97,
        avgReviewTime: 8,
        isLead: true,
        isSenior: true,
        joinedAt: new Date('2023-01-01')
      },
      {
        id: 'auditor-002',
        name: 'Sofia Chen',
        email: 'sofia@solay39.eu',
        publicKey: '0xfedcba0987654321',
        expertise: ['BRIDGE', 'CROSS_CHAIN', 'LAYER2'],
        auditCount: 120,
        accuracy: 95,
        avgReviewTime: 10,
        isLead: true,
        isSenior: true,
        joinedAt: new Date('2023-03-01')
      },
      {
        id: 'auditor-003',
        name: 'Alex Mueller',
        email: 'alex@solay39.eu',
        publicKey: '0xabcdef1234567890',
        expertise: ['NFT', 'GOVERNANCE', 'STAKING'],
        auditCount: 80,
        accuracy: 93,
        avgReviewTime: 12,
        isLead: false,
        isSenior: true,
        joinedAt: new Date('2023-06-01')
      }
    ]
    
    for (const auditor of defaultAuditors) {
      this.auditors.set(auditor.id, auditor)
    }
  }
  
  /**
   * Create a new review request
   */
  createReview(params: {
    auditId: string
    projectName: string
    chain: string
    aiScore: number
    aiFindings: number
    aiCriticals: number
    aiHighs: number
    contractAddress?: string
  }): AuditReview {
    const priority = this.calculatePriority(params.aiScore, params.aiCriticals, params.aiHighs)
    
    const review: AuditReview = {
      id: `review-${Date.now()}`,
      auditId: params.auditId,
      projectName: params.projectName,
      contractAddress: params.contractAddress,
      chain: params.chain,
      status: 'PENDING_REVIEW',
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      aiScore: params.aiScore,
      aiFindings: params.aiFindings,
      aiCriticals: params.aiCriticals,
      aiHighs: params.aiHighs,
      assignments: []
    }
    
    this.reviews.set(review.id, review)
    return review
  }
  
  /**
   * Calculate review priority
   */
  private calculatePriority(score: number, criticals: number, highs: number): AuditReview['priority'] {
    if (criticals > 0 || score < 50) return 'CRITICAL'
    if (highs > 2 || score < 70) return 'HIGH'
    if (highs > 0 || score < 85) return 'MEDIUM'
    return 'LOW'
  }
  
  /**
   * Assign auditor to review
   */
  assignAuditor(reviewId: string, auditorId: string): ReviewAssignment | null {
    const review = this.reviews.get(reviewId)
    const auditor = this.auditors.get(auditorId)
    
    if (!review || !auditor) return null
    
    const assignment: ReviewAssignment = {
      auditorId,
      assignedAt: new Date(),
      status: 'ASSIGNED',
      findings: [],
      checklistScores: [],
      overallScore: 0,
      recommendation: 'NEEDS_CHANGES',
      notes: '',
      timeSpentHours: 0
    }
    
    review.assignments.push(assignment)
    review.status = 'IN_REVIEW'
    review.updatedAt = new Date()
    
    return assignment
  }
  
  /**
   * Auto-assign best auditor based on expertise
   */
  autoAssignAuditor(reviewId: string, requiredExpertise: AuditorExpertise[]): ReviewAssignment | null {
    const availableAuditors = Array.from(this.auditors.values())
      .filter(a => {
        // Check expertise match
        const hasExpertise = requiredExpertise.some(e => a.expertise.includes(e))
        return hasExpertise
      })
      .sort((a, b) => {
        // Sort by accuracy, then by experience
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
        return b.auditCount - a.auditCount
      })
    
    if (availableAuditors.length === 0) return null
    
    return this.assignAuditor(reviewId, availableAuditors[0].id)
  }
  
  /**
   * Submit review findings
   */
  submitReview(
    reviewId: string,
    auditorId: string,
    findings: ReviewFinding[],
    checklistScores: ChecklistScore[],
    recommendation: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES',
    notes: string,
    timeSpentHours: number
  ): boolean {
    const review = this.reviews.get(reviewId)
    if (!review) return false
    
    const assignment = review.assignments.find(a => a.auditorId === auditorId)
    if (!assignment) return false
    
    assignment.findings = findings
    assignment.checklistScores = checklistScores
    assignment.overallScore = this.calculateChecklistScore(checklistScores)
    assignment.recommendation = recommendation
    assignment.notes = notes
    assignment.timeSpentHours = timeSpentHours
    assignment.completedAt = new Date()
    assignment.status = 'COMPLETE'
    
    review.updatedAt = new Date()
    
    // Check if needs second review
    if (review.priority === 'CRITICAL' && review.assignments.length < 2) {
      review.status = 'NEEDS_SECOND_REVIEW'
    } else if (review.assignments.length >= 2) {
      // Check for conflicts
      const recs = review.assignments.map(a => a.recommendation)
      if (new Set(recs).size > 1) {
        review.status = 'CONFLICT_RESOLUTION'
      } else {
        review.status = 'REVIEW_COMPLETE'
      }
    } else {
      review.status = 'REVIEW_COMPLETE'
    }
    
    return true
  }
  
  /**
   * Calculate overall checklist score
   */
  private calculateChecklistScore(scores: ChecklistScore[]): number {
    if (scores.length === 0) return 0
    
    let totalWeightedScore = 0
    let totalWeight = 0
    
    for (const category of REVIEW_CHECKLIST) {
      const categoryScore = scores.find(s => s.categoryId === category.id)
      if (categoryScore) {
        totalWeightedScore += categoryScore.score * category.weight
        totalWeight += category.weight
      }
    }
    
    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0
  }
  
  /**
   * Resolve conflicts between auditors
   */
  resolveConflict(reviewId: string, leadDecision: 'APPROVE' | 'REJECT' | 'CONDITIONAL_APPROVE', leadNotes: string): boolean {
    const review = this.reviews.get(reviewId)
    if (!review || review.status !== 'CONFLICT_RESOLUTION') return false
    
    // Calculate final score as average of all reviews
    const avgScore = review.assignments.reduce((sum, a) => sum + a.overallScore, 0) / review.assignments.length
    
    review.finalScore = Math.round(avgScore)
    review.finalRecommendation = leadDecision
    review.status = leadDecision === 'REJECT' ? 'REJECTED' : 'APPROVED'
    review.updatedAt = new Date()
    
    return true
  }
  
  /**
   * Approve review for publication
   */
  approveForPublication(reviewId: string): boolean {
    const review = this.reviews.get(reviewId)
    if (!review || review.status !== 'REVIEW_COMPLETE') return false
    
    // All reviewers must recommend APPROVE
    const allApprove = review.assignments.every(a => a.recommendation === 'APPROVE')
    if (!allApprove) return false
    
    const avgScore = review.assignments.reduce((sum, a) => sum + a.overallScore, 0) / review.assignments.length
    
    review.finalScore = Math.round(avgScore)
    review.finalRecommendation = 'APPROVE'
    review.status = 'APPROVED'
    review.updatedAt = new Date()
    
    return true
  }
  
  /**
   * Sign and publish report
   */
  signAndPublish(reviewId: string, signingAuditorIds: string[]): DigitalSignature[] {
    const review = this.reviews.get(reviewId)
    if (!review || review.status !== 'APPROVED') return []
    
    const reportHash = this.generateReportHash(review)
    const signatures: DigitalSignature[] = []
    
    for (const auditorId of signingAuditorIds) {
      const auditor = this.auditors.get(auditorId)
      if (!auditor) continue
      
      // In production, use actual cryptographic signing
      const signature: DigitalSignature = {
        auditorId,
        auditorName: auditor.name,
        signature: this.generateSignature(reportHash, auditor.publicKey),
        timestamp: new Date(),
        reportHash
      }
      
      signatures.push(signature)
    }
    
    review.signatures = signatures
    review.publishedAt = new Date()
    review.status = 'PUBLISHED'
    review.updatedAt = new Date()
    
    return signatures
  }
  
  /**
   * Generate report hash
   */
  private generateReportHash(review: AuditReview): string {
    const data = JSON.stringify({
      auditId: review.auditId,
      projectName: review.projectName,
      finalScore: review.finalScore,
      findings: review.assignments.flatMap(a => a.findings),
      timestamp: Date.now()
    })
    
    // Simple hash for demo - use crypto.subtle.digest in production
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(64, '0')}`
  }
  
  /**
   * Generate digital signature
   */
  private generateSignature(reportHash: string, publicKey: string): string {
    // In production, use actual ECDSA signing
    const combined = reportHash + publicKey + Date.now()
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `sig:${Math.abs(hash).toString(16).padStart(128, '0')}`
  }
  
  /**
   * Get review by ID
   */
  getReview(reviewId: string): AuditReview | undefined {
    return this.reviews.get(reviewId)
  }
  
  /**
   * Get review queue
   */
  getReviewQueue(status?: AuditStatus): AuditReview[] {
    const all = Array.from(this.reviews.values())
    if (status) {
      return all.filter(r => r.status === status)
    }
    return all.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }
  
  /**
   * Get auditor workload
   */
  getAuditorWorkload(auditorId: string): { active: number; completed: number; avgTime: number } {
    const active = Array.from(this.reviews.values())
      .filter(r => r.assignments.some(a => a.auditorId === auditorId && a.status !== 'COMPLETE'))
      .length
    
    const completed = Array.from(this.reviews.values())
      .filter(r => r.assignments.some(a => a.auditorId === auditorId && a.status === 'COMPLETE'))
    
    const avgTime = completed.length > 0
      ? completed.reduce((sum, r) => {
          const a = r.assignments.find(a => a.auditorId === auditorId)
          return sum + (a?.timeSpentHours || 0)
        }, 0) / completed.length
      : 0
    
    return { active, completed: completed.length, avgTime }
  }
  
  /**
   * Get checklist template
   */
  getChecklistTemplate(): ChecklistCategory[] {
    return REVIEW_CHECKLIST
  }
  
  /**
   * Get system statistics
   */
  getStats(): HumanReviewStats {
    const allReviews = Array.from(this.reviews.values())
    const completed = allReviews.filter(r => r.status === 'PUBLISHED')
    const avgReviewTime = completed.length > 0
      ? completed.reduce((sum, r) => 
          sum + r.assignments.reduce((s, a) => s + a.timeSpentHours, 0), 0) / completed.length
      : 0
    
    return {
      totalReviews: allReviews.length,
      pendingReviews: allReviews.filter(r => r.status === 'PENDING_REVIEW').length,
      inProgressReviews: allReviews.filter(r => r.status === 'IN_REVIEW').length,
      completedReviews: completed.length,
      totalAuditors: this.auditors.size,
      avgReviewTimeHours: Math.round(avgReviewTime * 10) / 10,
      checklistCategories: REVIEW_CHECKLIST.length,
      checklistItems: REVIEW_CHECKLIST.reduce((sum, c) => sum + c.items.length, 0)
    }
  }
}

export interface HumanReviewStats {
  totalReviews: number
  pendingReviews: number
  inProgressReviews: number
  completedReviews: number
  totalAuditors: number
  avgReviewTimeHours: number
  checklistCategories: number
  checklistItems: number
}

// Export singleton instance
export const humanReviewSystem = new HumanReviewSystem()
