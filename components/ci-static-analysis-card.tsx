"use client"

import { useState } from "react"
import useSWR from "swr"
import { Play, Loader2, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react"
import type { CiJobStatus } from "@/lib/github-analysis-runner"

const fetcher = async (url: string): Promise<CiJobStatus> => {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
  return body
}

const IMPACT_COLOR: Record<string, string> = {
  High: "text-red-400",
  Medium: "text-yellow-400",
  Low: "text-cyan-300",
  Informational: "text-gray-400",
  Optimization: "text-gray-400",
}

export function CiStaticAnalysisCard({ code, contractName }: { code: string; contractName?: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { data, error } = useSWR(jobId ? `/api/static-analysis/ci?jobId=${jobId}` : null, fetcher, {
    refreshInterval: (latest) => (latest?.state === "completed" || latest?.state === "failed" ? 0 : 10_000),
    revalidateOnFocus: false,
  })

  const canRun = /pragma\s+solidity/.test(code)
  const busy = starting || (jobId !== null && !error && data?.state !== "completed" && data?.state !== "failed")

  async function start() {
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch("/api/static-analysis/ci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, contractName }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setJobId(body.jobId)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err))
    } finally {
      setStarting(false)
    }
  }

  const stateLabel = starting
    ? "Avvio del workflow..."
    : data?.state === "queued" || (jobId && !data)
      ? "In coda su GitHub Actions..."
      : data?.state === "running"
        ? "Slither e Mythril in esecuzione (3-8 min)..."
        : null

  const result = data?.state === "completed" ? data.result : null
  const runUrl = data && "runUrl" in data ? data.runUrl : null
  const shownError = startError || error?.message || (data?.state === "failed" ? data.error : null)

  return (
    <section aria-labelledby="ci-analysis-title" className="rounded-lg border border-cyan-900/30 bg-black/40 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="ci-analysis-title" className="font-mono text-sm text-cyan-300">SLITHER + MYTHRIL REALI</h3>
          <p className="text-xs text-gray-400 leading-relaxed">Esecuzione su GitHub Actions, stessa toolchain della CI.</p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={!canRun || busy}
          className="flex items-center gap-2 rounded border border-cyan-700 px-3 py-1.5 font-mono text-xs text-cyan-300 hover:bg-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Play className="w-4 h-4" aria-hidden />}
          {result ? "Riesegui" : "Esegui analisi reale"}
        </button>
      </div>

      {!canRun && <p className="text-xs text-gray-500">Inserisci codice Solidity con pragma per avviare.</p>}

      {stateLabel && !shownError && (
        <p className="flex items-center gap-2 text-xs text-yellow-400" role="status">
          <Clock className="w-3 h-3" aria-hidden /> {stateLabel}
        </p>
      )}

      {shownError && (
        <p className="flex items-start gap-2 text-xs text-red-400" role="alert">
          <XCircle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden /> {shownError}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToolSummary
              name="Slither"
              version={result.slither.version}
              ok={result.slither.success}
              detail={`${result.slither.findings.length} findings${result.slither.detectors_run ? ` · ${result.slither.detectors_run} detectors` : ""}`}
              error={result.slither.error}
            />
            <ToolSummary
              name="Mythril"
              version={result.mythril.version}
              ok={result.mythril.success}
              detail={`${result.mythril.findings.length} issues`}
              error={result.mythril.error}
            />
          </div>

          {result.slither.findings.length + result.mythril.findings.length > 0 && (
            <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {result.slither.findings.map((f, i) => (
                <li key={`s-${i}`} className="rounded border border-gray-800 bg-gray-900/50 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="text-white">Slither · {f.check}</span>
                    <span className={IMPACT_COLOR[f.impact] || "text-gray-400"}>{f.impact} / {f.confidence}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line line-clamp-4">{f.description}</p>
                </li>
              ))}
              {result.mythril.findings.map((f, i) => (
                <li key={`m-${i}`} className="rounded border border-gray-800 bg-gray-900/50 p-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="text-white">Mythril · {f.swc_id} {f.swc_title}</span>
                    <span className={IMPACT_COLOR[f.severity] || "text-gray-400"}>{f.severity}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">
                    {f.function ? `${f.function}${f.lineno ? ` (riga ${f.lineno})` : ""}: ` : ""}{f.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {result.solcVersion && <p className="text-xs text-gray-500">solc {result.solcVersion}</p>}
        </div>
      )}

      {runUrl && (
        <a href={runUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-cyan-400 hover:underline w-fit">
          Log del run su GitHub <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      )}
    </section>
  )
}

function ToolSummary({ name, version, ok, detail, error }: { name: string; version: string; ok: boolean; detail: string; error: string | null }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900/50 p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-white">{name}</span>
        {ok ? <CheckCircle2 className="w-4 h-4 text-green-400" aria-label="eseguito" /> : <XCircle className="w-4 h-4 text-red-400" aria-label="errore" />}
      </div>
      <span className="text-xs text-gray-400">v{version}</span>
      <span className={`text-xs ${ok ? "text-green-400" : "text-red-400"}`}>{ok ? detail : error || "Esecuzione fallita"}</span>
    </div>
  )
}
