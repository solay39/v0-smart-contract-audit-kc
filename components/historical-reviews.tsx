"use client"

import { useEffect, useRef, useState } from "react"
import { REVIEW_CHECKS, type ReviewDraft, type ReviewQueueItem, type ReviewView } from "@/lib/historical-review-types"
import styles from "./historical-reviews.module.css"

type Ethereum = { request(input: { method: string; params?: unknown[] }): Promise<unknown>; isMetaMask?: boolean; providers?: Ethereum[] }
function walletProvider(): Ethereum {
  const injected = (window as Window & { ethereum?: Ethereum }).ethereum
  const provider = injected?.providers?.find(p => p.isMetaMask) ?? injected
  if (!provider) throw new Error("MetaMask non disponibile. Apri un browser con il wallet del founder.")
  return provider
}
const api = "/api/founder/historical-reviews"
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin",
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Richiesta non riuscita (${response.status}).`)
  return data as T
}
export function HistoricalReviews() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [query, setQuery] = useState("")
  const [view, setView] = useState<ReviewView | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [findingPage, setFindingPage] = useState(0)
  const [now, setNow] = useState(Date.now())
  const loadSequence = useRef(0)
  const dirty = !!view && !!draft && JSON.stringify(draft) !== JSON.stringify(view.state.draft)
  const frozen = !!view?.state.approval
  const locked = busy || frozen || !!view?.readOnly
  useEffect(() => {
    let active = true
    request<{ queue: ReviewQueueItem[] }>(api).then(data => { if (active) setQueue(data.queue) }).catch(e => { if (active) setError(String(e.message)) })
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])
  function adopt(data: ReviewView) {
    setView(data); setDraft(data.state.draft)
    setQueue(rows => rows.map(row => row.auditId === data.snapshot.auditId ? {
      ...row, status: data.state.approval ? "APPROVED_UNPUBLISHED" : data.state.version > 0 ? "DRAFT" : "NOT_STARTED",
    } : row))
  }
  async function open(auditId: string) {
    if (dirty && !window.confirm("Scartare le modifiche non salvate prima di cambiare o ricaricare audit?")) return
    const sequence = ++loadSequence.current
    setBusy(true); setError(""); setNotice("")
    try {
      const data = await request<ReviewView>(`${api}/${encodeURIComponent(auditId)}`)
      if (sequence === loadSequence.current) { adopt(data); setFindingPage(0) }
    } catch (e) { if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : "Caricamento non riuscito.") }
    finally { if (sequence === loadSequence.current) setBusy(false) }
  }
  async function command(action: "save" | "challenge" | "approve") {
    if (!view || !draft || busy || frozen || view.readOnly) return
    setBusy(true); setError(""); setNotice("")
    try {
      const path = `${api}/${encodeURIComponent(view.snapshot.auditId)}`
      const base = { action, reviewKey: view.reviewKey, expectedVersion: view.state.version }
      let body: unknown
      if (action === "save") body = { ...base, draft }
      else if (action === "challenge") {
        const accounts = await walletProvider().request({ method: "eth_requestAccounts" }) as string[]
        if (!accounts?.[0]) throw new Error("Il wallet non ha restituito un account.")
        body = { ...base, wallet: accounts[0] }
      } else {
        const challenge = view.state.challenge
        if (dirty || !challenge || Date.parse(challenge.expiresAt) <= Date.now()) throw new Error("Salva la bozza e prepara una challenge valida.")
        const provider = walletProvider()
        const accounts = await provider.request({ method: "eth_accounts" }) as string[]
        if (accounts?.[0]?.toLowerCase() !== challenge.wallet) throw new Error("Account del wallet cambiato. Prepara una nuova challenge.")
        const encoded = "0x" + Array.from(new TextEncoder().encode(challenge.message), byte => byte.toString(16).padStart(2, "0")).join("")
        const signature = await provider.request({ method: "personal_sign", params: [encoded, challenge.wallet] })
        body = { ...base, nonce: challenge.nonce, signature }
      }
      const result = await request<ReviewView>(path, body)
      if (action === "approve") {
        const persisted = await request<ReviewView>(path)
        if (!result.state.approval?.id || persisted.state.approval?.id !== result.state.approval.id
            || persisted.state.approval.payloadHash !== result.state.approval.payloadHash) {
          throw new Error("Conferma persistita non verificabile. Ricarica prima di considerare approvato.")
        }
        adopt(persisted)
        setNotice("Approvazione salvata e riletta dal server. Audit non pubblicato.")
      } else {
        adopt(result)
        setNotice(action === "save" ? "Bozza salvata e riletta dal server." : "Challenge preparata. Controlla il messaggio prima di firmare.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita. Nessuna approvazione confermata.")
    } finally { setBusy(false) }
  }
  function update(patch: Partial<ReviewDraft>) {
    if (draft && !locked) { setDraft({ ...draft, ...patch }); setNotice("") }
  }
  const filtered = queue.filter(row => `${row.name} ${row.auditId} ${row.network} ${row.address || ""}`.toLowerCase().includes(query.toLowerCase()))
  const challenge = view?.state.challenge
  const expired = !!challenge && Date.parse(challenge.expiresAt) <= now
  const findingCount = view?.snapshot.findings.length ?? 0
  const findings = view?.snapshot.findings.slice(findingPage * 12, (findingPage + 1) * 12) ?? []
  const completed = draft ? Object.values(draft.decisions).filter(d => d.decision !== "pending").length : 0
  return <main className={styles.shell}>
    <a href="#review-content" className={styles.skip}>Vai alla revisione</a>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>SOLAY39 / FOUNDER WORKSPACE</p><h1>Revisione degli audit storici</h1>
        <p>Uno snapshot, una decisione, una firma. Approvazione privata e pubblicazione restano separate.</p></div>
      <a className={styles.button} href="/" onClick={event => { if (dirty && !window.confirm("Uscire senza salvare le modifiche?")) event.preventDefault() }}>Torna alla home</a>
    </header>
    <div className={styles.feedback}>
      {error && <div className={styles.error} role="alert">{error} Nessuna nuova approvazione viene dichiarata senza conferma persistita.</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}
    </div>
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Coda degli audit">
        <label htmlFor="history-search">Cerca un audit</label>
        <input id="history-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome, rete, indirizzo o ID" />
        <p className={styles.muted}>{filtered.length} di {queue.length} record. Nessuna approvazione in blocco.</p>
        <div className={styles.queue}>
          {filtered.map(row => <button key={row.auditId} disabled={busy} className={`${styles.queueItem} ${view?.snapshot.auditId === row.auditId ? styles.selected : ""}`}
            onClick={() => void open(row.auditId)} aria-pressed={view?.snapshot.auditId === row.auditId}>
            <strong>{row.name}</strong><span>{row.network} · {row.findings} finding da revisionare</span>
            <code>{row.auditId}</code>
            <span className={row.status === "APPROVED_UNPUBLISHED" ? styles.green : styles.muted}>
              {row.status === "APPROVED_UNPUBLISHED" ? "APPROVATO / NON PUBBLICATO" : row.status === "DRAFT" ? "BOZZA SALVATA" : "DA INIZIARE"}
              {row.technicalBlockers.length > 0 && " · BLOCCHI TECNICI"}
            </span>
          </button>)}
          {!filtered.length && <p className={styles.muted}>Nessun record. Se il catalogo non si carica, controlla l’errore di configurazione.</p>}
        </div>
      </aside>
      <section id="review-content" className={styles.review} aria-busy={busy}>
        {!view || !draft ? <div className={styles.empty}><p className={styles.eyebrow}>REVISIONE RISERVATA AL FOUNDER</p><h2>Seleziona un audit per iniziare</h2>
          <p>Il vecchio report non equivale a evidenza validata. Ogni finding storico e ogni candidato statico richiede una decisione motivata.</p>
          <p>Questo flusso non pubblica, non cambia i punteggi e non certifica un contratto come sicuro.</p></div> : <>
          <div className={styles.auditHeading}><p className={styles.eyebrow}>{view.localOnly ? "PREPARAZIONE LOCALE / NESSUN DEPLOY" : "ARCHIVIO PRIVATO / NON PUBBLICATO"}</p>
            {view.readOnly && <p className={styles.notice}>Sola lettura: bozze, firme e approvazioni disabilitate dal server.</p>}
            {view.snapshot.testFixture && <p className={styles.error}>FIXTURE SINTETICA DI TEST. Non è un audit reale.</p>}
            <h2>{view.snapshot.name}</h2><code>{view.snapshot.auditId}</code><p>{view.snapshot.network} · {view.snapshot.address || "Indirizzo non confermato"}</p>
            <div className={styles.row}><span className={styles.muted}>Revisione v{view.state.version} {dirty ? "· MODIFICHE NON SALVATE" : "· ALLINEATA AL SERVER"}</span>
              <button className={styles.button} disabled={busy} onClick={() => void open(view.snapshot.auditId)}>Ricarica dal server</button></div>
          </div>
          {frozen && <div className={styles.approved} role="status"><h3>Approvato, non pubblicato</h3><p>Questa revisione è immutabile. L’approvazione riguarda lo scope dichiarato, non la sicurezza assoluta del contratto.</p>
            <p>Wallet: <code>{view.state.approval!.wallet}</code><br />Salvato: {view.state.approval!.approvedAt}</p>
            <label htmlFor="approval-receipt">Ricevuta persistita</label><textarea id="approval-receipt" readOnly rows={4} value={JSON.stringify(view.state.approval, null, 2)} />
          </div>}
          <section className={styles.block}><h3>Snapshot ed evidenze</h3>
            <dl className={styles.hashes}>
              <dt>Snapshot SHA-256</dt><dd><code>{view.snapshotHash}</code></dd>
              <dt>Report originale SHA-256</dt><dd><code>{view.snapshot.originalReportHash}</code></dd>
              <dt>Evidenze SHA-256</dt><dd><code>{view.snapshot.evidenceHash}</code></dd>
              {view.snapshot.sourceDigests.map(source => <div key={source.target}><dt>Sorgente {source.target}</dt><dd><code>{source.sha256}</code></dd></div>)}
            </dl>
            <p className={styles.muted}>Gli artefatti sono nel dossier verificato. Le impronte identificano i file, non dimostrano da sole correttezza o sicurezza. Revisiona anche sorgenti, output originali e limiti del dossier.</p>
            <details><summary>Apri riepilogo tecnico e riferimenti agli artefatti</summary><pre>{JSON.stringify(view.snapshot.evidence, null, 2)}</pre>
              {view.snapshot.refs.map((ref, i) => <p key={`${ref.sha256}-${i}`}><span>{ref.label}</span><br /><code>{ref.sha256}</code></p>)}</details>
            {!!view.snapshot.technicalBlockers.length && <div className={styles.warning}><h4>Blocchi tecnici non aggirabili con la checklist</h4><ul>{view.snapshot.technicalBlockers.map(item => <li key={item}>{item}</li>)}</ul></div>}
            <details><summary>Limiti da riconoscere prima della firma</summary><ul>{view.snapshot.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details>
          </section>
          <section className={styles.block}><h3>Scope e conclusione revisionata</h3>
            <fieldset disabled={locked}>
              <label htmlFor="review-scope">Scope revisionato</label><textarea id="review-scope" value={draft.scope} maxLength={12000} rows={4} onChange={e => update({ scope: e.target.value })} placeholder="File, versioni, indirizzi, rete, blocco e parti escluse dalla revisione." />
              <label htmlFor="review-conclusion">Conclusione revisionata</label><textarea id="review-conclusion" value={draft.conclusion} maxLength={12000} rows={5} onChange={e => update({ conclusion: e.target.value })} placeholder="Conclusioni basate sulle evidenze e sulle decisioni seguenti, senza ereditare i vecchi rating." />
              <label htmlFor="review-risks">Rischi residui e limiti</label><textarea id="review-risks" value={draft.residualRisks} maxLength={12000} rows={3} onChange={e => update({ residualRisks: e.target.value })} />
            </fieldset>
          </section>
          <section className={styles.block}><h3>Controlli obbligatori</h3>
            <fieldset disabled={locked}>{REVIEW_CHECKS.map(([id, label]) => <div className={styles.check} key={id}>
              <label htmlFor={`check-${id}`}>{label}</label><select id={`check-${id}`} value={draft.checks[id].status} onChange={e => update({ checks: { ...draft.checks, [id]: { ...draft.checks[id], status: e.target.value as "pending" | "pass" | "fail" } } })}>
                <option value="pending">Da verificare</option><option value="pass">Pass motivato</option><option value="fail">Fail / bloccante</option></select>
              <label htmlFor={`check-note-${id}`}>Motivazione: {label}</label><textarea id={`check-note-${id}`} rows={2} value={draft.checks[id].note} maxLength={12000}
                onChange={e => update({ checks: { ...draft.checks, [id]: { ...draft.checks[id], note: e.target.value } } })} />
            </div>)}</fieldset>
          </section>
          <section className={styles.block}><h3>Decisioni sui finding</h3><p>{completed}/{findingCount} decisioni impostate. Le motivazioni e i riferimenti restano obbligatori.</p>
            <p className={styles.muted}>Le descrizioni storiche possono contenere vecchie affermazioni non provate. Un candidato Slither non è una vulnerabilità confermata.</p>
            <p className={styles.muted}>Se scopri un finding non elencato, annotalo nei rischi residui e imposta il controllo pertinente su Fail.
              Serve un nuovo snapshot del dossier con il finding aggiunto: non approvare una lista incompleta.</p>
            <fieldset disabled={locked}>{findings.map(finding => {
              const decision = draft.decisions[finding.id]
              const change = (patch: Partial<typeof decision>) => update({ decisions: { ...draft.decisions, [finding.id]: { ...decision, ...patch } } })
              return <details key={finding.id} className={styles.finding}><summary>{decision.decision === "pending" ? "DA DECIDERE" : "DECISIONE IMPOSTATA"} · {finding.kind} · {finding.title}</summary>
                <p>Severità dichiarata, non validata: {finding.declaredSeverity}</p><code>{finding.sourceTarget}</code><pre>{finding.description}</pre>
                <label htmlFor={`decision-${finding.id}`}>Decisione</label><select id={`decision-${finding.id}`} value={decision.decision} onChange={e => change({ decision: e.target.value as typeof decision.decision })}>
                  <option value="pending">Da verificare</option><option value="false_positive">Falso positivo / affermazione confutata</option><option value="confirmed_open">Confermato aperto (blocca)</option>
                  <option value="verified_observation">Osservazione informativa verificata (solo INFO)</option>
                  <option value="resolved">Risolto con evidenza</option><option value="accepted_risk">Rischio residuo accettato (non HIGH/CRITICAL)</option></select>
                <label htmlFor={`severity-${finding.id}`}>Severità revisionata</label><select id={`severity-${finding.id}`} value={decision.severity} onChange={e => change({ severity: e.target.value as typeof decision.severity })}>
                  {["UNRATED", "INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map(value => <option key={value}>{value}</option>)}</select>
                <label htmlFor={`rationale-${finding.id}`}>Motivazione della decisione</label><textarea id={`rationale-${finding.id}`} rows={3} maxLength={12000} value={decision.rationale} onChange={e => change({ rationale: e.target.value })} />
                <label htmlFor={`evidence-${finding.id}`}>Evidenza a supporto</label><select id={`evidence-${finding.id}`} value={decision.evidenceRefs[0] || ""} onChange={e => change({ evidenceRefs: e.target.value ? [e.target.value] : [] })}>
                  <option value="">Seleziona un artefatto verificato</option>{view.snapshot.refs.map((ref, i) => <option key={`${ref.sha256}-${i}`} value={ref.sha256}>{ref.label}</option>)}</select>
              </details>
            })}</fieldset>
            <div className={styles.row}><button className={styles.button} disabled={findingPage === 0 || busy} onClick={() => setFindingPage(p => p - 1)}>Finding precedenti</button>
              <span>{findingPage + 1}/{Math.max(1, Math.ceil(findingCount / 12))}</span>
              <button className={styles.button} disabled={(findingPage + 1) * 12 >= findingCount || busy} onClick={() => setFindingPage(p => p + 1)}>Finding successivi</button></div>
          </section>
          <section className={styles.block}><h3>Riepilogo e approvazione privata</h3>
            <fieldset disabled={locked}>
              {([["limitsReviewed", "Ho revisionato le lacune e dichiarato i limiti dello scope."], ["noPublication", "Approvo solo una revisione privata: non autorizzo la pubblicazione."], ["noSafetyGuarantee", "La firma non certifica sicurezza assoluta né attribuisce uno stato tier 1."]] as const).map(([key, label]) =>
                <label className={styles.checkbox} key={key}><input type="checkbox" checked={draft.acknowledgements[key]} onChange={e => update({ acknowledgements: { ...draft.acknowledgements, [key]: e.target.checked } })} />{label}</label>)}
            </fieldset>
            {!frozen && <details open className={styles.warning}><summary>{view.blockers.length} condizioni aperte nella bozza salvata</summary>
              {dirty && <p>Ci sono modifiche non salvate. I controlli server verranno ricalcolati dopo il salvataggio.</p>}
              <ul>{view.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul>
            </details>}
            {challenge && !frozen && <div className={styles.challenge}><h4>Messaggio esatto da firmare</h4>
              <p>{expired ? "Challenge scaduta. Preparane una nuova." : `Scadenza: ${challenge.expiresAt}. Nessuna transazione on-chain.`}</p>
              <pre>{challenge.message}</pre></div>}
            {!frozen && <div className={styles.actions}>
              <button className={styles.button} disabled={busy || view.readOnly} onClick={() => void command("save")}>{busy ? "Operazione in corso…" : "Salva bozza"}</button>
              <button className={styles.button} disabled={busy || view.readOnly || dirty || view.blockers.length > 0 || !view.walletReady} onClick={() => void command("challenge")}>Prepara firma</button>
              <button className={styles.primary} disabled={busy || view.readOnly || dirty || !challenge || expired || view.blockers.length > 0} onClick={() => void command("approve")}>Firma e approva senza pubblicare</button>
            </div>}
            <p className={styles.muted}>Solo il founder approva. Una firma rifiutata o un errore di salvataggio non cambia lo stato in “approvato”. Se perdi la risposta, usa “Ricarica dal server”.</p>
          </section>
        </>}
      </section>
    </div>
  </main>
}
