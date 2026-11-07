# Solay39: approvazione sicura degli audit storici

Il flusso è stato implementato e verificato in locale, poi preparato per una PR di sola revisione, senza distribuzione o modifiche ai dati pubblici. Nessun audit storico ha ricevuto una firma o un’approvazione durante la preparazione: le firme di collaudo riguardano esclusivamente fixture sintetiche e un wallet temporaneo.

## Come funzionerà per il founder

Il nuovo percorso è `Founder Access → Audit storici`, con pagina privata `/founder/historical-reviews`. Si approva una revisione delimitata da sorgente, evidenze e conclusioni, non la sicurezza assoluta di un contratto.

- **Selezione singola:** cerca per nome, rete, indirizzo o ID e apri un solo audit. Non esiste un comando di approvazione in blocco.
- **Evidenze:** confronta lo snapshot, gli hash di sorgente e report, i risultati acquisiti e le limitazioni con il dossier originale. Un hash identifica un contenuto, ma non prova che l’analisi sia corretta.
- **Scope e conclusione:** scrivi cosa hai effettivamente revisionato, cosa è escluso, le conclusioni sostenibili e i rischi residui. I vecchi score e rating non vengono ereditati.
- **Controlli obbligatori:** ogni controllo richiede un esito Pass motivato. Un esito pendente o Fail impedisce di preparare la firma.
- **Finding:** decidi ogni finding storico e ogni candidato statico; indica severità revisionata, motivazione e artefatto a supporto. Puoi distinguere un falso positivo, un problema aperto, un problema risolto, un rischio residuo accettato e un’osservazione informativa verificata, quest’ultima solo INFO. Un risultato Slither non diventa automaticamente una vulnerabilità.
- **Nuovi problemi:** se scopri un finding non presente nello snapshot, annotalo nei rischi residui e imposta il controllo pertinente su Fail. Serve un nuovo snapshot con il finding aggiunto prima dell’approvazione.
- **Salvataggio:** usa “Salva bozza”, poi verifica la conferma del server. Puoi interrompere e riprendere; cambiare audit con modifiche non salvate richiede conferma.
- **Firma:** quando non ci sono blocchi, usa “Prepara firma”, controlla il messaggio completo e poi “Firma e approva senza pubblicare”. Serve il wallet del founder esplicitamente autorizzato.
- **Ricevuta:** la schermata dichiara approvato soltanto dopo salvataggio e rilettura. Il risultato è `APPROVED_UNPUBLISHED`, con wallet, firma, hash e data del server.

Se il wallet rifiuta, la rete fallisce o la conferma non è verificabile, il client non dichiara una nuova approvazione. Dopo una risposta persa, “Ricarica dal server” recupera l’eventuale approvazione effettivamente persistita.

## Protezioni implementate

- **Autorizzazione:** sessione founder verificata sul server e allowlist wallet non vuota. Sono richiesti una password founder privata configurata esplicitamente e un segreto di sessione dedicato; il nuovo flusso non si affida al fingerprint legacy pubblico.
- **Separazione dei dati:** cataloghi e revisioni usano tabelle private dedicate, non `public.audits`. La bozza di migrazione abilita RLS, revoca accesso ad anon e authenticated e riserva le operazioni al backend.
- **Firma vincolata al contenuto:** il messaggio lega dominio, ID audit, rete, indirizzo, snapshot, report originale, sorgenti, evidenze, decisioni e conclusioni salvate. La canonicalizzazione ordina le chiavi JSON e conserva l’ordine degli array; non è dichiarata come implementazione di uno standard esterno.
- **Challenge monouso:** nonce generato dal server, wallet vincolato e scadenza di 10 minuti. Modifiche alla bozza invalidano la challenge.
- **Concorrenza:** ogni scrittura richiede la versione attesa. Consumo del nonce e approvazione avvengono nello stesso aggiornamento condizionale; una sessione obsoleta non può sovrascrivere l’altra.
- **Immutabilità:** una revisione approvata è congelata. Nuove evidenze producono una nuova chiave di revisione e richiedono una nuova approvazione; la precedente non viene riutilizzata.
- **Controlli sulle decisioni:** finding confermati aperti e rischi HIGH/CRITICAL non risolti bloccano l’approvazione. Dichiarare un finding risolto richiede almeno un riferimento a un’esecuzione o a stato acquisito, oltre alla valutazione umana del contenuto.
- **CSRF e richieste:** le scritture richiedono l’Origin esatto configurato; Origin mancante, nullo o differente è rifiutato. Schema richieste rigoroso, limite corpo di 2 MiB e risposte private senza cache.
- **Conferma reale:** il server rilegge il dato persistito; il client rilegge nuovamente la ricevuta prima di mostrare l’approvazione. Anche le firme salvate vengono ricontrollate crittograficamente durante la lettura.
- **Firma legacy:** il vecchio endpoint count-only restituisce 410 agli utenti autenticati e non aggiorna più il report pubblico. Il vecchio pulsante è sostituito dal collegamento al flusso sicuro.
- **Sola lettura:** un interruttore server può disabilitare tutte le scritture, comprese bozze, challenge e approvazioni. È stato usato per verificare il catalogo reale senza assegnare decisioni.

