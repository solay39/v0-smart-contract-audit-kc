"use client"

import { useState, useEffect, Component, type ReactNode } from "react"
import { ProjectDetail, getPublishedAudits } from "@/components/skynet-public"
import { type PortfolioProject } from "@/lib/solay39-constants"

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

export function AuditDetailClient({ project, auditId }: { project: PortfolioProject | null; auditId: string }) {
  const [liveProject, setLiveProject] = useState<PortfolioProject | null>(project)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(!project)

  // If server didn't find it, check localStorage then Blob API
  useEffect(() => {
    const published = getPublishedAudits()
    // Normalize ID for comparison (handle URL-encoded and special chars)
    const normalizedId = decodeURIComponent(auditId).toLowerCase().replace(/[^a-z0-9-]/g, "")

    if (!project) {
      // Server didn't find it -- look in localStorage by ID (exact match first, then normalized)
      let local = published.find((p) => p.id === auditId)
      if (!local) {
        // Try normalized comparison
        local = published.find((p) => p.id.toLowerCase().replace(/[^a-z0-9-]/g, "") === normalizedId)
      }
      if (local) {
        setLiveProject(local)
        setLoading(false)
      } else {
        // Last resort: try Blob API (handles cross-device access)
        fetch(`/api/audits?id=${encodeURIComponent(auditId)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.audit) {
              setLiveProject(data.audit)
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      }
    } else {
      // Server found it -- merge with any richer local data
      const local = published.find(
        (p) =>
          p.id === project.id ||
          (p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "") ===
            (project.name || "").toLowerCase().replace(/[^a-z0-9]/g, "")
      )
      if (local) {
        // Merge: local data on top but blob enterprise fields take priority
        setLiveProject({
          ...project,
          ...local,
          findings: local.findings?.length ? local.findings : project.findings,
          // Enterprise fields: prefer server/blob version (more complete)
          signedReport: project.signedReport || local.signedReport,
          onChainRecord: project.onChainRecord || local.onChainRecord,
          reportIntegrity: project.reportIntegrity || local.reportIntegrity,
          scopeTable: project.scopeTable || local.scopeTable,
          engagement: project.engagement || local.engagement,
          reviewRecord: project.reviewRecord || local.reviewRecord,
          attackerProfiles: project.attackerProfiles || local.attackerProfiles,
          assetsAtRisk: project.assetsAtRisk || local.assetsAtRisk,
          enterpriseTrustAssumptions: project.enterpriseTrustAssumptions || local.enterpriseTrustAssumptions,
          formalVerification: project.formalVerification || local.formalVerification,
          residualRisk: project.residualRisk || local.residualRisk,
          economicAttackVectors: project.economicAttackVectors || local.economicAttackVectors,
          exploitSimulation: project.exploitSimulation || local.exploitSimulation,
          ipfsRecord: project.ipfsRecord || local.ipfsRecord,
          pocScripts: project.pocScripts || local.pocScripts,
          codeReference: project.codeReference || local.codeReference,
          auditorSignatures: project.auditorSignatures || local.auditorSignatures,
          testCoverage: project.testCoverage || local.testCoverage,
          solanaAttestation: project.solanaAttestation || local.solanaAttestation,
          // Manual Review + Security Checklist + On-Chain Analysis
          manualReview: project.manualReview || local.manualReview,
          securityChecklist: project.securityChecklist || local.securityChecklist,
          onChainAnalysis: project.onChainAnalysis || local.onChainAnalysis,
        })
      }
      setLoading(false)
    }
  }, [project, auditId])

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

  // Loading state (checking localStorage)
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
      <div className="min-h-dvh bg-s39-bg0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-[9px] text-s39-red tracking-[0.15em] mb-4">AUDIT NOT FOUND</div>
          <h1 className="text-xl font-bold text-s39-white mb-4 font-mono">Report does not exist</h1>
          <p className="text-[10px] text-s39-dim mb-6 max-w-sm mx-auto leading-relaxed">
            This audit report does not exist or may have been removed. Check the URL and try again.
          </p>
          <a
            href="/"
            className="text-[10px] text-s39-cyan border border-s39-cyan/30 px-4 py-2 tracking-widest hover:bg-s39-cyan/5 transition-colors no-underline font-mono"
          >
            {"<- BACK TO PORTFOLIO"}
          </a>
        </div>
      </div>
    )
  }

  return (
    <AuditErrorBoundary auditId={auditId}>
      <ProjectDetail
        p={liveProject}
        backHref="/"
        isLive={isLive}
      />
    </AuditErrorBoundary>
  )
}
