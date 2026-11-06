# Solay39 Slither worker

Servizio che compila i contratti Solidity con la versione di `solc` corretta ed esegue **Slither** (101 detector). È il motore di analisi statica principale di Solay39: l'app Next.js invia i sorgenti a questo servizio e converte i risultati in finding.

Vercel non può eseguire Slither (serve Python + solc), quindi Slither gira su **GitHub Actions** (gratis) oppure su un server Docker.

## Cosa fa meglio del vecchio `security-backend`

| | vecchio backend | worker |
|---|---|---|
| Esito quando Slither trova problemi | `exit 255` → considerato **errore**, risultati scartati | esito letto dal report JSON |
| Versione di `solc` | sempre 0.8.20, cambio globale con `solc-select use` (si rompe con richieste parallele) | scelta dal `pragma`, binario passato per richiesta con `--solc`, versioni mancanti installate al volo |
| Import `@openzeppelin/...` | non risolti → compilazione fallita | OpenZeppelin v5.4 e v4.9 inclusi, scelta automatica con fallback |
| Più file | no | `sources: { "path.sol": "..." }` |
| Formato risposta | `tools.slither` (l'app leggeva `slither` → risultati persi) | formato unico e tipizzato (`lib/slither-client.ts`) |
| Evidenze | — | versione Slither, versione solc, SHA-256 dei sorgenti, numero di detector, durata |
| Posizione | solo righe | file, contratto, funzione, righe, snippet, raccomandazione e link alla wiki di Slither |

## API

`POST /v1/analyze` — header `x-api-key: <SLITHER_WORKER_API_KEY>` (oppure `Authorization: Bearer ...`)

```json
{ "code": "pragma solidity ^0.8.20; ...", "contractName": "Vault" }
```
oppure
```json
{ "sources": { "src/Vault.sol": "...", "src/IVault.sol": "..." } }
```
Campi opzionali: `solcVersion` (`"0.8.24"`), `excludeInformational` (default `false`), `excludeOptimization` (default `true`).

Risposta: `status` = `ok` | `compile_error` | `timeout` | `error`, più `findings[]` con `check`, `impact`, `confidence`, `title`, `description`, `recommendation`, `wikiUrl`, `file`, `contract`, `function`, `lines`, `startLine`, `endLine`, `snippet`.

`GET /health` — stato, versione di Slither, compilatori installati, numero di detector.

## Variabili d'ambiente

| Variabile | Default | |
|---|---|---|
| `SLITHER_WORKER_API_KEY` | — | **obbligatoria**, stringa casuale lunga |
| `SLITHER_MAX_CONCURRENCY` | `2` | analisi in parallelo |
| `SLITHER_TIMEOUT_SECONDS` | `120` | |
| `SLITHER_ALLOW_SOLC_DOWNLOAD` | `1` | installa al volo le versioni di solc mancanti |
| `PORT` | `8080` | |

## Pubblicazione

Ci sono due modi. Producono lo stesso risultato, cambia solo dove gira Slither.

### A. GitHub Actions (consigliato, gratuito)

Nessun server da pagare. Per ogni audit l'app avvia un workflow in un repository **privato**. Il workflow esegue Slither (circa 25 secondi con la cache), poi l'app scarica il risultato e **cancella** sia l'esecuzione sia il risultato, così il codice del cliente non resta su GitHub.

- Il repository deve essere privato: in uno pubblico gli input del workflow, cioè il codice del cliente, sarebbero visibili a chiunque. `setup.sh` si rifiuta di procedere se non lo è.
- Costo: un audit occupa circa 1 minuto di runner Linux. Il piano Free include 12 $/mese di Actions, circa 2000 minuti, quindi circa 1000 audit al mese senza spese. Oltre la soglia GitHub blocca i job, a meno che tu non abbia impostato un budget di spesa.
- Limite: circa 250 KB di sorgente per audit (gli input di `workflow_dispatch` sono al massimo 65.535 caratteri, dopo la compressione).

1. Crea o aggiorna il repository del runner (va rieseguito quando cambi `app.py`):
   ```bash
   slither-worker/github-runner/setup.sh            # crea <tuo-utente>/solay39-slither-runner (privato)
   ```
2. Crea un **fine-grained personal access token**: GitHub → Settings → Developer settings → Fine-grained tokens.
   - Repository access: **solo** `solay39-slither-runner`
   - Permissions → Repository → **Actions: Read and write** (Metadata: read viene aggiunto da solo)
3. Su Vercel (Production):
   ```
   SLITHER_GITHUB_TOKEN=github_pat_...
   SLITHER_GITHUB_REPO=solay39/solay39-slither-runner
   ```

`/api/ai-audit`, `/api/static-analysis` e `/api/skynet` hanno `maxDuration = 300`, quindi aspettano la fine del run. Se GitHub è lento (code dei runner), dopo 240 secondi il run viene annullato e l'audit prosegue con le euristiche, indicando `toolchain.mode = "heuristic-only"` e il motivo.

Variabili opzionali: `SLITHER_GITHUB_REF` (default `main`), `SLITHER_GITHUB_KEEP_RUNS=1` (solo per debug, conserva i run che contengono il codice).

### B. Server Docker (Fly.io, Railway, Render, VPS)

Più veloce (nessuna coda) ma a pagamento: servono almeno 2 GB di RAM.

```bash
cd slither-worker
fly launch --no-deploy --name solay39-slither   # usa il Dockerfile
fly secrets set SLITHER_WORKER_API_KEY=$(openssl rand -hex 32)
fly scale memory 2048
fly deploy
```
Su Vercel: `SLITHER_WORKER_URL=https://solay39-slither.fly.dev` e `SLITHER_WORKER_API_KEY=<stesso valore>`. Se sono configurati entrambi i modi, viene usato il server.

Senza nessuna delle due configurazioni l'app continua a funzionare in modalità euristica, segnalata come `toolchain.mode = "heuristic-only"` nel risultato.

## Test

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
solc-select install 0.8.26 0.7.6
# librerie OpenZeppelin come nel Dockerfile, poi:
SLITHER_LIBS_DIR=/percorso/solidity-libs pytest -q tests
```

I test eseguono Slither reale (entrypoint GitHub `run_job.py`, reentrancy, CEI corretto, OpenZeppelin v4 e v5, solc 0.7.6, più file, errori di compilazione, path traversal, autenticazione).

`tests/fixtures/slither-results.json` nella root contiene output reali del worker usati dai test TypeScript del motore (`pnpm test:engine`). Per rigenerarlo, vedi lo script in `slither-worker/scripts/record_fixtures.py`.