La firma dimostra che il wallet ha sottoscritto quel contenuto; non dimostra da sola correttezza del giudizio, competenza del revisore o sicurezza del contratto. La data è quella del server, non una notarizzazione indipendente, e i privilegi di amministrazione del database restano un confine di fiducia.

## Stato degli audit storici

Il catalogo privato contiene 115 record, tutti inizialmente da revisionare. L’importazione ricontrolla l’archivio consegnato, i 1.199 artefatti del manifesto e gli hash dei file sorgente, senza contattare o aggiornare la produzione.

- **AERO:** è l’unico record senza i blocchi tecnici preliminari previsti da questa versione del flusso. Deve comunque ricevere il triage completo, una revisione manuale dello scope e delle autorità, conclusioni motivate e la firma del founder; non è già approvato.
- **TAG / Tagger:** i quattro record restano bloccati per la revisione incompleta dei titolari dei ruoli e per la valutazione di cap e replay. I test locali e il signer osservato a zero non giustificano né una dichiarazione di exploit pubblico attivo né una conclusione di assenza di rischio.
- **Altri record EVM:** dove applicabile, restano da acquisire test specifici, completare letture di stato fallite, risolvere scope/target o inventari e validare tutte le decisioni. Compilazione e analisi statica non sostituiscono questi passaggi.
- **MEET48:** non si riassegna silenziosamente il report a una rete o a un indirizzo recuperato. Il target originale deve essere confermato e legato alle evidenze.
- **Solana:** gli account mint acquisiti non equivalgono a un audit di un programma Rust. Non si può approvare un audit di programma sulla sola base di quei dati.

Questi blocchi non sono eliminabili inviando una checklist compilata dal browser. Il catalogo include 6.615 candidati statici grezzi unici per i target acquisiti; possono ricomparire in più report che condividono il target e non costituiscono finding già confermati.

## Verifiche eseguite e limiti

- **Test applicativi:** 101 test superati, comprendenti le 75 regressioni esistenti e 26 nuovi test per il flusso storico.
- **TypeScript del nuovo flusso:** controllo mirato superato. Il controllo globale del repository conserva i 95 errori preesistenti; non viene dichiarato superato.
- **Database offline:** 7 gruppi di verifiche superati su motore PostgreSQL compatibile PGlite: migrazione, idempotenza, permessi/RLS, aggiornamenti condizionali, congelamento, divieto di cancellazione e separazione dai report pubblici.
- **Browser con fixture:** 11 gruppi di verifiche su server locale HTTPS, cookie Secure reale e wallet sintetico. Comprendono rifiuto firma, errore di persistenza simulato, errore di rilettura simulato dopo un salvataggio reale, recupero della ricevuta, blocchi tecnici, desktop e larghezze 375/320 px.
- **Dati reali:** controllo locale in sola lettura della coda, degli snapshot e dei blocchi, senza salvare bozze o approvazioni storiche.
- **Integrità numerica:** gli interi JSON oltre la precisione esatta JavaScript, incluso `rentEpoch` Solana a 64 bit, vengono conservati come stringhe lessicali esatte durante l’importazione. Le impronte degli artefatti originali restano legate ai byte del dossier.
- **Produzione:** il codice è destinato a una PR di revisione; non sono autorizzati merge, deploy, migrazioni, import remoti o firme reali. L’integrazione con le nuove tabelle Supabase in produzione e il wallet reale resta da collaudare dopo un’autorizzazione separata.

