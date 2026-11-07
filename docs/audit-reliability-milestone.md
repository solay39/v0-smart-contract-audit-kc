# Affidabilità degli audit: primo intervento sul motore

Questa modifica elimina conferme tecniche non sostenute da esecuzioni e rafforza il percorso GitHub Actions. Non certifica i contratti esistenti e non trasforma i report preliminari in audit approvati.

## Problemi corretti

- **PoC simulati:** la severità non determina più l'esito di un exploit. Un template non eseguito resta `NOT_RUN`.
- **Foundry:** i test vengono contati dal JSON, non dalla parola `FAIL`. Passare o fallire un test non dimostra da solo exploit riusciti o sicurezza. Il runner locale seleziona il file, registra il digest e non usa una shell.
- **Pipeline:** findings e stringhe di firma non dimostrano scansioni, revisione manuale o approvazione. Questa resta riservata al fondatore.
- **AI e fallback:** nessuna firma automatica, registrazione on-chain o pubblicazione IPFS viene avviata generando una bozza. PASS formali, ore umane e simulazioni non documentate non vengono restituiti come prove; le ipotesi restano proposte.
- **Invarianti:** zero non significa dato assente. Stato mancante, errore e predicato non eseguito sono distinti da un controllo passato. Gli snapshot euristici non sono prove formali.
- **Evidenze CI:** schema v2 con sorgente esatto, digest di ogni artefatto consumato, repository, run, tentativo e revisione. Il server respinge incoerenze, evidenze legacy, false dichiarazioni e ZIP ambigui o eccessivi.
- **Errori:** uno strumento fallito non impedisce agli altri controlli applicabili di produrre risultati. Il finalizzatore conserva gli errori. Un job cancellato senza artefatti non è un audit riuscito.
- **Versioni:** fissate quelle dirette di Slither, Mythril, solc-select e Foundry; registrati ambiente Python, configurazione Foundry e dipendenze sorgente. Transitive e immagine host non sono ancora completamente bloccate.
- **Workspace:** controlli custom importati come candidati; errori custom o Foundry rendono visibile l'incompletezza. Compilazione non significa test o fuzzing.
- **Condivisione:** gli artefatti includono il sorgente. Il server impedisce dispatch a repository pubblici senza consenso esplicito; cambiare codice azzera il consenso.

## Esecuzioni reali e limiti

Il workflow esegue Slither, Mythril, controlli custom sul sorgente e compilazione Foundry. Non attesta exploit, fuzzing di protocollo, invarianti eseguite, equivalenza col bytecode distribuito o revisione manuale.

Il sorgente resta negli artefatti per 30 giorni secondo la conservazione configurata. Non inviare codice riservato a repository pubblici; la conferma riguarda questo runner, non una verifica globale dei percorsi legacy.

Le evidenze v1 richiedono una nuova esecuzione, non un cambio di etichetta. Report esistenti, dati salvati, grafica approvata e logo non vengono riscritti.

## Verifiche

- Regressioni JS/TS e Python per risultati simulati, zero/missing/error, decompressione, layout e integrità.
- Casi avversari per dati alterati, assenti o malformati; sorgente/run/tentativo/revisione diversi; ZIP duplicati, annidati o eccessivi.
- Browser locale con dati sintetici e Supabase simulato in memoria. Nessun audit sintetico o nuova approvazione in produzione.
- Gli eventuali run GitHub di collaudo usano solo sorgenti sintetici non riservati. I conteggi dei test dell'app non misurano copertura delle vulnerabilità o sicurezza dei token.

## Blocchi ancora aperti

- **Firma:** il vecchio sign-off non lega ancora l'approvazione al digest canonico di report e sorgente con challenge monouso e controllo delle modifiche concorrenti.
- **Pubblicazione:** serve un unico gate server-side sull'approvazione attuale e sulle evidenze effettive, senza fidarsi di flag client o conteggi di attestazioni.
- **Deployment:** ricostruire configurazione del compilatore, dipendenze, proxy e corrispondenza col bytecode distribuito.
- **Prove specifiche:** revisionare e isolare harness, exploit riprodotti e fuzzing/invarianti applicabili, oppure documentare la non applicabilità. Non eseguire automaticamente test AI con segreti o rete.
- **Revisione:** il fondatore deve verificare applicabilità, impatto, riproduzione e disposition dei findings.
- **Benchmark:** ampliare il corpus revisionato di contratti vulnerabili/corretti e misurare falsi positivi/negativi per classe. Le regressioni dell'app non sostituiscono questo lavoro.
- **Repository:** resta debito TypeScript/CI preesistente. Una build Next con `ignoreBuildErrors` non equivale a type-check completo riuscito.

OWASP richiede perimetro, controlli ed evidenze verificabili e distingue gli strumenti automatici da una valutazione completa. Non offre una certificazione OWASP per contratti o fornitori: questo intervento non viene presentato come tale ([OWASP SCSVS Assessment and Certification](https://scs.owasp.org/SCSVS/04-Assessment_and_Certification/)).
