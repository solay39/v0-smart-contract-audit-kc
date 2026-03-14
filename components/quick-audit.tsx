"use client"

import { useState } from "react"
import { S39Btn, S39Input, ScoreRing } from "@/components/solay39-ui"
import { getExplorer, isValidAddress } from "@/lib/explorers"

// ══════════════════════════════════════════════════════════════════════════════
// SOLAY39 QUICK AUDIT — Audit direttamente da indirizzo blockchain
// ══════════════════════════════════════════════════════════════════════════════

interface QuickAuditResult {
  success: boolean
  tokenAddress: string
  network: string
  metadata: {
    name: string
    symbol: string
    logoUrl: string
    description: string
    website: string
    twitter: string
    telegram: string
    github: string
    totalSupply: string
    decimals: number
    price: string
    marketCap: string
    volume24h: string
    holders: number
  }
  source: {
    code: string
    language: string
    compiler: string
    contractName: string
    linesOfCode: number
    verified: boolean
    explorerUrl: string
  }
  onChain: {
    mintAuthority: string | null
    freezeAuthority: string | null
    owner: string | null
    topHolders: Array<{
      address: string
      balance: string
      percentage: number
      label?: string
    }>
    liquidityPools: Array<{
      dex: string
      pair: string
      liquidity: string
      lpLocked: boolean
      lockDuration?: string
    }>
    hasMintFunction: boolean
    hasPauseFunction: boolean
    hasBlacklistFunction: boolean
  }
  audit?: {
    score: number
    findings: Array<{
      title: string
      severity: string
      description: string
      location: string
      recommendation: string
    }>
    riskLevel: string
    recommendation: string
  }
  errors: string[]
}

const CHAINS = [
  { id: "Ethereum", color: "#627EEA" },
  { id: "BSC", color: "#F0B90B" },
  { id: "Polygon", color: "#8247E5" },
  { id: "Arbitrum", color: "#28A0F0" },
  { id: "Base", color: "#0052FF" },
  { id: "Optimism", color: "#FF0420" },
  { id: "Avalanche", color: "#E84142" },
  { id: "Solana", color: "#14F195" },
]

interface QuickAuditProps {
  onAuditComplete?: (result: QuickAuditResult) => void
  onStartWorkspace?: (result: QuickAuditResult) => void
}

