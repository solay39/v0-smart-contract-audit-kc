"use client"

import Link from "next/link"
import { ScoreBadge } from "@/components/ScoreBadge"
import { SecurityScoreRing } from "@/components/SecurityScoreRing"
import { hasEnoughEvidence } from "@/lib/verification"
import type { AuditProject } from "@/lib/types"

type Props = { project: AuditProject }
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

const severityStyles: Record<Severity, string> = {
  CRITICAL: "border-rose-400/25 bg-rose-400/[0.07] text-rose-300",
  HIGH: "border-orange-400/25 bg-orange-400/[0.07] text-orange-300",
  MEDIUM: "border-amber-300/25 bg-amber-300/[0.07] text-amber-200",
  LOW: "border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-200",
}

export function AuditEnterpriseDetail({ project }: Props) {
  const evidence = project.evidence
  const verified = hasEnoughEvidence(evidence) && project.score !== null && project.score !== undefined
  const score = verified ? project.score : null

  const findings: { severity: Severity; count: number }[] = [
    { severity: "CRITICAL", count: project.findings.critical },
    { severity: "HIGH", count: project.findings.high },
    { severity: "MEDIUM", count: project.findings.medium },
    { severity: "LOW", count: project.findings.low },
  ]
  const totalFindings = findings.reduce((sum, finding) => sum + finding.count, 0)

  const evidenceItems = [
    { label: "Report hash", value: evidence.reportHash, present: Boolean(evidence.reportHash?.trim()) },
    { label: "Source commit", value: evidence.commitHash, present: Boolean(evidence.commitHash?.trim()) },
    { label: "Reviewers", value: evidence.reviewerNames?.join(", "), present: Boolean(evidence.reviewerNames?.length) },
    { label: "CI artifacts", value: evidence.ciArtifacts?.length ? `${evidence.ciArtifacts.length} supplied` : undefined, present: Boolean(evidence.ciArtifacts?.length) },
    { label: "Attestations", value: `${evidence.attestationCount ?? 0} / 2 required`, present: Number(evidence.attestationCount ?? 0) >= 2 },
  ]
  const artifactUrls = (evidence.ciArtifacts ?? []).filter((item) => /^https:\/\//i.test(item))

  return (
    <div className="min-h-screen bg-[#07090d] text-[#e8edf2]">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#07090d]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/25 text-sm font-bold text-emerald-300">S</span>
            <span className="text-xs font-semibold tracking-[0.18em]">SOLAY39 <span className="font-normal text-slate-500">/ SECURITY</span></span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-5 text-[11px] text-slate-400 sm:gap-7">
            <Link href="/" className="transition hover:text-white">Portfolio</Link>
            <Link href="/benchmark" className="transition hover:text-white">Benchmark</Link>
          </nav>
          <span className={`hidden rounded-full border px-3 py-1 text-[9px] font-medium tracking-[0.14em] sm:inline-flex ${verified ? "border-emerald-300/25 text-emerald-300" : "border-amber-300/25 text-amber-200"}`}>
            {verified ? "EVIDENCE READY" : "PENDING"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/" className="text-[10px] uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-200">← Back to portfolio</Link>

        <section className="mt-7 border-b border-white/[0.08] pb-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg font-semibold text-slate-200">{project.ticker.slice(0, 2)}</div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{project.network} <span className="px-1.5 text-slate-700">/</span> {project.category}</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{project.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{project.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">{project.tags.map((tag) => <span key={tag} className="border border-white/[0.08] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-slate-500">{tag}</span>)}</div>
              </div>
            </div>
            <div className="flex min-w-[220px] flex-col items-start gap-3 md:items-end">
              <ScoreBadge score={score} rating={verified ? project.rating : "PENDING"} evidence={evidence} />
              <div className="flex gap-5 text-right">
                <div><p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Price</p><p className="mt-1 text-sm text-slate-300">{project.price}</p>{project.change24h && <p className="mt-0.5 text-[10px] text-slate-500">{project.change24h}</p>}</div>
                <div><p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Market cap</p><p className="mt-1 text-sm text-slate-300">{project.marketCap}</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 border-b border-white/[0.08] py-8 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <div className="flex justify-center md:justify-start"><SecurityScoreRing score={score} evidence={evidence} size={188} /></div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Summary label="Critical" value={project.findings.critical} tone="text-rose-300" />
            <Summary label="High" value={project.findings.high} tone="text-orange-300" />
            <Summary label="Medium" value={project.findings.medium} tone="text-amber-200" />
            <Summary label="Low" value={project.findings.low} tone="text-cyan-200" />
            <div className="col-span-2 border-t border-white/[0.07] pt-4 sm:col-span-4">
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">Assessment status</p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                {verified
                  ? "Required evidence fields are present. This indicator does not independently validate the signature or contents of linked artifacts."
                  : "The security score is withheld because required evidence is incomplete. No score or security conclusion is inferred from missing data."}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Report contents</p><h2 className="mt-1 text-lg font-medium text-slate-100">Findings summary</h2></div>
              <span className="text-[10px] text-slate-500">{totalFindings} reported</span>
            </div>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {findings.map((item) => (
                <div key={item.severity} className="grid grid-cols-[100px_48px_minmax(0,1fr)] items-center gap-3 py-4">
                  <span className={`w-fit rounded border px-2 py-1 text-[8px] font-medium tracking-[0.12em] ${severityStyles[item.severity]}`}>{item.severity}</span>
                  <span className="font-mono text-sm text-slate-300">{item.count}</span>
                  <span className="text-[11px] text-slate-500">{item.count === 0 ? "None reported" : "Finding details are not included in this summary record."}</span>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <div className="mb-4"><p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Provenance</p><h2 className="mt-1 text-lg font-medium text-slate-100">Evidence verification</h2></div>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {evidenceItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0"><p className="text-[10px] text-slate-400">{item.label}</p>{item.value && <p className="mt-1 break-all text-[9px] text-slate-600">{item.value}</p>}</div>
                  <span className={`shrink-0 text-[9px] uppercase tracking-[0.12em] ${item.present ? "text-emerald-300" : "text-amber-200"}`}>{item.present ? "Supplied" : "Pending"}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {artifactUrls.length ? artifactUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-300 underline decoration-emerald-300/30 underline-offset-4 hover:decoration-emerald-300">View artifact ↗</a>) : <span className="text-[10px] text-slate-600">No public artifact links supplied</span>}
              {evidence.reviewerNames?.length ? <span className="text-[10px] text-slate-500">{evidence.reviewerNames.length} reviewer name(s) listed</span> : null}
            </div>
          </aside>
        </div>

        <footer className="border-t border-white/[0.07] pt-4 text-[9px] leading-relaxed text-slate-600">
          Presence of evidence metadata is not proof that signatures are valid or that artifacts were independently reproduced. This report is not a guarantee of security or a deployment recommendation.
        </footer>
      </main>
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{label}</p><p className={`mt-1 text-2xl font-medium ${tone}`}>{value}</p></div>
}
