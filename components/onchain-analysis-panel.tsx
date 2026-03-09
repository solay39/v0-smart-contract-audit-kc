"use client"

import { useState } from "react"

interface AnalysisResult {
  tokenData: {
    name: string
    symbol: string
    network: string
    tokenAddress: string
    totalSupply: string
    decimals: number
    price?: number
    marketCap?: number
    volume24h?: number
    totalHolders: number
    mintAuthority?: string | null
    freezeAuthority?: string | null
    topHolders: { address: string; percentage: number }[]
    liquidityPools: { dex: string; pair: string; liquidity: string; lpLocked: boolean }[]
  }
  analysis: {
    tokenomicsAnalysis: string
    whaleDistribution: string
    insiderWallets: string
    devWalletAnalysis: string
    supplyAnalysis: string
    rugPullRisk: string
    priceManipulation: string
    overallRiskScore: number
    recommendation: string
  }
  timestamp: string
}

interface Props {
  contractAddress: string
  network: string
  onAnalysisComplete?: (result: AnalysisResult) => void
}

export function OnChainAnalysisPanel({ contractAddress, network, onAnalysisComplete }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>("summary")

  const runAnalysis = async () => {
    if (!contractAddress) {
      setError("Enter a contract address first")
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch("/api/onchain-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: contractAddress, network }),
      })
      
      const data = await res.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        onAnalysisComplete?.(data)
      }
    } catch (e) {
      setError("Analysis failed: " + (e instanceof Error ? e.message : String(e)))
    }
    
    setLoading(false)
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return "#00ff88"
    if (score <= 60) return "#ffd600"
    return "#ff2d55"
  }

  const getRiskLabel = (score: number) => {
    if (score <= 30) return "LOW RISK"
    if (score <= 60) return "MEDIUM RISK"
    return "HIGH RISK"
  }

  const Section = ({ 
    id, 
    title, 
    content, 
    icon,
    severity,
  }: { 
    id: string
    title: string
    content: string
    icon: string
    severity?: "safe" | "warning" | "danger"
  }) => {
    const isExpanded = expandedSection === id
    const severityColor = severity === "safe" ? "#00ff88" : severity === "danger" ? "#ff2d55" : severity === "warning" ? "#ffd600" : "#00e5ff"
    
    return (
      <div style={{ 
        background: "#0a0e14", 
        border: `1px solid ${isExpanded ? severityColor + "40" : "#1e2a3a"}`,
        marginBottom: 8,
        transition: "border-color 0.2s",
      }}>
        <button
          onClick={() => setExpandedSection(isExpanded ? null : id)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ color: "#c8d8e8", fontSize: 11, fontWeight: 600, letterSpacing: "0.02em" }}>{title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {severity && (
              <span style={{ 
                fontSize: 8, 
                padding: "2px 8px", 
                background: severityColor + "15",
                border: `1px solid ${severityColor}30`,
                color: severityColor,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}>
                {severity.toUpperCase()}
              </span>
            )}
            <span style={{ color: "#445566", fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
          </div>
        </button>
        {isExpanded && (
          <div style={{ 
            padding: "0 14px 14px 14px",
            color: "#8899aa",
            fontSize: 10,
            lineHeight: 1.7,
            borderTop: "1px solid #1e2a3a",
            paddingTop: 12,
          }}>
            {content}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: "#060a0f", border: "1px solid #0f1a24", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ color: "#00e5ff", fontSize: 8, letterSpacing: "0.2em", marginBottom: 4 }}>AI SECURITY ANALYSIS</div>
          <div style={{ color: "#c8d8e8", fontSize: 13, fontWeight: 700 }}>On-Chain Token Analysis</div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading || !contractAddress}
          style={{
            background: loading ? "#1e2a3a" : "#00ff8815",
            border: "1px solid #00ff8830",
            color: "#00ff88",
            fontSize: 10,
            fontWeight: 700,
            padding: "8px 16px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
            letterSpacing: "0.05em",
          }}
        >
          {loading ? "ANALYZING..." : "RUN AI ANALYSIS"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ 
          background: "#ff2d5510", 
          border: "1px solid #ff2d5530", 
          padding: "10px 14px", 
          marginBottom: 16,
          color: "#ff6b6b",
          fontSize: 10,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ color: "#00e5ff", fontSize: 24, marginBottom: 12 }}>⟳</div>
          <div style={{ color: "#00e5ff", fontSize: 11, marginBottom: 4 }}>Fetching on-chain data...</div>
          <div style={{ color: "#445566", fontSize: 9 }}>Analyzing tokenomics, whale distribution, rug risk with AI</div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Risk Score Summary */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr 1fr", 
            gap: 12, 
            marginBottom: 16,
          }}>
            {/* Overall Risk */}
            <div style={{ 
              background: "#0a0e14", 
              border: `1px solid ${getRiskColor(result.analysis.overallRiskScore)}30`,
              padding: 16,
              textAlign: "center",
            }}>
              <div style={{ color: "#445566", fontSize: 7, letterSpacing: "0.15em", marginBottom: 6 }}>RISK SCORE</div>
              <div style={{ 
                color: getRiskColor(result.analysis.overallRiskScore), 
                fontSize: 32, 
                fontWeight: 700,
                lineHeight: 1,
              }}>
                {result.analysis.overallRiskScore}
              </div>
              <div style={{ 
                color: getRiskColor(result.analysis.overallRiskScore), 
                fontSize: 9, 
                fontWeight: 700,
                marginTop: 4,
              }}>
                {getRiskLabel(result.analysis.overallRiskScore)}
              </div>
            </div>

            {/* Market Cap */}
            <div style={{ 
              background: "#0a0e14", 
              border: "1px solid #1e2a3a",
              padding: 16,
              textAlign: "center",
            }}>
              <div style={{ color: "#445566", fontSize: 7, letterSpacing: "0.15em", marginBottom: 6 }}>MARKET CAP</div>
              <div style={{ color: "#c8d8e8", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                ${result.tokenData.marketCap?.toLocaleString() || "N/A"}
              </div>
              <div style={{ color: "#7a8c9e", fontSize: 9, marginTop: 4 }}>
                {result.tokenData.totalHolders} holders
              </div>
            </div>

            {/* Liquidity */}
            <div style={{ 
              background: "#0a0e14", 
              border: "1px solid #1e2a3a",
              padding: 16,
              textAlign: "center",
            }}>
              <div style={{ color: "#445566", fontSize: 7, letterSpacing: "0.15em", marginBottom: 6 }}>LIQUIDITY</div>
              <div style={{ color: "#c8d8e8", fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                ${result.tokenData.liquidityPools.reduce((sum, lp) => sum + parseFloat(lp.liquidity || "0"), 0).toLocaleString()}
              </div>
              <div style={{ color: result.tokenData.liquidityPools.some(lp => lp.lpLocked) ? "#00ff88" : "#ff6b00", fontSize: 9, marginTop: 4 }}>
                {result.tokenData.liquidityPools.some(lp => lp.lpLocked) ? "LP LOCKED" : "LP NOT LOCKED"}
              </div>
            </div>
          </div>

          {/* Token Info */}
          <div style={{ 
            background: "#0a0e14", 
            border: "1px solid #1e2a3a",
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                background: "#00e5ff15", 
                border: "1px solid #00e5ff30",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "#00e5ff",
              }}>
                {result.tokenData.symbol.slice(0, 2)}
              </div>
              <div>
                <div style={{ color: "#c8d8e8", fontSize: 14, fontWeight: 700 }}>{result.tokenData.name}</div>
                <div style={{ color: "#7a8c9e", fontSize: 10 }}>{result.tokenData.symbol} • {result.tokenData.network}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 9 }}>
              <div>
                <span style={{ color: "#445566" }}>Price: </span>
                <span style={{ color: "#c8d8e8" }}>${result.tokenData.price?.toFixed(8) || "N/A"}</span>
              </div>
              <div>
                <span style={{ color: "#445566" }}>24h Volume: </span>
                <span style={{ color: "#c8d8e8" }}>${result.tokenData.volume24h?.toLocaleString() || "N/A"}</span>
              </div>
              <div>
                <span style={{ color: "#445566" }}>Mint Authority: </span>
                <span style={{ color: result.tokenData.mintAuthority === null ? "#00ff88" : "#ff2d55" }}>
                  {result.tokenData.mintAuthority === null ? "Disabled" : "Active (Risk)"}
                </span>
              </div>
              <div>
                <span style={{ color: "#445566" }}>Freeze Authority: </span>
                <span style={{ color: result.tokenData.freezeAuthority === null ? "#00ff88" : "#ff6b00" }}>
                  {result.tokenData.freezeAuthority === null ? "Disabled" : "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Top Holders */}
          <div style={{ 
            background: "#0a0e14", 
            border: "1px solid #1e2a3a",
            padding: 14,
            marginBottom: 16,
          }}>
            <div style={{ color: "#445566", fontSize: 8, letterSpacing: "0.1em", marginBottom: 10 }}>TOP HOLDERS</div>
            {result.tokenData.topHolders.slice(0, 10).map((holder, i) => (
              <div key={i} style={{ 
                display: "flex", 
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: i < 9 ? "1px solid #1e2a3a" : "none",
                fontSize: 9,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#445566", width: 16 }}>#{i + 1}</span>
                  <span style={{ color: "#7a8c9e", fontFamily: "monospace" }}>
                    {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                  </span>
                </div>
                <div style={{ 
                  color: holder.percentage > 20 ? "#ff2d55" : holder.percentage > 10 ? "#ffd600" : "#00ff88",
                  fontWeight: 700,
                }}>
                  {holder.percentage.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>

          {/* Analysis Sections */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: "#445566", fontSize: 8, letterSpacing: "0.1em", marginBottom: 10 }}>AI ANALYSIS REPORT</div>
          </div>

          <Section 
            id="summary"
            title="Executive Summary & Recommendation" 
            content={result.analysis.recommendation}
            icon="📋"
            severity={result.analysis.overallRiskScore <= 30 ? "safe" : result.analysis.overallRiskScore <= 60 ? "warning" : "danger"}
          />

          <Section 
            id="tokenomics"
            title="Tokenomics Analysis" 
            content={result.analysis.tokenomicsAnalysis}
            icon="📊"
          />

          <Section 
            id="whale"
            title="Whale Distribution" 
            content={result.analysis.whaleDistribution}
            icon="🐋"
            severity={result.tokenData.topHolders[0]?.percentage > 30 ? "danger" : result.tokenData.topHolders[0]?.percentage > 15 ? "warning" : "safe"}
          />

          <Section 
            id="insider"
            title="Insider Wallets Detection" 
            content={result.analysis.insiderWallets}
            icon="🔍"
          />

          <Section 
            id="dev"
            title="Dev Wallet Analysis" 
            content={result.analysis.devWalletAnalysis}
            icon="👨‍💻"
          />

          <Section 
            id="supply"
            title="Supply Analysis" 
            content={result.analysis.supplyAnalysis}
            icon="💰"
            severity={result.tokenData.mintAuthority ? "danger" : "safe"}
          />

          <Section 
            id="rug"
            title="Rug Pull Risk Assessment" 
            content={result.analysis.rugPullRisk}
            icon="⚠️"
            severity={result.analysis.overallRiskScore > 60 ? "danger" : result.analysis.overallRiskScore > 30 ? "warning" : "safe"}
          />

          <Section 
            id="manipulation"
            title="Price Manipulation Risk" 
            content={result.analysis.priceManipulation}
            icon="📈"
          />

          {/* Timestamp */}
          <div style={{ 
            textAlign: "center", 
            marginTop: 16, 
            padding: "12px 0",
            borderTop: "1px solid #1e2a3a",
            color: "#445566",
            fontSize: 8,
          }}>
            Analysis completed at {new Date(result.timestamp).toLocaleString()} by Solay39 AI Security Engine v2.0
          </div>
        </>
      )}

      {/* Initial State */}
      {!result && !loading && !error && (
        <div style={{ textAlign: "center", padding: 40, color: "#445566" }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🔬</div>
          <div style={{ fontSize: 11, marginBottom: 4 }}>No analysis yet</div>
          <div style={{ fontSize: 9 }}>Click "RUN AI ANALYSIS" to fetch on-chain data and generate security report</div>
        </div>
      )}
    </div>
  )
}
