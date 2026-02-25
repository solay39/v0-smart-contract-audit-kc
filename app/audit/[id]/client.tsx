"use client"

import { useState, useEffect } from "react"
import { ProjectDetail, getPublishedAudits } from "@/components/skynet-public"
import { type PortfolioProject } from "@/lib/solay39-constants"

export function AuditDetailClient({ project }: { project: PortfolioProject }) {
  const [liveProject, setLiveProject] = useState<PortfolioProject>(project)
  const [isLive, setIsLive] = useState(false)

  // Check if user has a locally published version with richer data
  useEffect(() => {
    const published = getPublishedAudits()
    const local = published.find(
      (p) =>
        p.id === project.id ||
        p.name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
          project.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    )
    if (local) {
      // Merge: server data as base, local overrides where richer
      setLiveProject({
        ...project,
        ...local,
        findings: local.findings?.length ? local.findings : project.findings,
      })
    }
  }, [project])

  // Fetch live price
  useEffect(() => {
    if (!liveProject.ticker && !liveProject.contractAddress) return
    let mounted = true

    async function fetchPrice() {
      try {
        const extra = liveProject.ticker && liveProject.contractAddress
          ? `?extra=${liveProject.ticker}:${liveProject.contractAddress}`
          : ""
        const res = await fetch(`/api/prices${extra}`)
        if (!res.ok) return
        const data = await res.json()
        const lp = liveProject.ticker ? data.prices?.[liveProject.ticker] : null
        if (mounted && lp) {
          setLiveProject((prev) => ({
            ...prev,
            price: lp.price || prev.price,
            change24h: lp.change24h || prev.change24h,
            tvl: lp.marketCap || prev.tvl,
          }))
          setIsLive(true)
        }
      } catch {
        // non-critical
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [liveProject.ticker, liveProject.contractAddress])

  return (
    <ProjectDetail
      p={liveProject}
      backHref="/"
      isLive={isLive}
    />
  )
}
