"use client"

import { useEffect, useState } from "react"
import type { PortfolioProject } from "@/lib/solay39-constants"
import { assertDraftSaved } from "@/lib/audit-draft"

/** Local data is only a recovery candidate, never a public report substitute. */
export function AuditDraftRecovery({ auditId }: { auditId: string }) {
  const [backup, setBackup] = useState<PortfolioProject | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    fetch("/api/founder/session", { cache: "no-store" }).then(r => r.json()).then(session => {
      if (!session.authenticated || cancelled) return
      const records: unknown = JSON.parse(localStorage.getItem("solay39_portfolio") || "[]")
      if (Array.isArray(records)) setBackup(records.find(p => p?.id === auditId && typeof p?.name === "string") ?? null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [auditId])
  if (!backup) return null
  return <section className="mt-8 max-w-md mx-auto border border-cyan-800 p-5 text-left space-y-3">
    <h2 className="text-base text-s39-white">Founder recovery</h2>
    <p className="text-sm leading-relaxed text-s39-lite">
      A backup of {backup.name} exists in this browser, but it is not a public report.
      Restore it to server storage as an unverified preliminary assessment.
    </p>
    <button type="button" disabled={busy} className="min-h-11 border border-cyan-700 px-4 py-2 text-sm text-cyan-300 disabled:opacity-50"
      onClick={async () => {
        setBusy(true); setError("")
        try {
          const res = await fetch("/api/audits", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audit: backup }) })
          const receipt = await res.json()
          const path = assertDraftSaved(res.ok, receipt)
          if (path !== `/audit/${auditId}`) throw new Error("Saved report identity does not match")
          window.location.reload()
        } catch (e) { setError(e instanceof Error ? e.message : "Restore failed") }
        finally { setBusy(false) }
      }}>{busy ? "Saving to server..." : "Restore preliminary report"}</button>
    {error && <p role="alert" className="text-sm text-red-300 break-words">{error}</p>}
  </section>
}
