// app/security/[slug]/page.tsx
// Serve: solay39.eu/security/cross

import { list } from "@vercel/blob"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"

async function getAuditBySlug(slug: string) {
  try {
    const { blobs } = await list({ prefix: "audits/" })
    for (const blob of blobs) {
      if (!blob.pathname.endsWith(".json")) continue
      const res = await fetch(blob.url)
      if (!res.ok) continue
      const audit = await res.json()
      const auditSlug = (audit.symbol ?? audit.name ?? "")
        .toLowerCase().replace(/\s+/g, "-")
      if (auditSlug === slug || audit.id?.includes(slug)) return audit
    }
  } catch { }
  return null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const audit = await getAuditBySlug(slug)
  return {
    title: audit ? `${audit.name} Security Profile | Solay39` : "Security Profile | Solay39",
    description: audit ? `Security audit report for ${audit.name}. Score: ${audit.score ?? 89}/100` : "Security audit profile",
  }
}

export default async function SecurityProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const audit = await getAuditBySlug(slug)
  if (!audit) notFound()

  const score = audit.securityScore ?? audit.score ?? 89
  const rating = audit.rating ?? "A"
  const ratingColor =
    rating === "AAA" ? "#22c55e" :
    rating === "AA"  ? "#84cc16" :
    rating === "A"   ? "#6366f1" : "#f59e0b"

  const findings = audit.findings ?? []
  const critical = findings.filter((f: { severity: string }) => f.severity === "CRITICAL").length
  const high     = findings.filter((f: { severity: string }) => f.severity === "HIGH").length
  const medium   = findings.filter((f: { severity: string }) => f.severity === "MEDIUM").length
  const low      = findings.filter((f: { severity: string }) => f.severity === "LOW").length

  const embedCode = `<a href="https://www.solay39.eu/audit/${audit.id}" target="_blank">
  <img src="https://www.solay39.eu/api/badge/${audit.id}"
       alt="Audited by Solay39" height="36"/>
</a>`

  return (
    <div className="min-h-screen bg-s39-bg0 text-s39-white font-sans">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          {audit.logoUrl && (
            <img src={audit.logoUrl} width={56} height={56}
              className="rounded-xl" alt={audit.name} />
          )}
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold m-0">
              {audit.name}
              <span className="text-base text-s39-mid ml-2">
                {audit.symbol}
              </span>
            </h1>
            <p className="text-s39-dim text-sm mt-1">
              Security Profile · Solay39
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-extrabold leading-none" style={{ color: ratingColor }}>{score}</div>
            <div className="text-xl font-bold" style={{ color: ratingColor }}>{rating}</div>
          </div>
        </div>

        {/* Findings summary */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Critical", value: critical, color: "#ef4444" },
            { label: "High",     value: high,     color: "#f97316" },
            { label: "Medium",   value: medium,   color: "#f59e0b" },
            { label: "Low",      value: low,      color: "#6366f1" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-s39-bg1 rounded-xl p-4 text-center border"
              style={{ borderColor: `${color}22` }}>
              <div className="text-2xl sm:text-3xl font-bold" style={{ color }}>{value}</div>
              <div className="text-[11px] text-s39-dim mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Audit details */}
        <div className="bg-s39-bg1 rounded-xl p-6 mb-6 border border-s39-border">
          <h2 className="text-xs text-s39-dim font-semibold tracking-widest mb-4">
            AUDIT DETAILS
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Audit ID", value: audit.id },
              { label: "Network", value: audit.network ?? "—" },
              { label: "Published", value: audit.publishedAt
                ? new Date(audit.publishedAt).toLocaleDateString()
                : "—" },
              { label: "Lines of Code", value: audit.linesOfCode ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] text-s39-dim mb-0.5">{label}</div>
                <div className="text-sm text-s39-white font-medium truncate">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="bg-s39-bg1 rounded-xl p-6 mb-6 border border-s39-border">
          <h2 className="text-xs text-s39-dim font-semibold tracking-widest mb-4">
            VERIFICATION
          </h2>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "SHA-256", ok: !!audit.reportHash },
              { label: "ECDSA Signed", ok: !!audit.signedReport?.signature },
              { label: "IPFS Pinned", ok: !!audit.ipfsAttestation?.ipfsCid || !!audit.ipfsRecord?.ipfsCid },
              { label: "CVSS/CWE/SWC", ok: findings.some((f: { cvss?: number }) => f.cvss) },
            ].map(({ label, ok }) => (
              <div key={label} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                ok 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-s39-bg2 text-s39-dim border-s39-border"
              }`}>
                {ok ? "✓" : "○"} {label}
              </div>
            ))}
          </div>
        </div>

        {/* Embed badge */}
        <div className="bg-s39-bg1 rounded-xl p-6 mb-6 border border-s39-border">
          <h2 className="text-xs text-s39-dim font-semibold tracking-widest mb-3">
            EMBED BADGE
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/badge/${audit.id}`} height={36} alt="Solay39 badge"
            className="mb-3 block" />
          <pre className="bg-s39-bg0 rounded-lg p-3 text-[11px] text-s39-mid overflow-auto border border-s39-border m-0">
            {embedCode}
          </pre>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href={`/audit/${audit.id}`} 
            className="inline-block px-7 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold text-sm transition-colors">
            View Full Audit Report →
          </Link>
        </div>

      </div>
    </div>
  )
}
