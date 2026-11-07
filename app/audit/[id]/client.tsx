"use client"

import { useState, useEffect, Component, type ReactNode } from "react"
import { ProjectDetail } from "@/components/skynet-public"
import { isVerifiedReport, type PortfolioProject } from "@/lib/solay39-constants"
import { PreliminaryAuditReport } from "@/components/preliminary-audit-report"
import { AuditDraftRecovery } from "@/components/audit-draft-recovery"
import { recordIssues, type RecordIssue } from "@/lib/preliminary-report"

// Error boundary to catch rendering crashes in ProjectDetail
class AuditErrorBoundary extends Component<{ children: ReactNode; auditId: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; auditId: string }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { console.error("[Solay39] ProjectDetail crash:", error.message) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-s39-bg0 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-[9px] text-red-400 tracking-[0.15em] mb-3 font-mono">RENDER ERROR</div>
            <h1 className="text-xl font-bold text-s39-white mb-3 font-mono">Failed to render audit report</h1>
            <p className="text-[10px] text-s39-dim mb-6 leading-relaxed">
              The audit data may be incomplete or corrupted. Try reloading or running the audit again.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
                className="text-[9px] text-s39-green border border-s39-green/30 px-4 py-2 font-mono tracking-wider hover:bg-s39-green/5 transition-colors cursor-pointer bg-transparent">
                RELOAD
              </button>
              <a href="/" className="text-[9px] text-s39-cyan border border-s39-cyan/30 px-4 py-2 font-mono tracking-wider hover:bg-s39-cyan/5 transition-colors no-underline">
                BACK TO PORTFOLIO
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function enforceEvidenceOnlyReport(input: PortfolioProject): PortfolioProject {
  const integrity = input.reportIntegrity as { sourceSha256?: string; artifacts?: Record<string, string>; ciStatus?: string } | undefined
  const hasCiEvidence = Boolean(integrity?.sourceSha256 && integrity?.artifacts && Object.keys(integrity.artifacts).length > 0)
  if (hasCiEvidence) return input

  return {
    ...input,
    score: 0,
    rating: "PENDING",
    finalAssessment: {
      ...input.finalAssessment,
      securityPosture: "Automated scan with pending manual review.",
      productionReadiness: "Not assessed until CI artifacts and manual sign-off are verified.",
      keyRisksToMonitor: input.finalAssessment?.keyRisksToMonitor || ["CI evidence", "Manual reviewer sign-off"],
    },
    engagement: input.engagement ? {
      ...input.engagement,
      numberOfAuditors: 0,
      engineeringHours: 0,
      securityEngineersInvolved: 0,
      leadAuditor: "Not assigned",
      reviewTeam: {
        ...input.engagement.reviewTeam,
        leadAuditor: { name: "Pending reviewer", role: "Manual reviewer", credentials: "Not verified", signedOff: false },
        reviewStatus: "AUTOMATED_ANALYSIS_PENDING_MANUAL_REVIEW",
        note: "Human review, reviewer identity, and CI evidence are not verified for this report.",
      },
    } : input.engagement,
    testingMethodology: {
      ...input.testingMethodology,
      manualReviewHours: 0,
      reviewPhases: ["Automated analysis", "Evidence pending", "Manual review pending"],
      staticAnalysisTools: input.testingMethodology?.staticAnalysisTools || [],
      fuzzingApplied: false,
      symbolicExecution: false,
      assumptions: ["Only submitted source is in scope", "CI evidence is pending"],
      limitations: ["No manual review", "No protocol-specific fuzzing or formal verification"],
    },
    manualReview: undefined,
    auditorSignatures: undefined,
    formalVerification: undefined,
  }
}

function isPendingVerification(project: PortfolioProject | null): boolean {
  if (!project) return true
  const integrity = project.reportIntegrity as { sourceSha256?: string; artifacts?: Record<string, string> } | undefined
  const hasCiEvidence = Boolean(
    integrity?.sourceSha256 &&
    integrity?.artifacts &&
    Object.keys(integrity.artifacts).length > 0
  )
  const hasRealScore = Number(project.score ?? 0) > 0
  return !hasCiEvidence || !hasRealScore
}

export function AuditDetailClient({ project, auditId, declarationIssues }: { project: PortfolioProject | null; auditId: string; declarationIssues?: RecordIssue[] }) {
  const [issues, setIssues] = useState<RecordIssue[]>(declarationIssues ?? (project ? recordIssues(project) : []))
  const [liveProject, setLiveProject] = useState<PortfolioProject | null>(project ? enforceEvidenceOnlyReport(project) : null)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(!project)

  // Public report identity comes only from the server. A local draft is not a publication.
  useEffect(() => {
    if (project) {
      setIssues(declarationIssues ?? recordIssues(project))
      setLiveProject(enforceEvidenceOnlyReport(project))
      setLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setLiveProject(null)
    setIssues([])
    setLoading(true)
    fetch(`/api/audits?id=${encodeURIComponent(auditId)}`, {
      cache: "no-store", signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.audit) {
          setIssues(recordIssues(data.audit))
          setLiveProject(enforceEvidenceOnlyReport(data.audit))
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [project, auditId, declarationIssues])

  // Fetch live price
  useEffect(() => {
    if (!liveProject?.ticker && !liveProject?.contractAddress) return
    let mounted = true

    async function fetchPrice() {
      try {
        const extra = liveProject?.ticker && liveProject?.contractAddress
          ? `?extra=${liveProject.ticker}:${liveProject.contractAddress}:${liveProject.network || "Ethereum"}`
          : ""
        const res = await fetch(`/api/prices${extra}`)
        if (!res.ok) return
        const data = await res.json()
        const lp = liveProject?.ticker ? data.prices?.[liveProject.ticker] : null
        if (mounted && lp) {
          setLiveProject((prev) => prev ? ({
            ...prev,
            price: lp.price || prev.price,
            change24h: lp.change24h || prev.change24h,
            tvl: lp.marketCap || prev.tvl,
          }) : prev)
          setIsLive(true)
        }
      } catch {
        // non-critical
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [liveProject?.ticker, liveProject?.contractAddress])

  // Loading state (checking canonical server storage)
  if (loading) {
    return (
      <div className="min-h-dvh bg-s39-bg0 flex items-center justify-center">
        <div className="text-[10px] text-s39-cyan tracking-[0.15em] animate-pulse">
          LOADING AUDIT REPORT...
        </div>
      </div>
    )
  }

  // Not found anywhere
  if (!liveProject) {
    return (
      <div className="min-h-dvh bg-s39-bg0 flex items-center justify-center px-5 py-8">
        <div className="text-center w-full max-w-lg">
          <div className="text-sm text-red-300 tracking-[0.15em] mb-4">AUDIT NOT FOUND</div>
          <h1 className="text-xl font-bold text-s39-white mb-4 font-mono">Report does not exist</h1>
          <p className="text-sm text-s39-lite mb-6 max-w-sm mx-auto leading-relaxed">
            No server-persisted report exists for this ID. A successful GitHub workflow alone does not publish an audit.
          </p>
          <a
            href="/"
            className="inline-flex min-h-11 items-center text-sm text-s39-cyan border border-s39-cyan/30 px-4 py-2 tracking-widest hover:bg-s39-cyan/5 transition-colors no-underline font-mono"
          >
            {"<- BACK TO PORTFOLIO"}
          </a>
          <AuditDraftRecovery auditId={auditId} />
        </div>
      </div>
    )
  }

  const pendingVerification = isPendingVerification(liveProject)

  if (pendingVerification || !isVerifiedReport(liveProject)) {
    return <PreliminaryAuditReport project={liveProject} declarationIssues={issues} />
  }

  return (
    <div className="relative">
      <AuditErrorBoundary auditId={auditId}>
        <ProjectDetail
          p={liveProject}
          backHref="/"
          isLive={isLive}
        />
      </AuditErrorBoundary>

      {pendingVerification && (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16">
          <div className="border border-[#ffb800]/40 bg-[#05080a]/80 text-[#ffb800] font-mono text-[9px] tracking-[0.25em] uppercase px-4 py-2 shadow-[0_0_20px_rgba(255,184,0,0.15)]">
            PENDING
          </div>
        </div>
      )}
    </div>
  )
}