Il superamento di questi test riguarda il flusso di approvazione, non una certificazione “tier 1” degli audit.

## Preparazione tecnica per una futura attivazione

L’attivazione non è stata eseguita. Va pianificata separatamente, con controllo del progetto Supabase corretto, backup e autorizzazione esplicita.

Il branch `review/historical-approval-flow` disabilita esplicitamente le distribuzioni Git automatiche Vercel tramite `git.deploymentEnabled` in `vercel.json`; questa impostazione non disabilita le distribuzioni di `main`. Non eseguire merge o attivare l’auto-merge della PR senza una nuova autorizzazione.

- **Migrazione da revisionare:** `supabase/migrations/202611070001_historical_review_private.sql`. Crea soltanto `historical_review_catalogs` e `historical_review_states`, più i relativi vincoli e trigger.
- **Catalogo privato:** va importato nella tabella dedicata come documento con la sua impronta autorizzata, non copiato in `public/`, nel bundle client o nei report pubblici. Nessuno script fornito esegue automaticamente questo import remoto.
- **Configurazione:** `SOLAY39_HISTORICAL_REVIEWS=enabled`, `SOLAY39_REVIEW_STORE=supabase`, `SOLAY39_REVIEW_ORIGIN` con l’origine HTTPS esatta, `SOLAY39_REVIEW_CATALOG_SHA256`, `SOLAY39_AUDITOR_WALLETS`, `SOLAY39_FOUNDER_PASSWORD_SHA256` con l’impronta della password privata e `SOLAY39_SESSION_SECRET` dedicato di almeno 32 caratteri. Sono inoltre richiesti `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; quest’ultima rimane esclusivamente nel backend e il browser non accede direttamente alle tabelle private.
- **Collaudo iniziale:** impostare `SOLAY39_REVIEW_READ_ONLY=yes` e verificare accessi, permessi e snapshot. Togliere la sola lettura soltanto dopo l’esito positivo e l’autorizzazione.
- **Pubblicazione:** non è implementata in questo flusso. Approvare una revisione non autorizza una pubblicazione successiva.

L’archivio delle evidenze già consegnato ha SHA-256:

```text
b313540bc31dc4f94d4f3bf73edf2ce848ed41a62a3fb841cebb9e4eee3963f1
```

Il catalogo locale preparato per questa versione ha impronta canonica:

```text
ee48ce2285f788687324705b9c64e8188f0fb5917273c0e4ccad90297d18626d
```

Per rigenerarlo dal dossier estratto e dall’archivio originale:

```bash
npx tsx scripts/prepare-historical-review-catalog.mts \
  --dossier-dir /percorso/dossier-estratto \
  --archive /percorso/Solay39-dossier-verifiche-storiche-2026-11-07.tar.gz \
  --archive-sha256 b313540bc31dc4f94d4f3bf73edf2ce848ed41a62a3fb841cebb9e4eee3963f1 \
  --output .local/historical-review-catalog.json
```

Lo script rifiuta checksum diversi e non sovrascrive un catalogo esistente. `.local/` è esclusa da Git; contiene soltanto preparazione privata, dati di collaudo e, quando usato, l’archivio locale di sviluppo.

Per i test ripetibili:

```bash
npm run test:engine
npm run test:historical-types
npx tsx scripts/start-historical-review-qa.mts 3001
# In un secondo terminale, usando la directory QA stampata dal server:
npx tsx tests/historical-review.browser.mts .local/historical-review-qa-XXXXXX 3001
```

Il server QA genera credenziali e certificato TLS temporanei; non usare credenziali o wallet reali. La persistenza filesystem è vietata in produzione e su Vercel, non costituisce un fallback alla mancata connessione al database e non sostituisce backup e procedure operative.

Per ripetere il collaudo del catalogo reale senza poter salvare alcun dato, avvia il server QA con il terzo argomento `.local/historical-review-catalog.json`, poi esegui `tests/historical-review-catalog.browser.mts` con la nuova directory QA stampata. Usa un solo server Next di sviluppo alla volta, perché condivide il lock `.next/dev`.

Il collaudo SQL offline usa PGlite 0.5.15 installato separatamente, senza aggiungerlo alle dipendenze dell’app. Lo script `tests/historical-review.sql.mts` richiede il percorso assoluto al suo modulo sotto `/tmp/` e non accetta URL di database remoti.
