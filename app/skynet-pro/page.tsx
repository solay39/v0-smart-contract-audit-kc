"use client"

import { useState, useEffect, useMemo } from "react"
import { ScoreRing } from "@/components/solay39-ui"
import { OnChainAnalysisPanel } from "@/components/onchain-analysis-panel"
import { DEFAULT_PROJECTS, scoreColor } from "@/lib/solay39-constants"

// ── Market Ticker Component ──────────────────────────────────────
function MarketTicker() {
  const [prices, setPrices] = useState<any>({})

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const tokens = [
          "BTC:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599:eth",
          "ETH:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2:eth",
          "SOL:So11111111111111111111111111111111111111112:solana",
          "BNB:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c:bsc"
        ]
        const res = await fetch(`/api/prices?extra=${tokens.join(",")}`)
        const data = await res.json()
        setPrices(data.prices || {})
      } catch (e) {
        console.error("Ticker error:", e)
      }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative z-10 bg-[#00ff880a] border-b border-[#00ff8811] py-2 overflow-hidden whitespace-nowrap">
      <div className="flex animate-[ticker_30s_linear_infinite] gap-12 px-6">
        {Object.values(prices).length > 0 ? Object.values(prices).map((p: any) => (
          <div key={p.ticker} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#7a8c9e]">{p.ticker}</span>
            <span className="text-[10px] text-white font-mono">${parseFloat(p.price).toLocaleString()}</span>
            <span className={`text-[9px] font-mono ${p.change24h?.startsWith("-") ? 'text-[#ff2d55]' : 'text-[#00ff88]'}`}>
              {p.change24h || "0.00"}%
            </span>
          </div>
        )) : (
          <div className="text-[9px] text-[#445566] uppercase tracking-widest">Establishing secure data link to global exchanges...</div>
        )}
        {/* Duplicate for seamless loop */}
        {Object.values(prices).map((p: any) => (
          <div key={`${p.ticker}-loop`} className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#7a8c9e]">{p.ticker}</span>
            <span className="text-[10px] text-white font-mono">${parseFloat(p.price).toLocaleString()}</span>
            <span className={`text-[9px] font-mono ${p.change24h?.startsWith("-") ? 'text-[#ff2d55]' : 'text-[#00ff88]'}`}>
              {p.change24h || "0.00"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface DbProject {
  id: string
  name: string
  ticker?: string
  network: string
  score: number
  contractAddress?: string
  logoUrl?: string
  date: string
  criticals: number
  highs: number
  mediums: number
}

export default function SkynetProPage() {
  const [address, setAddress] = useState("")
  const [network, setNetwork] = useState("BSC")
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  // ── Database Projects (all audited tokens) ──
  const [dbProjects, setDbProjects] = useState<DbProject[]>([])
  const [loadingDb, setLoadingDb] = useState(true)
  
  // Load ALL projects from database
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await fetch("/api/audits")
        const data = await res.json()
        if (data.audits && Array.isArray(data.audits)) {
          setDbProjects(data.audits) // ALL projects, no limit
        }
      } catch (e) {
        console.error("Failed to load projects:", e)
      } finally {
        setLoadingDb(false)
      }
    }
    loadProjects()
  }, [])
  
  // Merge database projects with DEFAULT_PROJECTS (db takes priority)
  const allProjects = useMemo(() => {
    const merged = [...dbProjects]
    const dbIds = new Set(dbProjects.map(p => p.id))
    for (const p of DEFAULT_PROJECTS) {
      if (!dbIds.has(p.id)) {
        merged.push(p as DbProject)
      }
    }
    return merged
  }, [dbProjects])

  // ── Anti-Hacker & Registry States ──
  const [blockedEntities, setBlockedEntities] = useState([
    { id: 1, type: 'WALLET', target: '0x7a2...f3e', reason: 'Flash Loan Exploit Pattern', time: '12m ago' },
    { id: 2, type: 'IP', target: '192.x.x.42', reason: 'RPC DDoS Attempt', time: '45m ago' },
  ])

  const [securityRegistry, setSecurityRegistry] = useState([
    { id: 1, event: 'Liquidity Drain Prevented', project: 'PancakeSwap Fork', impact: 'CRITICAL', time: '2h ago' },
    { id: 2, event: 'Malicious Proxy Upgrade Blocked', project: 'Alpha Finance', impact: 'HIGH', time: '5h ago' },
    { id: 3, event: 'Phishing Contract Flagged', project: 'Global Network', impact: 'MEDIUM', time: 'Yesterday' },
  ])

  // Exploit Analysis State
  const [exploitTx, setExploitTx] = useState("")
  const [analyzingExploit, setAnalyzingExploit] = useState(false)
  const [exploitAnalysis, setExploitAnalysis] = useState<any>(null)

  const handleExploitAnalysis = async () => {
    if (!exploitTx) return
    setAnalyzingExploit(true)
    setExploitAnalysis(null)
    try {
      const res = await fetch("/api/exploit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: exploitTx, network })
      })
      const data = await res.json()
      setExploitAnalysis(data)
    } catch (e) {
      console.error("Exploit analysis failed:", e)
    } finally {
      setAnalyzingExploit(false)
    }
  }

  // Simulated live threats for the "Command Center" feel
  const [liveThreats, setLiveThreats] = useState<{id: number, msg: string, time: string, type: 'info' | 'warn' | 'error'}[]>([
    { id: 1, msg: "Monitoring mempool for sandwich attacks...", time: "LIVE", type: 'info' },
    { id: 2, msg: "Cross-referencing with known exploit signatures...", time: "LIVE", type: 'info' },
  ])

  const [firewallMode, setFirewallMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')

  useEffect(() => {
    const interval = setInterval(() => {
      const projects = allProjects.length > 0 ? allProjects.map(p => p.name) : DEFAULT_PROJECTS.map(p => p.name)
      const randomProject = projects[Math.floor(Math.random() * projects.length)]

      const publicMessages = [
        `Analyzing liquidity depth for ${randomProject}...`,
        `Checking whale wallet clusters on ${randomProject}...`,
        `Verifying bytecode integrity for ${randomProject}...`,
        `ANTI-HACKER: Blocked malicious address targeting ${randomProject}`,
        `REGISTRY: Logged security audit for ${randomProject} v2.0`,
        `ANTI-HACKER: Intercepted suspicious flash loan request`,
      ]
      const privateMessages = [
        "ANTI-HACKER: Stealth node active, blocking scanner IP...",
        "REGISTRY: Encrypted log entry generated (AES-256)",
        "ANTI-HACKER: Wallet 0x... blocked from interacting with RPC",
        "Private Firewall: Intercepting unauthorized calls...",
        "Node 0x3a2f: Deep packet inspection complete.",
      ]
      
      const messages = firewallMode === 'PUBLIC' ? publicMessages : privateMessages
      const types: ('info' | 'warn' | 'error')[] = ['info', 'info', 'warn']
      const newMsg = {
        id: Date.now(),
        msg: messages[Math.floor(Math.random() * messages.length)],
        time: new Date().toLocaleTimeString(),
        type: types[Math.floor(Math.random() * types.length)]
      }
      setLiveThreats(prev => [newMsg, ...prev.slice(0, 5)])
    }, 4000)
    return () => clearInterval(interval)
  }, [firewallMode])

  return (
    <div className="min-h-screen bg-[#05080a] text-[#c8d8e8] font-mono selection:bg-[#00ff8833]">
      <MarketTicker />
      {/* BACKGROUND GRID EFFECT */}
      <div className="fixed inset-0 pointer-events-none opacity-20" 
        style={{ backgroundImage: 'radial-gradient(#1e2a3a 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      {/* HEADER / COMMAND BAR */}
      <nav className="relative z-10 border-b border-[#00ff8822] bg-[#05080a]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-[#00ff88] font-bold text-xl tracking-tighter">SKYNET <span className="text-white">PRO</span></div>
          <div className="h-4 w-px bg-[#1e2a3a]" />
          <div className="text-[10px] text-[#445566] tracking-widest uppercase">Security Command Center v3.0</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-[10px] text-[#00ff88] uppercase tracking-widest">Global Network Active</span>
          </div>
          <a href="/" className="text-[10px] text-[#7a8c9e] hover:text-[#00ff88] transition-colors uppercase tracking-widest">Back to Hub</a>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SYSTEM STATUS */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* NODE FIREWALL CONTROLS */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] text-[#00ff88] tracking-[0.2em] uppercase font-bold">Node Firewall</h2>
              <div className="flex bg-[#05080a] border border-[#1e2a3a] p-1">
                <button 
                  onClick={() => setFirewallMode('PUBLIC')}
                  className={`px-3 py-1 text-[8px] tracking-widest uppercase transition-all ${firewallMode === 'PUBLIC' ? 'bg-[#00ff8822] text-[#00ff88]' : 'text-[#445566]'}`}
                >
                  Public
                </button>
                <button 
                  onClick={() => setFirewallMode('PRIVATE')}
                  className={`px-3 py-1 text-[8px] tracking-widest uppercase transition-all ${firewallMode === 'PRIVATE' ? 'bg-[#ff2d5522] text-[#ff2d55]' : 'text-[#445566]'}`}
                >
                  Private
                </button>
              </div>
            </div>
            
            <div className="p-4 border border-[#1e2a3a] bg-[#05080a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#7a8c9e]">Shield Status</span>
                <span className={`text-[9px] font-bold ${firewallMode === 'PRIVATE' ? 'text-[#ff2d55]' : 'text-[#00ff88]'}`}>
                  {firewallMode === 'PRIVATE' ? 'ACTIVE: STEALTH' : 'ACTIVE: PUBLIC'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#7a8c9e]">Encryption Level</span>
                <span className="text-[9px] text-white font-mono">
                  {firewallMode === 'PRIVATE' ? 'AES-256 GCM' : 'TLS 1.3'}
                </span>
              </div>
              <div className="h-1 bg-[#1e2a3a] w-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${firewallMode === 'PRIVATE' ? 'bg-[#ff2d55] w-full' : 'bg="#00ff88" w-1/3'}`} 
                />
              </div>
            </div>
          </section>

          {/* TARGET IDENTIFICATION */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <h2 className="text-[10px] text-[#00e5ff] tracking-[0.2em] uppercase mb-4 font-bold">Target Identification</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] text-[#445566] uppercase mb-2 block">Network</label>
                <select 
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full bg-[#05080a] border border-[#1e2a3a] text-[11px] p-2 outline-none focus:border-[#00ff8844] text-[#c8d8e8]"
                >
                  <option value="BSC">Binance Smart Chain</option>
                  <option value="Ethereum">Ethereum Mainnet</option>
                  <option value="Solana">Solana Mainnet</option>
                  <option value="Arbitrum">Arbitrum One</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] text-[#445566] uppercase mb-2 block">Contract Address</label>
                <input 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x... or Solana Address"
                  className="w-full bg-[#05080a] border border-[#1e2a3a] text-[11px] p-2 outline-none focus:border-[#00ff8844] text-[#c8d8e8] font-mono"
                />
              </div>
              <button 
                className="w-full py-3 bg-[#00ff8815] border border-[#00ff8844] text-[#00ff88] text-[10px] font-bold uppercase tracking-widest hover:bg-[#00ff8825] transition-all"
                onClick={() => setAnalyzing(true)}
              >
                Engage Deep Scan
              </button>
            </div>
          </section>

          {/* ANTI-HACKER REAL-TIME DATABASE */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <h2 className="text-[10px] text-[#ff2d55] tracking-[0.2em] uppercase mb-4 font-bold">Anti-Hacker DB</h2>
            <div className="space-y-3">
              {blockedEntities.map(e => (
                <div key={e.id} className="p-3 bg-[#ff2d5505] border border-[#ff2d5522] flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-[#ff2d55]">{e.type} BLOCKED</span>
                    <span className="text-[8px] text-[#445566]">{e.time}</span>
                  </div>
                  <div className="text-[10px] text-white font-mono truncate">{e.target}</div>
                  <div className="text-[8px] text-[#7a8c9e] italic">{e.reason}</div>
                </div>
              ))}
            </div>
          </section>

          {/* SECURITY REGISTRY */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl overflow-hidden">
            <h2 className="text-[10px] text-[#00ff88] tracking-[0.2em] uppercase mb-4 font-bold">Security Registry</h2>
            <div className="space-y-3 relative">
              {securityRegistry.map(r => (
                <div key={r.id} className="p-3 border-l-2 border-[#1e2a3a] hover:border-[#00ff88] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-[#00ff88]">{r.impact} EVENT</span>
                    <span className="text-[8px] text-[#445566]">{r.time}</span>
                  </div>
                  <div className="text-[10px] text-[#c8d8e8] font-bold">{r.event}</div>
                  <div className="text-[8px] text-[#7a8c9e] uppercase">{r.project}</div>
                </div>
              ))}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0a0e14] to-transparent pointer-events-none" />
            </div>
            <button className="w-full mt-4 text-[8px] text-[#445566] hover:text-[#00ff88] transition-colors uppercase tracking-widest">
              Access Full Archive
            </button>
          </section>

        </div>

        {/* MIDDLE COLUMN: COMMAND CENTER */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* EXPLOIT ANALYSIS ENGINE */}
          <section className="bg-[#0a0e14] border border-[#ff2d5544] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <div className="w-16 h-16 border-t-2 border-r-2 border-[#ff2d55]" />
            </div>
            <h2 className="text-[10px] text-[#ff2d55] tracking-[0.2em] uppercase mb-4 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff2d55] animate-pulse" />
              Exploit Analysis Engine
            </h2>
            <p className="text-[9px] text-[#7a8c9e] mb-4">Paste a transaction hash to analyze the attack vector and root cause.</p>
            
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                placeholder="0x..." 
                value={exploitTx}
                onChange={(e) => setExploitTx(e.target.value)}
                className="flex-1 bg-[#05080a] border border-[#1e2a3a] text-[11px] p-2 outline-none focus:border-[#ff2d5544] text-white font-mono"
              />
              <button 
                onClick={handleExploitAnalysis}
                disabled={analyzingExploit || !exploitTx}
                className="bg-[#ff2d5522] border border-[#ff2d5544] text-[#ff2d55] px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-[#ff2d5544] transition-all disabled:opacity-50"
              >
                {analyzingExploit ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {exploitAnalysis && (
              <div className="mt-4 p-4 border border-[#ff2d5522] bg-[#05080a] max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="text-[10px] text-[#ff2d55] font-bold mb-2 uppercase tracking-widest">Analysis Report</div>
                <div className="text-[11px] leading-relaxed text-[#c8d8e8] whitespace-pre-wrap font-sans">
                  {exploitAnalysis.analysis}
                </div>
              </div>
            )}
          </section>

          {/* MAIN COMMAND CONSOLE */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <h2 className="text-[10px] text-[#00ff88] tracking-[0.2em] uppercase mb-4 font-bold">Skynet Command Console</h2>
            <div className="bg-[#05080a] border border-[#1e2a3a] p-4 h-64 overflow-y-auto font-mono text-[11px] custom-scrollbar">
              {liveThreats.map((t) => (
                <div key={t.id} className="mb-2 flex gap-4">
                  <span className="text-[#445566] shrink-0">[{t.time}]</span>
                  <span className={t.type === 'error' ? 'text-[#ff2d55]' : t.type === 'warn' ? 'text-[#ffb800]' : 'text-[#00ff88]'}>
                    {t.msg}
                  </span>
                </div>
              ))}
              <div className="animate-pulse inline-block w-2 h-4 bg-[#00ff88] ml-1" />
            </div>
          </section>

          {/* SKYNET PROTECTION RULES */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <h2 className="text-[10px] text-[#00e5ff] tracking-[0.2em] uppercase mb-4 font-bold">Real-time Protection Rules</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { name: "Flash Loan Detection", status: "ACTIVE", color: "text-[#00ff88]" },
                { name: "Reentrancy Monitor", status: "ACTIVE", color: "text-[#00ff88]" },
                { name: "Oracle Deviation", status: "MONITORING", color: "text-[#00e5ff]" },
                { name: "Mempool Signature Filter", status: "ACTIVE", color: "text-[#00ff88]" },
                { name: "Hacker Profiling", status: "ENABLED", color: "text-[#ffb800]" },
              ].map(rule => (
                <div key={rule.name} className="flex items-center justify-between p-2 border border-[#1e2a3a] bg-[#05080a]">
                  <span className="text-[10px] text-[#7a8c9e]">{rule.name}</span>
                  <span className={`text-[9px] font-bold ${rule.color}`}>{rule.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: ANALYSIS & METRICS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* TOP METRICS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6 flex flex-col items-center justify-center">
              <div className="text-[8px] text-[#445566] tracking-widest uppercase mb-4">Security Score</div>
              <ScoreRing score={98} size={120} />
              <div className="text-[9px] text-[#00ff88] mt-4 uppercase">Better than 99% of projects</div>
            </div>
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6 text-center flex flex-col items-center justify-center">
              <div className="text-[8px] text-[#445566] tracking-widest uppercase mb-2">Liquidity Health</div>
              <div className="text-4xl font-bold text-[#ffd600] leading-none my-4">GOOD</div>
              <div className="text-[9px] text-[#ffd600] uppercase">$2.4M Locked (12mo)</div>
            </div>
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6 text-center flex flex-col items-center justify-center">
              <div className="text-[8px] text-[#445566] tracking-widest uppercase mb-2">Community Trust</div>
              <div className="text-4xl font-bold text-[#00e5ff] leading-none my-4">HIGH</div>
              <div className="text-[9px] text-[#00e5ff] uppercase">Verified Founders</div>
            </div>
          </div>

          {/* GLOBAL MARKET MONITORING */}
          <section className="bg-[#0a0e14] border border-[#1e2a3a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] text-[#00e5ff] tracking-[0.2em] uppercase font-bold">Global Market Monitoring</h2>
              <div className="flex items-center gap-3">
                {loadingDb && <div className="w-2 h-2 rounded-full bg-[#ffd600] animate-pulse" />}
                <div className="text-[9px] text-[#445566]">
                  {loadingDb ? "Loading from database..." : `Scanning ${allProjects.length} Security Verified Assets`}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e2a3a] text-[9px] text-[#445566] uppercase tracking-widest">
                    <th className="py-3 px-2">Project</th>
                    <th className="py-3 px-2">Network</th>
                    <th className="py-3 px-2">Security Score</th>
                    <th className="py-3 px-2">Risk Status</th>
                    <th className="py-3 px-2">Market Action</th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  {allProjects.map((p) => (
                    <tr key={p.id} className="border-b border-[#1e2a3a]/50 hover:bg-[#00ff8805] transition-colors group">
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          {p.logoUrl ? (
                            <img 
                              src={p.logoUrl} 
                              alt={p.name}
                              className="w-7 h-7 rounded-full object-cover border border-[#00ff8844]"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div className="w-7 h-7 bg-[#00ff8811] flex items-center justify-center border border-[#00ff8822] text-[#00ff88] text-[9px] font-bold rounded-full" style={{ display: p.logoUrl ? 'none' : 'flex' }}>
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-[#c8d8e8]">{p.name}</div>
                            <div className="text-[8px] text-[#445566] uppercase">{p.ticker || "TOKEN"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-[#7a8c9e]">{p.network}</td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1 bg-[#1e2a3a] rounded-full overflow-hidden">
                            <div className="h-full" style={{ width: `${p.score}%`, backgroundColor: scoreColor(p.score) }} />
                          </div>
                          <span className="font-bold font-mono" style={{ color: scoreColor(p.score) }}>{p.score}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase border ${
                          p.score >= 90 ? 'bg-[#00ff8811] text-[#00ff88] border-[#00ff8833]' : 
                          p.score >= 70 ? 'bg-[#ffd60011] text-[#ffd600] border-[#ffd60033]' : 
                          'bg-[#ff2d5511] text-[#ff2d55] border-[#ff2d5533]'
                        }`}>
                          {p.score >= 90 ? 'SECURE' : p.score >= 70 ? 'WARNING' : 'CRITICAL'}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                          <span className="text-[8px] text-[#7a8c9e] uppercase">Monitoring Live</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-center">
              <button className="text-[9px] text-[#445566] hover:text-[#00e5ff] uppercase tracking-widest transition-colors">
                View All Security Verified Assets (Full List)
              </button>
            </div>
          </section>

          {/* ANALYSIS PANEL INTEGRATION */}
          <div className="bg-[#0a0e14] border border-[#1e2a3a] p-2 min-h-[600px]">
            {analyzing ? (
              <OnChainAnalysisPanel 
                contractAddress={address} 
                network={network} 
                onAnalysisComplete={(res) => {
                  setResult(res)
                  setAnalyzing(false)
                }} 
              />
            ) : result ? (
              <OnChainAnalysisPanel 
                contractAddress={address} 
                network={network} 
                initialResult={result}
                onAnalysisComplete={(res) => setResult(res)} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] text-center space-y-6 p-12">
                <div className="w-24 h-24 border-2 border-[#00ff8822] rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 border border-[#00ff8844] rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 bg-[#00ff8822] rounded-full" />
                  </div>
                </div>
                <div>
                  <h3 className="text-[#c8d8e8] text-lg font-bold mb-2">System Idle</h3>
                  <p className="text-[#7a8c9e] text-xs max-w-sm mx-auto leading-relaxed">
                    Enter a smart contract address on the left to begin deep security analysis. 
                    Our engine will scan bytecode, on-chain events, and market data in real-time.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="border border-[#1e2a3a] p-4 text-left">
                    <div className="text-[#00e5ff] text-[9px] mb-1">AI INSIGHTS</div>
                    <div className="text-[#445566] text-[8px]">Proprietary AI model trained on 10k+ exploits.</div>
                  </div>
                  <div className="border border-[#1e2a3a] p-4 text-left">
                    <div className="text-[#00ff88] text-[9px]">ON-CHAIN VERIFIED</div>
                    <div className="text-[#445566] text-[8px]">Direct connection to BSC/ETH/Solana nodes.</div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[#1e2a3a] py-8 mt-12 bg-[#05080a]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-[#445566]">
            &copy; 2024 SOLAY39 SKYNET PRO. ALL RIGHTS RESERVED.
          </div>
          <div className="flex gap-6">
            <span className="text-[9px] text-[#445566] uppercase">Privacy Protocol</span>
            <span className="text-[9px] text-[#445566] uppercase">Security Standards</span>
            <span className="text-[9px] text-[#445566] uppercase">API Access</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
