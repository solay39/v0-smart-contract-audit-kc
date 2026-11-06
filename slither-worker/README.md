# Solay39 Slither worker

Servizio HTTP che compila i contratti Solidity con la versione di `solc` corretta ed esegue **Slither** (101 detector). È il motore di analisi statica principale di Solay39: l'app Next.js invia i sorgenti a questo servizio e converte i risultati in finding.

Vercel non può eseguire Slither (serve Python + solc), quindi il worker va pubblicato su un host di container (Fly.io, Railway, Render, una VM).

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

### Fly.io
```bash
cd slither-worker
fly launch --no-deploy --name solay39-slither   # usa il Dockerfile
fly secrets set SLITHER_WORKER_API_KEY=$(openssl rand -hex 32)
fly scale memory 2048
fly deploy
```

### Railway / Render
Nuovo servizio dal repository, **root directory** `slither-worker`, build da Dockerfile, variabile `SLITHER_WORKER_API_KEY`. Consigliati almeno 2 GB di RAM.

### Collegamento all'app (Vercel)
```
SLITHER_WORKER_URL=https://solay39-slither.fly.dev
SLITHER_WORKER_API_KEY=<stesso valore del worker>
```
Senza queste variabili l'app continua a funzionare in modalità euristica, segnalata come `toolchain.mode = "heuristic-only"` nel risultato.

## Test

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
solc-select install 0.8.26 0.7.6
# librerie OpenZeppelin come nel Dockerfile, poi:
SLITHER_LIBS_DIR=/percorso/solidity-libs pytest -q tests
```

I test eseguono Slither reale (reentrancy, CEI corretto, OpenZeppelin v4 e v5, solc 0.7.6, più file, errori di compilazione, path traversal, autenticazione).

`tests/fixtures/slither-results.json` nella root contiene output reali del worker usati dai test TypeScript del motore (`pnpm test:engine`). Per rigenerarlo, vedi lo script in `slither-worker/scripts/record_fixtures.py`.
