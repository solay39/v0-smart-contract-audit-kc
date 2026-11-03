import Link from "next/link"
import { getAllAudits } from "@/lib/mock-db"
import { PortfolioGrid } from "@/components/PortfolioGrid"
import { SiteHeader } from "@/components/SiteHeader"
import { hasEnoughEvidence } from "@/lib/verification"

export default async function HomePage() {
  const audits = await getAllAudits()
  const evidenceCompleteCount = audits.filter((audit) => hasEnoughEvidence(audit.evidence)).length
  const pendingCount = audits.length - evidenceCompleteCount

  return (
    <main className="min-h-screen bg-s39-bg0 text-s39-white">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-10 border-b border-s39-border py-16 sm:py-24 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="text-[9px] uppercase tracking-[0.28em] text-s39-green">Independent security evidence</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl">
              Security reviews, <span className="text-s39-mid">with the evidence in view.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-s39-mid">
              A public index for audit records, findings and supporting evidence. Scores are shown only when the required record fields are present; field presence alone is not independent verification.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/benchmark" className="border border-s39-green/40 bg-s39-green/[0.07] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.15em] text-s39-green transition hover:bg-s39-green/[0.12]">Benchmark methodology</Link>
              <Link href="/methodology" className="border border-s39-border px-4 py-3 text-[10px] font-medium uppercase tracking-[0.15em] text-s39-lite transition hover:border-s39-mid">Review standards</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 border-y border-s39-border py-5 lg:border-l lg:border-y-0 lg:pl-8">
            <div className="pr-4">
              <p className="text-[9px] uppercase tracking-[0.17em] text-s39-dim">Evidence fields present</p>
              <p className="mt-3 text-3xl font-medium text-s39-lite">{evidenceCompleteCount}</p>
              <p className="mt-1 text-[10px] text-s39-dim">Metadata completeness only</p>
            </div>
            <div className="border-l border-s39-border pl-5">
              <p className="text-[9px] uppercase tracking-[0.17em] text-s39-dim">Pending records</p>
              <p className="mt-3 text-3xl font-medium text-s39-lite">{pendingCount}</p>
              <p className="mt-1 text-[10px] text-s39-dim">Evidence incomplete</p>
            </div>
          </div>
        </section>

        <section className="py-10" aria-labelledby="portfolio-heading">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-s39-dim">Public records</p>
              <h2 id="portfolio-heading" className="mt-1 text-xl font-medium">Audit portfolio</h2>
            </div>
            <Link href="/verification" className="text-[10px] text-s39-mid underline decoration-s39-border underline-offset-4 hover:text-s39-white">How status is determined</Link>
          </div>
          <PortfolioGrid audits={audits} />
        </section>

        <section className="grid gap-6 border-t border-s39-border py-8 sm:grid-cols-3">
          <Principle title="Transparent records" text="Separate findings, evidence metadata and conclusions so readers can inspect what is—and is not—available." />
          <Principle title="Reproducible evaluation" text="Benchmark claims require versioned data, documented methods and artifacts that can be independently reproduced." />
          <Principle title="No implied guarantee" text="An audit report is a point-in-time review, not a promise that software is free of vulnerabilities or safe to deploy." />
        </section>
      </div>
    </main>
  )
}

function Principle({ title, text }: { title: string; text: string }) {
  return <div className="border-t border-s39-border pt-4"><h3 className="text-xs font-medium text-s39-lite">{title}</h3><p className="mt-2 text-[11px] leading-5 text-s39-dim">{text}</p></div>
}