export function QuickAudit({ onAuditComplete, onStartWorkspace }: QuickAuditProps) {
  const [address, setAddress] = useState("")
  const [network, setNetwork] = useState("Ethereum")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")
  const [result, setResult] = useState<QuickAuditResult | null>(null)
  const [error, setError] = useState("")
  
  // Custom metadata for new tokens
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const [customSymbol, setCustomSymbol] = useState("")
  const [customLogo, setCustomLogo] = useState("")
  const [customDesc, setCustomDesc] = useState("")
  const [customWebsite, setCustomWebsite] = useState("")
  const [customTwitter, setCustomTwitter] = useState("")
  const [customTelegram, setCustomTelegram] = useState("")
  const [customGithub, setCustomGithub] = useState("")

  async function runQuickAudit() {
    if (!address.trim()) {
      setError("Please enter a contract address")
      return
    }
    
    if (!isValidAddress(address.trim(), network)) {
      setError(`Invalid ${network} address format`)
      return
    }
    
    setLoading(true)
    setError("")
    setResult(null)
    setProgress("Connecting to blockchain explorer...")
    
    try {
      // Build custom metadata if provided
      const customMetadata = showCustom ? {
        name: customName || undefined,
        symbol: customSymbol || undefined,
        logoUrl: customLogo || undefined,
        description: customDesc || undefined,
        website: customWebsite || undefined,
        twitter: customTwitter || undefined,
        telegram: customTelegram || undefined,
        github: customGithub || undefined,
      } : undefined
      
      setProgress("Fetching source code and token data...")
      
      const res = await fetch("/api/audit-from-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          network,
          customMetadata,
        }),
      })
      
      setProgress("Processing audit results...")
      
      const data: QuickAuditResult = await res.json()
      
      if (!res.ok) {
        throw new Error(data.errors?.[0] || "Audit failed")
      }
      
      setResult(data)
      setProgress("")
      
      if (onAuditComplete) {
        onAuditComplete(data)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run audit")
      setProgress("")
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setError("")
    setProgress("")
  }

  const sevColors: Record<string, string> = {
    CRITICAL: "#ff2d55",
    HIGH: "#ff6b00",
    MEDIUM: "#ffd600",
    LOW: "#00ff88",
    INFO: "#4488ff",
  }

  return (
    <div className="bg-s39-bg1 border border-s39-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-s39-cyan to-s39-green flex items-center justify-center text-s39-bg0 font-bold text-sm">
          Q
        </div>
        <div>
          <div className="text-[9px] text-s39-cyan tracking-[0.15em]">QUICK AUDIT</div>
          <div className="text-[10px] text-s39-dim">Audit direttamente da indirizzo blockchain</div>
        </div>
      </div>

      {!result ? (
        <>
          {/* Network selector */}
          <div className="mb-4">
            <div className="text-[8px] text-s39-dim tracking-widest mb-2">BLOCKCHAIN</div>
            <div className="flex flex-wrap gap-2">
              {CHAINS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setNetwork(c.id)}
                  className="px-3 py-1.5 text-[9px] font-mono border transition-all"
                  style={{
                    background: network === c.id ? `${c.color}22` : "transparent",
                    borderColor: network === c.id ? c.color : "var(--s39-border)",
                    color: network === c.id ? c.color : "var(--s39-dim)",
                  }}
                >
                  {c.id}
                </button>
              ))}
            </div>
          </div>
          
          {/* Address input */}
          <div className="mb-4">
            <div className="text-[8px] text-s39-dim tracking-widest mb-2">CONTRACT ADDRESS</div>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder={network === "Solana" ? "SPL Token mint address..." : "0x..."}
              className="w-full bg-s39-bg2 border border-s39-border text-s39-cyan text-[11px] font-mono px-3 py-2.5 focus:border-s39-cyan outline-none transition-colors"
            />
            <div className="text-[8px] text-s39-dim mt-1.5">
              Es: <span className="text-s39-cyan font-mono">0xdAC17F958D2ee523a2206206994597C13D831ec7</span> (USDT)
            </div>
          </div>
          
          {/* Custom metadata toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowCustom(!showCustom)}
              className="text-[9px] text-s39-mid hover:text-s39-cyan transition-colors flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={showCustom ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
              {showCustom ? "Nascondi" : "Aggiungi"} metadata custom (per token nuovi)
            </button>
            
            {showCustom && (
              <div className="mt-3 p-4 bg-s39-bg2 border border-s39-border">
                <div className="text-[8px] text-s39-yellow tracking-widest mb-3">
                  METADATA CUSTOM (per token non ancora su CoinGecko)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">NOME TOKEN</div>
                    <input
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      placeholder="Es: My Token"
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">SIMBOLO</div>
                    <input
                      value={customSymbol}
                      onChange={e => setCustomSymbol(e.target.value)}
                      placeholder="Es: MTK"
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="text-[8px] text-s39-dim mb-1">LOGO URL</div>
                    <input
                      value={customLogo}
                      onChange={e => setCustomLogo(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="text-[8px] text-s39-dim mb-1">DESCRIZIONE</div>
                    <textarea
                      value={customDesc}
                      onChange={e => setCustomDesc(e.target.value)}
                      placeholder="Breve descrizione del progetto..."
                      rows={2}
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan resize-none"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">WEBSITE</div>
                    <input
                      value={customWebsite}
                      onChange={e => setCustomWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">TWITTER</div>
                    <input
                      value={customTwitter}
                      onChange={e => setCustomTwitter(e.target.value)}
                      placeholder="https://twitter.com/..."
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">TELEGRAM</div>
                    <input
                      value={customTelegram}
                      onChange={e => setCustomTelegram(e.target.value)}
                      placeholder="https://t.me/..."
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] text-s39-dim mb-1">GITHUB</div>
                    <input
                      value={customGithub}
                      onChange={e => setCustomGithub(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full bg-s39-bg0 border border-s39-border text-s39-lite text-[10px] px-2 py-1.5 outline-none focus:border-s39-cyan"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Error */}
          {error && (
            <div className="bg-[#160005] border border-s39-red/30 text-s39-red text-[10px] p-3 mb-4">
              {error}
            </div>
          )}
          
          {/* Progress */}
          {progress && (
            <div className="bg-s39-bg2 border border-s39-cyan/20 text-s39-cyan text-[10px] p-3 mb-4 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-s39-cyan border-t-transparent rounded-full animate-spin" />
              {progress}
            </div>
          )}
          
          {/* Submit button */}
          <S39Btn
            primary
            onClick={runQuickAudit}
            disabled={loading || !address.trim()}
            className="w-full !bg-s39-cyan !text-s39-bg0 !border-s39-cyan"
          >
            {loading ? "Analyzing..." : `Start Quick Audit on ${network}`}
          </S39Btn>
        </>
      ) : (
        /* Results view */
        <div className="animate-[fadeUp_0.3s_ease]">
          {/* Header with score */}
          <div className="flex items-start gap-4 mb-5 pb-5 border-b border-s39-border">
            <div className="shrink-0">
              {result.metadata.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.metadata.logoUrl}
                  alt={result.metadata.name}
                  className="w-14 h-14 rounded-lg border border-s39-border object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-s39-cyan/30 bg-s39-bg2 flex items-center justify-center text-s39-cyan text-xl font-bold">
                  {result.metadata.symbol?.charAt(0) || "?"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-s39-white font-bold">{result.metadata.name}</div>
              <div className="text-[10px] text-s39-cyan font-mono">{result.metadata.symbol}</div>
              <div className="text-[9px] text-s39-dim mt-1">
                {result.network} | {result.source.linesOfCode} LOC
              </div>
            </div>
            {result.audit && (
              <div className="shrink-0">
                <ScoreRing score={result.audit.score} size={56} />
              </div>
            )}
          </div>
          
          {/* Token info grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              ["Price", result.metadata.price],
              ["Market Cap", result.metadata.marketCap],
              ["Holders", result.metadata.holders?.toLocaleString() || "N/A"],
              ["Volume 24h", result.metadata.volume24h],
            ].map(([label, value]) => (
              <div key={label} className="bg-s39-bg2 p-2.5 border border-s39-border">
                <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">{label}</div>
                <div className="text-[10px] text-s39-lite font-mono">{value || "N/A"}</div>
              </div>
            ))}
          </div>
          
          {/* Security warnings */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className={`p-2.5 border text-center ${result.onChain.mintAuthority ? "bg-[#160005] border-s39-red/30" : "bg-[#001608] border-s39-green/30"}`}>
              <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">MINT</div>
              <div className={`text-[9px] font-bold ${result.onChain.mintAuthority ? "text-s39-red" : "text-s39-green"}`}>
                {result.onChain.mintAuthority ? "ACTIVE" : "DISABLED"}
              </div>
            </div>
            <div className={`p-2.5 border text-center ${result.onChain.freezeAuthority ? "bg-[#160800] border-s39-yellow/30" : "bg-[#001608] border-s39-green/30"}`}>
              <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">FREEZE</div>
              <div className={`text-[9px] font-bold ${result.onChain.freezeAuthority ? "text-s39-yellow" : "text-s39-green"}`}>
                {result.onChain.freezeAuthority ? "ACTIVE" : "DISABLED"}
              </div>
            </div>
            <div className={`p-2.5 border text-center ${result.source.verified ? "bg-[#001608] border-s39-green/30" : "bg-[#160005] border-s39-red/30"}`}>
              <div className="text-[7px] text-s39-dim tracking-widest mb-0.5">SOURCE</div>
              <div className={`text-[9px] font-bold ${result.source.verified ? "text-s39-green" : "text-s39-red"}`}>
                {result.source.verified ? "VERIFIED" : "NOT VERIFIED"}
              </div>
            </div>
          </div>
          
          {/* Findings summary */}
          {result.audit && result.audit.findings.length > 0 && (
            <div className="mb-5">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">
                {result.audit.findings.length} FINDING{result.audit.findings.length !== 1 ? "S" : ""}
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {result.audit.findings.slice(0, 5).map((f, i) => (
                  <div
                    key={i}
                    className="bg-s39-bg2 border-l-2 p-2.5"
                    style={{ borderLeftColor: sevColors[f.severity] || sevColors.INFO }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[7px] px-1.5 py-0.5 font-bold"
                        style={{
                          background: `${sevColors[f.severity]}22`,
                          color: sevColors[f.severity],
                        }}
                      >
                        {f.severity}
                      </span>
                      <span className="text-[9px] text-s39-lite font-bold truncate">{f.title}</span>
                    </div>
                    <div className="text-[8px] text-s39-dim line-clamp-2">{f.description}</div>
                  </div>
                ))}
                {result.audit.findings.length > 5 && (
                  <div className="text-[9px] text-s39-dim text-center py-2">
                    +{result.audit.findings.length - 5} more findings
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Top holders */}
          {result.onChain.topHolders.length > 0 && (
            <div className="mb-5">
              <div className="text-[8px] text-s39-dim tracking-widest mb-2">TOP HOLDERS</div>
              <div className="space-y-1">
                {result.onChain.topHolders.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px]">
                    <span className="text-s39-dim w-4">{i + 1}.</span>
                    <span className="text-s39-cyan font-mono truncate flex-1">
                      {h.address.slice(0, 6)}...{h.address.slice(-4)}
                    </span>
                    <span className={`font-mono ${h.percentage > 10 ? "text-s39-red" : h.percentage > 5 ? "text-s39-yellow" : "text-s39-green"}`}>
                      {h.percentage.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Errors/warnings */}
          {result.errors.length > 0 && (
            <div className="bg-[#160800] border border-s39-yellow/30 p-3 mb-5">
              <div className="text-[8px] text-s39-yellow tracking-widest mb-1">WARNINGS</div>
              {result.errors.map((e, i) => (
                <div key={i} className="text-[9px] text-s39-dim">{e}</div>
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <S39Btn onClick={reset} className="flex-1">
              New Audit
            </S39Btn>
            {onStartWorkspace && result.source.verified && (
              <S39Btn
                primary
                onClick={() => onStartWorkspace(result)}
                className="flex-1 !bg-s39-cyan !text-s39-bg0"
              >
                Open Full Workspace
              </S39Btn>
            )}
            <a
              href={result.source.explorerUrl || getExplorer(result.network).addressUrl(result.tokenAddress)}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 border border-s39-border text-[9px] text-s39-mid hover:bg-s39-bg2 transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Explorer
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickAudit
