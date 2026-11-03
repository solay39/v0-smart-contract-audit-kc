import Link from "next/link"
import { SiteHeader } from "@/components/SiteHeader"
import { getAllAudits } from "@/lib/mock-db"
import { hasEnoughEvidence } from "@/lib/verification"

export default async function VerificationPage() {
  const audits = await getAllAudits()

  return (
    <main className="min-h-screen bg-s39-bg0 text-s39-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="text-[9px] uppercase tracking-[0.25em] text-s39-green">Status definitions</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Verification status</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-s39-mid">The current application checks whether required evidence metadata has been supplied. It does not yet validate cryptographic signatures, reviewer identities, report contents or artifact reproducibility.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatusCard title="PENDING" detail="One or more required metadata fields are absent. The score is withheld." tone="amber" />
          <StatusCard title="Evidence fields complete" detail="The required metadata fields are present. This is not a cryptographic or independent verification result." tone="green" />
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-medium">Current portfolio records</h2>
          <div className="mt-4 divide-y divide-s39-border border-y border-s39-border">
            {audits.map((audit) => {
              const complete = hasEnoughEvidence(audit.evidence)
              return (
                <div key={audit.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div><p className="text-sm text-s39-lite">{audit.name} <span className="text-s39-dim">({audit.ticker})</span></p><p className="mt-1 text-[10px] text-s39-dim">{audit.network} · {audit.category}</p></div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[9px] uppercase tracking-[0.14em] ${complete ? "text-s39-green" : "text-s39-yellow"}`}>{complete ? "Fields complete" : "Pending"}</span>
                    <Link href={`/audit/${audit.id}/evidence`} className="text-[10px] text-s39-mid underline decoration-s39-border underline-offset-4 hover:text-s39-white">Evidence dossier</Link>
                    <Link href={`/audit/${audit.id}`} className="text-[10px] text-s39-mid underline decoration-s39-border underline-offset-4 hover:text-s39-white">Audit record</Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatusCard({ title, detail, tone }: { title: string; detail: string; tone: "amber" | "green" }) {
  const color = tone === "amber" ? "text-s39-yellow" : "text-s39-green"
  return <article className="border border-s39-border bg-s39-bg1/50 p-5"><h2 className={`text-xs font-semibold uppercase tracking-[0.16em] ${color}`}>{title}</h2><p className="mt-3 text-xs leading-5 text-s39-mid">{detail}</p></article>
}
