import Link from "next/link"
import { getAuditById } from "@/lib/mock-db"
import { hasEnoughEvidence } from "@/lib/verification"
import { AuditEnterpriseDetail } from "@/components/AuditEnterpriseDetail"

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getAuditById(id)

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.28em] text-rose-300">Audit not found</div>
          <h1 className="mt-4 text-4xl font-black">Report unavailable</h1>
          <p className="mt-4 text-slate-400">
            This audit does not exist or has not been published with enough evidence.
          </p>
        </div>
      </main>
    )
  }

  if (!hasEnoughEvidence(project.evidence)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-[10px] uppercase tracking-[0.24em] text-slate-300">← Back</Link>
            </div>
            <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-amber-300">
              PENDING
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
            <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Verification pending</div>
            <h1 className="mt-4 text-4xl font-black">Security score not available yet</h1>
            <p className="mt-4 text-slate-400">
              This report is still pending required evidence: report hash, reviewer names, CI artifacts, commit snapshot and multi-signer attestation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <AuditEnterpriseDetail project={project} />
}
