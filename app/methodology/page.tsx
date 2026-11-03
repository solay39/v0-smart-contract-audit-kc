import { SiteHeader } from "@/components/SiteHeader"

const principles = [
  { title: "Scope and assumptions", detail: "Each review should identify the exact repository revision, contracts and dependencies in scope, deployment assumptions, excluded components and the date of review." },
  { title: "Manual review and tooling", detail: "Automated analyzers support review; they do not replace manual reasoning. Tool names, versions, configuration and limitations should be recorded with the report." },
  { title: "Findings and remediation", detail: "Findings should include severity rationale, affected component, impact, reproducible conditions, recommended mitigation and remediation status." },
  { title: "Scoring", detail: "A score must be derived from a published, versioned rubric and trace back to evidence and findings. No score should be inferred from a project name, token market data or missing fields." },
  { title: "Evidence provenance", detail: "Reports should be linked to a source commit and content hash. Signatures, signer identities and artifacts must be independently checked before describing them as verified." },
  { title: "Limitations", detail: "An audit is a time-bounded assessment of a defined scope. It cannot establish that software is vulnerability-free or guarantee future security." },
]

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-s39-bg0 text-s39-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="text-[9px] uppercase tracking-[0.25em] text-s39-green">Public documentation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Whitepaper & methodology</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-s39-mid">This page describes the publication standard the product is designed to follow. It is not a claim that every control or review process is already operational.</p>

        <div className="mt-9 divide-y divide-s39-border border-y border-s39-border">
          {principles.map((item, index) => (
            <section key={item.title} className="grid gap-3 py-5 sm:grid-cols-[48px_minmax(0,1fr)]">
              <span className="font-mono text-[10px] text-s39-dim">0{index + 1}</span>
              <div><h2 className="text-sm font-medium text-s39-lite">{item.title}</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-s39-mid">{item.detail}</p></div>
            </section>
          ))}
        </div>

        <aside className="mt-8 border border-s39-border bg-s39-bg1/50 p-5">
          <h2 className="text-xs font-semibold text-s39-lite">Current implementation status</h2>
          <p className="mt-2 text-xs leading-5 text-s39-mid">The demo currently provides portfolio and audit-record UI, metadata-based evidence gating, and a benchmark page that intentionally publishes no measured results. Signature verification, durable attestation storage and a production scoring rubric are not represented as complete.</p>
        </aside>
      </div>
    </main>
  )
}
