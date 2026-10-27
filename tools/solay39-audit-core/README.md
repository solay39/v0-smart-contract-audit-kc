# solay39-audit-core

Pipeline di audit con tre livelli, in ordine di affidabilità:

1. **Fatti deterministici** (`src/facts.mjs`): compila con solc e interroga l'AST (raggiungibilità di delegatecall,
   upgradeability, costanti-limite mai applicate, mint senza cap, firme senza dominio, slippage a 0).
2. **Giudizio** (`src/llm-review.mjs`, NON testato; oppure revisore umano): aggiunge finding semantici
   (centralizzazione, front-running, economia). Entra nel report solo come `candidate` con citazione reale.
3. **Gate di pubblicazione** (`src/validate.mjs`): blocca report con claim senza artefatti, finding non ancorati al codice,
   High/Critical non confermati, narrativa che contraddice `manual_review`, verdetti incoerenti.

## Uso
    npm install
    node bin/audit.mjs scan contratto.sol --contract NomeContratto --out out/
    node bin/audit.mjs validate out/report.json --source contratto.sol
    npm test

## Limiti (da dichiarare sempre)
- Trova solo ciò che i fatti sanno esprimere. NON trova: front-running del launch su pool preesistente,
  eccesso di poteri dell'owner, errori di logica economica. Quelli richiedono LLM+umano.
- Non esegue Slither/Mythril/fuzzing/PoC: restano in `analysis.not_performed` finché non allegate gli artefatti.
- Un High/Critical diventa tale solo con `status: "confirmed"` + PoC (con hash) o reviewer nominato.
- Contratti multi-file: gli import devono stare sotto la cartella del file principale.

## Orchestratore (run)
    node bin/audit.mjs run contratto.sol --contract Nome --tools slither,mythril --docker-image IMG --llm --out out/
Produce `out/report.json` (sigillato con hash del JSON canonico), `out/REPORT.md` (generato dal JSON: una sola fonte di verità)
e `out/artifacts/*` (output grezzi Slither/Mythril con sha256). `--llm` richiede ANTHROPIC_API_KEY e AUDIT_MODEL (non testato).

## Integrazione nel vostro repo: `repo-patch/`
Copiare le cartelle in Solay39 (`core/audit-core`, `src/security/publish-gate.ts`, `app/api/publish/route.ts`).
Il body di POST /api/publish deve contenere: `auditReport` (report.json), `sourceText`, `artifacts` (path->contenuto).
`PUBLISH_GATE=enforce` (default) rifiuta con 422; `warn` solo per migrare i client.
Il nome del revisore è dichiarato, non verificato: per un sign-off vero firmare il report con la chiave del revisore.
