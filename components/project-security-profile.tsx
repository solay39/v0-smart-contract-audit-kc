"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleHelp,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileSearch,
  Fingerprint,
  Globe2,
  Layers3,
  Radio,
  Shield,
  ShieldQuestion,
  Users,
  Workflow,
} from "lucide-react"
import type { PortfolioProject } from "../lib/solay39-constants"
import {
  findingReviewQuestion,
  preliminaryMarkdown,
  reportText,
  type RecordIssue,
} from "../lib/preliminary-report"
import { projectProfileModel } from "../lib/project-profile"
import { PreliminaryAuditReport } from "./preliminary-audit-report"
import { ReportTokenLogo } from "./report-token-logo"
import styles from "./project-security-profile.module.css"

const sections = [
  ["code-security", "Code Security", Code2],
  ["execution-evidence", "Evidence", FileSearch],
  ["fundamental", "Fundamental", Fingerprint],
  ["operational", "Operational", Radio],
  ["governance", "Governance", Layers3],
  ["community", "Community", Users],
  ["market", "Market", Globe2],
] as const
const colors: Record<string, string> = {
  CRITICAL: "#b52f42",
  HIGH: "#ac4e1f",
  MEDIUM: "#87630f",
  LOW: "#417d9c",
  INFO: "#67758b",
  UNCLASSIFIED: "#68716d",
}
const label = (severity: string) =>
  severity === "INFO"
    ? "Informational"
    : severity[0] + severity.slice(1).toLowerCase()
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))

