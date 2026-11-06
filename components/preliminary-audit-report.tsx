import React from "react"
import type { PortfolioProject } from "../lib/solay39-constants"

/** A pending report must not inherit completion claims from the full report template. */
export function PreliminaryAuditReport({ project }: { project: PortfolioProject }) {
  const findings = Array.isArray(project.findings) ? project.findings : []
  const integrity = project.reportIntegrity as { sourceSha256?: unknown } | undefined
  const sourceHash = typeof integrity?.sourceSha256 === "string" ? integrity.sourceSha256 : undefined
  return (
    <main className="min-h-dvh bg-s39-bg0 text-s39-lite [overflow-wrap:anywhere] px-5 py-8 sm:px-8 sm:py-12">
      <article className="max-w-4xl mx-auto space-y-8">
        <a href="/" className="inline-flex items-center min-h-11 text-sm text-s39-cyan underline underline-offset-4">
          Back to portfolio
        </a>
        <header className="space-y-3">
          <p className="text-sm font-mono text-s39-mid">SOLAY39 / PRELIMINARY REPORT</p>
          <h1 className="text-xl font-bold text-s39-white">{project.name || "Smart contract assessment"}</h1>
          <p className="text-base leading-relaxed">
            Evidence verification and founder review are pending. This record is not a completed security audit,
            certification, or deployment recommendation. No verified security score is available.
          </p>
        </header>
        <section aria-labelledby="scope-title" className="space-y-4">
          <h2 id="scope-title" className="text-lg font-semibold text-s39-white">Declared scope</h2>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            {[
              ["Report ID", project.id],
              ["Network", project.network],
              ["Contract address", project.contractAddress],
              ["Source SHA-256 (declared, not validated here)", sourceHash],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <dt className="text-s39-mid">{label}</dt>
                <dd className="font-mono break-all">{value || "Not provided"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="evidence-title" className="space-y-3">
          <h2 id="evidence-title" className="text-lg font-semibold text-s39-white">Evidence required before final approval</h2>
          <ul className="list-disc pl-5 space-y-2 text-base leading-relaxed">
            <li>Exact source files, compiler configuration and immutable source digest.</li>
            <li>Captured tool outputs bound to that source, including failures and skipped checks.</li>
            <li>Manual validation of findings and dispositions, signed exclusively by the founder.</li>
            <li>Execution artifacts for any claimed exploit reproduction, fuzzing or formal verification.</li>
          </ul>
          <p className="text-sm text-s39-mid">Missing evidence does not imply that the contract is safe or vulnerable.</p>
        </section>
        <section aria-labelledby="findings-title" className="space-y-5">
          <h2 id="findings-title" className="text-lg font-semibold text-s39-white">Submitted findings awaiting validation ({findings.length})</h2>
          {findings.length === 0 && <p className="text-base">No findings were supplied in this record. This is not proof of security.</p>}
          {findings.map((finding, index) => (
            <article key={`${finding.location}-${index}`} className="bg-s39-bg1 p-5 space-y-3">
              <p className="text-sm font-mono text-s39-mid">{finding.severity} / SUBMITTED, NOT VALIDATED</p>
              <h3 className="text-base font-semibold text-s39-white">{finding.title}</h3>
              <p className="text-sm font-mono break-words">{finding.location || "Location not supplied"}</p>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{finding.description}</p>
              {finding.impact && <p className="text-base leading-relaxed">Declared impact: {finding.impact}</p>}
              {finding.recommendation && <p className="text-base leading-relaxed">Proposed remediation: {finding.recommendation}</p>}
            </article>
          ))}
        </section>
        <footer className="text-sm text-s39-mid leading-relaxed">
          Approval is reserved to the founder. This preliminary view intentionally omits unverified ratings,
          review hours, coverage percentages, execution claims and attestations.
        </footer>
      </article>
    </main>
  )
}
