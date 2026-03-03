"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface VerifyResult {
  found: boolean
  auditId?: string
  contractName?: string
  chain?: string
  score?: number
  publishDate?: string
  storedHash?: string
  recomputedHash?: string
  hashMatch?: boolean
  auditorSignature?: string
  findingsCount?: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  error?: string
}

export default function VerifyPage() {
  const params = useParams()
  const id = params.id as string
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/verify?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => setResult(data))
      .catch(() => setResult({ found: false, error: "Network error" }))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="min-h-screen bg-[#030608] text-[#8a9bb5] font-mono">
      {/* Header */}
      <header className="border-b border-[#0d1520] px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-5 h-5 border border-[#00ff88] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#00ff88]" />
            </div>
            <span className="text-[10px] text-[#c8d6e5] tracking-[0.25em] group-hover:text-[#00ff88] transition-colors">
              SOLAY39
            </span>
          </Link>
          <span className="text-[8px] text-[#4a5568] tracking-[0.2em]">
            REPORT INTEGRITY VERIFICATION
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border border-[#00ff88]/30 flex items-center justify-center animate-pulse">
              <div className="w-3 h-3 bg-[#00ff88]/30 animate-pulse" />
            </div>
            <p className="text-[10px] text-[#4a5568] tracking-[0.2em] animate-pulse">
              VERIFYING REPORT INTEGRITY...
            </p>
          </div>
        ) : !result || !result.found ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="w-16 h-16 border border-[#ff4444]/30 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#ff4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-[13px] text-[#ff4444] tracking-[0.15em] mb-2">AUDIT NOT FOUND</h1>
              <p className="text-[10px] text-[#4a5568] max-w-md leading-relaxed">
                {"No published audit report matches ID "}
                <code className="text-[#8a9bb5] bg-[#0a0f18] px-1.5 py-0.5 border border-[#0d1520]">{id}</code>
                {". The report may have been unpublished or the URL may be incorrect."}
              </p>
            </div>
            <Link
              href="/"
              className="text-[9px] text-[#00ff88] tracking-[0.15em] border border-[#00ff88]/30 px-4 py-2 hover:bg-[#00ff88]/5 transition-colors"
            >
              RETURN TO SOLAY39
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Verification Status Banner */}
            <div className={`border p-6 sm:p-8 text-center ${
              result.hashMatch
                ? "bg-[#00ff8808] border-[#00ff8830]"
                : "bg-[#ff440808] border-[#ff444430]"
            }`}>
              <div className={`w-14 h-14 mx-auto mb-4 border flex items-center justify-center ${
                result.hashMatch
                  ? "border-[#00ff8840]"
                  : "border-[#ff444440]"
              }`}>
                {result.hashMatch ? (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 3L24 8v5c0 6-4 9.5-10 11.5C8 22.5 4 19 4 13V8L14 3z" stroke="#00ff88" strokeWidth="1" strokeLinejoin="round" fill="none"/>
                    <path d="M10 14l3 3 5-6" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 3L24 8v5c0 6-4 9.5-10 11.5C8 22.5 4 19 4 13V8L14 3z" stroke="#ff4444" strokeWidth="1" strokeLinejoin="round" fill="none"/>
                    <path d="M11 11l6 6M17 11l-6 6" stroke="#ff4444" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              <h1 className={`text-[14px] tracking-[0.2em] mb-1 ${
                result.hashMatch ? "text-[#00ff88]" : "text-[#ff4444]"
              }`}>
                {result.hashMatch ? "INTEGRITY VERIFIED" : "INTEGRITY MISMATCH"}
              </h1>
              <p className="text-[9px] text-[#4a5568] tracking-wider max-w-sm mx-auto">
                {result.hashMatch
                  ? "The SHA-256 hash of this report matches the original. This audit has not been modified since publication."
                  : "WARNING: The recomputed hash does not match the stored hash. This report may have been altered after publication."
                }
              </p>
            </div>

            {/* Audit Summary */}
            <div className="bg-[#060a10] border border-[#0d1520] p-5 sm:p-6">
              <div className="text-[8px] text-[#4a5568] tracking-[0.2em] mb-4">AUDIT SUMMARY</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">CONTRACT</div>
                  <div className="text-[11px] text-[#c8d6e5]">{result.contractName}</div>
                </div>
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">CHAIN</div>
                  <div className="text-[11px] text-[#c8d6e5]">{result.chain}</div>
                </div>
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">SCORE</div>
                  <div className={`text-[14px] font-bold ${
                    (result.score ?? 0) >= 80 ? "text-[#00ff88]" :
                    (result.score ?? 0) >= 60 ? "text-[#ffaa00]" :
                    "text-[#ff4444]"
                  }`}>
                    {result.score ?? "N/A"}<span className="text-[9px] text-[#4a5568]">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">PUBLISHED</div>
                  <div className="text-[10px] text-[#c8d6e5]">
                    {result.publishDate
                      ? new Date(result.publishDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "N/A"
                    }
                  </div>
                </div>
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">AUDITOR</div>
                  <div className="text-[10px] text-[#c8d6e5]">Solay39 Founder</div>
                </div>
                <div>
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-0.5">REPORT ID</div>
                  <div className="text-[9px] text-[#8a9bb5] font-mono">solay39-audit-{result.auditId}</div>
                </div>
              </div>
            </div>

            {/* Findings Breakdown */}
            {result.findingsCount && (
              <div className="bg-[#060a10] border border-[#0d1520] p-5 sm:p-6">
                <div className="text-[8px] text-[#4a5568] tracking-[0.2em] mb-4">FINDINGS SUMMARY</div>
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: "CRITICAL", count: result.findingsCount.critical, color: "#ff4444" },
                    { label: "HIGH", count: result.findingsCount.high, color: "#ff6b00" },
                    { label: "MEDIUM", count: result.findingsCount.medium, color: "#ffaa00" },
                    { label: "LOW", count: result.findingsCount.low, color: "#00ff88" },
                    { label: "INFO", count: result.findingsCount.info, color: "#4a5568" },
                  ].map(s => (
                    <div
                      key={s.label}
                      className="flex items-center gap-2 px-3 py-2 border"
                      style={{ borderColor: `${s.color}30`, backgroundColor: `${s.color}05` }}
                    >
                      <span className="text-[7px] tracking-widest" style={{ color: s.color }}>{s.label}</span>
                      <span className="text-[12px] font-bold" style={{ color: s.color }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cryptographic Verification */}
            <div className="bg-[#060a10] border border-[#0d1520] p-5 sm:p-6">
              <div className="text-[8px] text-[#4a5568] tracking-[0.2em] mb-4">CRYPTOGRAPHIC VERIFICATION</div>
              <div className="space-y-3">
                <div className="p-3 bg-[#0a0f18] border border-[#0d1520]">
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-1">STORED SHA-256 HASH</div>
                  <code className="text-[9px] text-[#c8d6e5] font-mono break-all block leading-relaxed">
                    {result.storedHash || "Not available (pre-integrity audit)"}
                  </code>
                </div>
                <div className="p-3 bg-[#0a0f18] border border-[#0d1520]">
                  <div className="text-[7px] text-[#4a5568] tracking-widest mb-1">RECOMPUTED SHA-256 HASH</div>
                  <code className={`text-[9px] font-mono break-all block leading-relaxed ${
                    result.hashMatch ? "text-[#00ff88]" : "text-[#ff4444]"
                  }`}>
                    {result.recomputedHash}
                  </code>
                </div>
                <div className={`p-3 border flex items-center gap-2 ${
                  result.hashMatch
                    ? "bg-[#00ff8808] border-[#00ff8830]"
                    : "bg-[#ff440808] border-[#ff444430]"
                }`}>
                  {result.hashMatch ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6l2.5 2.5L9 4" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="#ff4444" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  )}
                  <span className={`text-[9px] tracking-wider ${
                    result.hashMatch ? "text-[#00ff88]" : "text-[#ff4444]"
                  }`}>
                    {result.hashMatch
                      ? "HASHES MATCH — Report integrity confirmed. No modifications detected."
                      : "HASH MISMATCH — Report content has been modified since initial publication."
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Auditor Signature */}
            {result.auditorSignature && (
              <div className="bg-[#060a10] border border-[#0d1520] p-5 sm:p-6">
                <div className="text-[8px] text-[#4a5568] tracking-[0.2em] mb-2">AUDITOR SIGNATURE</div>
                <p className="text-[10px] text-[#c8d6e5]">{result.auditorSignature}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4">
              <Link
                href="/"
                className="text-[8px] text-[#4a5568] tracking-[0.15em] border border-[#0d1520] px-3 py-1.5 hover:text-[#c8d6e5] hover:border-[#1a2535] transition-colors"
              >
                RETURN TO SOLAY39
              </Link>
              <span className="text-[7px] text-[#4a5568] tracking-wider">
                {"Verification performed server-side via SHA-256"}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
