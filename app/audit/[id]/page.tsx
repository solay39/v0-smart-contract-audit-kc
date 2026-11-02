import { getAuditById } from "@/lib/mock-db"
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
          <p className="mt-4 text-slate-400">This audit record does not exist.</p>
        </div>
      </main>
    )
  }

  // Keep the full enterprise layout for pending reports. The detail component
  // gates score visuals and clearly shows which evidence fields are missing.
  return <AuditEnterpriseDetail project={project} />
}
