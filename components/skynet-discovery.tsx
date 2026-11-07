"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileSearch,
  Globe2,
  Layers3,
  LayoutGrid,
  ListFilter,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react"
import {
  directoryLogo,
  networkCounts,
  normalizeDirectory,
  selectDirectory,
  type DirectoryOrder,
  type DirectoryProject,
  type DirectorySnapshot,
} from "../lib/skynet-directory"
import styles from "./skynet-discovery.module.css"

type View = "overview" | "directory" | "recent" | "networks" | "methodology"
const navigation = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "directory", label: "All reports", icon: LayoutGrid },
  { id: "recent", label: "Latest reports", icon: FileSearch },
  { id: "networks", label: "Networks", icon: Globe2 },
  { id: "methodology", label: "Methodology", icon: BookOpen },
] as const
function Logo({ project }: { project: DirectoryProject }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [project.logoUrl])
  const src = directoryLogo(project.logoUrl)
  return src && !failed ? (
    <img
      src={src}
      alt={`${project.name} logo`}
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={styles.monogram}
      role="img"
      aria-label={`${project.name}: logo unavailable`}
    >
      {project.name.slice(0, 2).toUpperCase()}
    </span>
  )
}
export function SkynetDiscovery({
  onBack,
  onClassic,
  initialSnapshot,
  preview = false,
}: {
  onBack?: () => void
  onClassic?: () => void
  initialSnapshot?: DirectorySnapshot
  preview?: boolean
}) {
  const [view, setView] = useState<View>("overview")
  const [query, setQuery] = useState("")
  const [network, setNetwork] = useState("all")
  const [order, setOrder] = useState<DirectoryOrder>("name")
  const [page, setPage] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [snapshot, setSnapshot] = useState<DirectorySnapshot | null>(
    initialSnapshot || null
  )
  const [loading, setLoading] = useState(!initialSnapshot)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const search = useRef<HTMLInputElement>(null)
  const mobileToggle = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    if (preview) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let disposed = false
    setLoading(true)
    setError("")
    const timer = setTimeout(() => controller.abort(), 60_000)
    void fetch("/api/audits", {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        const data = await response.json()
        return normalizeDirectory(data.audits)
      })
      .then((projects) =>
        setSnapshot({ projects, observedAt: new Date().toISOString() })
      )
      .catch(() => {
        if (!controller.signal.aborted || !disposed)
          setError("Directory unavailable. No data has been estimated.")
      })
      .finally(() => {
        clearTimeout(timer)
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [revision, preview])
  useEffect(() => {
    if (!mobileNav) return
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false)
        mobileToggle.current?.focus()
      }
      if (event.key === "Tab" && nav.current) {
        const controls = [
          ...nav.current.querySelectorAll<HTMLElement>("button, a[href]"),
        ].filter((el) => el.offsetParent !== null)
        const first = controls[0],
          last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    nav.current?.querySelector<HTMLButtonElement>("button")?.focus()
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [mobileNav])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 861px)")
    const resize = () => {
      if (media.matches) setMobileNav(false)
    }
    media.addEventListener("change", resize)
    return () => media.removeEventListener("change", resize)
  }, [])
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    document.addEventListener("keydown", shortcut)
    return () => document.removeEventListener("keydown", shortcut)
  }, [])
  const projects = snapshot?.projects || []
  const networks = useMemo(() => networkCounts(projects), [projects])
  const effectiveOrder = view === "recent" ? "recent" : order
  const filtered = useMemo(
    () => selectDirectory(projects, query, network, effectiveOrder),
    [projects, query, network, effectiveOrder]
  )
  useEffect(() => setPage(0), [query, network, effectiveOrder, view])
  const pages = Math.max(1, Math.ceil(filtered.length / 12))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * 12, (currentPage + 1) * 12)
  const recent = selectDirectory(projects, "", "all", "recent")
    .filter((p) => p.reportedAt)
    .slice(0, 4)
  const highlighted = selectDirectory(projects, "", "all", "name").slice(0, 6)
  const go = (next: View) => {
    setView(next)
    setMobileNav(false)
    window.scrollTo(0, 0)
    if (mobileNav) mobileToggle.current?.focus()
  }
  const chooseNetwork = (value: string) => {
    setNetwork(value)
    setQuery("")
    go("directory")
  }
  const reportHref = (id: string) =>
    `${preview ? "https://www.solay39.eu" : ""}/audit/${encodeURIComponent(id)}`
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(value))
      : "Not disclosed"
  const reportLink = (p: DirectoryProject) => (
    <a
      href={reportHref(p.id)}
      className={styles.projectLink}
      data-testid={`report-${p.id}`}
      target={preview ? "_blank" : undefined}
      rel={preview ? "noopener noreferrer" : undefined}
    >
      <Logo project={p} />
      <span>
        <strong>{p.name}</strong>
        <small>{p.ticker || p.network}</small>
      </span>
    </a>
  )
  const back = () => {
    if (onBack) onBack()
    else window.location.assign("https://www.solay39.eu/")
  }
  return (
    <div
      className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}
      data-testid="skynet-discovery"
    >
      <a className={styles.skip} href="#skynet-main">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => {
            setMobileNav(false)
            mobileToggle.current?.focus()
          }}
        />
      )}
      <aside
        ref={nav}
        className={`${styles.sidebar} ${mobileNav ? styles.mobileOpen : ""}`}
        aria-label="Skynet navigation"
        {...(mobileNav ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className={styles.brand}>
          <ShieldCheck size={30} aria-hidden />
          <span>
            SOLAY39<small>SKYNET EXPLORER</small>
          </span>
          <button
            className={styles.mobileClose}
            aria-label="Close menu"
            onClick={() => {
              setMobileNav(false)
              mobileToggle.current?.focus()
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.navLabel}>EXPLORE</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              title={item.label}
              data-testid={`nav-${item.id}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "directory" && snapshot && (
                <small>{projects.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.reviewNote}>
            <ShieldQuestion size={18} />
            <span>
              Evidence before scores
              <small>A report is not a certification.</small>
            </span>
          </div>
          <button
            className={styles.classic}
            onClick={onClassic || back}
            data-testid="classic-view"
          >
            <Layers3 size={17} />
            <span>{onClassic ? "Classic view" : "Solay39 website"}</span>
            <ArrowRight size={15} />
          </button>
          <button
            className={styles.collapseButton}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft size={18} />
            <span>Collapse menu</span>
          </button>
        </div>
      </aside>
      <header className={styles.header}>
        <button
          ref={mobileToggle}
          className={styles.mobileToggle}
          aria-label="Open menu"
          aria-expanded={mobileNav}
          onClick={() => setMobileNav(!mobileNav)}
        >
          <Menu size={21} />
        </button>
        <span className={styles.headerTitle}>
          Skynet <strong>Explorer</strong>
        </span>
        <label className={styles.globalSearch}>
          <Search size={17} />
          <span className={styles.srOnly}>Search projects</span>
          <input
            ref={search}
            value={query}
            placeholder="Search project, token or address"
            onChange={(e) => {
              setQuery(e.target.value)
              if (!["overview", "directory", "recent"].includes(view))
                setView("directory")
            }}
            data-testid="search-projects"
          />
          <kbd>/</kbd>
        </label>
        <button
          className={styles.homeButton}
          onClick={back}
          data-testid="back-home"
        >
          <ArrowLeft size={15} />
          <span>Solay39</span>
        </button>
      </header>
      <main id="skynet-main" ref={main} className={styles.main} tabIndex={-1}>
        <div className={styles.pageHeading}>
          <div>
            <div className={styles.eyebrow}>SOLAY39 / PUBLIC INTELLIGENCE</div>
            <h1>{navigation.find((n) => n.id === view)?.label}</h1>
            <p>Explore reports. Check the evidence.</p>
          </div>
          <div className={styles.capture}>
            <span className={styles.dot} />
            {preview ? "Public snapshot" : "Public directory"}
            <small>
              {snapshot
                ? `Loaded ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.observedAt))}`
                : "Loading"}
              {error && snapshot ? " · out of date" : ""}
            </small>
          </div>
        </div>
        <div className={styles.disclosure}>
          <ShieldQuestion size={18} />
          <p>
            <strong>Preliminary reports, not certifications.</strong> Legacy
            scores and signatures are not verified approvals.
          </p>
          <button onClick={() => go("methodology")}>
            How to read the data <ArrowRight size={14} />
          </button>
        </div>
        {error && (
          <div role="alert" className={styles.error}>
            <span>
              {error}
              {snapshot ? " Previously loaded data remains visible." : ""}
            </span>
            <button
              onClick={() => setRevision((n) => n + 1)}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}
        {loading && !snapshot ? (
          <div
            className={styles.loading}
            role="status"
            aria-label="Loading directory"
          >
            <div />
            <div />
            <div />
            <div />
            <span>Loading public reports…</span>
          </div>
        ) : (
          <>
            {view === "methodology" ? (
              <section className={styles.methodology}>
                <div>
                  <BookOpen size={24} />
                  <h2>What this directory means</h2>
                  <p>
                    A report in this directory means a public record exists. It
                    does not prove that the contract is safe, that findings are
                    confirmed, or that the review is complete.
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Preliminary status</dt>
                    <dd>
                      All records are treated as preliminary in this view. A
                      signature stored in a legacy format is not considered
                      independent verification.
                    </dd>
                  </div>
                  <div>
                    <dt>Security score: N/A</dt>
                    <dd>
                      Legacy scores are not republished as verified ratings. No
                      security ranking is calculated without evidence and a
                      validated methodology.
                    </dd>
                  </div>
                  <div>
                    <dt>Submitted findings</dt>
                    <dd>
                      The count reflects entries in the record, not confirmed
                      vulnerabilities. A zero count does not mean there is no
                      risk.
                    </dd>
                  </div>
                  <div>
                    <dt>Date and network</dt>
                    <dd>
                      These are declarations from the original record. The
                      directory loading date is not the audit date and does not
                      establish that the evidence is current.
                    </dd>
                  </div>
                  <div>
                    <dt>Market data and monitoring</dt>
                    <dd>
                      Prices, visit-based trending and continuous monitoring are
                      not available in this view. They are not simulated.
                    </dd>
                  </div>
                  <div>
                    <dt>Private approvals</dt>
                    <dd>
                      Founder reviews remain separate. Even a private approval
                      does not constitute publication or a guarantee about the
                      contract.
                    </dd>
                  </div>
                </dl>
              </section>
            ) : view === "networks" ? (
              <section>
                <div className={styles.sectionHeading}>
                  <h2>Explore by declared network</h2>
                  <span>{networks.length} networks</span>
                </div>
                <div className={styles.networkGrid}>
                  {networks.map((n) => (
                    <button
                      key={n.network}
                      onClick={() => chooseNetwork(n.network)}
                      data-testid={`network-card-${n.network}`}
                    >
                      <Globe2 size={24} />
                      <strong>{n.network}</strong>
                      <span>{n.count} public reports</span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </div>
                {!networks.length && (
                  <p className={styles.empty}>
                    No networks are available in the loaded directory.
                  </p>
                )}
              </section>
            ) : (
              <>
                {view === "overview" &&
                  !query &&
                  network === "all" &&
                  projects.length > 0 && (
                    <>
                      <section className={styles.featured}>
                        <div className={styles.sectionHeading}>
                          <h2>
                            <Compass size={17} /> Projects in the directory
                          </h2>
                          <span>
                            Alphabetical order, not a security ranking
                          </span>
                        </div>
                        <div className={styles.projectStrip}>
                          {highlighted.map((p) => (
                            <article key={p.id}>
                              {reportLink(p)}
                              <div>
                                <span className={styles.badge}>
                                  Preliminary
                                </span>
                                <small>{p.network}</small>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section className={styles.boards}>
                        <div className={styles.sectionHeading}>
                          <h2>Explore networks</h2>
                          <button onClick={() => go("networks")}>
                            All networks <ArrowRight size={14} />
                          </button>
                        </div>
                        <div className={styles.boardGrid}>
                          {networks.slice(0, 3).map((n, i) => (
                            <button
                              key={n.network}
                              className={styles.board}
                              onClick={() => chooseNetwork(n.network)}
                              data-testid={`board-${n.network}`}
                            >
                              <span className={styles.boardCaption}>
                                DIRECTORY / {String(i + 1).padStart(2, "0")}
                              </span>
                              <strong>{n.network}</strong>
                              <span>
                                {n.count} reports to explore{" "}
                                <ArrowRight size={16} />
                              </span>
                              <div className={styles.boardLogos}>
                                {projects
                                  .filter((p) => p.network === n.network)
                                  .slice(0, 4)
                                  .map((p) => (
                                    <Logo key={p.id} project={p} />
                                  ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                      <section className={styles.summaryGrid}>
                        <article>
                          <div className={styles.sectionHeading}>
                            <h2>Latest declared reports</h2>
                            <button
                              onClick={() => {
                                setOrder("recent")
                                go("recent")
                              }}
                              aria-label="Open latest reports"
                            >
                              <ArrowRight size={17} />
                            </button>
                          </div>
                          {recent.length ? (
                            recent.map((p) => (
                              <div key={p.id} className={styles.miniRow}>
                                {reportLink(p)}
                                <small>{date(p.reportedAt)}</small>
                              </div>
                            ))
                          ) : (
                            <p className={styles.muted}>
                              No declared dates are available.
                            </p>
                          )}
                        </article>
                        <article>
                          <div className={styles.sectionHeading}>
                            <h2>Review status</h2>
                            <ShieldQuestion size={18} />
                          </div>
                          <div className={styles.reviewSummary}>
                            <strong>{projects.length}</strong>
                            <span>
                              public records
                              <br />
                              <b>Awaiting manual validation</b>
                            </span>
                          </div>
                          <p className={styles.muted}>
                            No approval is inferred from legacy scores or
                            badges.
                          </p>
                          <button
                            className={styles.textButton}
                            onClick={() => go("methodology")}
                          >
                            Read the methodology <ArrowRight size={15} />
                          </button>
                        </article>
                      </section>
                    </>
                  )}
                <section className={styles.directory}>
                  <div className={styles.sectionHeading}>
                    <h2>
                      {view === "recent"
                        ? "Reports by declared date"
                        : "Report directory"}
                    </h2>
                    <span data-testid="result-count">
                      {filtered.length} of {projects.length} records
                    </span>
                  </div>
                  <div className={styles.filters}>
                    <label>
                      <ListFilter size={16} />
                      <span className={styles.srOnly}>Filter by network</span>
                      <select
                        aria-label="Filter by network"
                        value={network}
                        onChange={(e) => setNetwork(e.target.value)}
                      >
                        <option value="all">All networks</option>
                        {networks.map((n) => (
                          <option key={n.network} value={n.network}>
                            {n.network}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <ArrowDownUp size={16} />
                      <span className={styles.srOnly}>Sort reports</span>
                      <select
                        aria-label="Sort reports"
                        value={effectiveOrder}
                        disabled={view === "recent"}
                        onChange={(e) =>
                          setOrder(e.target.value as DirectoryOrder)
                        }
                      >
                        <option value="name">Name A–Z</option>
                        <option value="recent">Declared date</option>
                        <option value="findings">Submitted findings</option>
                      </select>
                    </label>
                    {(query || network !== "all") && (
                      <button
                        onClick={() => {
                          setQuery("")
                          setNetwork("all")
                        }}
                      >
                        Clear filters <X size={14} />
                      </button>
                    )}
                    <button
                      className={styles.refresh}
                      onClick={() => setRevision((n) => n + 1)}
                      disabled={loading || preview}
                      aria-label={
                        preview
                          ? "Preview snapshot, refresh disabled"
                          : "Refresh directory"
                      }
                    >
                      <RefreshCw size={16} />
                      {loading ? "Loading" : "Refresh"}
                    </button>
                  </div>
                  {filtered.length ? (
                    <>
                      <div className={styles.tableWrap}>
                        <table>
                          <caption className={styles.srOnly}>
                            Public Solay39 reports. Submitted findings and
                            declared networks, with no verified scores.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Project</th>
                              <th scope="col">Security score</th>
                              <th scope="col">Review status</th>
                              <th scope="col">Submitted findings</th>
                              <th scope="col">Network</th>
                              <th scope="col">Declared date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((p, i) => (
                              <tr key={p.id}>
                                <td>{currentPage * 12 + i + 1}</td>
                                <td>
                                  {reportLink(p)}
                                  {p.address && (
                                    <code
                                      title={p.address}
                                      className={styles.address}
                                    >
                                      {p.address.length > 22
                                        ? `${p.address.slice(0, 10)}…${p.address.slice(-6)}`
                                        : p.address}
                                    </code>
                                  )}
                                </td>
                                <td>
                                  <span className={styles.noScore}>N/A</span>
                                </td>
                                <td>
                                  <span className={styles.badge}>
                                    Preliminary
                                  </span>
                                </td>
                                <td>
                                  <strong>{p.findings ?? "N/A"}</strong>
                                  {p.highFindings ? (
                                    <small className={styles.findingNote}>
                                      {p.highFindings} HIGH / CRITICAL
                                    </small>
                                  ) : null}
                                </td>
                                <td>
                                  <span className={styles.networkLabel}>
                                    {p.network}
                                  </span>
                                </td>
                                <td className={styles.muted}>
                                  {date(p.reportedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.pagination}>
                        <span>
                          Page {currentPage + 1} of {pages}
                        </span>
                        <div>
                          <button
                            aria-label="Previous page"
                            disabled={!currentPage}
                            onClick={() => setPage((n) => Math.max(0, n - 1))}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <button
                            aria-label="Next page"
                            disabled={currentPage + 1 >= pages}
                            onClick={() => setPage((n) => n + 1)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={styles.empty}>
                      <Search size={28} />
                      <h3>
                        {projects.length
                          ? "No reports match your search"
                          : error
                            ? "Directory unavailable"
                            : "No public reports available"}
                      </h3>
                      <p>
                        {projects.length
                          ? "Try another name, address or network."
                          : "Reports will appear here when available."}
                      </p>
                      {projects.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("")
                            setNetwork("all")
                            search.current?.focus()
                          }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Solay39</span>
          <span>Public reports. Evidence you can inspect.</span>
          <button onClick={() => go("methodology")}>Methodology</button>
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
  )
}
