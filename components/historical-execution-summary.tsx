import React from "react"
import type { PortfolioProject } from "../lib/solay39-constants"
import { EXECUTION_LIMITATIONS, PUBLIC_EXECUTION_SUMMARY, executionCounts, historicalExecutionFor } from "../lib/historical-execution"

export function HistoricalExecutionSummary({ project }: { project: PortfolioProject }) {
  const row = historicalExecutionFor(project)
  if (!row) return null
  const counts = executionCounts(row)
  return <section id="historical-tests" className="r-section" aria-labelledby="historical-tests-title">
    <div className="r-section-head"><div>
      <h2 id="historical-tests-title">Historical execution results</h2>
      <p>Captured {PUBLIC_EXECUTION_SUMMARY.capturedOn}. Tests ran on local source fixtures, not on the current production deployment.</p>
    </div></div>
    <div className="r-stats">
      <div className="r-stat"><strong>{counts.passed}/{row.tests.length}</strong><span>Listed properties passed</span></div>
      <div className="r-stat"><strong>{counts.fuzzCases.toLocaleString("en-US")}</strong><span>Fuzz cases executed</span></div>
      <div className="r-stat"><strong>{counts.statefulCalls.toLocaleString("en-US")}</strong><span>Stateful handler calls</span></div>
    </div>
    <div className="r-panel" style={{ marginTop: 16 }}>
      <h3>Execution scope and provenance</h3>
      <dl className="r-fields">
        <div><dt className="r-label">Historical target</dt><dd>Chain {row.chainId} · {row.address}</dd></div>
        <div><dt className="r-label">Historical source manifest SHA-256</dt><dd>{row.sourceManifestSha256}</dd></div>
        <div><dt className="r-label">Execution output SHA-256</dt><dd>{row.executionOutputSha256}</dd></div>
      </dl>
      <p className="r-muted">These digests identify historical artifacts, not a verified match to the current declared source or deployed bytecode. A digest alone is not independent validation.</p>
    </div>
    <details style={{ marginTop: 16 }}>
      <summary>Inspect executed properties ({row.tests.length})</summary>
      <div className="r-table-wrap" tabIndex={0} role="region" aria-label="Executed property results; scroll horizontally on narrow screens">
        <table className="r-technical-table"><thead><tr><th>Executed property</th><th>Category</th><th>Observed result</th></tr></thead>
          <tbody>{row.tests.map(test => <tr key={test.name}><td>{test.name}</td><td>{test.category}</td><td>Passed{"runs" in test && test.runs ? ` · ${test.runs} runs` : ""}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
    <div className="r-panel" style={{ marginTop: 16 }}><h3>Still required before approval</h3>
      <ul className="r-list">{EXECUTION_LIMITATIONS.map(text => <li key={text}>{text}</li>)}
        {row.chainId === 56 && row.address === "0x208bf3e7da9639f1eaefa2de78c23396b0682025" &&
          <li>TAG uses mocked DEX dependencies on local chain 31337. BSC locker behavior and live signer integration were not tested.</li>}
      </ul>
    </div>
    <div className="r-actions">
      <a className="r-action" href="/evidence/historical-execution-summary.json" download>Download public execution summary</a>
      <a className="r-action" href="/verification-updates">View verification update</a>
    </div>
  </section>
}
