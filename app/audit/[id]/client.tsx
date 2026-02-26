"use client"

import { useState, useEffect } from "react"
import { ProjectDetail, getPublishedAudits } from "@/components/skynet-public"
import { type PortfolioProject } from "@/lib/solay39-constants"

export function AuditDetailClient({ project, auditId }: { project: PortfolioProject | null; auditId: string }) {
  const [liveProject, setLiveProject] = useState<PortfolioProject | null>(project)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(!project)

  // If server didn't find it, check localStorage then Blob API
  useEffect(() => {
    const published = getPublishedAudits()

    if (!project) {
      // Server didn't find it -- look in localStorage by ID
      const local = published.find((p) => p.id === auditId)
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
          p.name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            project.name.toLowerCase().replace(/[^a-z0-9]/g, "")
      )
      if (local) {
        setLiveProject({
          ...project,
          ...local,
          findings: local.findings?.length ? local.findings : project.findings,
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
    <ProjectDetail
      p={liveProject}
      backHref="/"
      isLive={isLive}
    />
  )
}
