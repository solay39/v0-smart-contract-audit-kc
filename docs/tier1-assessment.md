# Solay39: valutazione tecnica verso un servizio di audit di fascia alta

Verifica del 6 novembre 2026. La piattaforma non è ancora dimostrata di livello “tier 1”: questo documento definisce lacune osservate e criteri di accettazione, non assegna una certificazione né una posizione rispetto a CertiK. GitHub Actions resta il runner scelto; non serve introdurre Render.

## Perimetro e limiti della verifica

- **Codice esaminato:** `main` al commit `23fb6a6f5bc5582008170b2658b5300ef109a940`, ramo `feat/slither-engine` al commit `43a32068e69b6485935b7f1abd5d1adcdf5eb905`, e modifiche di questa PR. È una revisione mirata dei percorsi di analisi, riepilogo, firma e CI, non una revisione completa di tutti gli endpoint o un penetration test della produzione.
- **Stato GitHub:** al momento della verifica le [PR #80](https://github.com/solay39/v0-smart-contract-audit-kc/pull/80), [#81](https://github.com/solay39/v0-smart-contract-audit-kc/pull/81) e [#82](https://github.com/solay39/v0-smart-contract-audit-kc/pull/82) sono aperte. La presenza di codice in una PR non dimostra la sua attivazione in produzione.
- **Metodo:** lettura del codice e nuovi test locali del motore. Nessun nuovo audit su blockchain, trasferimento di fondi, pubblicazione di attestazioni o prova di configurazione Vercel è stato effettuato.
- **Standard di riferimento:** OWASP richiede per una verifica SCSVS evidenze validate manualmente, perimetro esplicito, esclusioni e documentazione riproducibile; i soli strumenti automatici non bastano. OWASP non certifica fornitori o contratti, e SCSVS non copre tutta la sicurezza dell'applicazione web ([OWASP Assessment and Certification](https://scs.owasp.org/SCSVS/04-Assessment_and_Certification/)).

## Blocchi osservati

### Accesso esclusivo del founder non ancora integrato in main

La protezione richiesta è nella [PR #80](https://github.com/solay39/v0-smart-contract-audit-kc/pull/80), che risulta ancora aperta. Il ramo Slither parte dalla correzione del motore, non dalla PR di autenticazione: integrare solo Slither non integra automaticamente la protezione founder.

La versione attuale del [modulo founder](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/lib/founder-auth.ts) usa inoltre un hash pubblico come segreto di sessione di ripiego. Non è una base accettabile per sessioni privilegiate; la correzione preparata deve essere integrata e configurata prima del rilascio.

Criterio di accettazione: ogni endpoint che avvia analisi, modifica audit, firma o pubblica attestazioni deve rifiutare chiamanti non founder. Servono prove su richieste senza cookie, cookie contraffatto, credenziali errate, origine estranea e chiamate server interne, senza introdurre altri auditor autorizzati.

### Punteggio e deduplicazione possono dare falsa fiducia

Nel [motore precedente a questa PR](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/core/engine/auditEngine.ts) il punteggio è calcolato sottraendo penalità da 100 anche se Slither fallisce. La deduplicazione considera solo i primi 30 caratteri normalizzati del titolo, con perdita possibile di vulnerabilità distinte in funzioni o file diversi.

Questa PR:

- **Analisi incompleta:** restituisce `summary.score = null` quando Slither non completa; i finding già rilevati restano disponibili.
- **Esito senza finding:** sostituisce `SAFE` con `NO_FINDINGS`; in assenza di Slither e finding usa `INCOMPLETE`.
- **Stato esplicito:** aggiunge `assurance.status`, `founderReviewRequired`, `isCertification: false` e limitazioni del motore.
- **Deduplicazione:** distingue motore, detector, titolo completo, posizione e snippet. Elimina duplicati equivalenti, non finding distinti solo perché hanno lo stesso titolo.
- **Compatibilità:** i consumatori del riepilogo devono gestire `score: null`, `NO_FINDINGS` e `INCOMPLETE`. La modifica non aggiorna ogni interfaccia o altro motore presente nel repository.

Anche un punteggio 100 con Slither completato è solo un indicatore basato sui finding rilevati, non prova di sicurezza o approvazione finale.

### Firma di revisione non sufficientemente vincolata all'oggetto dell'audit

Il [percorso review-signoff esaminato](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/app/api/audit/review-signoff/route.ts) verifica una firma su nome, indirizzo, rete, conteggi e data ricevuti dal client. Il messaggio firmato non include `auditId`, hash del sorgente, hash dei finding o digest completo delle decisioni; non dimostra quindi l'approvazione di quello specifico contenuto immutabile.

Criterio di accettazione: autorizzazione founder sul server, wallet founder consentito, revisione recuperata dal database, nonce monouso e firma su `auditId`, hash del sorgente, commit, hash del report, decisioni e perimetro. Rifiutare review incompleta, firma riutilizzata e cambiamenti successivi; una modifica al codice deve richiedere una nuova revisione.

Questa PR non dichiara risolto tale blocco e non implementa un sistema completo di pubblicazione o approvazione.

### Funzionalità avanzate non dimostrate dal percorso principale

Il [percorso runAuditEngine](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/core/engine/auditEngine.ts) esegue Slither e analisi euristiche, non Foundry, Echidna, Mythril o un dimostratore formale. Generare un template PoC non significa averlo compilato o aver riprodotto un exploit; valutare condizioni su uno stato in [invariantEngine](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/core/formal/invariantEngine.ts) non dimostra proprietà su tutti gli stati raggiungibili.

Criterio di accettazione: un manifesto per audit con ogni strumento richiesto e il suo stato `completed`, `failed`, `timeout`, `skipped` o `not_applicable`, più versione, configurazione, input, output e digest. Dichiarare una PoC “riprodotta” solo se il test è stato effettivamente compilato ed eseguito con un risultato verificabile.

### Benchmark troppo limitato per una superiorità dimostrata

Il [corpus security-cases](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/benchmarks/security-cases.json) contiene sei casi. L'[evaluator](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/benchmarks/evaluate.py) misura corrispondenze esatte di identificativi e dichiara i propri limiti: non misura da solo sfruttabilità o completezza dell'audit.

Proposta interna, non standard universale “tier 1”: almeno 100 casi revisionati dal founder, con varianti vulnerabili/corrette, più file, proxy, autorizzazioni, firme, oracoli, arrotondamenti e logica DeFi. Separare sviluppo e test nascosto; misurare precisione, recall, falsi negativi critici, falsi positivi e fallimenti di compilazione per classe. Non dichiarare superiorità su un concorrente senza un confronto riproducibile sullo stesso perimetro.

### La build non impone la correttezza TypeScript

La [configurazione Next](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/next.config.mjs) usa `ignoreBuildErrors: true`. Una build verde non dimostra pertanto l'assenza di errori TypeScript.

Criterio di accettazione: `tsc --noEmit` senza errori, build di produzione, test di autorizzazione e regressione obbligatori prima del merge. Non eliminare o disattivare i controlli per ottenere una spunta verde.

### Runner GitHub: privacy e affidabilità da irrobustire

Il [client GitHub](https://github.com/solay39/v0-smart-contract-audit-kc/blob/43a32068e69b6485935b7f1abd5d1adcdf5eb905/lib/slither-github.ts) invia il sorgente compresso negli input del workflow e tenta poi la cancellazione di run e artifact. Le cancellazioni sono best-effort: non equivalgono a una garanzia assoluta di rimozione.

Criterio di accettazione: verifica runtime che il repository sia privato, token minimo limitato al runner, risultato validato e legato al job e al digest del sorgente, timeout di rete, limiti di dimensione/decompressione, errori di pulizia tracciati e processo di recupero. Passare a job asincroni persistenti per non dipendere dalla durata di una richiesta Vercel; testare coda, annullamento, duplicati e riavvio.

## Ordine consigliato

- **Blocco accessi:** integrare #80 e verificare configurazione e rifiuti sul deployment reale.
- **Correttezza di base:** integrare #81, poi #82, poi questa PR; gestire i nuovi valori nel frontend e nei report.
- **Integrità della revisione:** legare la firma founder all'audit immutabile, distinguere bozza e report approvato e impedire pubblicazioni incomplete sul server.
- **Esecuzione riproducibile:** job persistenti su GitHub, manifesto degli strumenti, test Foundry/invarianti progettati per il contratto e conservazione controllata delle evidenze.
- **Validazione del prodotto:** corpus ampio, misure pubblicabili, CI senza errori e prove di regressione sugli incidenti riprodotti.

Tutti gli strumenti sono supporto operativo: solo il founder avvia gli audit e convalida i risultati e le attestazioni. Questo requisito resta distinto dalla capacità di dichiarare conformità a uno standard o superiorità rispetto ad altri fornitori.

## Verifica delle modifiche di questa PR

- **Test del motore:** `pnpm test:engine`, 22 test superati, nessun fallimento. Tre nuovi test verificano assenza di score con Slither incompleto, stato di bozza anche dopo analisi completata e conservazione di finding omonimi in posizioni diverse.
- **TypeScript:** `tsc --noEmit -p tsconfig.json` segnala 101 errori, identici prima e dopo queste modifiche; il controllo globale non è superato.
- **Diff:** `git diff --check` superato. In questo intervento non sono stati rieseguiti deploy, build Docker o test live del runner.
