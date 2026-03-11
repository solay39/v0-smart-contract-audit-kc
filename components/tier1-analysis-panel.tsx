"use client"

import { useState } from "react"
import { Shield, Bug, FlaskConical, GitBranch, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Zap, Activity } from "lucide-react"

interface Tier1AnalysisPanelProps {
  staticAnalysis?: {
    slither: { version: string; success: boolean; findingsCount: number; detectorsRun: number }
    mythril: { version: string; success: boolean; findingsCount: number }
    rawFindings: number
  } | null
  fuzzingResults?: {
    success: boolean
    runs: number
    vulnerabilitiesFound: number
    tool: string
    version: string
  } | null
  formalVerificationResults?: {
    success: boolean
    proofsChecked: number
    failed: number
    tool: string
    version: string
  } | null
  crossContractAnalysis?: {
    success: boolean
    risksFound: number
    externalDependencies: string[]
  } | null
  analysisMode: "tier1-real" | "tier1-pattern" | string
}

export function Tier1AnalysisPanel({
  staticAnalysis,
  fuzzingResults,
  formalVerificationResults,
  crossContractAnalysis,
  analysisMode,
}: Tier1AnalysisPanelProps) {
  const [expanded, setExpanded] = useState(false)
  
  const isRealMode = analysisMode === "tier1-real"
  const hasAnyResults = staticAnalysis || fuzzingResults || formalVerificationResults || crossContractAnalysis
  
  if (!hasAnyResults) return null

  const tools = [
    {
      name: "Slither",
      icon: Shield,
      version: staticAnalysis?.slither.version || "N/A",
      status: staticAnalysis?.slither.success ? "pass" : staticAnalysis ? "fail" : "pending",
      details: staticAnalysis 
        ? `${staticAnalysis.slither.findingsCount} findings from ${staticAnalysis.slither.detectorsRun} detectors`
        : "Not run",
      color: "cyan",
    },
    {
      name: "Mythril",
      icon: Bug,
      version: staticAnalysis?.mythril.version || "N/A",
      status: staticAnalysis?.mythril.success ? "pass" : staticAnalysis ? "fail" : "pending",
      details: staticAnalysis
        ? `${staticAnalysis.mythril.findingsCount} vulnerabilities detected`
        : "Not run",
      color: "purple",
    },
    {
      name: "Foundry Fuzz",
      icon: Zap,
      version: fuzzingResults?.version || "N/A",
      status: fuzzingResults?.success 
        ? (fuzzingResults.vulnerabilitiesFound === 0 ? "pass" : "warn")
        : fuzzingResults ? "fail" : "pending",
      details: fuzzingResults
        ? `${fuzzingResults.runs.toLocaleString()} runs, ${fuzzingResults.vulnerabilitiesFound} violations`
        : "Not run",
      color: "orange",
    },
    {
      name: "Halmos",
      icon: FlaskConical,
      version: formalVerificationResults?.version || "N/A",
      status: formalVerificationResults?.success
        ? (formalVerificationResults.failed === 0 ? "pass" : "fail")
        : formalVerificationResults ? "fail" : "pending",
      details: formalVerificationResults
        ? `${formalVerificationResults.proofsChecked} proofs, ${formalVerificationResults.failed} failed`
        : "Not run",
      color: "green",
    },
    {
      name: "Cross-Contract",
      icon: GitBranch,
      version: "1.0",
      status: crossContractAnalysis?.success
        ? (crossContractAnalysis.risksFound === 0 ? "pass" : "warn")
        : crossContractAnalysis ? "fail" : "pending",
      details: crossContractAnalysis
        ? `${crossContractAnalysis.risksFound} integration risks found`
        : "Not run",
      color: "blue",
    },
  ]

  const passCount = tools.filter(t => t.status === "pass").length
  const failCount = tools.filter(t => t.status === "fail").length
  const warnCount = tools.filter(t => t.status === "warn").length

  return (
    <div className="rounded-lg border border-cyan-900/30 bg-black/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-900/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <span className="font-mono text-sm text-cyan-300">TIER-1 ANALYSIS ENGINE</span>
          <span className={`text-xs px-2 py-0.5 rounded ${isRealMode ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
            {isRealMode ? "REAL EXECUTION" : "PATTERN-BASED"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400">{passCount} pass</span>
            <span className="text-gray-500">|</span>
            <span className="text-yellow-400">{warnCount} warn</span>
            <span className="text-gray-500">|</span>
            <span className="text-red-400">{failCount} fail</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-cyan-900/30 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon
              const statusColor = tool.status === "pass" ? "text-green-400" :
                                tool.status === "warn" ? "text-yellow-400" :
                                tool.status === "fail" ? "text-red-400" : "text-gray-500"
              const StatusIcon = tool.status === "pass" ? CheckCircle2 :
                               tool.status === "fail" ? XCircle : Clock

              return (
                <div
                  key={tool.name}
                  className="p-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 text-${tool.color}-400`} />
                      <span className="font-mono text-sm text-white">{tool.name}</span>
                    </div>
                    <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                  </div>
                  <div className="text-xs text-gray-400 mb-1">v{tool.version}</div>
                  <div className={`text-xs ${statusColor}`}>{tool.details}</div>
                </div>
              )
            })}
          </div>

          {/* Backend Status */}
          <div className="mt-4 p-3 rounded-lg bg-gray-900/30 border border-gray-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Backend Status:</span>
              {isRealMode ? (
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Docker backend connected (Railway)
                </span>
              ) : (
                <span className="text-yellow-400">
                  Pattern-based mode (deploy Docker backend for real execution)
                </span>
              )}
            </div>
            {!isRealMode && (
              <div className="mt-2 text-xs text-gray-500">
                Deploy the Docker backend to Railway for real Slither/Mythril/Foundry/Halmos execution:
                <code className="ml-2 px-1 py-0.5 bg-black rounded text-cyan-300">cd scripts/static-analysis-backend && ./deploy.sh</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
