// Costruisce un report in cui OGNI finding è "candidate" finché un umano o un PoC non lo conferma.
// Niente punteggi, niente "production ready", niente claim su test/fuzzing senza artefatti.
import crypto from "node:crypto";

export const sha256 = (x) => crypto.createHash("sha256").update(x).digest("hex");

// JSON canonico (chiavi ordinate): l'hash firmato è calcolato SU QUESTO, lo stesso che si pubblica.
export function canonicalJson(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canonicalJson(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export function reportDigest(report) {
  const { integrity, ...rest } = report;
  return sha256(canonicalJson(rest));
}
export function seal(report) {
  report.integrity = { report_sha256: reportDigest(report), canonicalization: "sorted-keys-json" };
  return report;
}

export function buildReport({ compiled, factsResult, sourcePath }) {
  const { facts } = factsResult;
  const F = (kind) => facts.filter((f) => f.kind === kind);
  const findings = [];
  const add = (o) => findings.push({ status: "candidate", evidence: { type: "static_fact", fact_id: o.fact.id }, ...strip(o) });
  const strip = ({ fact, ...rest }) => ({ file: fact.file, line: fact.line, quote: fact.text, ...rest });

  const del = F("delegatecall")[0];
  if (del?.reachable) {
    add({ fact: del, title: "Delegatecall raggiungibile da una funzione esterna", category: "delegatecall", severity_hint: "High",
      description: `delegatecall raggiungibile da: ${[...new Set(del.reachableFrom.map((r) => r.entry))].join(", ")}. Verificare se il target è controllabile.` });
  }
  for (const f of F("unprotected_upgrade")) {
    add({ fact: f, title: "_authorizeUpgrade senza controlli", category: "upgrade", severity_hint: "Critical",
      description: "Funzione di autorizzazione upgrade con corpo vuoto e nessun modifier." });
  }

  const anyUncappedMint = F("mint_site").some((m) => !m.capChecked);
  for (const u of F("unused_limit_constant")) {
    add({ fact: u, title: `${u.name} dichiarata ma mai applicata`, category: "unenforced-invariant",
      severity_hint: anyUncappedMint ? "High" : "Low",
      description: `La costante ${u.name} non è referenziata da nessuna funzione: il limite non è imposto dal codice.` });
  }
  for (const m of F("mint_site").filter((x) => !x.capChecked)) {
    add({ fact: m, title: `Mint senza controllo di cap in ${m.function}`, category: "uncapped-mint", severity_hint: "Medium",
      description: `${m.function} (${m.visibility}, modifiers: ${m.modifiers.join(", ") || "nessuno"}) chiama mint senza riferirsi a totalSupply o a una costante MAX/CAP/LIMIT.` });
  }
  for (const s of F("signature_verification").filter((x) => !x.hasDomainSeparation)) {
    add({ fact: s, title: `Firma in ${s.function} senza chainId/address(this)`, category: "signature-domain", severity_hint: "Low",
      description: "La verifica usa ecrecover ma né block.chainid né address(this) compaiono nel percorso di esecuzione: replay tra chain o deploy possibile." });
  }
  for (const z of F("zero_slippage_param")) {
    add({ fact: z, title: `Slippage minimo a zero (${z.param}) in ${z.function}`, category: "slippage", severity_hint: "Medium",
      description: "Parametro di minimo impostato a 0: nessuna protezione se il prezzo è manipolato." });
  }
  for (const o of F("owner_bypass")) {
    add({ fact: o, title: "L'owner supera ogni controllo di ruolo", category: "centralization", severity_hint: "Medium",
      description: `${o.function} fa passare l'owner anche senza il ruolo richiesto: l'owner ha di fatto tutti i poteri.` });
  }
  for (const w of F("privileged_withdrawal")) {
    add({ fact: w, title: `${w.function} sposta valore con accesso privilegiato`, category: "centralization", severity_hint: "Medium",
      description: `Modifier: ${w.modifiers.join(", ")}. Verificare chi controlla il ruolo (EOA o multisig/timelock).` });
  }
  for (const m of F("mint_to_constant_recipient").filter((x) => (x.pctOfMaxSupply ?? 0) >= 20)) {
    add({ fact: m, title: `${m.pctOfMaxSupply}% di MAX_SUPPLY coniato verso un solo indirizzo (${m.recipient})`, category: "token-distribution", severity_hint: "Medium",
      description: "Concentrazione dell'offerta in un indirizzo costante: verificare vesting/lock e controllo dell'indirizzo." });
  }
  for (const p of F("pool_init_zero_min")) {
    add({ fact: p, title: `Pool creato/inizializzato in ${p.function} con minimi a zero`, category: "launch-frontrun", severity_hint: "Medium",
      description: "Se il pool esiste già a un prezzo manipolato, la liquidità entra a quel prezzo senza protezione. Verificare se il launch è già avvenuto." });
  }
  for (const s of F("signer_setter")) {
    add({ fact: s, title: `Signer sostituibile da ${s.modifiers.join("/")} ${s.hasTimelock ? "" : "senza timelock"}`.trim(), category: "centralization", severity_hint: "Medium",
      description: `${s.function} cambia ${s.variable}, usato da ${s.usedBy.join(", ")} per autorizzare mint via firma.` });
  }
  const pr = F("pragma")[0];
  if (pr?.floating) add({ fact: pr, title: `Pragma flottante (${pr.value})`, category: "pragma", severity_hint: "Info", description: "Fissare la versione del compilatore usata per il deploy." });

  findings.forEach((f, i) => (f.id = `C-${String(i + 1).padStart(2, "0")}`));

  return {
    schema: "solay39.report/2",
    status: "AUTOMATED_SCAN_PENDING_REVIEW",
    target: { file: compiled.primaryFile, sha256: sha256(compiled.primaryText), contract: factsResult.target, path: sourcePath },
    toolchain: { solc: compiled.solcVersion, node: process.version },
    analysis: {
      performed: ["compilation", "ast_facts"],
      not_performed: ["manual_review", "slither", "mythril", "fuzzing", "invariant_testing", "formal_verification", "poc_on_fork"],
    },
    manual_review: { performed: false },
    claims: {}, // test/fuzz/coverage solo con { artifact: { path, sha256 } }
    tools: {},
    facts,
    findings,
    manual_checklist: [
      "Verificare on-chain chi sono owner, deployer, operator e signer (EOA o multisig) e la soglia/timelock.",
      "Verificare se launch() è già stato eseguito e lo stato del pool prima/dopo.",
      "Confermare ogni finding High/Critical con un PoC su fork (chain, block, commit, hash dell'artefatto).",
      "Controllare l'inventario delle funzioni che cambiano stato (facts F-inventory) una per una.",
    ],
    narrative: {
      summary: "Scansione automatica deterministica. Nessuna revisione manuale. I finding sono candidati non confermati.",
    },
    verdict: "NOT_ASSESSED",
  };
}


// Rendering del report leggibile a partire dal JSON: una sola fonte di verità => nessuna contraddizione tra sezioni.
export function renderMarkdown(report) {
  const L = [];
  L.push(`# Audit: ${report.target.contract}`);
  L.push(`**Stato: ${report.status}** · verdetto: ${report.verdict}`);
  L.push(`Sorgente \`${report.target.file}\` sha256 \`${report.target.sha256}\` · ${report.toolchain.solc}`);
  L.push("");
  L.push("## Cosa è stato fatto");
  L.push(report.analysis.performed.map((x) => `- ${x}`).join("\n"));
  L.push("## Cosa NON è stato fatto");
  L.push(report.analysis.not_performed.map((x) => `- ${x}`).join("\n"));
  L.push(`Revisione manuale: ${report.manual_review.performed ? "sì — " + report.manual_review.reviewer?.name : "NO"}`);
  L.push("");
  L.push("## Finding");
  if (!report.findings.length) L.push("Nessuno.");
  for (const f of report.findings) {
    L.push(`### ${f.id} · ${f.severity ?? "(" + f.severity_hint + ")"} · ${f.status}`);
    L.push(`${f.title}  \n\`${f.file}:${f.line}\` — \`${f.quote}\``);
    L.push(f.description ?? "");
    if (f.how_to_confirm) L.push(`Per confermare: ${f.how_to_confirm}`);
  }
  if (report.llm?.rejected?.length) {
    L.push("## Suggerimenti LLM scartati");
    for (const x of report.llm.rejected) L.push(`- ${x.title ?? "?"}: ${x.reason}`);
  }
  L.push("");
  L.push("## Da fare per la revisione manuale");
  L.push(report.manual_checklist.map((x) => `- [ ] ${x}`).join("\n"));
  L.push("");
  L.push(`Hash del report (JSON canonico): \`${report.integrity?.report_sha256 ?? "non sigillato"}\``);
  return L.join("\n");
}
