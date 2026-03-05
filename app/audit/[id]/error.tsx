"use client"

export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-dvh bg-[#0a0e14] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-[9px] text-[#ff3b5c] tracking-[0.15em] mb-4 font-mono">
          AUDIT REPORT ERROR
        </div>
        <h1 className="text-xl font-bold text-[#e0eaf0] mb-4 font-mono">
          Failed to load audit report
        </h1>
        <p className="text-[10px] text-[#4e6070] mb-2 leading-relaxed font-mono">
          {error.message || "An unexpected error occurred while loading this audit."}
        </p>
        {error.digest && (
          <p className="text-[8px] text-[#3e5060] mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="text-[10px] text-[#00ff88] border border-[#00ff8833] px-4 py-2 tracking-widest hover:bg-[#00ff8808] transition-colors font-mono bg-transparent cursor-pointer"
          >
            RETRY
          </button>
          <a
            href="/"
            className="text-[10px] text-[#00e5ff] border border-[#00e5ff33] px-4 py-2 tracking-widest hover:bg-[#00e5ff08] transition-colors no-underline font-mono"
          >
            BACK TO PORTFOLIO
          </a>
        </div>
      </div>
    </div>
  )
}
