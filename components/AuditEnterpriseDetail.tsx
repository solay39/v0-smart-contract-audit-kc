"use client"

import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ScoreBadge } from "@/components/ScoreBadge"
import { SecurityScoreRing } from "@/components/SecurityScoreRing"
import { hasEnoughEvidence } from "@/lib/verification"
import type { AuditProject } from "@/lib/types"

type Props = { project: AuditProject }
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

const severityStyles: Record<Severity, string> = {
  CRITICAL: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  HIGH: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  MEDIUM: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  LOW: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
}

export function AuditEnterpriseDetail({ project }: Props) {
  const evidence = project.evidence
  const evidenceComplete = hasEnoughEvidence(evidence)
  const score = evidenceComplete && project.score != null ? project.score : null
  const categories = project.scoreBreakdown
    ? [
        { name: "Code security", score: project.scoreBreakdown.codeSecurity },
        { name: "Architecture", score: project.scoreBreakdown.architecture },
        { name: "Governance", score: project.scoreBreakdown.governance },
        { name: "Economics", score: project.scoreBreakdown.economics },
        { name: "On-chain", score: project.scoreBreakdown.onChain },
      ]
    : []

  const evidenceChecks = [
    { label: "Report hash", present: Boolean(evidence.reportHash?.trim()), value: evidence.reportHash },
    { label: "Reviewer names", present: Boolean(evidence.reviewerNames?.length), value: evidence.reviewerNames?.join(", ") },
    { label: "CI artifacts", present: Boolean(evidence.ciArtifacts?.length), value: evidence.ciArtifacts?.join(", ") },
    { label: "Commit snapshot", present: Boolean(evidence.commitHash?.trim()), value: evidence.commitHash },
    { label: "Attestation count", present: Number(evidence.attestationCount ?? 0) >= 2, value: evidence.attestationCount ? `${evidence.attestationCount} declared signers` : undefined },
  ]

  const findingCounts: { severity: Severity; count: number }[] = [
    { severity: "CRITICAL", count: project.findings.critical },
    { severity: "HIGH", count: project.findings.high },
    { severity: "MEDIUM", count: project.findings.medium },
    { severity: "LOW", count: project.findings.low },
  ]
  const totalFindings = findingCounts.reduce((sum, item) => sum + item.count, 0)
  const artifactLinks = (evidence.ciArtifacts ?? []).filter((item) => /^https:\/\//i.test(item))

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 selection:bg-emerald-400/20">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#070b12]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-4 py-3 sm:px-7">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-400 text-sm font-black text-slate-950">S</span>
            <span><span className="block text-sm font-bold tracking-[0.12em]">SOLAY39</span><span className="block text-[9px] uppercase tracking-[0.2em] text-slate-500">Evidence-led security</span></span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 text-xs text-slate-400 sm:flex">
            <Link href="/" className="transition hover:text-white">Portfolio</Link>
            <Link href="/benchmark" className="transition hover:text-white">Benchmark</Link>
            <Link href="/audit/injective-token" className="transition hover:text-white">Sample report</Link>
          </nav>
          <div className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold tracking-[0.18em] ${evidenceComplete ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}`}>
            {evidenceComplete ? "EVIDENCE FIELDS PRESENT" : "PENDING EVIDENCE"}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[78px] lg:max-h-[calc(100vh-96px)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-emerald-300/20 to-cyan-400/10 text-xl font-bold text-emerald-200">{project.ticker.slice(0, 2)}</div>
              <div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{project.network} · {project.category}</p><h1 className="mt-1 truncate text-lg font-semibold">{project.name}</h1></div>
            </div>

            <div className="my-5 flex justify-center rounded-xl border border-white/[0.06] bg-black/20 py-2">
              <SecurityScoreRing score={score} evidence={evidence} />
            </div>
            <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Report status</span><ScoreBadge score={score} rating={evidenceComplete ? project.rating : "PENDING"} evidence={evidence} /></div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Metric label="Findings" value={String(totalFindings)} />
              <Metric label="Listed reviewers" value={String(evidence.reviewerNames?.length ?? 0)} />
            </div>
            <div className="mt-4 space-y-2">
              {artifactLinks.length > 0 ? artifactLinks.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-400/10">View artifact ↗</a>) : <div className="rounded-lg border border-white/[0.07] px-3 py-2.5 text-center text-[9px] uppercase tracking-[0.14em] text-slate-500">Artifact links unavailable</div>}
              <div className="rounded-lg border border-white/[0.07] px-3 py-2.5 text-center text-[9px] uppercase tracking-[0.14em] text-slate-400">{evidence.reviewerNames?.length ? `${evidence.reviewerNames.length} reviewer name(s) listed` : "No reviewer names listed"}</div>
            </div>
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence summary</div>
              <div className="space-y-2.5">
                {evidenceChecks.map((item) => <div key={item.label} className="flex items-start justify-between gap-3 text-[10px]"><span className="text-slate-400">{item.label}</span><span className={item.present ? "max-w-[150px] truncate text-right text-emerald-300" : "text-amber-300"}>{item.present ? item.value : "Pending"}</span></div>)}
              </div>
              <p className="mt-4 text-[9px] leading-relaxed text-slate-600">Evidence fields indicate supplied metadata; this page does not independently validate signatures or artifact contents.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.10),_transparent_45%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(8,13,22,0.95))] p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">Audit dossier · {project.category}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{project.description}</p><div className="mt-4 flex flex-wrap gap-2">{project.tags.map((tag) => <span key={tag} className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">{tag}</span>)}</div></div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]"><MarketMetric label="Price" value={project.price} change={project.change24h} /><MarketMetric label="Market cap" value={project.marketCap} /></div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Overall score" value={score === null ? "PENDING" : `${score}/100`} note={score === null ? "Evidence gate incomplete" : `Rating ${project.rating ?? "—"}`} />
            <Kpi label="Critical findings" value={String(project.findings.critical)} note="Reported count" tone="rose" />
            <Kpi label="Open high" value={String(project.findings.high)} note="Reported count" tone="amber" />
            <Kpi label="Attestations" value={String(evidence.attestationCount ?? 0)} note="Declared signer count" tone="cyan" />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Panel title="Category assessment" eyebrow="Score components">
              {categories.length ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #334155", borderRadius: 10, fontSize: 12 }} /><Bar dataKey="score" name="Score" fill="#34d399" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No category scores published" detail="Category data will appear when it is included in the report evidence." />}
            </Panel>
            <Panel title="Finding distribution" eyebrow="By severity">
              <div className="space-y-3">{findingCounts.map((finding) => <div key={finding.severity} className="flex items-center gap-3"><span className={`w-24 rounded-md border px-2 py-1 text-center text-[9px] font-semibold tracking-[0.12em] ${severityStyles[finding.severity]}`}>{finding.severity}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: totalFindings ? `${Math.max(4, finding.count / totalFindings * 100)}%` : "0%" }} /></div><span className="w-8 text-right font-mono text-sm text-slate-200">{finding.count}</span></div>)}</div>
              <p className="mt-5 text-[9px] text-slate-600">Counts are taken from the report record; detailed finding-level evidence is not available in this data model.</p>
            </Panel>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Findings register" eyebrow="Report summary">
              <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[9px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="pb-3 pr-4">Severity</th><th className="pb-3 pr-4">Count</th><th className="pb-3">Detail</th></tr></thead><tbody>{findingCounts.map((item) => <tr key={item.severity} className="border-t border-white/[0.06]"><td className="py-3 pr-4"><span className={`rounded-md border px-2 py-1 text-[9px] ${severityStyles[item.severity]}`}>{item.severity}</span></td><td className="py-3 pr-4 font-mono">{item.count}</td><td className="py-3 text-slate-500">{item.count ? "Finding details not included in this report record" : "No finding reported in this severity band"}</td></tr>)}</tbody></table></div>
            </Panel>
            <Panel title="Attestation & provenance" eyebrow="Evidence lifecycle">
              <div className="space-y-0">{[
                { label: "Source snapshot", value: evidence.commitHash || "Not supplied", done: Boolean(evidence.commitHash) },
                { label: "Report hash", value: evidence.reportHash || "Not supplied", done: Boolean(evidence.reportHash) },
                { label: "Reviewer metadata", value: evidence.reviewerNames?.length ? evidence.reviewerNames.join(", ") : "Not supplied", done: Boolean(evidence.reviewerNames?.length) },
                { label: "CI artifact references", value: evidence.ciArtifacts?.length ? `${evidence.ciArtifacts.length} reference(s)` : "Not supplied", done: Boolean(evidence.ciArtifacts?.length) },
                { label: "Signer threshold", value: `${evidence.attestationCount ?? 0} / 2`, done: Number(evidence.attestationCount ?? 0) >= 2 },
              ].map((item, index, list) => <div key={item.label} className="flex gap-3"><div className="flex flex-col items-center"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.done ? "bg-emerald-400" : "bg-amber-400"}`} />{index < list.length - 1 && <span className="my-1 min-h-7 w-px flex-1 bg-slate-800" />}</div><div className="min-w-0 pb-4"><div className="text-xs font-medium text-slate-200">{item.label}</div><div className="mt-1 break-all text-[10px] text-slate-500">{item.value}</div></div></div>)}</div>
            </Panel>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-slate-900/40 px-4 py-3 text-[9px] leading-relaxed text-slate-500">Status is based on required evidence fields being present. It is not a guarantee of security, independent signature verification, or production readiness.</section>
        </main>
      </div>
    </div>
  )
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/[0.08] bg-slate-900/55 p-5 shadow-xl shadow-black/10"><div className="mb-5"><p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p><h3 className="mt-1 text-base font-semibold text-slate-100">{title}</h3></div>{children}</section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-200">{value}</p></div>
}

function MarketMetric({ label, value, change }: { label: string; value: string; change?: string }) {
  return <div className="min-w-[122px] rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>{change && <p className="mt-1 text-[9px] text-slate-500">{change}</p>}</div>
}

function Kpi({ label, value, note, tone = "emerald" }: { label: string; value: string; note: string; tone?: "emerald" | "rose" | "amber" | "cyan" }) {
  const style = { emerald: "text-emerald-300", rose: "text-rose-300", amber: "text-amber-300", cyan: "text-cyan-300" }[tone]
  return <div className="rounded-2xl border border-white/[0.08] bg-slate-900/55 p-4"><p className="text-[8px] uppercase tracking-[0.17em] text-slate-500">{label}</p><p className={`mt-3 truncate text-xl font-semibold ${style}`}>{value}</p><p className="mt-1 text-[9px] text-slate-600">{note}</p></div>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 px-5 text-center"><p className="text-sm text-slate-300">{title}</p><p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">{detail}</p></div>
}
