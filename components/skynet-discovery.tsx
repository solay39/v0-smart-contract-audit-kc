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
  { id: "overview", label: "Panoramica", icon: Compass },
  { id: "directory", label: "Tutti i report", icon: LayoutGrid },
  { id: "recent", label: "Ultimi report", icon: FileSearch },
  { id: "networks", label: "Reti", icon: Globe2 },
  { id: "methodology", label: "Metodologia", icon: BookOpen },
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
      aria-label={`${project.name}: logo non disponibile`}
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
          setError("Catalogo non raggiungibile. Nessun dato è stato stimato.")
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
      ? new Intl.DateTimeFormat("it-IT", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(value))
      : "Non dichiarata"
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
        Vai al contenuto
      </a>
      {mobileNav && (
        <button
          className={styles.backdrop}
          aria-label="Chiudi navigazione"
          onClick={() => {
            setMobileNav(false)
            mobileToggle.current?.focus()
          }}
        />
      )}
      <aside
        ref={nav}
        className={`${styles.sidebar} ${mobileNav ? styles.mobileOpen : ""}`}
        aria-label="Navigazione Skynet"
        {...(mobileNav ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className={styles.brand}>
          <ShieldCheck size={30} aria-hidden />
          <span>
            SOLAY39<small>SKYNET EXPLORER</small>
          </span>
          <button
            className={styles.mobileClose}
            aria-label="Chiudi menu"
            onClick={() => {
              setMobileNav(false)
              mobileToggle.current?.focus()
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.navLabel}>ESPLORA</div>
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
              Evidenze prima dei punteggi
              <small>Un report non è una certificazione.</small>
            </span>
          </div>
          <button
            className={styles.classic}
            onClick={onClassic || back}
            data-testid="classic-view"
          >
            <Layers3 size={17} />
            <span>{onClassic ? "Vista classica" : "Sito Solay39"}</span>
            <ArrowRight size={15} />
          </button>
          <button
            className={styles.collapseButton}
            aria-label={
              collapsed ? "Espandi barra laterale" : "Riduci barra laterale"
            }
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft size={18} />
            <span>Riduci menu</span>
          </button>
        </div>
      </aside>
      <header className={styles.header}>
        <button
          ref={mobileToggle}
          className={styles.mobileToggle}
          aria-label="Apri menu"
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
          <span className={styles.srOnly}>Cerca progetti</span>
          <input
            ref={search}
            value={query}
            placeholder="Cerca progetto, token o indirizzo"
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
            <p>Esplora i report. Verifica le evidenze.</p>
          </div>
          <div className={styles.capture}>
            <span className={styles.dot} />
            {preview ? "Snapshot pubblico" : "Catalogo pubblico"}
            <small>
              {snapshot
                ? `Caricato ${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.observedAt))}`
                : "In caricamento"}
              {error && snapshot ? " · non aggiornato" : ""}
            </small>
          </div>
        </div>
        <div className={styles.disclosure}>
          <ShieldQuestion size={18} />
          <p>
            <strong>Report preliminari, non certificazioni.</strong> Score e
            firme legacy non sono approvazioni verificate.
          </p>
          <button onClick={() => go("methodology")}>
            Come leggere i dati <ArrowRight size={14} />
          </button>
        </div>
        {error && (
          <div role="alert" className={styles.error}>
            <span>
              {error}
              {snapshot
                ? " Restano visibili i dati caricati in precedenza."
                : ""}
            </span>
            <button
              onClick={() => setRevision((n) => n + 1)}
              disabled={loading}
            >
              Riprova
            </button>
          </div>
        )}
        {loading && !snapshot ? (
          <div
            className={styles.loading}
            role="status"
            aria-label="Caricamento catalogo"
          >
            <div />
            <div />
            <div />
            <div />
            <span>Caricamento dei report pubblici…</span>
          </div>
        ) : (
          <>
            {view === "methodology" ? (
              <section className={styles.methodology}>
                <div>
                  <BookOpen size={24} />
                  <h2>Cosa significa questo catalogo</h2>
                  <p>
                    La presenza di un report indica che esiste una scheda
                    pubblica. Non dimostra che il contratto sia sicuro, che i
                    finding siano confermati o che la revisione sia conclusa.
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Stato preliminare</dt>
                    <dd>
                      Tutti i record sono trattati come preliminari in questa
                      vista. Una firma salvata nel vecchio formato non viene
                      considerata una verifica indipendente.
                    </dd>
                  </div>
                  <div>
                    <dt>Security score: N/D</dt>
                    <dd>
                      I punteggi legacy non vengono ripubblicati come rating
                      verificati. Nessuna classifica di sicurezza è calcolata
                      senza prove e una metodologia validata.
                    </dd>
                  </div>
                  <div>
                    <dt>Finding dichiarati</dt>
                    <dd>
                      Il conteggio riporta gli elementi presenti nel record, non
                      vulnerabilità accertate. Un conteggio pari a zero non
                      significa assenza di rischio.
                    </dd>
                  </div>
                  <div>
                    <dt>Data e rete</dt>
                    <dd>
                      Sono dichiarazioni del record originale. La data di
                      caricamento del catalogo non è la data dell’audit e non
                      attesta la freschezza delle evidenze.
                    </dd>
                  </div>
                  <div>
                    <dt>Mercato e monitoraggio</dt>
                    <dd>
                      Prezzi, trending per visite e monitoraggio continuo non
                      sono disponibili in questa vista. Non vengono simulati.
                    </dd>
                  </div>
                  <div>
                    <dt>Approvazioni private</dt>
                    <dd>
                      Le revisioni founder rimangono separate. Anche
                      un’approvazione privata non equivale a una pubblicazione o
                      a una garanzia sul contratto.
                    </dd>
                  </div>
                </dl>
              </section>
            ) : view === "networks" ? (
              <section>
                <div className={styles.sectionHeading}>
                  <h2>Esplora per rete dichiarata</h2>
                  <span>{networks.length} reti</span>
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
                      <span>{n.count} report pubblici</span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </div>
                {!networks.length && (
                  <p className={styles.empty}>
                    Nessuna rete disponibile nel catalogo caricato.
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
                            <Compass size={17} /> Progetti nel catalogo
                          </h2>
                          <span>Ordine alfabetico, non per sicurezza</span>
                        </div>
                        <div className={styles.projectStrip}>
                          {highlighted.map((p) => (
                            <article key={p.id}>
                              {reportLink(p)}
                              <div>
                                <span className={styles.badge}>
                                  Preliminare
                                </span>
                                <small>{p.network}</small>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section className={styles.boards}>
                        <div className={styles.sectionHeading}>
                          <h2>Esplora le reti</h2>
                          <button onClick={() => go("networks")}>
                            Tutte le reti <ArrowRight size={14} />
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
                                CATALOGO / {String(i + 1).padStart(2, "0")}
                              </span>
                              <strong>{n.network}</strong>
                              <span>
                                {n.count} report da esplorare{" "}
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
                            <h2>Ultimi report dichiarati</h2>
                            <button
                              onClick={() => {
                                setOrder("recent")
                                go("recent")
                              }}
                              aria-label="Apri ultimi report"
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
                              Nessuna data dichiarata disponibile.
                            </p>
                          )}
                        </article>
                        <article>
                          <div className={styles.sectionHeading}>
                            <h2>Stato delle revisioni</h2>
                            <ShieldQuestion size={18} />
                          </div>
                          <div className={styles.reviewSummary}>
                            <strong>{projects.length}</strong>
                            <span>
                              record pubblici
                              <br />
                              <b>Da validare manualmente</b>
                            </span>
                          </div>
                          <p className={styles.muted}>
                            Nessuna approvazione viene dedotta da score o badge
                            storici.
                          </p>
                          <button
                            className={styles.textButton}
                            onClick={() => go("methodology")}
                          >
                            Consulta la metodologia <ArrowRight size={15} />
                          </button>
                        </article>
                      </section>
                    </>
                  )}
                <section className={styles.directory}>
                  <div className={styles.sectionHeading}>
                    <h2>
                      {view === "recent"
                        ? "Report per data dichiarata"
                        : "Directory dei report"}
                    </h2>
                    <span data-testid="result-count">
                      {filtered.length} di {projects.length} record
                    </span>
                  </div>
                  <div className={styles.filters}>
                    <label>
                      <ListFilter size={16} />
                      <span className={styles.srOnly}>Filtra per rete</span>
                      <select
                        aria-label="Filtra per rete"
                        value={network}
                        onChange={(e) => setNetwork(e.target.value)}
                      >
                        <option value="all">Tutte le reti</option>
                        {networks.map((n) => (
                          <option key={n.network} value={n.network}>
                            {n.network}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <ArrowDownUp size={16} />
                      <span className={styles.srOnly}>Ordina report</span>
                      <select
                        aria-label="Ordina report"
                        value={effectiveOrder}
                        disabled={view === "recent"}
                        onChange={(e) =>
                          setOrder(e.target.value as DirectoryOrder)
                        }
                      >
                        <option value="name">Nome A–Z</option>
                        <option value="recent">Data dichiarata</option>
                        <option value="findings">Finding dichiarati</option>
                      </select>
                    </label>
                    {(query || network !== "all") && (
                      <button
                        onClick={() => {
                          setQuery("")
                          setNetwork("all")
                        }}
                      >
                        Azzera filtri <X size={14} />
                      </button>
                    )}
                    <button
                      className={styles.refresh}
                      onClick={() => setRevision((n) => n + 1)}
                      disabled={loading || preview}
                      aria-label={
                        preview
                          ? "Snapshot di anteprima, aggiornamento disabilitato"
                          : "Aggiorna catalogo"
                      }
                    >
                      <RefreshCw size={16} />
                      {loading ? "Caricamento" : "Aggiorna"}
                    </button>
                  </div>
                  {filtered.length ? (
                    <>
                      <div className={styles.tableWrap}>
                        <table>
                          <caption className={styles.srOnly}>
                            Report pubblici Solay39. Finding e reti dichiarati,
                            nessun punteggio verificato.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Progetto</th>
                              <th scope="col">Security score</th>
                              <th scope="col">Stato revisione</th>
                              <th scope="col">Finding dichiarati</th>
                              <th scope="col">Rete</th>
                              <th scope="col">Data dichiarata</th>
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
                                  <span className={styles.noScore}>N/D</span>
                                </td>
                                <td>
                                  <span className={styles.badge}>
                                    Preliminare
                                  </span>
                                </td>
                                <td>
                                  <strong>{p.findings ?? "N/D"}</strong>
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
                          Pagina {currentPage + 1} di {pages}
                        </span>
                        <div>
                          <button
                            aria-label="Pagina precedente"
                            disabled={!currentPage}
                            onClick={() => setPage((n) => Math.max(0, n - 1))}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <button
                            aria-label="Pagina successiva"
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
                          ? "Nessun report corrisponde alla ricerca"
                          : error
                            ? "Catalogo non disponibile"
                            : "Nessun report pubblico disponibile"}
                      </h3>
                      <p>
                        {projects.length
                          ? "Prova un altro nome, indirizzo o rete."
                          : "I report appariranno qui quando saranno disponibili."}
                      </p>
                      {projects.length > 0 && (
                        <button
                          onClick={() => {
                            setQuery("")
                            setNetwork("all")
                            search.current?.focus()
                          }}
                        >
                          Azzera ricerca
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
          <span>Report pubblici. Evidenze consultabili.</span>
          <button onClick={() => go("methodology")}>Metodologia</button>
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
