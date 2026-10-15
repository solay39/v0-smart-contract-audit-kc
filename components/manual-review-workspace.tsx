"use client"

// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — AI-Guided Manual Review Workspace
// components/manual-review-workspace.tsx
//
// Il cuore del sistema di audit umano guidato dall'AI.
//
// Flusso:
// 1. L'AI genera una checklist DINAMICA specifica per il contratto
// 2. L'auditor lavora side-by-side: codice a sx, checklist a dx
// 3. Ogni finding AI ha 3 azioni: ✅ Conferma / ❌ Falso positivo / ⚠️ Modifica
// 4. L'auditor può aggiungere finding manuali
// 5. Solo dopo aver completato la review può firmare
//
// Integrazione: importa in audit-workspace.tsx e aggiungi un tab "Review"
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react"
import { OnChainAnalysisPanel } from "./onchain-analysis-panel"

// ─── Types ───────────────────────────────────────────────────────

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
type CheckStatus = "pending" | "pass" | "fail" | "na"
type FindingDecision = "pending" | "confirmed" | "false-positive" | "modified"

interface DynamicCheckItem {
  id: string
  category: string
  question: string                // "Is the mint authority verified before minting?"
  why: string                     // "Missing mint authority check allows anyone to mint"
  severity: Severity
  relevantCode?: string           // Snippet di codice rilevante
  lineRef?: string                // "lib.rs:42-48"
  status: CheckStatus
  note: string                    // Nota dell'auditor
  aiGenerated: boolean            // true = generata dall'AI per questo contratto
}

interface AIFindingReview {
  id: string
  title: string
  severity: Severity
  location: string
  description: string
  impact: string
  recommendation: string
  proofOfConcept?: string
  decision: FindingDecision
  auditorNote: string             // L'auditor spiega perché conferma/rigetta
  modifiedSeverity?: Severity     // Se l'auditor cambia la severity
  modifiedDescription?: string
}

interface ManualFinding {
  id: string
  title: string
  severity: Severity
  location: string
  description: string
  impact: string
  recommendation: string
  addedBy: "manual"
}

interface OnChainAnalysis {
  // Token info
  tokenName?: string
  tokenSymbol?: string
  tokenAddress?: string
  tokenNetwork?: string
  marketCap?: number
  liquidity?: number
  price?: number
  volume24h?: number
  holders?: number
  // Analysis results
  executiveSummary?: string
  tokenEconomics?: string
  whaleDistribution?: string
  insiderWallets?: string
  devWalletAnalysis?: string
  supplyAnalysis?: string
  rugPullRisk?: string
  priceManipulation?: string
  hiddenGovernance?: string
  complexBugs?: string
  liquidityAnalysis?: string
  clusterAnalysis?: string
  scenarioAnalysis?: string
  recommendation?: string
  overallRiskScore?: number
  scores?: {
    smartContractSecurity?: number
    decentralization?: number
    liquidityHealth?: number
    manipulationRisk?: string
  }
  topHolders?: { address: string; percentage: number }[]
}

interface ReviewSession {
  contractAddress: string
  contractName: string
  network: string
  startedAt: string
  completedAt?: string
  auditorWallet?: string
  solanaWallet?: string
  checks: DynamicCheckItem[]
  aiFindings: AIFindingReview[]
  manualFindings: ManualFinding[]
  reviewNotes: string
  signed: boolean
  signature?: string
  solanaSignature?: string
  onChainAnalysis?: OnChainAnalysis
  }

// ─── Props ────────────────────────────────────────────────────────

interface ManualReviewWorkspaceProps {
  contractSource: string
  contractAddress: string
  contractName: string
  network: string
  // Finding dall'AI (da skynet/route.ts)
  aiFindings: Array<{
    title: string
    severity: string
    location: string
    description: string
    impact: string
    recommendation: string
    proofOfConcept?: string
  }>
  // Chiamata immediatamente quando l'auditor clicca "SAVE TO AUDIT REPORT" nel pannello on-chain
  onOnChainFindings?: (findings: Array<{
    id: string
    title: string
    severity: string
    location: string
    description: string
    impact: string
    recommendation: string
  }>) => void
  // Chiamata immediatamente per salvare i dati on-chain analysis per il PDF/report
  onOnChainAnalysisData?: (data: OnChainAnalysis) => void
  // Chiamata quando l'auditor completa e firma la review
  onReviewComplete: (session: ReviewSession) => void
}

// ─── Severity config ──────────────────────────────────────────────

const REVIEW_GUIDE = [
  { id: "onchain" as const, number: "01", title: "Deployment & config", instruction: "Confronta address, chain, bytecode verificato, compiler, constructor args, proxy implementation e admin con il deployment reale." },
  { id: "checklist" as const, number: "02", title: "Roles & governance", instruction: "Identifica owner, minter, pauser, upgrader e guardian. Verifica multisig, quorum, timelock, renounce/transfer e ogni funzione privilegiata." },
  { id: "findings" as const, number: "03", title: "Threat model", instruction: "Per ogni rischio prova il percorso d'attacco: attore, precondizioni, asset a rischio, impatto, mitigazione e test o evidenza che lo chiude." },
  { id: "manual" as const, number: "04", title: "Coverage & warnings", instruction: "Controlla coverage line/branch/function, fuzz/invariant tests, warning Solidity e dipendenze. Ogni eccezione deve avere una motivazione scritta." },
  { id: "summary" as const, number: "05", title: "Evidence & sign-off", instruction: "Non firmare con check pending, finding non deciso o evidenza mancante. Salva note, link explorer, commit e limiti residui della review." },
]

const SEV: Record<Severity, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: "#ff4444", bg: "#ff444418", label: "CRITICAL" },
  HIGH:     { color: "#ff8800", bg: "#ff880018", label: "HIGH" },
  MEDIUM:   { color: "#ffcc00", bg: "#ffcc0018", label: "MEDIUM" },
  LOW:      { color: "#44aaff", bg: "#44aaff18", label: "LOW" },
  INFO:     { color: "#888888", bg: "#88888818", label: "INFO" },
}

// ─── Main component ───────────────────────────────────────────────