export function ProjectSecurityProfile({
  project,
  declarationIssues,
  preview = false,
  onBack,
}: {
  project: PortfolioProject
  declarationIssues?: RecordIssue[]
  preview?: boolean
  onBack?: () => void
}) {
  const model = projectProfileModel(project)
  const issues = declarationIssues ?? model.issues
  const [filter, setFilter] = useState("ALL")
  const [classic, setClassic] = useState(false)
  const [active, setActive] = useState("code-security")
  const [copyState, setCopyState] = useState("")
  const [infoOpen, setInfoOpen] = useState(false)
  const technicalButton = useRef<HTMLButtonElement>(null)
  const profileHeading = useRef<HTMLHeadingElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    setFilter("ALL")
    setClassic(false)
    setCopyState("")
    setInfoOpen(false)
  }, [project.id])
  useEffect(() => {
    if (restoreFocus.current) {
      ;(classic ? technicalButton.current : profileHeading.current)?.focus()
      restoreFocus.current = false
    }
    if (classic) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-110px 0px -65% 0px" }
    )
    for (const [id] of sections) {
      const node = document.getElementById(id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [classic])
  function switchReport(value: boolean) {
    restoreFocus.current = true
    setClassic(value)
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([preliminaryMarkdown(project, project, declarationIssues)], {
        type: "text/markdown;charset=utf-8",
      })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.id}-technical-report.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(model.address)
      setCopyState("Contract address copied.")
    } catch {
      setCopyState("Copy unavailable. Select the contract address below.")
    }
  }
  const back = onBack ? (
    <button type="button" onClick={onBack}>
      <ArrowLeft size={16} /> All projects
    </button>
  ) : (
    <a href="/skynet">
      <ArrowLeft size={16} /> All projects
    </a>
  )
  if (classic)
    return (
      <div className={styles.classic}>
        <div className={styles.classicBar}>
          <button
            ref={technicalButton}
            type="button"
            onClick={() => switchReport(false)}
          >
            <ArrowLeft size={16} /> Back to project profile
          </button>
          <span>Full technical report · Original view</span>
        </div>
        <PreliminaryAuditReport
          project={project}
          declarationIssues={declarationIssues}
        />
      </div>
    )
  let cumulative = 0
  const total = model.findings.length
  const donut = model.distribution
    .filter((row) => row.count > 0)
    .map((row) => {
      const start = cumulative
      cumulative += (row.count / total) * 100
      return `${colors[row.severity]} ${start}% ${cumulative}%`
    })
    .join(", ")
  const shown = model.findings.filter(
    (f) => filter === "ALL" || f.category === filter
  )
  return (
    <div className={styles.root} data-testid="project-profile">
      <a className={styles.skip} href="#project-main">
        Skip to security report
      </a>
      <nav className={styles.rail} aria-label="Solay39 project navigation">
        <a
          className={styles.brand}
          href={preview ? "https://www.solay39.eu" : "/"}
          aria-label="Solay39 website"
        >
          <Shield size={29} strokeWidth={1.7} />
        </a>
        <a
          href={preview ? "#directory" : "/skynet"}
          onClick={
            onBack
              ? (e) => {
                  e.preventDefault()
                  onBack()
                }
              : undefined
          }
          aria-label="Project directory"
          title="Project directory"
        >
          <Layers3 size={20} />
        </a>
        {sections.map(([id, title, Icon]) => (
          <a
            key={id}
            href={`#${id}`}
            title={title}
            aria-label={title}
            aria-current={active === id ? "location" : undefined}
          >
            <Icon size={19} />
          </a>
        ))}
      </nav>
      <header className={styles.header}>
        {back}
        <span className={styles.breadcrumb}>
          Solay39 Explorer <span>/</span> Project security
        </span>
        <button type="button" onClick={download}>
          <Download size={15} /> Export report
        </button>
      </header>
      <div className={styles.layout}>
        <div className={styles.content}>
          <nav className={styles.sectionNav} aria-label="Project sections">
            {sections.map(([id, title]) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={active === id ? "location" : undefined}
              >
                {title}
              </a>
            ))}
          </nav>
          <main id="project-main" className={styles.main}>
            <div className={styles.notice}>
              <ShieldQuestion size={19} />
              <p>
                <strong>Preliminary assessment.</strong> Findings are submitted,
                not validated. This is not a completed audit, certification or
                deployment recommendation.
              </p>
            </div>
            {preview && (
              <p className={styles.previewNotice}>
                PR preview · Read-only public snapshot · Not deployed to Solay39
              </p>
            )}
            <section id="code-security" className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <Code2 size={23} />
                </span>
                <h2>Code Security</h2>
                <span className={styles.sectionMeta}>
                  Source, findings & review
                </span>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h3>Code audit record</h3>
                    <p>One report record, not a complete audit history.</p>
                  </div>
                  <button type="button" onClick={() => switchReport(true)}>
                    <FileSearch size={15} /> Full technical report
                  </button>
                </div>
                <div className={styles.recordLabel}>
                  <FileCode2 size={15} />
                  <span>
                    {model.name}
                    {model.ticker ? ` (${model.ticker})` : ""}
                  </span>
                  <span className={styles.pending}>Preliminary</span>
                </div>
                <div className={styles.auditGrid}>
                  <div className={styles.distribution}>
                    <div className={styles.findingTotals}>
                      <div
                        className={styles.donut}
                        style={
                          {
                            "--donut": donut
                              ? `conic-gradient(${donut})`
                              : "#e9edea",
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      >
                        <span>{model.findingsSupplied ? total : "?"}</span>
                      </div>
                      <div>
                        <strong>
                          {model.findingsSupplied ? total : "N/A"}
                        </strong>
                        <span>Submitted findings</span>
                      </div>
                      <div>
                        <strong className={styles.muted}>Pending</strong>
                        <span>Validation status</span>
                      </div>
                    </div>
                    <p className={styles.small}>
                      Severity reflects saved declarations, not confirmed risk.
                    </p>
                    <div
                      className={styles.severityList}
                      aria-label="Submitted finding distribution"
                    >
                      {model.distribution
                        .filter(
                          (row) =>
                            row.severity !== "UNCLASSIFIED" || row.count > 0
                        )
                        .map((row) => (
                          <button
                            key={row.severity}
                            type="button"
                            aria-pressed={filter === row.severity}
                            onClick={() =>
                              setFilter(
                                filter === row.severity ? "ALL" : row.severity
                              )
                            }
                            data-testid={`severity-${row.severity}`}
                          >
                            <span
                              className={styles.severityDot}
                              style={{ background: colors[row.severity] }}
                            />
                            <b>{model.findingsSupplied ? row.count : "?"}</b>
                            <span>{label(row.severity)}</span>
                            <span className={styles.bar}>
                              <span
                                style={{
                                  width: `${total ? (row.count / total) * 100 : 0}%`,
                                  background: colors[row.severity],
                                }}
                              />
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className={styles.auditFacts}>
                    <div>
                      <span className={styles.eyebrow}>
                        Declared report date
                      </span>
                      <strong>
                        {model.declaredAt
                          ? date(model.declaredAt)
                          : "Not supplied"}
                      </strong>
                    </div>
                    <div>
                      <span className={styles.eyebrow}>Assessment method</span>
                      <strong>Submitted technical assessment</strong>
                      <p>
                        Execution and manual review require separate evidence.
                      </p>
                    </div>
                    <div>
                      <span className={styles.eyebrow}>Consistency checks</span>
                      <a href="#execution-evidence">
                        {issues.length} declaration{" "}
                        {issues.length === 1 ? "issue" : "issues"}{" "}
                        <ArrowUpRight size={13} />
                      </a>
                    </div>
                    <div>
                      <span className={styles.eyebrow}>Resolution status</span>
                      <strong>Not independently validated</strong>
                      <p>
                        No saved “resolved” label is treated as verified
                        remediation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h3>Submitted findings</h3>
                    <p>
                      Open a finding for impact, remediation and review
                      questions.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={filter === "ALL"}
                    onClick={() => setFilter("ALL")}
                  >
                    All ({total})
                  </button>
                </div>
                <p className={styles.small} role="status">
                  {filter === "ALL"
                    ? `${total} submitted findings`
                    : `${shown.length} ${label(filter).toLowerCase()} submissions`}
                </p>
                {!shown.length && (
                  <div className={styles.empty}>
                    <CircleHelp size={22} />
                    <p>
                      {model.findingsSupplied
                        ? "No submissions in this category. This does not establish safety."
                        : "Findings were not supplied. No safety conclusion is available."}
                    </p>
                  </div>
                )}
                <div className={styles.findings}>
                  {shown.map((finding) => (
                    <details key={finding.displayId} className={styles.finding}>
                      <summary>
                        <span className={styles.findingId}>
                          {finding.displayId}
                        </span>
                        <span
                          className={styles.severityBadge}
                          style={{ color: colors[finding.category] }}
                        >
                          {label(finding.category)}
                        </span>
                        <span className={styles.findingName}>
                          {reportText(finding.title, 500)}
                        </span>
                        <span className={styles.submitted}>Submitted</span>
                      </summary>
                      <div className={styles.findingBody}>
                        <span className={styles.eyebrow}>
                          Declared location
                        </span>
                        <code>
                          {reportText(finding.location) || "Not supplied"}
                        </code>
                        <p>{reportText(finding.description)}</p>
                        <h4>Declared impact</h4>
                        <p>{reportText(finding.impact) || "Not supplied"}</p>
                        <h4>Proposed remediation</h4>
                        <p>
                          {reportText(finding.recommendation) || "Not supplied"}
                        </p>
                        <div className={styles.reviewQuestion}>
                          <h4>Founder review question</h4>
                          <p>{findingReviewQuestion(finding.title)}</p>
                        </div>
                        {(finding.foundryPoC || finding.proofOfConcept) && (
                          <details>
                            <summary>Inspect submitted PoC code</summary>
                            <p>
                              Submitted code is not proof of successful
                              execution.
                            </p>
                            <pre>
                              {reportText(
                                finding.foundryPoC || finding.proofOfConcept,
                                50000
                              )}
                            </pre>
                          </details>
                        )}
                        {finding.remediationExample && (
                          <details>
                            <summary>Review remediation example</summary>
                            <pre>
                              {reportText(finding.remediationExample, 50000)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </section>
            <section id="execution-evidence" className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <FileSearch size={23} />
                </span>
                <h2>Execution & Evidence</h2>
                <span className={styles.sectionMeta}>
                  Provenance before confidence
                </span>
              </div>
              <div className={styles.twoColumns}>
                <div className={styles.panel}>
                  <h3>Source provenance</h3>
                  <dl className={styles.fields}>
                    <div>
                      <dt>Source SHA-256 · declared</dt>
                      <dd>
                        <code>{model.sourceHash || "Not supplied"}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Compiler target · declared</dt>
                      <dd>
                        {reportText(
                          project.codeMetrics?.compilerVersion ||
                            project.engagement?.compilerVersionUsed
                        ) || "Not supplied"}
                      </dd>
                    </div>
                  </dl>
                  {model.sourceUrl ? (
                    <a
                      className={styles.inlineLink}
                      href={model.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open declared source <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <p className={styles.small}>
                      No source repository supplied.
                    </p>
                  )}
                  <p className={styles.small}>
                    A digest declaration does not verify deployed bytecode.
                  </p>
                </div>
                <div className={styles.panel}>
                  <h3>Execution linkage</h3>
                  <span className={styles.neutralBadge}>
                    {model.ciLinked ? "Linked declaration" : "Not established"}
                  </span>
                  <p>
                    {model.ciLinked
                      ? "CI metadata references the declared source digest. Artifact authenticity and results still require review."
                      : "No source-bound execution linkage is established by this record."}
                  </p>
                  {model.runUrl && (
                    <a
                      className={styles.inlineLink}
                      href={model.runUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Inspect declared CI run <ArrowUpRight size={14} />
                    </a>
                  )}
                  <p className={styles.small}>
                    A GitHub success badge alone is not an audit approval.
                  </p>
                </div>
              </div>
              {(model.scope.length > 0 || model.technical) && (
                <div className={styles.panel}>
                  <h3>Submitted source inventory</h3>
                  <p>
                    Source declarations and lexical observations, not verified
                    coverage.
                  </p>
                  {model.scope.length > 0 && (
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>File / contract</th>
                            <th>Language</th>
                            <th>Declared LOC</th>
                            <th>Source revision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.scope.map((entry, i) => (
                            <tr key={i}>
                              <td>{reportText(entry.contract)}</td>
                              <td>
                                {reportText(entry.language) || "Not supplied"}
                              </td>
                              <td>
                                {Number.isFinite(entry.linesOfCode)
                                  ? entry.linesOfCode
                                  : "Not supplied"}
                              </td>
                              <td>
                                {/^[a-f0-9]{7,40}$/i.test(
                                  reportText(entry.commit)
                                )
                                  ? entry.commit
                                  : "Not established"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {model.technical && (
                    <>
                      <p>{model.technical.method}</p>
                      <div className={styles.inventoryCount}>
                        <FileCode2 size={18} />
                        <strong>{model.technical.functions.length}</strong>{" "}
                        submitted function observations
                      </div>
                      <p className={styles.small}>
                        The complete function inventory, call flow and
                        verification matrix remain in the full technical report.
                      </p>
                      <button type="button" onClick={() => switchReport(true)}>
                        Open complete technical evidence{" "}
                        <ArrowUpRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className={styles.panel}>
                <h3>Record consistency</h3>
                <p>
                  {issues.length
                    ? "Resolve these declaration conflicts before sign-off."
                    : "No supported rule detected a conflict. This does not validate the report."}
                </p>
                {issues.map((issue) => (
                  <details className={styles.issue} key={issue.id}>
                    <summary>{issue.title}</summary>
                    <p>{issue.detail}</p>
                  </details>
                ))}
              </div>
              <div className={styles.panel}>
                <h3>Evidence feed</h3>
                <div className={styles.feed}>
                  <span className={styles.feedDot} />
                  <div>
                    <span className={styles.eyebrow}>
                      {model.declaredAt
                        ? date(model.declaredAt)
                        : "Date not supplied"}
                    </span>
                    <strong>Report date declared</strong>
                    <p>
                      This is a saved record date, not a verified execution or
                      review event.
                    </p>
                  </div>
                </div>
                <div className={styles.feed}>
                  <span className={styles.feedDot} />
                  <div>
                    <span className={styles.eyebrow}>
                      Pending · no event date
                    </span>
                    <strong>Founder validation & approval</strong>
                    <p>
                      No verified approval is issued by this preliminary
                      profile.
                    </p>
                  </div>
                </div>
              </div>
            </section>
            <section id="fundamental" className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <Fingerprint size={23} />
                </span>
                <h2>Fundamental Health</h2>
                <span className={styles.sectionMeta}>Identity & review</span>
              </div>
              <div className={styles.twoColumns}>
                <div className={styles.panel}>
                  <h3>Review workflow</h3>
                  <ol className={styles.workflow}>
                    <li>
                      <FileCode2 size={18} />
                      <div>
                        <strong>Public record</strong>
                        <span>Available · declarations only</span>
                      </div>
                    </li>
                    <li>
                      <FileSearch size={18} />
                      <div>
                        <strong>Evidence verification</strong>
                        <span>Founder review pending</span>
                      </div>
                    </li>
                    <li>
                      <ShieldQuestion size={18} />
                      <div>
                        <strong>Final approval</strong>
                        <span>Reserved exclusively to the founder</span>
                      </div>
                    </li>
                  </ol>
                </div>
                <div className={styles.panel}>
                  <h3>Team verification</h3>
                  <span className={styles.neutralBadge}>
                    Not independently verified
                  </span>
                  <p>
                    No validated KYC or team-identity attestation is supplied
                    for this profile.
                  </p>
                  <p className={styles.small}>
                    Auditor identity and token-team identity are separate
                    checks.
                  </p>
                </div>
              </div>
            </section>
            <section id="operational" className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <Radio size={23} />
                </span>
                <h2>Operational Resilience</h2>
                <span className={styles.sectionMeta}>Coverage is explicit</span>
              </div>
              <div className={styles.panel}>
                <h3>Active monitoring</h3>
                <div className={styles.capabilities}>
                  {[
                    [Globe2, "Website"],
                    [Code2, "Code repository"],
                    [FileCode2, "Smart contract"],
                    [Users, "Social media"],
                  ].map(([Icon, title]) => {
                    const Glyph = Icon as typeof Globe2
                    return (
                      <div key={String(title)}>
                        <Glyph size={23} />
                        <strong>{String(title)}</strong>
                        <span>Not connected</span>
                      </div>
                    )
                  })}
                </div>
                <p className={styles.small}>
                  This report is a point-in-time declaration. It does not run
                  continuous monitoring.
                </p>
              </div>
              <div className={styles.twoColumns}>
                <div className={styles.panel}>
                  <h3>Bug bounty program</h3>
                  <span className={styles.neutralBadge}>
                    Evidence not supplied
                  </span>
                  <p>
                    No verified program scope or bounty-policy evidence is
                    attached.
                  </p>
                </div>
                <div className={styles.panel}>
                  <h3>Incident history</h3>
                  <span className={styles.neutralBadge}>Not monitored</span>
                  <p>
                    Missing incident records do not mean the project has had no
                    incidents.
                  </p>
                </div>
              </div>
            </section>
            <section id="governance" className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <Layers3 size={23} />
                </span>
                <h2>Governance & Centralization</h2>
                <span className={styles.sectionMeta}>
                  Declared trust boundaries
                </span>
              </div>
              <div className={styles.panel}>
                <h3>Centralization overview</h3>
                <div className={styles.controlGrid}>
                  {[
                    "Distribution",
                    "Upgrade authority",
                    "Owner privileges",
                    "Trading constraints",
                  ].map((title) => (
                    <div key={title}>
                      <strong>{title}</strong>
                      <span>Not independently assessed</span>
                    </div>
                  ))}
                </div>
                <p className={styles.small}>
                  A token scan does not establish safe governance, holder
                  distribution or integration behavior.
                </p>
                {model.trust.map((entry, i) => (
                  <details className={styles.issue} key={i}>
                    <summary>{reportText(entry.component)}</summary>
                    <p>
                      Declared trust:{" "}
                      {reportText(entry.trustRequired) || "Not supplied"}
                    </p>
                    <p>{reportText(entry.riskIfCompromised)}</p>
                    <p>
                      Proposed control:{" "}
                      {reportText(entry.mitigation) || "Not supplied"}
                    </p>
                  </details>
                ))}
              </div>
            </section>
            {(["community", "market"] as const).map((id) => (
              <section id={id} className={styles.section} key={id}>
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>
                    {id === "community" ? (
                      <Users size={23} />
                    ) : (
                      <Globe2 size={23} />
                    )}
                  </span>
                  <h2>
                    {id === "community" ? "Community Trust" : "Market Data"}
                  </h2>
                  <span className={styles.sectionMeta}>Not connected</span>
                </div>
                <div className={styles.panel}>
                  <h3>
                    {id === "community"
                      ? "Social and reputation signals"
                      : "Market & on-chain analytics"}
                  </h3>
                  <p>
                    {id === "community"
                      ? "No verified social monitoring, user ratings or reputation feed is connected. Community popularity is not a security finding."
                      : "No authenticated price, liquidity, TVL or holder-distribution feed is connected to this profile. No market chart is simulated."}
                  </p>
                  <span className={styles.neutralBadge}>
                    Unavailable in this assessment
                  </span>
                </div>
              </section>
            ))}
            <footer className={styles.footer}>
              <Shield size={17} />
              <span>Solay39 · Evidence before assurance</span>
              <a
                href="https://www.perplexity.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Built with Perplexity
              </a>
            </footer>
          </main>
        </div>
        <aside className={styles.sidebar} aria-label="Project summary">
          <div className={styles.identity}>
            <ReportTokenLogo name={model.name} logoUrl={model.logoUrl} />
            <div>
              <h1 ref={profileHeading} tabIndex={-1}>
                {model.name}
              </h1>
              <span>
                {model.ticker || "Token ticker not supplied"}{" "}
                <span className={styles.chain}>{model.network}</span>
              </span>
            </div>
          </div>
          <div className={styles.assurance}>
            <span className={styles.eyebrow}>Solay39 security assessment</span>
            <div className={styles.score}>
              <strong>N/A</strong>
              <span>Preliminary</span>
            </div>
            <div className={styles.assuranceGraphic}>
              <ShieldQuestion size={57} strokeWidth={1.25} />
              <strong>Not rated</strong>
              <p>No verified security score</p>
            </div>
            <div className={styles.assuranceRows}>
              <div>
                <FileCode2 size={16} />
                <span>Source digest</span>
                <b>{model.sourceHash ? "Declared" : "Not supplied"}</b>
              </div>
              <div>
                <Workflow size={16} />
                <span>Execution</span>
                <b>
                  {model.ciLinked ? "Linked declaration" : "Not established"}
                </b>
              </div>
              <div>
                <ShieldQuestion size={16} />
                <span>Founder review</span>
                <b>Pending</b>
              </div>
            </div>
          </div>
          <div className={styles.badges}>
            <a href="#code-security">
              <Code2 size={22} />
              <strong>Report</strong>
              <span>Preliminary</span>
            </a>
            <a href="#fundamental">
              <Fingerprint size={22} />
              <strong>Team</strong>
              <span>Unverified</span>
            </a>
            <a href="#operational">
              <Radio size={22} />
              <strong>Monitor</strong>
              <span>Not connected</span>
            </a>
          </div>
          <button
            type="button"
            className={styles.infoToggle}
            aria-expanded={infoOpen}
            aria-controls="project-information"
            onClick={() => setInfoOpen(!infoOpen)}
          >
            {infoOpen
              ? "Hide project information"
              : "Project information & downloads"}{" "}
            <span aria-hidden="true">{infoOpen ? "−" : "+"}</span>
          </button>
          <div
            id="project-information"
            className={styles.projectInfo}
            data-expanded={infoOpen}
          >
            <h3>{model.name} Info</h3>
            {model.description && <p>{model.description}</p>}
            <dl className={styles.fields}>
              <div>
                <dt>Network · declared</dt>
                <dd>{model.network}</dd>
              </div>
              <div>
                <dt>Token contract · declared</dt>
                <dd>
                  {model.address ? (
                    <>
                      <code>{model.address}</code>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={copyAddress}
                        aria-label="Copy contract address"
                      >
                        {copyState.startsWith("Contract") ? (
                          <Check size={15} />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                    </>
                  ) : (
                    "Not supplied"
                  )}
                </dd>
              </div>
              <div>
                <dt>Report ID</dt>
                <dd>
                  <code>{reportText(project.id, 200)}</code>
                </dd>
              </div>
            </dl>
            <p role="status" className={styles.copyStatus}>
              {copyState}
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={download}
            >
              <Download size={15} /> Download technical report
            </button>
            <button type="button" onClick={() => switchReport(true)}>
              Original technical view <ArrowUpRight size={14} />
            </button>
            {preview && (
              <a
                className={styles.inlineLink}
                href={`https://www.solay39.eu/audit/${encodeURIComponent(project.id)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open published version <ArrowUpRight size={14} />
              </a>
            )}
            <p className={styles.small}>
              Missing evidence does not establish that this contract is safe or
              vulnerable.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
