"use client"

import { useState, useEffect, Component, type ReactNode } from "react"
import { ProjectDetail, getPublishedAudits } from "@/components/skynet-public"
import { type PortfolioProject } from "@/lib/solay39-constants"

// ── React Error Boundary to catch rendering crashes ──
class AuditErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error) {
    console.error("[Solay39] ProjectDetail render error:", error)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ── Ensure all required fields exist with safe defaults ──
function sanitizeProject(p: PortfolioProject): PortfolioProject {
  return {
    ...p,
    id: p.id || "unknown",
    name: p.name || "Unknown Contract",
    score: p.score ?? 0,
    criticals: p.criticals ?? p.findings?.filter(f => f.severity === "CRITICAL").length ?? 0,
    highs: p.highs ?? p.findings?.filter(f => f.severity === "HIGH").length ?? 0,
    mediums: p.mediums ?? p.findings?.filter(f => f.severity === "MEDIUM").length ?? 0,
    lows: p.lows ?? p.findings?.filter(f => f.severity === "LOW").length ?? 0,
    infos: p.infos ?? p.findings?.filter(f => f.severity === "INFO").length ?? 0,
    findings: p.findings || [],
    network: p.network || "BSC",
  }
}

export function AuditDetailClient({ project, auditId }: { project: PortfolioProject | null; auditId: string }) {
  const [liveProject, setLiveProject] = useState<PortfolioProject | null>(project ? sanitizeProject(project) : null)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(!project)

  // If server didn't find it, check localStorage then Blob API
  useEffect(() => {
    const published = getPublishedAudits()

    if (!project) {
      // Server didn't find it -- look in localStorage by ID
      const local = published.find((p) => p.id === auditId)
      if (local) {
        setLiveProject(sanitizeProject(local))
        setLoading(false)
      } else {
        // Last resort: try Blob API (handles cross-device access)
        fetch(`/api/audits?id=${encodeURIComponent(auditId)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.audit) {
              setLiveProject(sanitizeProject(data.audit))
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
        setLiveProject(sanitizeProject({
          ...project,
          ...local,
          findings: local.findings?.length ? local.findings : project.findings,
        }))
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
          setLiveProject((prev) => prev ? sanitizeProject({
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

  // Loading state
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

  const errorFallback = (
    <div className="min-h-dvh bg-[#0a0e14] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-[9px] text-[#ff3b5c] tracking-[0.15em] mb-4 font-mono">RENDER ERROR</div>
        <h1 className="text-xl font-bold text-[#e0eaf0] mb-4 font-mono">Failed to render audit report</h1>
        <p className="text-[10px] text-[#4e6070] mb-6 leading-relaxed font-mono">
          The audit data may be incomplete or corrupted. Try reloading or running the audit again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="text-[10px] text-[#00ff88] border border-[#00ff8833] px-4 py-2 tracking-widest hover:bg-[#00ff8808] transition-colors font-mono bg-transparent cursor-pointer"
          >
            RELOAD
          </button>
          <a
            href="/"
            className="text-[10px] text-[#00e5ff] border border-[#00e5ff33] px-4 py-2 tracking-widest hover:bg-[#00e5ff08] transition-colors no-underline font-mono"
          >
            BACK TO PORTFOLIO
          </a>
        </div>
      </div>
    </div>
  )

  return (
    <AuditErrorBoundary fallback={errorFallback}>
      <ProjectDetail
        p={liveProject}
        backHref="/"
        isLive={isLive}
      />
    </AuditErrorBoundary>
  )
}
