"use client"

import React, { useState } from "react"
import type { PortfolioProject, SeverityLevel } from "../lib/solay39-constants"
import { findingReviewQuestion, preliminaryMarkdown, preliminaryModel, reportText, REPORT_SEVERITIES, safeReportUrl } from "../lib/preliminary-report"
import { PRELIMINARY_REPORT_STYLE } from "../lib/preliminary-report-style"
import type { RecordIssue } from "../lib/preliminary-report"
import { ReportTokenLogo } from "./report-token-logo"

/** Full technical detail and conservative assurance are independent concerns. */
export function PreliminaryAuditReport({ project, declaredRecord = project, declarationIssues }: {
  project: PortfolioProject; declaredRecord?: PortfolioProject; declarationIssues?: RecordIssue[]
}) {
  const [filter, setFilter] = useState<"ALL" | SeverityLevel>("ALL")
  const model = preliminaryModel(project, declaredRecord)
  const m = { ...model, issues: declarationIssues ?? model.issues }
  const visible = m.findings.map((finding, index) => ({ finding, index })).filter(x => filter === "ALL" || x.finding.severity === filter)
  const navigation = [["overview", "Overview"], ["scope", "Scope & architecture"], ["findings", "Findings"], ["evidence", "Execution & evidence"], ["review", "Founder review"]]
  const reference = (value: { id: string; url: string } | null | undefined, host: string) => {
    const url = safeReportUrl(value?.url)
    return value && url && new URL(url).hostname === host
      ? <a href={url} target="_blank" rel="noopener noreferrer">{value.id}</a> : null
  }
  function download() {
    const url = URL.createObjectURL(new Blob([preliminaryMarkdown(project, declaredRecord, declarationIssues)], { type: "text/markdown;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url; a.download = `${project.id}-technical-report.md`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <main className="s39-report" data-report-appearance="classic">
    <style>{PRELIMINARY_REPORT_STYLE}</style>
    <div className="r-shell">
      <div className="r-top">
        <a className="r-brand" href="/">SOLAY39<small>SMART CONTRACT SECURITY</small></a>
        <a className="r-back" href="/">Back to portfolio</a>
      </div>
      <div className="r-layout">
        <aside className="r-index"><nav className="r-nav" aria-label="Report sections">
          {navigation.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav></aside>
        <article className="r-content">
          <header id="overview">
            <div className="r-kicker">SOLAY39 / PRELIMINARY REPORT</div>
            <div className="r-project-heading">
              <ReportTokenLogo name={project.name || "Smart contract"} logoUrl={project.logoUrl} />
              <div className="r-project-identity">
                <h1>{project.name || "Smart contract"}</h1>
                {project.ticker && <span className="r-ticker">{project.ticker}</span>}
              </div>
            </div>
            <p className="r-muted">Smart contract security assessment · {project.network || "Network not supplied"}</p>
            <p className="r-lead">Technical findings, proposed fixes and review context in one report. Submitted declarations are preserved; execution evidence and founder approval are tracked separately.</p>
            <div className="r-actions">
              <button type="button" className="r-action r-action-primary" onClick={download}>Download technical report</button>
              {m.sourceUrl && <a className="r-action" href={m.sourceUrl} target="_blank" rel="noopener noreferrer">Open declared source</a>}
            </div>
            <div className="r-notice"><span className="r-status">Awaiting founder review</span><p style={{ marginTop: 9 }}>This is not a completed security audit or deployment recommendation. No verified security score is issued. Missing evidence does not establish safety or vulnerability.</p></div>
            <div className="r-stats">
              <div className="r-stat"><strong>{m.findings.length}</strong><span>Submitted findings</span></div>
              <div className="r-stat"><strong>{m.counts.CRITICAL + m.counts.HIGH}</strong><span>High / critical claims</span></div>
              <div className="r-stat"><strong>{m.pocCount}</strong><span>PoC code submissions</span></div>
            </div>
          </header>
          <section className="r-section" aria-labelledby="overview-title">
            <div className="r-section-head"><div><h2 id="overview-title">Executive overview</h2><p>Reported scope and review priorities, not a safety rating.</p></div></div>
            <div className="r-grid">
              <div className="r-panel"><h3>Assessment scope</h3><p>{reportText(project.scope) || "The contract identified in the scope below."}</p>
                {project.description && <p className="r-muted">{reportText(project.description, 1800)}</p>}
              </div>
              <div className="r-panel"><h3>What needs attention</h3><ul className="r-list">
                <li>{m.counts.HIGH + m.counts.CRITICAL} high / critical severity submissions require exploitability review.</li>
                <li>{m.issues.length} consistency {m.issues.length === 1 ? "issue" : "issues"} in the saved declarations.</li>
                <li>{m.ciLinked ? "A CI run is linked to the declared source digest." : "Source-bound CI evidence is not established."}</li>
                <li>Only the founder may validate findings and sign off.</li>
              </ul></div>
            </div>
            {m.issues.length > 0 && <details style={{ marginTop: 20 }}><summary>Inspect record consistency checks ({m.issues.length})</summary>
              {m.issues.map(issue => <div className="r-panel r-issue" key={issue.id}><h3>{issue.title}</h3><p>{issue.detail}</p></div>)}
            </details>}
          </section>
          <section id="scope" className="r-section" aria-labelledby="scope-title">
            <div className="r-section-head"><div><h2 id="scope-title">Scope & architecture</h2><p>Declared context. Counts and architecture have not been independently confirmed.</p></div></div>
            <div className="r-panel"><dl className="r-fields">
              {[
                ["Report ID", project.id], ["Network", project.network], ["Contract address", project.contractAddress],
                ["Declared report date", project.date], ["Declared compiler target", project.codeMetrics?.compilerVersion || project.engagement?.compilerVersionUsed],
                ["Source SHA-256 (declared)", m.sourceHash],
              ].map(([label, value]) => <div key={label}><dt className="r-label">{label}</dt><dd>{value || "Not supplied"}</dd></div>)}
            </dl></div>
            {m.scope.length > 0 && <div className="r-table-wrap"><table><caption className="r-label" style={{ textAlign: "left" }}>Submitted source inventory</caption>
              <thead><tr><th>File / contract</th><th>Language</th><th>Declared LOC</th><th>Source revision</th></tr></thead>
              <tbody>{m.scope.map((entry, i) => <tr key={i}><td>{entry.contract}</td><td>{reportText(entry.language) || "Not supplied"}</td><td>{Number.isFinite(entry.linesOfCode) ? entry.linesOfCode : "Not supplied"}</td><td>{/^[a-f0-9]{7,40}$/i.test(reportText(entry.commit)) ? entry.commit : "Not established"}</td></tr>)}</tbody>
            </table></div>}
            {project.architectureOverview && <div className="r-panel" style={{ marginTop: 16 }}><h3>Submitted architecture</h3><p>{reportText(project.architectureOverview)}</p></div>}
            {m.trust.length > 0 && <div className="r-panel" style={{ marginTop: 16 }}><h3>Declared trust boundaries</h3>
              {m.trust.map((entry, i) => <div key={i} style={{ marginTop: 14 }}><span className="r-label">{entry.component} · {reportText(entry.trustRequired)} trust declared</span><p>{reportText(entry.riskIfCompromised)}</p>{entry.mitigation && <p className="r-muted">Proposed control: {reportText(entry.mitigation)}</p>}</div>)}
            </div>}
          </section>
          <section id="findings" className="r-section" aria-labelledby="findings-title">
            <div className="r-section-head"><div><h2 id="findings-title">Technical findings</h2><p>SUBMITTED, NOT VALIDATED. Severity and disposition are declarations, not founder approval.</p></div></div>
            <div className="r-filters" role="group" aria-label="Filter findings by severity">
              <button className="r-filter" type="button" aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>All ({m.findings.length})</button>
              {REPORT_SEVERITIES.filter(s => m.counts[s] > 0).map(s => <button className="r-filter" type="button" key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{s} ({m.counts[s]})</button>)}
            </div>
            <p className="r-muted r-caption" role="status">Showing {visible.length} of {m.findings.length} submitted findings.</p>
            {m.findings.length === 0 && <div className="r-panel" style={{ marginTop: 16 }}>No findings supplied. This is not proof of security.</div>}
            {visible.map(({ finding: f, index }) => <article className="r-finding" key={index} id={`finding-${index + 1}`}>
              <div className="r-finding-head"><div><span className="r-label">F-{String(index + 1).padStart(2, "0")} · {f.severity === "INFO" ? "Informational observation" : "Code finding submission"}</span><h3>{f.title}</h3></div><span className="r-severity" data-level={f.severity}>{f.severity} / SUBMITTED</span></div>
              <p className="r-location">{f.location || "Exact source location not supplied"}</p><p className="r-prose">{reportText(f.description)}</p>
              <div className="r-finding-grid"><div><span className="r-label">Declared impact</span><p>{reportText(f.impact) || "Not supplied"}</p></div><div><span className="r-label">Proposed remediation</span><p>{reportText(f.recommendation) || "Not supplied"}</p></div></div>
              <div className="r-tags"><span>Disposition: {f.status || "Not supplied"}</span>
                {f.cvss && Number.isFinite(f.cvss.baseScore) && <span>Declared CVSS: {f.cvss.baseScore} (not validated)</span>}
                {reference(f.cwe, "cwe.mitre.org")}{reference(f.swc, "swcregistry.io")}
              </div>
              {f.cvss?.vectorString && <p className="r-location" style={{ marginTop: 8 }}>{reportText(f.cvss.vectorString, 300)}</p>}
              <div className="r-review-question"><strong>Founder review question</strong><p>{findingReviewQuestion(f.title)}</p></div>
              {f.remediationExample && <details><summary>Review remediation example</summary><p className="r-muted r-caption">Submitted example. Not compiled or validated here; adapt it to the actual source and storage layout.</p><pre><code>{reportText(f.remediationExample, 50000)}</code></pre></details>}
              {(f.foundryPoC || f.proofOfConcept) && <details><summary>Inspect submitted PoC code</summary><p className="r-muted r-caption">Code submission only. No successful reproduction is established; a privileged caller in a test is not evidence of an unprivileged exploit.</p><pre><code>{reportText(f.foundryPoC || f.proofOfConcept, 50000)}</code></pre></details>}
              {f.clientResponse && <details><summary>Read submitted response</summary><p className="r-prose">{reportText(f.clientResponse)}</p>{f.fixVerification && <p className="r-prose">Declared fix verification: {reportText(f.fixVerification)}. Independent validation pending.</p>}</details>}
            </article>)}
          </section>
          <section id="evidence" className="r-section" aria-labelledby="evidence-title">
            <div className="r-section-head"><div><h2 id="evidence-title">Execution & evidence</h2><p>Stored narrative, submitted code and captured execution are different evidence classes.</p></div></div>
            {[
              ["Source snapshot", m.sourceHash ? "Digest declared" : "Missing", m.sourceHash ? "A digest is recorded. Matching the deployed bytecode still needs validation." : "Attach exact source files, compiler settings and an immutable source digest."],
              ["CI source binding", m.ciLinked ? "Linked" : "Not established", m.ciLinked ? "Run metadata references the same declared source SHA-256. Founder validation is pending." : "A workflow link or a successful job alone cannot establish source-bound analysis."],
              ["Exploit reproduction", "Not established", m.pocCount ? `${m.pocCount} PoC code submissions are available above. Compilation, execution and exploit preconditions are not established by their presence.` : "No finding-specific PoC code was supplied."],
              ["Founder sign-off", "Pending", "Manual validation, remediation decisions and final approval are reserved exclusively to the founder."],
            ].map(([title, state, detail]) => <div className="r-evidence-row" key={title}><strong>{title}</strong><div><span className="r-evidence-state" data-linked={state === "Linked"}>{state}</span><p>{detail}</p></div></div>)}
            {m.ci?.result && <div style={{ marginTop: 18 }}><h3>Recorded CI execution</h3>
              {([["Slither", m.ci.result.slither], ["Mythril", m.ci.result.mythril]] as const).map(([name, tool]) => tool && <div className="r-evidence-row" key={name}><strong>{name}</strong><div><span className="r-evidence-state">{tool.success ? "Execution completed" : "INCOMPLETE / FAILED"}</span><p>Recorded version: {tool.version || "Not supplied"}</p>{tool.error && <p style={{ whiteSpace: "pre-wrap" }}>{reportText(tool.error, 6000)}</p>}</div></div>)}
              {m.runUrl && <a className="r-action" style={{ marginTop: 14 }} href={m.runUrl} target="_blank" rel="noopener noreferrer">View CI execution evidence on GitHub</a>}
            </div>}
            <div className="r-panel" style={{ marginTop: 20 }}><h3>Evidence policy</h3><p className="r-muted">Historical tool narratives, coverage percentages, generated attack simulations and legacy signatures are not promoted to execution proof. Attach source-bound runner artifacts for any claimed fuzzing, symbolic execution, formal verification or exploit reproduction.</p></div>
          </section>
          <section id="review" className="r-section" aria-labelledby="review-title">
            <div className="r-section-head"><div><h2 id="review-title">Founder review plan</h2><p>Concrete next steps toward a defensible final report.</p></div></div>
            <ol className="r-list">
              <li>Lock the exact source, dependency versions, compiler settings and deployment identity.</li>
              <li>Resolve the saved record inconsistencies before relying on architecture or supply claims.</li>
              <li>Validate each finding against the code, with reachable preconditions and a reproducible impact.</li>
              <li>Capture real tool outputs, reproduce applicable exploits and retest proposed fixes.</li>
              <li>Record the founder&apos;s decisions and issue a signed report only when the evidence gate permits it.</li>
            </ol>
          </section>
          <footer className="r-footer">Report {project.id}. This technical draft preserves the submitted material without certifying it. Approval is reserved to the founder; unsupported ratings, review hours, staffing claims and attestations remain excluded.</footer>
        </article>
      </div>
    </div>
  </main>
}
