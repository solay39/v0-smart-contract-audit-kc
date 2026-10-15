"use client"

export interface ConsensusData {
  enginesRun?: string[]
  confirmed?: number
  likely?: number
  unconfirmed?: number
  engineOnly?: { name: string; severity: string; engine: string }[]
}

export interface ConfirmedPoC {
  findingId: string
  findingTitle: string
  severity: string
  pocFile: string
  runCommand: string
  compiled: boolean | null
  code?: string
}

export interface MonitoringData {
  enrolled: boolean
  network: string
  contractAddress: string | null
  pollInterval: string
  watchedEvents: string[]
  reason?: string
}

interface Props {
  consensus: ConsensusData | null
  pocs: ConfirmedPoC[]
  monitoring: MonitoringData | null
}

export function AuditAssurancePanel({ consensus, pocs, monitoring }: Props) {
  if (!consensus && pocs.length === 0 && !monitoring) return null

  return (
    <section aria-label="Audit assurance" className="bg-s39-bg1 border border-s39-border p-4 sm:p-6 mb-5 flex flex-col gap-5">
      {consensus && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[9px] text-s39-mid tracking-[0.15em]">MULTI-ENGINE CONSENSUS</h3>
          <p className="text-[10px] text-s39-lite">
            {"Engines: "}
            {(consensus.enginesRun ?? []).join(", ") || "n/a"}
          </p>
          <div className="flex gap-4 flex-wrap text-[10px]">
            <span className="text-s39-green">{`Confirmed ${consensus.confirmed ?? 0}`}</span>
            <span className="text-s39-lite">{`Likely ${consensus.likely ?? 0}`}</span>
            <span className="text-s39-mid">{`AI-only ${consensus.unconfirmed ?? 0}`}</span>
          </div>
          {(consensus.engineOnly ?? []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(consensus.engineOnly ?? []).slice(0, 10).map((h, i) => (
                <li key={`${h.engine}-${i}`} className="text-[10px] text-s39-lite">
                  {`[${h.engine.toUpperCase()}] ${h.severity} - ${h.name}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pocs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[9px] text-s39-mid tracking-[0.15em]">PROOF-OF-CONCEPT EXPLOITS</h3>
          <ul className="flex flex-col gap-3">
            {pocs.map((p) => (
              <li key={p.findingId} className="flex flex-col gap-1 border border-s39-border p-3">
                <div className="flex justify-between gap-2 flex-wrap">
                  <span className="text-[10px] text-s39-lite font-bold">{`${p.findingId} ${p.findingTitle}`}</span>
                  <span className={`text-[9px] tracking-widest ${p.compiled === false ? "text-s39-mid" : "text-s39-green"}`}>
                    {p.compiled === true ? "COMPILED" : p.compiled === false ? "COMPILE FAILED" : "GENERATED"}
                  </span>
                </div>
                <code className="text-[9px] text-s39-mid break-all">{p.runCommand}</code>
                {p.code && (
                  <details>
                    <summary className="text-[9px] text-s39-green cursor-pointer">{p.pocFile}</summary>
                    <pre className="text-[9px] text-s39-lite overflow-x-auto mt-2 leading-relaxed">{p.code}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {monitoring && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[9px] text-s39-mid tracking-[0.15em]">POST-AUDIT MONITORING (SKYNET)</h3>
          <p className={`text-[10px] ${monitoring.enrolled ? "text-s39-green" : "text-s39-mid"}`}>
            {monitoring.enrolled
              ? `Active on ${monitoring.network}, polled every ${monitoring.pollInterval}`
              : `Not active: ${monitoring.reason ?? "n/a"}`}
          </p>
          {monitoring.enrolled && monitoring.watchedEvents.length > 0 && (
            <p className="text-[10px] text-s39-lite">{`Watched: ${monitoring.watchedEvents.join(", ")}`}</p>
          )}
        </div>
      )}
    </section>
  )
}