export default function ManualReviewWorkspace({
  contractSource,
  contractAddress,
  contractName,
  network,
  aiFindings,
  onOnChainFindings,
  onOnChainAnalysisData,
  onReviewComplete,
}: ManualReviewWorkspaceProps) {

  const [session, setSession] = useState<ReviewSession>({
    contractAddress,
    contractName,
    network,
    startedAt: new Date().toISOString(),
    checks: [],
    aiFindings: aiFindings.map((f, i) => ({
      id: `AI-${String(i + 1).padStart(3, "0")}`,
      title: f.title,
      severity: f.severity as Severity,
      location: f.location,
      description: f.description,
      impact: f.impact,
      recommendation: f.recommendation,
      proofOfConcept: f.proofOfConcept,
      decision: "pending",
      auditorNote: "",
    })),
    manualFindings: [],
    reviewNotes: "",
    signed: false,
  })

  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [activeSection, setActiveSection] = useState<"onchain" | "checklist" | "findings" | "manual" | "summary">("onchain")
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null)
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null)
  const [addingManual, setAddingManual] = useState(false)
  const [newFinding, setNewFinding] = useState<Partial<ManualFinding>>({})

  // ── Deep Review state ─────────────────────────────────────────
  const [deepReviewLoading, setDeepReviewLoading] = useState(false)
  const [deepReviewDone, setDeepReviewDone] = useState(false)
  const [deepReviewError, setDeepReviewError] = useState("")
  const [deepReviewSummary, setDeepReviewSummary] = useState("")
  const [deepReviewCompilerNote, setDeepReviewCompilerNote] = useState("")
  const [deepReviewContractType, setDeepReviewContractType] = useState("")
  const [deepReviewPrivilegedRoles, setDeepReviewPrivilegedRoles] = useState<Array<{role: string; capability: string; risk: string}>>([])
  const [deepReviewSource, setDeepReviewSource] = useState<{
    contractName: string; compiler: string; linesOfCode: number; fetchedFrom: string; sourcePreview: string
  } | null>(null)
  const [findingVerifications, setFindingVerifications] = useState<Array<{
    findingId: string
    verdict: "CONFIRMED" | "FALSE_POSITIVE" | "SEVERITY_WRONG" | "NEEDS_CLARIFICATION"
    reason: string
    suggestedSeverity?: string
  }>>([])
  const [missingFindings, setMissingFindings] = useState<Array<{
    id: string; title: string; severity: string; location: string
    description: string; impact: string; recommendation: string; codeEvidence?: string
    approved?: boolean; rejected?: boolean
  }>>([])

  // ── Run deep review ────────────────────────────────────────────
  const runDeepReview = useCallback(async () => {
    if (!contractAddress || deepReviewLoading || deepReviewDone) return
    setDeepReviewLoading(true)
    setDeepReviewError("")
    try {
      const res = await fetch("/api/deep-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress,
          network,
          aiFindings: aiFindings.map((f, i) => ({
            id: `AI-${String(i + 1).padStart(3, "0")}`,
            title: f.title,
            severity: f.severity,
            location: f.location,
            description: f.description,
            impact: f.impact,
          })),
          fallbackSource: contractSource.slice(0, 12000),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeepReviewError(data.error || "Deep review failed")
        return
      }
      // Populate state
      setDeepReviewSummary(data.summary || "")
      setDeepReviewCompilerNote(data.compilerNote || "")
      setDeepReviewContractType(data.contractType || "")
      setDeepReviewPrivilegedRoles(data.privilegedRoles || [])
      setDeepReviewSource(data.realSource || null)
      setFindingVerifications(data.findingVerifications || [])
      setMissingFindings((data.missingFindings || []).map((f: { id: string; title: string; severity: string; location: string; description: string; impact: string; recommendation: string; codeEvidence?: string }) => ({
        ...f, approved: false, rejected: false,
      })))
      // Replace checklist with deep-review specific one
      if (data.checklist?.length > 0) {
        setSession(s => ({ ...s, checks: data.checklist }))
      }
      setDeepReviewDone(true)
    } catch (e) {
      setDeepReviewError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setDeepReviewLoading(false)
    }
  }, [contractAddress, network, aiFindings, contractSource, deepReviewLoading, deepReviewDone])
  const [codeSearch, setCodeSearch] = useState("")
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState("")

  // ── Auto-run deep review on mount ─────────────────────────────
  useEffect(() => {
    if (contractAddress && !deepReviewDone && !deepReviewLoading) {
      runDeepReview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress])

  // ── Aggiorna stato di un check ─────────────────────────────────

  function updateCheck(id: string, status: CheckStatus, note?: string) {
    setSession(s => ({

      ...s,
      checks: s.checks.map(c =>
        c.id === id ? { ...c, status, note: note ?? c.note } : c
      ),
    }))
  }

  // ── Aggiorna decisione su un finding AI ───────────────────────

  function updateFindingDecision(
    id: string,
    decision: FindingDecision,
    note?: string,
    modifiedSeverity?: Severity
  ) {
    setSession(s => ({
      ...s,
      aiFindings: s.aiFindings.map(f =>
        f.id === id
          ? { ...f, decision, auditorNote: note ?? f.auditorNote, modifiedSeverity: modifiedSeverity ?? f.modifiedSeverity }
          : f
      ),
    }))
  }

  // ── Aggiunge finding manuale ───────────────────────────────────

  function addManualFinding() {
    if (!newFinding.title || !newFinding.severity) return
    const mf: ManualFinding = {
      id: `MAN-${Date.now()}`,
      title: newFinding.title || "",
      severity: newFinding.severity as Severity,
      location: newFinding.location || "Unknown",
      description: newFinding.description || "",
      impact: newFinding.impact || "",
      recommendation: newFinding.recommendation || "",
      addedBy: "manual",
    }
    setSession(s => ({ ...s, manualFindings: [...s.manualFindings, mf] }))
    setNewFinding({})
    setAddingManual(false)
  }

  // ── Firma la review con MetaMask + Phantom ──────────────────────────────

  async function signReview() {
    setSigning(true)
    setSignError("")
    try {
      // Step 1: MetaMask (Ethereum)
      const ethereum = (window as Window & { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
      if (!ethereum) throw new Error("MetaMask not found. Install MetaMask to sign.")

      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[]
      const ethAddress = accounts[0]

      const confirmedFindings = session.aiFindings.filter(f => f.decision === "confirmed" || f.decision === "modified").length
      const reviewedAt = new Date().toISOString()
      const message = [
        "Solay39 Manual Review Signature",
        `Contract: ${contractName} (${contractAddress})`,
        `Network: ${network}`,
        `Checks completed: ${session.checks.filter(c => c.status !== "pending").length}/${session.checks.length}`,
        `AI findings reviewed: ${session.aiFindings.filter(f => f.decision !== "pending").length}/${session.aiFindings.length}`,
        `Confirmed findings: ${confirmedFindings}`,
        `Manual findings added: ${session.manualFindings.length}`,
        `Reviewed at: ${reviewedAt}`,
        "I confirm I have manually reviewed this smart contract using the AI-guided checklist.",
      ].join("\n")

      const ethSignature = await ethereum.request({
        method: "personal_sign",
        params: [message, ethAddress],
      }) as string

      // Step 2: Phantom (Solana)
      let solAddress: string | undefined
      let solSignature: string | undefined
      
      const phantom = (window as Window & { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }> } }).solana
      
      if (phantom?.isPhantom) {
        try {
          const resp = await phantom.connect()
          solAddress = resp.publicKey.toString()
          
          const solMessage = new TextEncoder().encode(message)
          const { signature: solSig } = await phantom.signMessage(solMessage, "utf8")
          solSignature = Buffer.from(solSig).toString("base64")
        } catch (phantomErr) {
          console.log("[Solay39] Phantom signature skipped:", phantomErr)
          // Non blocchiamo se Phantom fallisce, la firma MetaMask e' sufficiente
        }
      }

      const completedSession: ReviewSession = {
        ...session,
        completedAt: reviewedAt,
        auditorWallet: ethAddress,
        solanaWallet: solAddress,
        signed: true,
        signature: ethSignature,
        solanaSignature: solSignature,
      }
      
      setSession(completedSession)
      onReviewComplete(completedSession)
    } catch (err: unknown) {
      setSignError(err instanceof Error ? err.message : "Signing failed")
    }
    setSigning(false)
  }

  // ── Computed stats ────────────────────────────────────────────

  const checksTotal = session.checks.length
  const checksDone = session.checks.filter(c => c.status !== "pending").length
  const checksFailed = session.checks.filter(c => c.status === "fail").length
  const findingsTotal = session.aiFindings.length
  const findingsReviewed = session.aiFindings.filter(f => f.decision !== "pending").length
  const findingsConfirmed = session.aiFindings.filter(f => f.decision === "confirmed" || f.decision === "modified").length
  const findingsFP = session.aiFindings.filter(f => f.decision === "false-positive").length
  const canSign = checksDone === checksTotal && findingsReviewed === findingsTotal && checksTotal > 0

  // ── Highlight codice con ricerca ──────────────────────────────

  const highlightedSource = codeSearch
    ? contractSource.split("\n").map((line, i) =>
        line.toLowerCase().includes(codeSearch.toLowerCase())
          ? `→ ${String(i + 1).padStart(4)} | ${line}`
          : `  ${String(i + 1).padStart(4)} | ${line}`
      ).join("\n")
    : contractSource

  // ───────────────────────────────────────────────────────���─────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "#0a0a0a", color: "#c8c8c8", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #222", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#00ff88", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em" }}>SOLAY39</span>
          <span style={{ color: "#333", fontSize: 10 }}>|</span>
          <span style={{ color: "#666", fontSize: 10, letterSpacing: "0.1em" }}>MANUAL REVIEW</span>
          <span style={{ color: "#333", fontSize: 10 }}>|</span>
          <span style={{ color: "#888", fontSize: 10 }}>{contractName}</span>
          <span style={{ color: "#444", fontSize: 9 }}>({network})</span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: checksDone === checksTotal && checksTotal > 0 ? "#00ff88" : "#666" }}>
            CHECKS {checksDone}/{checksTotal}
          </span>
          <span style={{ fontSize: 9, color: findingsReviewed === findingsTotal && findingsTotal > 0 ? "#00ff88" : "#666" }}>
            FINDINGS {findingsReviewed}/{findingsTotal}
          </span>
          <span style={{ fontSize: 9, color: session.signed ? "#00ff88" : "#444" }}>
            {session.signed ? "✓ SIGNED" : "UNSIGNED"}
          </span>
        </div>
      </div>

      {/* Guided manual-review rail */}
      <div style={{ borderBottom: "1px solid #1a1a1a", background: "#0c1013", padding: "10px 20px 12px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, minWidth: 760 }}>
          {REVIEW_GUIDE.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setActiveSection(step.id)}
              aria-label={`Open review step ${step.number}: ${step.title}`}
              style={{
                flex: 1, minWidth: 140, textAlign: "left", cursor: "pointer", padding: "9px 10px",
                background: activeSection === step.id ? "#122028" : "#101417",
                border: `1px solid ${activeSection === step.id ? "#00e5ff" : "#20282d"}`,
                color: "#c8d2d8", fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: activeSection === step.id ? "#00e5ff" : "#66747c", fontSize: 9, letterSpacing: "0.12em" }}>
                <span>{step.number}</span><span>{index < 4 ? "→" : "END"}</span>
              </div>
              <div style={{ marginTop: 7, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em" }}>{step.title}</div>
              <div style={{ marginTop: 5, color: "#718089", fontSize: 9, lineHeight: 1.45 }}>{step.instruction}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: code left, workspace right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "calc(100vh - 175px)" }}>

        {/* LEFT: Contract source */}
        <div style={{ borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 12px", background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>CONTRACT SOURCE</span>
            <input
              value={codeSearch}
              onChange={e => setCodeSearch(e.target.value)}
              placeholder="search line..."
              style={{ marginLeft: "auto", background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa", fontSize: 10, padding: "2px 8px", outline: "none", fontFamily: "inherit", width: 140 }}
            />
          </div>
          <pre style={{
            flex: 1, overflow: "auto", margin: 0, padding: "12px 16px",
            fontSize: 10.5, lineHeight: 1.65, color: "#666",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {highlightedSource.split("\n").map((line, i) => (
              <span key={i} style={{ color: line.startsWith("→") ? "#00ff88" : "#666", display: "block" }}>
                {line}
              </span>
            ))}
          </pre>
        </div>

        {/* RIGHT: Review workspace */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* Tab nav */}
          <div style={{ background: "#0f0f0f", borderBottom: "1px solid #1a1a1a", display: "flex" }}>
            {(["onchain", "checklist", "findings", "manual", "summary"] as const).map(s => (
              <button key={s} onClick={() => setActiveSection(s)} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "10px 16px", fontSize: 9, letterSpacing: "0.12em",
                color: activeSection === s ? "#00e5ff" : "#444",
                borderBottom: activeSection === s ? "1px solid #00e5ff" : "1px solid transparent",
                fontFamily: "inherit", textTransform: "uppercase",
              }}>
                {s === "onchain" && "Manual On-Chain"}
                {s === "checklist" && `Checklist (${checksDone}/${checksTotal})`}
                {s === "findings" && `AI Findings (${findingsReviewed}/${findingsTotal})`}
                {s === "manual" && `Manual (${session.manualFindings.length})`}
                {s === "summary" && "Summary & Sign"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

            {/* ── MANUAL ON-CHAIN ANALYSIS TAB ── */}
            {activeSection === "onchain" && (
              <div>
                <div style={{ marginBottom: 12, fontSize: 10, color: "#555" }}>
                  Manual on-chain analysis: tokenomics, whale distribution, insider wallets, dev wallet, rug risk assessment.
                </div>
                <OnChainAnalysisPanel 
                  contractAddress={contractAddress}
                  network={network}
                  onAnalysisComplete={(result) => {
                    // Save full on-chain analysis to session for PDF export
                    setSession(s => {
                      const td = result.tokenData || {}
                      const an = result.analysis || {}
                      
                      const newOnChainAnalysis = {
                        // Token info - use correct field names
                        tokenName: td.name || td.tokenName,
                        tokenSymbol: td.symbol || td.tokenSymbol,
                        tokenAddress: td.tokenAddress,
                        tokenNetwork: td.network,
                        marketCap: td.marketCap,
                        liquidity: (td.liquidityPools || []).reduce((sum: number, lp: { liquidity?: string }) => sum + parseFloat(lp.liquidity || "0"), 0),
                        price: td.price,
                        volume24h: td.volume24h,
                        holders: td.totalHolders || td.holders,
                        // Analysis results
                        executiveSummary: an.executiveSummary,
                        tokenEconomics: an.tokenEconomics,
                        whaleDistribution: an.whaleDistribution,
                        insiderWallets: an.insiderWallets,
                        devWalletAnalysis: an.devWalletAnalysis,
                        supplyAnalysis: an.supplyAnalysis,
                        rugPullRisk: an.rugPullRisk,
                        priceManipulation: an.priceManipulation,
                        hiddenGovernance: an.hiddenGovernance,
                        complexBugs: an.complexBugs,
                        liquidityAnalysis: an.liquidityAnalysis,
                        clusterAnalysis: an.clusterAnalysis,
                        scenarioAnalysis: an.scenarioAnalysis,
                        recommendation: an.recommendation,
                        overallRiskScore: an.overallRiskScore,
                        scores: an.scores,
                        topHolders: (td.topHolders || []).map((h: { address: string; percentage: number }) => ({
                          address: h.address,
                          percentage: h.percentage,
                        })),
                      }
                      
                      // ── Build full set of on-chain findings (OC-001…) ──────────────
                      const ts = Date.now()
                      const top6Pct = (td.topHolders || []).slice(0, 6).reduce((sum: number, h: { percentage: number }) => sum + h.percentage, 0)
                      const totalLiq = (td.liquidityPools || []).reduce((sum: number, lp: { liquidity?: string }) => sum + parseFloat(lp.liquidity || "0"), 0)
                      const lpLocked = (td.liquidityPools || []).some((lp: { lpLocked?: boolean }) => lp.lpLocked)

                      const ocFindings: typeof s.manualFindings = []

                      if (td.mintAuthority) {
                        ocFindings.push({
                          id: `onchain-oc001-${ts}`,
                          title: "OC-001 · Active Mint Authority Detected",
                          severity: "HIGH" as Severity,
                          location: String(td.mintAuthority),
                          description: an.tokenEconomics || `Mint authority is ACTIVE at ${td.mintAuthority}. The controller can create unlimited new tokens at any time, inflating the supply and diluting all existing holders.`,
                          impact: "Unlimited supply inflation. Existing holders diluted to zero at will.",
                          recommendation: "Disable (revoke) the mint authority if a fixed supply is intended. Verify team's stated tokenomics match on-chain reality.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (td.freezeAuthority) {
                        ocFindings.push({
                          id: `onchain-oc002-${ts}`,
                          title: "OC-002 · Active Freeze Authority Detected",
                          severity: "HIGH" as Severity,
                          location: String(td.freezeAuthority),
                          description: an.hiddenGovernance || `Freeze authority is ACTIVE at ${td.freezeAuthority}. Any wallet can be frozen and prevented from transacting at any time.`,
                          impact: "Any wallet including investor wallets can be frozen instantly, blocking all transfers.",
                          recommendation: "Disable freeze authority or document its use for compliance. Users must be warned of this centralised power.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (top6Pct > 50) {
                        ocFindings.push({
                          id: `onchain-oc003-${ts}`,
                          title: `OC-003 · High Whale Concentration — Top 6 Hold ${top6Pct.toFixed(1)}%`,
                          severity: (top6Pct > 70 ? "CRITICAL" : "HIGH") as Severity,
                          location: td.tokenAddress || "Token Contract",
                          description: an.whaleDistribution || `Top 6 wallets control ${top6Pct.toFixed(1)}% of supply. This is a critical centralisation risk.`,
                          impact: "Coordinated dump by top holders can collapse price instantly. Retail investors at extreme risk.",
                          recommendation: "Monitor top wallets for coordinated selling. Prefer tokens where top 10 wallets hold <30%.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (!lpLocked && totalLiq > 0) {
                        ocFindings.push({
                          id: `onchain-oc004-${ts}`,
                          title: "OC-004 · Liquidity Pool NOT Locked",
                          severity: "HIGH" as Severity,
                          location: "DEX Liquidity Pool",
                          description: `$${totalLiq.toLocaleString()} in liquidity is present but LP tokens are NOT locked. Developers can remove all liquidity instantly (direct rug pull vector).`,
                          impact: "Complete loss of tradeable liquidity in a single transaction. Price drops to zero immediately.",
                          recommendation: "Request team to lock LP via Team Finance or Unicrypt for ≥6 months. Verify lock on-chain before investing.",
                          addedBy: "manual" as const,
                        })
                      }

                      if ((td.liquidityPools || []).length === 0) {
                        ocFindings.push({
                          id: `onchain-oc005-${ts}`,
                          title: "OC-005 · No Liquidity Pool Found",
                          severity: "CRITICAL" as Severity,
                          location: td.tokenAddress || "Token Contract",
                          description: "No DEX liquidity pools detected for this token. Trading is impossible or occurs in unknown dark pools.",
                          impact: "Token cannot be bought or sold on any verifiable DEX. Exit is impossible.",
                          recommendation: "Do not invest. Token has no verifiable liquidity.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (td.hasBlacklistFunction) {
                        ocFindings.push({
                          id: `onchain-oc006-${ts}`,
                          title: "OC-006 · Blacklist Function in Contract",
                          severity: "MEDIUM" as Severity,
                          location: td.tokenAddress || "Token Contract",
                          description: an.hiddenGovernance || "The smart contract includes a blacklist function. The owner can block specific wallets from transacting.",
                          impact: "Investors can be selectively blocked from selling (honeypot vector). Transfers become conditional on owner approval.",
                          recommendation: "Verify if blacklist is used for legitimate compliance or as a trap. Renounced ownership mitigates this risk.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (td.hasPauseFunction) {
                        ocFindings.push({
                          id: `onchain-oc007-${ts}`,
                          title: "OC-007 · Pausable Transfer Function",
                          severity: "MEDIUM" as Severity,
                          location: td.tokenAddress || "Token Contract",
                          description: "Contract can pause all token transfers. In a rug scenario, the team could allow buying while blocking sells.",
                          impact: "All transfers halted at owner's discretion. Funds permanently locked during pause.",
                          recommendation: "Audit when/how the pause function can be triggered. Prefer renounced ownership.",
                          addedBy: "manual" as const,
                        })
                      }

                      if (td.isVerified === false) {
                        ocFindings.push({
                          id: `onchain-oc008-${ts}`,
                          title: "OC-008 · Smart Contract Not Verified on Explorer",
                          severity: "CRITICAL" as Severity,
                          location: td.tokenAddress || "Token Contract",
                          description: "The smart contract source code is NOT published on the block explorer. It is impossible to audit what the contract actually does.",
                          impact: "Hidden malicious code possible. No independent verification of token mechanics.",
                          recommendation: "Do not interact with unverified contracts. Request the team to verify the source immediately on the block explorer.",
                          addedBy: "manual" as const,
                        })
                      }

                      // Always add summary finding with full executive summary
                      ocFindings.push({
                        id: `onchain-oc000-${ts}`,
                        title: `OC-000 · On-Chain Risk Assessment: ${an.overallRiskScore > 70 ? "HIGH" : an.overallRiskScore > 40 ? "MEDIUM" : "LOW"} RISK (Score ${an.overallRiskScore}/100)`,
                        severity: (an.overallRiskScore > 70 ? "HIGH" : an.overallRiskScore > 40 ? "MEDIUM" : "LOW") as Severity,
                        location: td.tokenAddress || "Token Contract",
                        description: an.executiveSummary || an.recommendation || "On-chain analysis completed.",
                        impact: an.rugPullRisk || "See full on-chain analysis for details.",
                        recommendation: an.recommendation || "Review all on-chain findings carefully before interacting with this token.",
                        addedBy: "manual" as const,
                      })

                      const newManualFindings = [
                        ...s.manualFindings.filter(f => !f.id.startsWith("onchain-")), // remove stale onchain findings
                        ...ocFindings,
                      ]
                      
                      return {
                        ...s,
                        onChainAnalysis: newOnChainAnalysis,
                        manualFindings: newManualFindings,
                      }
                    })
                    
                    // ── Immediately push on-chain findings to the audit workspace ──
                    if (onOnChainFindings) {
                      const td2 = result.tokenData || {}
                      const an2 = result.analysis || {}
                      const top6 = (td2.topHolders || []).slice(0, 6).reduce((s: number, h: { percentage: number }) => s + h.percentage, 0)
                      const liq2 = (td2.liquidityPools || []).reduce((s: number, lp: { liquidity?: string }) => s + parseFloat(lp.liquidity || "0"), 0)
                      const locked2 = (td2.liquidityPools || []).some((lp: { lpLocked?: boolean }) => lp.lpLocked)
                      const ts2 = Date.now()
                      
                      const ocForCallback: Array<{id: string; title: string; severity: string; location: string; description: string; impact: string; recommendation: string}> = []
                      
                      if (td2.mintAuthority) {
                        ocForCallback.push({
                          id: `OC-001-${ts2}`,
                          title: "OC-001 · Active Mint Authority Detected",
                          severity: "HIGH",
                          location: String(td2.mintAuthority),
                          description: an2.tokenEconomics || `Mint authority is ACTIVE. Unlimited token minting possible.`,
                          impact: "Unlimited supply inflation.",
                          recommendation: "Disable mint authority if fixed supply intended.",
                        })
                      }
                      if (td2.freezeAuthority) {
                        ocForCallback.push({
                          id: `OC-002-${ts2}`,
                          title: "OC-002 · Active Freeze Authority Detected",
                          severity: "HIGH",
                          location: String(td2.freezeAuthority),
                          description: `Freeze authority is ACTIVE. Any wallet can be frozen.`,
                          impact: "Wallets can be frozen instantly.",
                          recommendation: "Disable freeze authority.",
                        })
                      }
                      if (top6 > 50) {
                        ocForCallback.push({
                          id: `OC-003-${ts2}`,
                          title: `OC-003 · High Whale Concentration — Top 6 Hold ${top6.toFixed(1)}%`,
                          severity: top6 > 70 ? "CRITICAL" : "HIGH",
                          location: td2.tokenAddress || "Token",
                          description: `Top 6 wallets control ${top6.toFixed(1)}% of supply.`,
                          impact: "Coordinated dump risk.",
                          recommendation: "Monitor top wallets.",
                        })
                      }
                      if (!locked2 && liq2 > 0) {
                        ocForCallback.push({
                          id: `OC-004-${ts2}`,
                          title: "OC-004 · Liquidity Pool NOT Locked",
                          severity: "HIGH",
                          location: "DEX LP",
                          description: `$${liq2.toLocaleString()} liquidity but LP not locked.`,
                          impact: "Rug pull vector.",
                          recommendation: "Lock LP for ≥6 months.",
                        })
                      }
                      // Summary
                      ocForCallback.push({
                        id: `OC-000-${ts2}`,
                        title: `OC-000 · Risk Score: ${an2.overallRiskScore}/100`,
                        severity: an2.overallRiskScore > 70 ? "HIGH" : an2.overallRiskScore > 40 ? "MEDIUM" : "LOW",
                        location: td2.tokenAddress || "Token",
                        description: an2.executiveSummary || "On-chain analysis completed.",
                        impact: an2.rugPullRisk || "See analysis.",
                        recommendation: an2.recommendation || "Review findings.",
                      })
                      
                      onOnChainFindings(ocForCallback)
                    }
                    
                    // ── Immediately push full on-chain analysis data to audit workspace ──
                    if (onOnChainAnalysisData) {
                      const td3 = result.tokenData || {}
                      const an3 = result.analysis || {}
                      onOnChainAnalysisData({
                        tokenName: td3.name || td3.tokenName,
                        tokenSymbol: td3.symbol || td3.tokenSymbol,
                        tokenAddress: td3.tokenAddress,
                        tokenNetwork: td3.network,
                        marketCap: td3.marketCap,
                        liquidity: (td3.liquidityPools || []).reduce((sum: number, lp: { liquidity?: string }) => sum + parseFloat(lp.liquidity || "0"), 0),
                        price: td3.price,
                        volume24h: td3.volume24h,
                        holders: td3.totalHolders || td3.holders,
                        executiveSummary: an3.executiveSummary,
                        tokenEconomics: an3.tokenEconomics,
                        whaleDistribution: an3.whaleDistribution,
                        insiderWallets: an3.insiderWallets,
                        devWalletAnalysis: an3.devWalletAnalysis,
                        supplyAnalysis: an3.supplyAnalysis,
                        rugPullRisk: an3.rugPullRisk,
                        priceManipulation: an3.priceManipulation,
                        hiddenGovernance: an3.hiddenGovernance,
                        complexBugs: an3.complexBugs,
                        liquidityAnalysis: an3.liquidityAnalysis,
                        clusterAnalysis: an3.clusterAnalysis,
                        scenarioAnalysis: an3.scenarioAnalysis,
                        recommendation: an3.recommendation,
                        overallRiskScore: an3.overallRiskScore,
                        scores: an3.scores,
                        topHolders: (td3.topHolders || []).map((h: { address: string; percentage: number }) => ({
                          address: h.address,
                          percentage: h.percentage,
                        })),
                      })
                    }
                  }}
                />
              </div>
            )}

            {/* ── CHECKLIST TAB ── */}
            {activeSection === "checklist" && (
              <div>
                {deepReviewLoading ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#444", fontSize: 11 }}>
                    <div style={{ color: "#00ff88", marginBottom: 8, fontSize: 18 }}>⟳</div>
                    <div style={{ color: "#00ff88", marginBottom: 4 }}>Fetching real source from {network} explorer...</div>
                    <div style={{ color: "#444", fontSize: 9 }}>Analyzing with AI — finding false positives & missing issues</div>
                  </div>
                ) : (
                  <>
                    {/* Generate local checklist if AI failed */}
                    {session.checks.length === 0 && deepReviewError && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ background: "#111", border: "1px solid #1e1e1e", padding: "12px 14px", marginBottom: 12 }}>
                          <div style={{ fontSize: 9, color: "#ffcc00", letterSpacing: "0.1em", marginBottom: 8 }}>CHECKLIST LOCALE — basata su pattern detection</div>
                          <div style={{ fontSize: 10, color: "#666", marginBottom: 10 }}>
                            L'AI non e' disponibile. Checklist generata analizzando pattern nel codice sorgente.
                          </div>
                          <button
                            onClick={() => {
                              const src = contractSource.toLowerCase()
                              const localChecks: DynamicCheckItem[] = []
                              let id = 1
                              
                              // Access Control checks
                              if (src.includes("onlyowner") || src.includes("owner()")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Access Control", question: "Can ownership be transferred securely using a 2-step process (propose + accept)?", why: "Single-step ownership transfer to wrong address permanently locks the contract", severity: "HIGH", status: "pending", note: "", aiGenerated: false })
                                localChecks.push({ id: `loc-${id++}`, category: "Access Control", question: "Is the owner address a multisig wallet or an EOA (Externally Owned Account)?", why: "A single compromised EOA gives full admin control to the attacker", severity: "MEDIUM", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("mint") && !src.includes("// mint")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Token Logic", question: "Is the mint() function protected by proper access control (onlyOwner/onlyMinter)?", why: "Public mint allows unlimited token inflation by anyone", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("burn")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Token Logic", question: "Does burn() require token holder approval before destroying tokens?", why: "Burn without approval allows arbitrary destruction of user tokens", severity: "HIGH", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("pause") || src.includes("pausable")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Centralization", question: "Who can pause the contract? Is there a timelock mechanism?", why: "Permanent pause freezes all funds indefinitely", severity: "HIGH", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("proxy") || src.includes("upgradeable") || src.includes("uups")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Upgradeability", question: "Is the upgrade function protected by a timelock of at least 48 hours?", why: "Immediate upgrade capability allows instant rug pull without user warning", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                                localChecks.push({ id: `loc-${id++}`, category: "Upgradeability", question: "Can initialize() only be called once (protected by Initializable modifier)?", why: "Unprotected reinitializer allows contract takeover by anyone", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes(".call{") || src.includes(".call(")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Reentrancy", question: "Do external calls occur AFTER all state updates (Checks-Effects-Interactions pattern)?", why: "Violating CEI pattern enables reentrancy attacks", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("block.timestamp")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Timestamp", question: "Is block.timestamp used for critical business logic?", why: "Miners can manipulate timestamp by ~15 seconds", severity: "MEDIUM", status: "pending", note: "", aiGenerated: false })
                              }
                              if (src.includes("getreserves") || src.includes("slot0")) {
                                localChecks.push({ id: `loc-${id++}`, category: "Oracle", question: "Is the AMM price protected by TWAP (Time-Weighted Average Price)?", why: "Spot price can be manipulated via flash loan in same block", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                              }
                              // Default checks
                              localChecks.push({ id: `loc-${id++}`, category: "Code Quality", question: "Is the Solidity pragma pinned to a specific version (not floating ^)?", why: "Floating pragma can compile with future incompatible compiler versions", severity: "LOW", status: "pending", note: "", aiGenerated: false })
                              localChecks.push({ id: `loc-${id++}`, category: "Deployment", question: "Does the deployed bytecode match the verified source code on the block explorer?", why: "Unverified source may contain hidden backdoors or malicious code", severity: "CRITICAL", status: "pending", note: "", aiGenerated: false })
                              
                              setSession(s => ({ ...s, checks: localChecks }))
                            }}
                            style={{ background: "#00ff8815", border: "1px solid #00ff8830", color: "#00ff88", fontSize: 10, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            Generate Local Checklist
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div style={{ marginBottom: 12, fontSize: 10, color: "#555" }}>
                      {session.checks.filter(c => c.aiGenerated).length > 0 
                        ? `${session.checks.filter(c => c.aiGenerated).length} questions generated by AI for this contract.`
                        : session.checks.length > 0 
                          ? `${session.checks.length} questions generated locally based on code patterns.`
                          : "No checklist generated yet. Click 'Generate' or wait for AI analysis."}
                      {checksFailed > 0 && <span style={{ color: "#ff8800", marginLeft: 8 }}>{checksFailed} potential issues flagged.</span>}
                    </div>

                    {/* Group by category */}
                    {Array.from(new Set(session.checks.map(c => c.category))).map(cat => (
                      <div key={cat} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: "0.15em", marginBottom: 8, textTransform: "uppercase" }}>
                          {cat}
                        </div>
                        {session.checks.filter(c => c.category === cat).map(check => (
                          <div key={check.id} style={{
                            marginBottom: 6, background: check.status === "fail" ? "#ff440008" : check.status === "pass" ? "#00ff8808" : "#111",
                            border: `1px solid ${check.status === "fail" ? "#ff440030" : check.status === "pass" ? "#00ff8830" : "#1e1e1e"}`,
                            padding: "10px 12px",
                          }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              {/* Status buttons */}
                              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 1 }}>
                                {(["pass", "fail", "na"] as const).map(s => (
                                  <button key={s} onClick={() => updateCheck(check.id, s)} style={{
                                    background: check.status === s ? (s === "pass" ? "#00ff88" : s === "fail" ? "#ff4444" : "#555") : "#1a1a1a",
                                    border: "none", cursor: "pointer", color: check.status === s ? "#000" : "#555",
                                    fontSize: 9, padding: "2px 6px", fontFamily: "inherit",
                                  }}>
                                    {s === "pass" ? "✓" : s === "fail" ? "✗" : "N/A"}
                                  </button>
                                ))}
                              </div>

                              {/* Question */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                                  onClick={() => setExpandedCheck(expandedCheck === check.id ? null : check.id)}>
                                  <span style={{ fontSize: 11, color: check.status === "fail" ? "#ff8800" : "#bbb" }}>
                                    {check.question}
                                  </span>
                                  <span style={{ fontSize: 9, color: SEV[check.severity].color, marginLeft: "auto", flexShrink: 0 }}>
                                    {check.severity}
                                  </span>
                                </div>

                                <div style={{ marginTop: 9 }}>
                                  <label style={{ display: "block", fontSize: 9, color: "#718089", letterSpacing: "0.08em", marginBottom: 5 }}>
                                    RISPOSTA AUDITOR
                                  </label>
                                  <textarea
                                    aria-label={`Risposta auditor per: ${check.question}`}
                                    value={check.note}
                                    onChange={e => updateCheck(check.id, check.status, e.target.value)}
                                    placeholder="Scrivi cosa hai verificato, quale evidenza hai trovato e il riferimento (link/file/linea)..."
                                    rows={2}
                                    style={{ width: "100%", background: "#0d0d0d", border: "1px solid #222", color: "#aaa", fontSize: 10, padding: "7px 8px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                                  />
                                </div>
                                {expandedCheck === check.id && (
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>{check.why}</div>
                                    {check.relevantCode && (
                                      <pre style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "6px 10px", fontSize: 10, color: "#888", marginBottom: 6, overflow: "auto" }}>
                                        {check.relevantCode}
                                      </pre>
                                    )}
                                    {check.lineRef && (
                                      <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>
                                        📍 {check.lineRef}
                                        <button onClick={() => setCodeSearch(check.lineRef!.split(":")[0])}
                                          style={{ background: "none", border: "none", color: "#00ff8880", cursor: "pointer", fontSize: 9, marginLeft: 6, fontFamily: "inherit" }}>
                                          [search in code]
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── AI FINDINGS TAB ── */}
            {activeSection === "findings" && (
              <div>
                {/* Deep review banner */}
                {deepReviewLoading && (
                  <div style={{ background: "#00ff8810", border: "1px solid #00ff8830", padding: "10px 14px", marginBottom: 12, fontSize: 10, color: "#00ff88" }}>
                    ⟳ Fetching real source from {network} explorer and analyzing findings...
                  </div>
                )}
                {deepReviewError && (
                  <div style={{ background: "#ff440010", border: "1px solid #ff440030", padding: "10px 14px", marginBottom: 12, fontSize: 10, color: "#ff6666" }}>
                    ⚠ {deepReviewError}
                    <div style={{ marginTop: 8, color: "#888", fontSize: 9 }}>
                      La revisione manuale guidata richiede una chiave AI. Puoi comunque:
                      <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                        <li>Verificare manualmente ogni finding AI cliccando Confirm/False Positive</li>
                        <li>Aggiungere finding manuali nella tab "Manual"</li>
                        <li>Firmare la review dopo aver completato la verifica</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => runDeepReview()}
                      style={{ marginTop: 8, background: "#00ff8815", border: "1px solid #00ff8830", color: "#00ff88", fontSize: 9, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Riprova Deep Review
                    </button>
                  </div>
                )}
                {deepReviewDone && deepReviewSource && (
                  <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", padding: "12px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: "0.1em", marginBottom: 6 }}>DEEP REVIEW — REAL SOURCE ANALYZED</div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>
                      {deepReviewSource.contractName} · {deepReviewSource.linesOfCode} LOC · {deepReviewSource.compiler}
                      <span style={{ color: "#555", marginLeft: 6 }}>from {deepReviewSource.fetchedFrom}</span>
                    </div>
                    {deepReviewContractType && (
                      <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, fontStyle: "italic" }}>
                        📄 {deepReviewContractType}
                      </div>
                    )}
                    {deepReviewCompilerNote && (
                      <div style={{ fontSize: 10, color: "#ffcc00", marginBottom: 6 }}>⚠ {deepReviewCompilerNote}</div>
                    )}
                    {deepReviewSummary && (
                      <div style={{ fontSize: 10, color: "#666", marginBottom: deepReviewPrivilegedRoles.length > 0 ? 8 : 0 }}>{deepReviewSummary}</div>
                    )}
                    {deepReviewPrivilegedRoles.length > 0 && (
                      <div style={{ marginTop: 8, borderTop: "1px solid #1a1a1a", paddingTop: 8 }}>
                        <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", marginBottom: 6 }}>PRIVILEGED ROLES</div>
                        {deepReviewPrivilegedRoles.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                            <span style={{ fontSize: 9, color: "#00ff88", minWidth: 80, flexShrink: 0 }}>{r.role}</span>
                            <span style={{ fontSize: 9, color: "#666", flex: 1 }}>{r.capability}</span>
                            <span style={{ fontSize: 9, color: r.risk.startsWith("HIGH") || r.risk.startsWith("CRITICAL") ? "#ff8800" : "#555", flexShrink: 0 }}>{r.risk}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 12, fontSize: 10, color: "#555" }}>
                  Review each AI finding. Deep analysis shows verdicts based on real source code.
                </div>

                {session.aiFindings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#444", fontSize: 11 }}>No AI findings to review.</div>
                ) : session.aiFindings.map((f, idx) => {
                  // Match deep-review verdict for this finding
                  const ver = findingVerifications.find(v =>
                    v.findingId === f.id ||
                    v.findingId === `AI-${String(idx + 1).padStart(3, "0")}`
                  )
                  const verdictColor = ver?.verdict === "FALSE_POSITIVE" ? "#ff4444"
                    : ver?.verdict === "CONFIRMED" ? "#00ff88"
                    : ver?.verdict === "SEVERITY_WRONG" ? "#ffcc00"
                    : "#888"
                  const verdictLabel = ver?.verdict === "FALSE_POSITIVE" ? "✗ FALSO POSITIVO"
                    : ver?.verdict === "CONFIRMED" ? "✓ CONFERMATO"
                    : ver?.verdict === "SEVERITY_WRONG" ? "⚠ SEVERITY ERRATA"
                    : ver?.verdict === "NEEDS_CLARIFICATION" ? "? DA VERIFICARE"
                    : deepReviewDone ? "— non analizzato" : ""

                  return (
                  <div key={f.id} style={{
                    marginBottom: 8,
                    background: f.decision === "confirmed" || f.decision === "modified" ? "#00ff8806" :
                      f.decision === "false-positive" ? "#ff444408" : "#111",
                    border: `1px solid ${f.decision === "confirmed" || f.decision === "modified" ? "#00ff8825" :
                      f.decision === "false-positive" ? "#ff444425" : "#1e1e1e"}`,
                    padding: "12px 14px",
                  }}>
                    {/* Finding header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: "#555" }}>{f.id}</span>
                      <span style={{
                        fontSize: 9, padding: "2px 7px",
                        background: SEV[f.severity].bg,
                        color: SEV[f.severity].color,
                        border: `1px solid ${SEV[f.severity].color}40`,
                      }}>
                        {f.modifiedSeverity || f.severity}
                      </span>
                      <span style={{ fontSize: 11, color: "#ccc", flex: 1, cursor: "pointer" }}
                        onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}>
                        {f.title}
                      </span>
                      {f.decision !== "pending" && (
                        <span style={{ fontSize: 9, color: f.decision === "false-positive" ? "#ff4444" : "#00ff88" }}>
                          {f.decision === "false-positive" ? "✗ FP" : f.decision === "modified" ? "⚠ MOD" : "✓ CONF"}
                        </span>
                      )}
                    </div>

                    {/* Deep review verdict banner */}
                    {ver && (
                      <div style={{
                        background: `${verdictColor}10`, border: `1px solid ${verdictColor}30`,
                        padding: "6px 10px", marginBottom: 8, fontSize: 10,
                      }}>
                        <span style={{ color: verdictColor, fontWeight: "bold" }}>{verdictLabel}</span>
                        {ver.suggestedSeverity && (
                          <span style={{ color: "#ffcc00", marginLeft: 8 }}>→ dovrebbe essere {ver.suggestedSeverity}</span>
                        )}
                        <div style={{ color: "#666", marginTop: 3, fontSize: 9 }}>{ver.reason}</div>
                      </div>
                    )}

                    {/* Decision buttons */}
                    <div style={{ display: "flex", gap: 6, marginBottom: expandedFinding === f.id ? 10 : 0 }}>
                      <button onClick={() => updateFindingDecision(f.id, "confirmed")} style={{
                        background: f.decision === "confirmed" ? "#00ff88" : "#1a1a1a",
                        border: "none", cursor: "pointer",
                        color: f.decision === "confirmed" ? "#000" : "#00ff8880",
                        fontSize: 9, padding: "4px 10px", fontFamily: "inherit",
                      }}>
                        ✅ Confirm
                      </button>
                      <button onClick={() => updateFindingDecision(f.id, "false-positive")} style={{
                        background: f.decision === "false-positive" ? "#ff4444" : "#1a1a1a",
                        border: "none", cursor: "pointer",
                        color: f.decision === "false-positive" ? "#fff" : "#ff444480",
                        fontSize: 9, padding: "4px 10px", fontFamily: "inherit",
                      }}>
                        ❌ False Positive
                      </button>
                      <button onClick={() => updateFindingDecision(f.id, "modified")} style={{
                        background: f.decision === "modified" ? "#ffcc00" : "#1a1a1a",
                        border: "none", cursor: "pointer",
                        color: f.decision === "modified" ? "#000" : "#ffcc0080",
                        fontSize: 9, padding: "4px 10px", fontFamily: "inherit",
                      }}>
                        ⚠️ Modify
                      </button>
                    </div>

                    {/* Expanded detail */}
                    {expandedFinding === f.id && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>📍 {f.location}</div>
                        <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>{f.description}</div>
                        <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>
                          <span style={{ color: "#555" }}>Impact: </span>{f.impact}
                        </div>
                        {f.proofOfConcept && (
                          <pre style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "8px 10px", fontSize: 9.5, color: "#777", marginBottom: 8, overflow: "auto", whiteSpace: "pre-wrap" }}>
                            {f.proofOfConcept}
                          </pre>
                        )}

                        {/* Modify severity */}
                        {f.decision === "modified" && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>Override severity:</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map(sev => (
                                <button key={sev} onClick={() => updateFindingDecision(f.id, "modified", f.auditorNote, sev)} style={{
                                  background: f.modifiedSeverity === sev ? SEV[sev].bg : "#1a1a1a",
                                  border: `1px solid ${f.modifiedSeverity === sev ? SEV[sev].color : "#222"}`,
                                  color: f.modifiedSeverity === sev ? SEV[sev].color : "#555",
                                  cursor: "pointer", fontSize: 9, padding: "2px 7px", fontFamily: "inherit",
                                }}>
                                  {sev}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <textarea
                          value={f.auditorNote}
                          onChange={e => updateFindingDecision(f.id, f.decision, e.target.value)}
                          placeholder={f.decision === "false-positive" ? "Why is this a false positive?" : "Auditor note..."}
                          rows={2}
                          style={{ width: "100%", background: "#0d0d0d", border: "1px solid #222", color: "#aaa", fontSize: 10, padding: "6px 8px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                        />
                      </div>
                    )}
                  </div>
                  )
                })}

                {/* ── Missing findings from deep review ── */}
                {missingFindings.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 9, color: "#ff8800", letterSpacing: "0.12em", marginBottom: 10 }}>
                      FINDING MANCANTI — trovati durante deep review ({missingFindings.filter(f => !f.rejected).length} da verificare)
                    </div>
                    {missingFindings.map((mf, i) => (
                      <div key={mf.id} style={{
                        marginBottom: 8,
                        background: mf.approved ? "#00ff8806" : mf.rejected ? "#ff444406" : "#0d0d0d",
                        border: `1px solid ${mf.approved ? "#00ff8825" : mf.rejected ? "#ff444425" : "#ff880025"}`,
                        padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 9, padding: "2px 6px", background: "#ff880020", color: "#ff8800", border: "1px solid #ff880040" }}>MISSING</span>
                          <span style={{
                            fontSize: 9, padding: "2px 7px",
                            background: SEV[mf.severity as Severity]?.bg || "#888",
                            color: SEV[mf.severity as Severity]?.color || "#888",
                          }}>{mf.severity}</span>
                          <span style={{ fontSize: 11, color: "#ccc", flex: 1 }}>{mf.title}</span>
                        </div>

                        <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>📍 {mf.location}</div>
                        <div style={{ fontSize: 10, color: "#777", marginBottom: 6 }}>{mf.description}</div>

                        {mf.codeEvidence && (
                          <pre style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "6px 10px", fontSize: 9, color: "#ff8800", marginBottom: 8, overflow: "auto", whiteSpace: "pre-wrap" }}>
                            {mf.codeEvidence}
                          </pre>
                        )}

                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => {
                              // Approve: add to manual findings
                              const finding: ManualFinding = {
                                id: `MR-${Date.now()}`,
                                title: mf.title,
                                severity: mf.severity as Severity,
                                location: mf.location,
                                description: mf.description,
                                impact: mf.impact,
                                recommendation: mf.recommendation,
                                addedBy: "manual",
                              }
                              setSession(s => ({ ...s, manualFindings: [...s.manualFindings, finding] }))
                              setMissingFindings(prev => prev.map((f, j) => j === i ? { ...f, approved: true, rejected: false } : f))
                            }}
                            style={{
                              background: mf.approved ? "#00ff88" : "#1a1a1a", border: "none", cursor: "pointer",
                              color: mf.approved ? "#000" : "#00ff8880", fontSize: 9, padding: "4px 10px", fontFamily: "inherit",
                            }}>
                            ✅ Aggiungi al report
                          </button>
                          <button
                            onClick={() => setMissingFindings(prev => prev.map((f, j) => j === i ? { ...f, rejected: true, approved: false } : f))}
                            style={{
                              background: mf.rejected ? "#ff4444" : "#1a1a1a", border: "none", cursor: "pointer",
                              color: mf.rejected ? "#fff" : "#ff444480", fontSize: 9, padding: "4px 10px", fontFamily: "inherit",
                            }}>
                            ❌ Rigetta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MANUAL FINDINGS TAB ── */}
            {activeSection === "manual" && (
              <div>
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#555" }}>
                    Add findings discovered during manual review not caught by AI.
                  </span>
                  <button onClick={() => setAddingManual(true)} style={{
                    background: "#00ff8818", border: "1px solid #00ff8840", color: "#00ff88",
                    cursor: "pointer", fontSize: 9, padding: "5px 12px", fontFamily: "inherit",
                  }}>
                    + Add Finding
                  </button>
                </div>

                {/* Add finding form */}
                {addingManual && (
                  <div style={{ background: "#111", border: "1px solid #222", padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 9, color: "#00ff88", marginBottom: 10, letterSpacing: "0.1em" }}>NEW MANUAL FINDING</div>
                    {[
                      { key: "title", placeholder: "Title (e.g. Missing authority check on withdraw)" },
                      { key: "location", placeholder: "Location (e.g. src/lib.rs:42 — withdraw())" },
                      { key: "description", placeholder: "Description..." },
                      { key: "impact", placeholder: "Impact (e.g. Any caller can drain the vault)" },
                      { key: "recommendation", placeholder: "Recommendation..." },
                    ].map(({ key, placeholder }) => (
                      <input key={key} value={(newFinding as Record<string, string>)[key] || ""} onChange={e => setNewFinding(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ display: "block", width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#aaa", fontSize: 10, padding: "6px 8px", fontFamily: "inherit", marginBottom: 6, boxSizing: "border-box" }}
                      />
                    ))}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as Severity[]).map(sev => (
                        <button key={sev} onClick={() => setNewFinding(p => ({ ...p, severity: sev }))} style={{
                          background: newFinding.severity === sev ? SEV[sev].bg : "#1a1a1a",
                          border: `1px solid ${newFinding.severity === sev ? SEV[sev].color : "#222"}`,
                          color: newFinding.severity === sev ? SEV[sev].color : "#555",
                          cursor: "pointer", fontSize: 9, padding: "3px 8px", fontFamily: "inherit",
                        }}>
                          {sev}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={addManualFinding} style={{ background: "#00ff88", border: "none", color: "#000", cursor: "pointer", fontSize: 9, padding: "5px 14px", fontFamily: "inherit" }}>
                        Add
                      </button>
                      <button onClick={() => setAddingManual(false)} style={{ background: "#1a1a1a", border: "1px solid #222", color: "#666", cursor: "pointer", fontSize: 9, padding: "5px 14px", fontFamily: "inherit" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {session.manualFindings.length === 0 && !addingManual ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#333", fontSize: 11 }}>
                    No manual findings yet.
                  </div>
                ) : session.manualFindings.map(f => (
                  <div key={f.id} style={{ marginBottom: 8, background: "#111", border: "1px solid #1e1e1e", padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: "#555" }}>{f.id}</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", background: SEV[f.severity].bg, color: SEV[f.severity].color }}>{f.severity}</span>
                      <span style={{ fontSize: 11, color: "#ccc" }}>{f.title}</span>
                      <span style={{ fontSize: 9, color: "#00ff88", marginLeft: "auto" }}>MANUAL</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#666" }}>{f.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── SUMMARY & SIGN TAB ── */}
            {activeSection === "summary" && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, color: "#00ff88", letterSpacing: "0.15em", marginBottom: 12 }}>REVIEW SUMMARY</div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {[
                      { label: "Checklist", value: `${checksDone}/${checksTotal}`, ok: checksDone === checksTotal },
                      { label: "Failed checks", value: checksFailed, ok: checksFailed === 0 },
                      { label: "AI findings reviewed", value: `${findingsReviewed}/${findingsTotal}`, ok: findingsReviewed === findingsTotal },
                      { label: "Confirmed findings", value: findingsConfirmed, ok: true },
                      { label: "False positives", value: findingsFP, ok: true },
                      { label: "Manual findings", value: session.manualFindings.length, ok: true },
                    ].map(({ label, value, ok }) => (
                      <div key={label} style={{ background: "#111", border: "1px solid #1e1e1e", padding: "10px 14px" }}>
                        <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 16, color: ok ? "#00ff88" : "#ff8800", fontWeight: 700 }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Final findings list */}
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 8, letterSpacing: "0.1em" }}>
                    FINAL FINDINGS ({findingsConfirmed + session.manualFindings.length} total)
                  </div>
                  {[
                    ...session.aiFindings.filter(f => f.decision === "confirmed" || f.decision === "modified"),
                    ...session.manualFindings,
                  ].map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #111" }}>
                      <span style={{ fontSize: 9, color: SEV[("modifiedSeverity" in f ? f.modifiedSeverity || f.severity : f.severity) as Severity].color }}>
                        {("modifiedSeverity" in f ? f.modifiedSeverity || f.severity : f.severity)}
                      </span>
                      <span style={{ fontSize: 10, color: "#aaa" }}>{f.title}</span>
                      {"addedBy" in f && <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>MANUAL</span>}
                    </div>
                  ))}

                  {/* Review notes */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 6, letterSpacing: "0.1em" }}>REVIEW NOTES</div>
                    <textarea
                      value={session.reviewNotes}
                      onChange={e => setSession(s => ({ ...s, reviewNotes: e.target.value }))}
                      placeholder="Overall notes about this review..."
                      rows={4}
                      style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#aaa", fontSize: 10, padding: "8px 10px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Sign button */}
                {!session.signed ? (
                  <div>
                    {!canSign && (
                      <div style={{ fontSize: 10, color: "#ff8800", marginBottom: 10, padding: "8px 12px", background: "#ff880010", border: "1px solid #ff880030" }}>
                        Complete all checks ({checksDone}/{checksTotal}) and review all AI findings ({findingsReviewed}/{findingsTotal}) before signing.
                      </div>
                    )}
                    <button
                      onClick={signReview}
                      disabled={!canSign || signing}
                      style={{
                        background: canSign ? "#00ff88" : "#1a1a1a",
                        border: "none", cursor: canSign ? "pointer" : "not-allowed",
                        color: canSign ? "#000" : "#444",
                        fontSize: 11, padding: "12px 24px", fontFamily: "inherit",
                        fontWeight: 700, letterSpacing: "0.1em", width: "100%",
                      }}
                    >
                      {signing ? "Signing with MetaMask + Phantom..." : "Sign Review (MetaMask + Phantom)"}
                    </button>
                    {signError && <div style={{ fontSize: 10, color: "#ff4444", marginTop: 8 }}>{signError}</div>}
                  </div>
                ) : (
                  <div style={{ background: "#00ff8810", border: "1px solid #00ff8840", padding: "16px 20px", textAlign: "center" }}>
                    <div style={{ color: "#00ff88", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>REVIEW SIGNED</div>
                    <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>
                      <span style={{ color: "#888" }}>ETH:</span> {session.auditorWallet?.slice(0, 10)}...{session.auditorWallet?.slice(-8)}
                    </div>
                    {session.solanaWallet && (
                      <div style={{ fontSize: 9, color: "#9945FF", marginBottom: 4 }}>
                        <span style={{ color: "#888" }}>SOL:</span> {session.solanaWallet.slice(0, 10)}...{session.solanaWallet.slice(-8)}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: "#444", marginTop: 6 }}>{session.completedAt}</div>
                    {session.solanaSignature && (
                      <div style={{ fontSize: 8, color: "#9945FF", marginTop: 8, padding: "6px 10px", background: "#9945FF10", border: "1px solid #9945FF30" }}>
                        Solana Attestation Ready
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fallback checklist statica adattata al network ────────��──────

function buildFallbackChecklist(network: string, source: string): DynamicCheckItem[] {
  const isSolana = network === "Solana"
  const hasProxy = /delegatecall|proxy|upgradeable/i.test(source)
  const hasMint = /mint|MintTo/i.test(source)
  const hasCPI = /invoke|CpiContext/i.test(source)

  const base: Omit<DynamicCheckItem, "status" | "note">[] = isSolana ? [
    { id: "s1", category: "Access Control", question: "Is the signer verified on all state-modifying instructions?", why: "Missing signer check is #1 Solana vulnerability", severity: "CRITICAL", aiGenerated: false },
    { id: "s2", category: "Access Control", question: "Are account owners verified before trusting account data?", why: "Account confusion attacks exploit missing owner checks", severity: "HIGH", aiGenerated: false },
    { id: "s3", category: "Arithmetic", question: "Are all arithmetic operations using checked math?", why: "Rust release mode disables overflow panics by default", severity: "MEDIUM", aiGenerated: false },
    { id: "s4", category: "CPI", question: "Are all CPI target programs verified before invocation?", why: "Arbitrary CPI allows attackers to redirect program calls", severity: "HIGH", aiGenerated: hasCPI },
    ...(hasMint ? [{ id: "s5", category: "Token", question: "Is mint authority verified before minting tokens?", why: "Missing mint authority allows unlimited token creation", severity: "CRITICAL" as Severity, aiGenerated: true }] : []),
  ] : [
    { id: "e1", category: "Access Control", question: "Are all privileged functions protected by access modifiers?", why: "Unrestricted admin functions allow protocol takeover", severity: "CRITICAL", aiGenerated: false },
    { id: "e2", category: "Reentrancy", question: "Are CEI pattern and ReentrancyGuard applied?", why: "Reentrancy is the most exploited vulnerability class", severity: "CRITICAL", aiGenerated: false },
    { id: "e3", category: "Arithmetic", question: "Is Solidity >= 0.8 used or SafeMath applied throughout?", why: "Integer overflow can drain funds", severity: "HIGH", aiGenerated: false },
    ...(hasProxy ? [{ id: "e4", category: "Upgradability", question: "Is the initialize function protected and callable only once?", why: "Unprotected initializers allow ownership hijacking", severity: "CRITICAL" as Severity, aiGenerated: true }] : []),
  ]

  return base.map(c => ({ ...c, status: "pending" as CheckStatus, note: "" }))
}
