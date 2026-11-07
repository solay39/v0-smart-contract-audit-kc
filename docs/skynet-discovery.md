# Solay39 Skynet Explorer

Interfaccia pubblica ispirata alla struttura di [CertiK Skynet](https://skynet.certik.com/leaderboards/trending), con identità Solay39 e senza copiare asset, dati di mercato o rating CertiK. Questa modifica riguarda la consultazione dei report, non il motore di audit o il loro livello di assurance.

## Entrate e compatibilità

- Home: `View Ratings` apre la nuova interfaccia; `Classic view` mantiene il portfolio esistente e il suo comportamento.
- `/skynet`: ingresso diretto alla nuova interfaccia.
- `/leaderboard`: conserva l'indirizzo precedente, sostituendo la graduatoria di score legacy con la directory senza rating non verificati.
- `/audit/[id]`: nuova scheda progetto per i report preliminari; URL, dati tecnici, logo, finding, qualifiche delle evidenze e download preservati. `Full technical report` e `Original technical view` aprono il report tecnico originale, con ritorno alla scheda.
- Accesso founder, revisioni storiche private, runner GitHub e API di scrittura non modificati.

## Scheda progetto

I riferimenti visivi sono le schede [PowerXone](https://skynet.certik.com/projects/powerxone), [Chiliz](https://skynet.certik.com/projects/chiliz), [Aria](https://skynet.certik.com/projects/aria), [ARK DeFAI](https://skynet.certik.com/projects/ark-defai) e [MyNeighborAlice](https://skynet.certik.com/projects/myneighboralice). La struttura riprende navigazione orizzontale, rail compatta, pannello progetto laterale e distribuzione dei finding, senza riutilizzare asset o risultati CertiK.

- `Code Security`: conteggi ricavati dai finding effettivi, distribuzione per severità, filtri e dettagli espandibili con impatto, remediation, PoC sottoposti e domande di verifica.
- `Evidence`: hash e compilatore dichiarati, source inventory, collegamento CI, conflitti del record e feed limitato alla data dichiarata e all'approvazione ancora pendente. Nessun evento inventato.
- `Fundamental`, `Operational`, `Governance`, `Community`, `Market`: revisione founder e disponibilità esplicita delle integrazioni. KYC, bounty, incident monitoring, controlli di centralizzazione e dati finanziari non vengono dedotti da narrazioni legacy.
- Pannello progetto: logo, rete e contratto dichiarati, copia indirizzo con feedback, esportazione e vista tecnica originale. Su mobile informazioni e download aggiuntivi sono apribili a richiesta.
- Nessun rating derivato da firme serializzate, stati privati o label `RESOLVED`. Un collegamento CI con hash corrispondente resta una dichiarazione, non autenticazione degli artifact.
- L'anteprima usa gli stessi componenti React della produzione proposta, con snapshot allowlisted dei soli record già pubblici, routing tramite query, reload dei deep link e ritorno alla directory conservando ricerca/filtri. Il link `Open published version` distingue la versione effettivamente pubblicata.

## Directory pubblica

Il componente legge soltanto `GET /api/audits`, stessa origine, senza credenziali, senza localStorage o cataloghi privati. La directory è una vista dei record restituiti da questa API, non una prova di completezza dello storage sottostante.

- I dati vengono minimizzati dal normalizzatore: ID, nome, ticker, rete dichiarata, indirizzo, logo HTTPS consentito, data dichiarata e conteggio dei finding.
- Ogni record rimane preliminare in questa vista. Non sono interpretati score, rating, vecchi badge, firme serializzate o stati privati `APPROVED_UNPUBLISHED`.
- Non sono attualmente visualizzati rating verificati o badge di approvazione, neppure dedotti dalla semplice presenza di una firma. Un futuro rilascio dovrà introdurre un verificatore pubblico di attestazioni legate a sorgente, scope e destinatario prima di esporli.
- Zero finding non significa sicurezza. Finding presenti non significa vulnerabilità confermate.
- Ordinamenti: alfabetico, data dichiarata, numero di finding dichiarati. Non esiste una graduatoria per sicurezza o visite.
- Le date non sono derivate dagli ID. Date non valide o assenti rimangono non dichiarate.
- Prezzi, TVL, variazioni e monitoraggio live non vengono simulati.
- Record distinti restano distinti anche se hanno stesso nome o indirizzo. Ricerca anche per ID e indirizzo per distinguerli.

Un errore di aggiornamento conserva il precedente snapshot in memoria e lo segnala come non aggiornato. Un errore iniziale mostra un messaggio con `Retry`, senza sostituirlo con un catalogo simulato. Un timeout di 60 secondi limita l'attesa della lettura pubblica.

## Interazioni

Panoramica, directory, ultimi report, reti, metodologia, ricerca globale con scorciatoia `/`, filtro rete, ordinamento, azzeramento, paginazione, refresh, barra laterale riducibile e menu mobile con Escape/focus trap. Le schede dei token aprono il report canonico; i loghi mancanti hanno un fallback neutro.

## Verifiche riproducibili

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test:engine
pnpm test:skynet-types
pnpm build
pnpm start --port 3021
# In un altro terminale:
SKYNET_QA_ORIGIN=http://127.0.0.1:3021 pnpm test:skynet-browser
```

La suite browser con fixture è limitata a localhost. Verifica loading, vuoto, payload malformato, errori/retry, dati obsoleti, ricerca e filtri, tutti i controlli, menu responsive, accessibilità di base, founder login e protezioni anonime. Eseguirla sul server di produzione locale evita che il pannello di sviluppo Next intercetti i click.

Per costruire un'anteprima statica degli stessi componenti con snapshot allowlisted dei record già pubblici:

```sh
pnpm exec tsx scripts/build-skynet-preview.mts
serve .local/skynet-preview -l 3030 --no-clipboard
# In un altro terminale:
pnpm exec tsx tests/skynet-preview.browser.mts
pnpm test:project-profile-browser
```

L'anteprima riporta `Public snapshot`, non aggiorna i dati e apre internamente le nuove schede progetto. `Open published version` apre separatamente il sito pubblico, che non viene modificato. Il refresh è intenzionalmente disabilitato. Lo script rifiuta un catalogo vuoto o una risposta HTTP non riuscita, minimizza i record, esclude firme/stati di approvazione e non include backend o cataloghi privati. L'output e le evidenze rimangono sotto `.local/`, ignorata da Git.

L'interfaccia e i metadati sono in inglese, come il resto del sito: navigazione, messaggi, stati, aria-label, etichette mobile e fallback. Le date usano `en-GB`, la ricerca e l'ordinamento usano locale inglese e l'anteprima dichiara `lang="en"`. I nomi originali dei progetti, i record e i report tecnici non sono tradotti o riscritti.

La verifica dello snapshot include il click al report Tagger, logo reale, quattro finding, filtro, disclosure e download Markdown con digest di regressione. Controlla inoltre 1440/375/320 px, ricerca, reti, metodologia e contrasto dei testi piccoli.

La suite delle schede verifica anche tutti i link di sezione, copia indirizzo, doppia esportazione identica, ritorno alla vista originale con ripristino del focus, ritorno alla directory conservando la ricerca, browser Back/reload, apertura dei dati su mobile e recupero di ID assenti. Sei record pubblici, incluso quello meno popolato, sono controllati nel browser; tutti i record dello snapshot passano il controllo di coerenza del modello. I test non attestano la validità tecnica dei finding.

## Rilascio

Il branch `review/skynet-discovery` ha la distribuzione automatica Vercel disabilitata in `vercel.json`. Questa PR non applica migrazioni, non approva audit, non pubblica attestazioni e non modifica i dati persistenti.

L'anteprima statica non è una distribuzione di produzione. Merge e rilascio su `www.solay39.eu` richiedono una decisione separata.
