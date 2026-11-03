import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/SiteHeader"
import { getAuditById } from "@/lib/mock-db"
import { hasEnoughEvidence } from "@/lib/verification"

export default async function EvidenceDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const audit = await getAuditById(id)
  if (!audit) notFound()

  const evidence = audit.evidence
  const items = [
    { label: "Report hash", value: evidence.reportHash, supplied: Boolean(evidence.reportHash?.trim()) },
    { label: "Source commit", value: evidence.commitHash, supplied: Boolean(evidence.commitHash?.trim()) },
    { label: "Branch", value: evidence.branch, supplied: Boolean(evidence.branch?.trim()) },
    { label: "Signed at", value: evidence.signedAt, supplied: Boolean(evidence.signedAt?.trim()) },
    { label: "Reviewers", value: evidence.reviewerNames?.join(", "), supplied: Boolean(evidence.reviewerNames?.some((name) => name.trim())) },
    { label: "Attestation count", value: String(evidence.attestationCount ?? 0), supplied: Number(evidence.attestationCount ?? 0) >= 2 },
  ]
  const publicArtifacts = (evidence.ciArtifacts ?? []).filter((url) => /^https:\/\//i.test(url))
  const metadataComplete = hasEnoughEvidence(evidence)

  return (
    <main className="min-h-screen bg-s39-bg0 text-s39-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <Link href={`/audit/${audit.id}`} className="text-[10px] uppercase tracking-[0.16em] text-s39-dim hover:text-s39-white">← Audit record</Link>
        <p className="mt-7 text-[9px] uppercase tracking-[0.25em] text-s39-green">Evidence dossier</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold tracking-tight">{audit.name}</h1><p className="mt-2 text-xs text-s39-mid">{audit.network} · {audit.category} · {audit.ticker}</p></div>
          <span className={`border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] ${metadataComplete ? "border-s39-green/30 text-s39-green" : "border-s39-yellow/30 text-s39-yellow"}`}>{metadataComplete ? "Required fields supplied" : "Pending evidence"}</span>
        </div>

        <p className="mt-5 max-w-3xl text-xs leading-6 text-s39-mid">This dossier displays evidence metadata recorded for this audit. Supplied metadata is not the same as independently authenticated evidence.</p>

        <section className="mt-8" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="text-sm font-medium">Evidence fields</h2>
          <div className="mt-3 divide-y divide-s39-border border-y border-s39-border">
            {items.map((item) => <EvidenceRow key={item.label} label={item.label} value={item.value} supplied={item.supplied} />)}
            <EvidenceRow label="CI artifact references" value={evidence.ciArtifacts?.length ? `${evidence.ciArtifacts.length} reference(s)` : undefined} supplied={Boolean(evidence.ciArtifacts?.some((artifact) => artifact.trim()))} />
          </div>
        </section>

        <section className="mt-9" aria-labelledby="artifact-heading">
          <h2 id="artifact-heading" className="text-sm font-medium">Public artifact links</h2>
          {publicArtifacts.length ? <ul className="mt-3 divide-y divide-s39-border border-y border-s39-border">{publicArtifacts.map((url) => <li key={url} className="py-3"><a href={url} target="_blank" rel="noreferrer" className="break-all text-xs text-s39-green underline decoration-s39-green/30 underline-offset-4">{url} ↗</a></li>)}</ul> : <p className="mt-3 border-y border-s39-border py-4 text-xs text-s39-dim">No public HTTPS artifact URLs have been supplied.</p>}
        </section>

        <aside className="mt-9 border border-s39-border bg-s39-bg1/50 p-5 text-[10px] leading-5 text-s39-dim">The current application does not cryptographically validate report hashes, signatures, signer identities or artifact contents. Do not treat this page as a certification or security guarantee.</aside>
      </div>
    </main>
  )
}

function EvidenceRow({ label, value, supplied }: { label: string; value?: string; supplied: boolean }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 py-3"><div><p className="text-[10px] text-s39-mid">{label}</p><p className="mt-1 break-all text-[10px] text-s39-dim">{value?.trim() || "Not supplied"}</p></div><span className={`text-[9px] uppercase tracking-[0.12em] ${supplied ? "text-s39-green" : "text-s39-yellow"}`}>{supplied ? "Supplied" : "Pending"}</span></div>
}
