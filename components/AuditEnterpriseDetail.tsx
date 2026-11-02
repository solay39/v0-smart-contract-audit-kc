import Link from "next/link"
import {
  Area,
  AreaChart,
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

type Props = {
  project: AuditProject
}

const scoreTrend = [
  { month: "Jan", score: 62 },
  { month: "Feb", score: 70 },
  { month: "Mar", score: 76 },
  { month: "Apr", score: 84 },
  { month: "May", score: 89 },
  { month: "Jun", score: 92 },
]

const breakdownData = [
  { name: "Code", value: 94 },
  { name: "Arch", value: 91 },
  { name: "Gov", value: 88 },
  { name: "Eco", value: 85 },
  { name: "On-Chain", value: 90 },
]

const attestationTimeline = [
  { phase: "Initial scan", status: "done", detail: "Slither + Mythril completed" },
  { phase: "Manual review", status: "done", detail: "Lead reviewer signed report" },
  { phase: "Multi-signer attestation", status: "done", detail: "3 reviewers signed same hash" },
  { phase: "Evidence publish", status: "live", detail: "Artifact bundle published for verification" },
]

const findingsRows = [
  { severity: "LOW", location: "Owner::setTreasury", description: "Minor governance delay in controller path" },
  { severity: "MEDIUM", location: "Vault::deposit", description: "Edge loss under unusual reentrancy stress" },
  { severity: "HIGH", location: "Escrow::withdraw", description: "Potential state desync during reward claim" },
  { severity: "CRITICAL", location: "Governance::execute", description: "Requires manual review before production use" },
]

const evidenceChecks = [
  { label: "Report hash", ok: true },
  { label: "Reviewer names", ok: true },
  { label: "CI artifacts", ok: true },
  { label: "Multi-signer attestation", ok: true },
  { label: "Commit snapshot", ok: true },
]

export function AuditEnterpriseDetail({ project }: Props) {
  const verified = hasEnoughEvidence(project.evidence)
  const score = verified ? project.score ?? 0 : 0
  const statusText = verified ? "VERIFIED" : "PENDING"

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-lg font-black text-slate-950">
              S
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">SOLAY39</div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Security Intelligence</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <Link href="/" className="transition hover:text-emerald-300">Portfolio</Link>
            <Link href="/benchmark" className="transition hover:text-emerald-300">Benchmark</Link>
            <Link href="/audit/injective-token" className="transition hover:text-emerald-300">Audit Demo</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-300">
              {statusText}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-2xl font-black text-slate-950">
                {project.ticker.slice(0, 2)}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{project.network}</div>
                <h1 className="mt-1 text-2xl font-black tracking-tight">{project.name}</h1>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Status</span>
              <ScoreBadge score={verified ? project.score : null} rating={verified ? project.rating : "PENDING"} evidence={project.evidence} />
            </div>

            <div className="mb-6 flex justify-center">
              <SecurityScoreRing score={verified ? project.score : null} evidence={project.evidence} />
            </div>

            <div className="space-y-3">
              <button className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-emerald-300 transition hover:bg-emerald-500/20">
                View artifact
              </button>
              <button className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-slate-200 transition hover:border-slate-500">
                Signed by 3 reviewers
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Evidence summary</div>
              <div className="mt-4 space-y-3">
                {evidenceChecks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{check.label}</span>
                    <span className={check.ok ? "text-emerald-300" : "text-amber-300"}>{check.ok ? "OK" : "PENDING"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400">{project.category}</div>
                <h2 className="mt-2 text-3xl font-black tracking-tight">{project.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-right">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Price</div>
                  <div className="mt-2 text-2xl font-black text-white">{project.price}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-right">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Market cap</div>
                  <div className="mt-2 text-2xl font-black text-white">{project.marketCap}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Code Security" value={`${project.scoreBreakdown?.codeSecurity ?? 92}`} tone="emerald" />
            <StatCard label="Architecture" value={`${project.scoreBreakdown?.architecture ?? 91}`} tone="cyan" />
            <StatCard label="Governance" value={`${project.scoreBreakdown?.governance ?? 88}`} tone="violet" />
            <StatCard label="Risk" value={project.riskLabel} tone="amber" />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4 text-[10px] uppercase tracking-[0.25em] text-slate-400">Score trend</div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={scoreTrend}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020817",
                        border: "1px solid #334155",
                        borderRadius: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#34d399" strokeWidth={3} fill="url(#scoreFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-4 text-[10px] uppercase tracking-[0.25em] text-slate-400">Breakdown</div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData}>
                    <CartesianGrid stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020817",
                        border: "1px solid #334155",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="mb-5 text-[10px] uppercase tracking-[0.25em] text-slate-400">Findings</div>
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {findingsRows.map((row) => (
                    <tr key={`${row.location}-${row.severity}`} className="border-t border-slate-800 text-slate-200">
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          row.severity === "CRITICAL"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                            : row.severity === "HIGH"
                              ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                              : row.severity === "MEDIUM"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        }`}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.location}</td>
                      <td className="px-4 py-3 text-slate-300">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-5 text-[10px] uppercase tracking-[0.25em] text-slate-400">Attestation timeline</div>
              <div className="space-y-4">
                {attestationTimeline.map((entry, idx) => (
                  <div key={entry.phase} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${entry.status === "live" ? "bg-emerald-400" : "bg-cyan-400"}`} />
                      {idx < attestationTimeline.length - 1 && <div className="mt-1 h-10 w-px bg-slate-700" />}
                    </div>
                    <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{entry.phase}</div>
                      <div className="mt-2 text-sm text-slate-200">{entry.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-5 text-[10px] uppercase tracking-[0.25em] text-slate-400">Evidence verification</div>
              <div className="space-y-4">
                {evidenceChecks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <span className="text-sm text-slate-300">{check.label}</span>
                    <span className={check.ok ? "text-emerald-300" : "text-amber-300"}>{check.ok ? "Verified" : "Pending"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
  tone: "emerald" | "cyan" | "violet" | "amber"
}

function StatCard({ label, value, tone }: StatCardProps) {
  const tones = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.25em]">{label}</div>
      <div className="mt-3 text-3xl font-black">{value}</div>
    </div>
  )
}
