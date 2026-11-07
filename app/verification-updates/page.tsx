import type { Metadata } from "next"
import { PUBLIC_EXECUTION_SUMMARY, EXECUTION_LIMITATIONS } from "../../lib/historical-execution"
import { PRELIMINARY_REPORT_STYLE } from "../../lib/preliminary-report-style"

export const metadata: Metadata = {
  title: "Historical execution results | Solay39",
  description: "Executed source-fixture tests, evidence digests, verification limits and pending founder review.",
}

export default function VerificationUpdates() {
  const batch = PUBLIC_EXECUTION_SUMMARY.specificBatch
  return <main className="s39-report">
    <style>{PRELIMINARY_REPORT_STYLE}</style>
    <article className="r-shell">
      <div className="r-top"><a className="r-brand" href="/">SOLAY39<small>SMART CONTRACT SECURITY</small></a><a className="r-back" href="/">Back to portfolio</a></div>
      <header><div className="r-kicker">TECHNICAL VERIFICATION UPDATE · {PUBLIC_EXECUTION_SUMMARY.capturedOn}</div>
        <h1>Historical execution results</h1>
        <p className="r-lead">Executed properties are now shown inside matching historical reports. This update adds evidence visibility, not a security rating, certification or automatic founder approval.</p>
      </header>
      <section className="r-section" aria-labelledby="batch-title"><h2 id="batch-title">New contract-specific test batch</h2>
        <p className="r-muted">Counts below apply only to the new 91-target batch. The older AERO and TAG execution sets are shown separately in their reports.</p>
        <div className="r-stats">
          <div className="r-stat"><strong>{batch.targets}</strong><span>Historical source targets</span></div>
          <div className="r-stat"><strong>{batch.testResults}</strong><span>Passing property results</span></div>
          <div className="r-stat"><strong>{batch.fuzzCases.toLocaleString("en-US")}</strong><span>Fuzz cases executed</span></div>
        </div>
        <p className="r-prose">{batch.invariantCampaigns} stateful invariant campaigns executed {batch.statefulCalls.toLocaleString("en-US")} handler calls. Counts describe the recorded final run, not full protocol coverage or current deployment verification.</p>
        <p className="r-muted">Earlier attempts and complete raw outputs remain in the private evidence archive. A passing final fixture check does not close a security finding.</p>
      </section>
      <section className="r-section" aria-labelledby="examples-title"><h2 id="examples-title">Open a report</h2>
        <div className="r-grid">
          <a className="r-panel" href="/audit/aerodrome-1772654966787#historical-tests"><h3>Aerodrome · AERO</h3><p>8 historical authorization properties. Separate from the 91-target batch.</p></a>
          <a className="r-panel" href="/audit/tagger-1793148483876#historical-tests"><h3>Tagger · TAG</h3><p>12 historical properties. Mocked DEX dependencies; live integration checks remain pending.</p></a>
        </div>
        <p className="r-muted">Each report matches results by network and contract address, not by token name. Historical source digests remain distinct from any unverified current source declaration.</p>
      </section>
      <section className="r-section" aria-labelledby="limits-title"><h2 id="limits-title">What this does not establish</h2>
        <ul className="r-list">{EXECUTION_LIMITATIONS.map(text => <li key={text}>{text}</li>)}</ul>
        <p className="r-prose">Private review decisions, approval state and the full evidence archive are not exposed here. CI workflow deployment and a source-fixture execution summary are separate from completed security audits.</p>
      </section>
      <section className="r-section" aria-labelledby="provenance-title"><h2 id="provenance-title">Public summary provenance</h2>
        <p className="r-prose">A compact whitelist contains target addresses, source and output digests, property names and observed outcomes. Digests identify artifacts; they do not independently attest to correctness.</p>
        <dl className="r-fields" style={{ gridTemplateColumns: "minmax(0,1fr)" }}><div><dt className="r-label">Historical-specific evidence index SHA-256</dt><dd>{PUBLIC_EXECUTION_SUMMARY.evidenceIndexSha256}</dd></div></dl>
        <div className="r-actions"><a className="r-action r-action-primary" href="/evidence/historical-execution-summary.json" download>Download public execution summary</a><a className="r-action" href="/">Back to portfolio</a></div>
      </section>
    </article>
  </main>
}
