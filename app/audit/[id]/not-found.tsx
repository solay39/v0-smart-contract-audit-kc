export default function AuditNotFound() {
  return (
    <div className="min-h-dvh bg-[#0a0e14] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[9px] text-[#ff3b5c] tracking-[0.15em] mb-4 font-mono">
          AUDIT NOT FOUND
        </div>
        <h1 className="text-xl font-bold text-[#e0eaf0] mb-4 font-mono">
          Report does not exist
        </h1>
        <p className="text-[10px] text-[#4e6070] mb-6 max-w-sm mx-auto leading-relaxed font-mono">
          This audit report does not exist or may have been removed.
        </p>
        <a
          href="/"
          className="text-[10px] text-[#00e5ff] border border-[#00e5ff33] px-4 py-2 tracking-widest hover:bg-[#00e5ff08] transition-colors no-underline font-mono"
        >
          {"<- BACK TO PORTFOLIO"}
        </a>
      </div>
    </div>
  )
}
