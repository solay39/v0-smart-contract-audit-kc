"use client"

import { useEffect, useRef, useState } from "react"
import type { DirectorySnapshot } from "../lib/skynet-directory"
import type { PortfolioProject } from "../lib/solay39-constants"
import { SkynetDiscovery } from "./skynet-discovery"
import { ProjectSecurityProfile } from "./project-security-profile"

/** Private static preview only. Uses exactly the production UI components. */
export function SkynetPreviewApp({
  snapshot,
  reports,
}: {
  snapshot: DirectorySnapshot
  reports: PortfolioProject[]
}) {
  const selectedId = () =>
    new URL(window.location.href).searchParams.get("project")
  const [id, setId] = useState<string | null>(selectedId)
  const scroll = useRef(0)
  const directory = useRef<HTMLDivElement>(null)
  const restoring = useRef(false)
  useEffect(() => {
    const pop = () => {
      restoring.current = true
      setId(selectedId())
    }
    window.addEventListener("popstate", pop)
    return () => window.removeEventListener("popstate", pop)
  }, [])
  useEffect(() => {
    if (!id && restoring.current) {
      restoring.current = false
      window.scrollTo(0, scroll.current)
      directory.current
        ?.querySelector<HTMLElement>("[data-testid^='report-']")
        ?.focus({ preventScroll: true })
    }
  }, [id])
  function navigate(next: string | null) {
    if (next) scroll.current = window.scrollY
    else restoring.current = true
    const url = new URL(window.location.href)
    if (next) url.searchParams.set("project", next)
    else url.searchParams.delete("project")
    url.hash = ""
    window.history.pushState({}, "", url)
    setId(next)
    if (next) window.scrollTo(0, 0)
  }
  const report = reports.find((p) => p.id === id)
  return (
    <>
      <div ref={directory} hidden={Boolean(id)}>
        <SkynetDiscovery
          initialSnapshot={snapshot}
          preview
          onOpenReport={(next) => navigate(next)}
        />
      </div>
      {id &&
        (report ? (
          <ProjectSecurityProfile
            key={id}
            project={report}
            preview
            onBack={() => navigate(null)}
          />
        ) : (
          <main
            style={{
              padding: 24,
              fontFamily: "Arial,sans-serif",
              background: "#fff",
              color: "#253b2b",
              minHeight: "100dvh",
            }}
          >
            <h1>Preview record unavailable</h1>
            <p>
              No public snapshot record matches this ID. No audit has been
              created or estimated.
            </p>
            <button type="button" onClick={() => navigate(null)}>
              Back to project directory
            </button>
          </main>
        ))}
    </>
  )
}
