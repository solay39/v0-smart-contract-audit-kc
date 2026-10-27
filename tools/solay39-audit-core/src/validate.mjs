// Gate di pubblicazione: rifiuta i report che contraddicono se stessi o dichiarano ciò che non provano.
import fs from "node:fs";
import path from "node:path";
import { sha256, reportDigest } from "./report.mjs";

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const HIGH = new Set(["High", "Critical"]);
const CLAIM_KEYS = ["tests", "coverage", "fuzzing", "echidna", "slither", "mythril", "formal_verification", "poc"];
const FORBIDDEN_WITHOUT_REVIEW =
  /line-by-line|every line|dual review|independent review (completed|performed)|production[- ]ready|manual (adversarial )?(code )?review (completed|performed|full)/i;

const defaultReader = (baseDir) => (p) => {
  const full = path.resolve(baseDir, p);
  return fs.existsSync(full) ? fs.readFileSync(full) : null;
};

// readArtifact(path) => Buffer|string|null  (in produzione: gli artefatti arrivano nel body della richiesta)
export function validateReport(report, { sourceText, baseDir = ".", readArtifact = defaultReader(baseDir) }) {
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push({ code, msg });

  // R7: l'hash del sorgente deve coincidere
  if (report.target?.sha256 !== sha256(sourceText)) err("SOURCE_HASH", "target.sha256 non corrisponde al sorgente");

  const lines = sourceText.split("\n");
  const factById = new Map((report.facts || []).map((f) => [f.id, f]));

  for (const f of report.findings || []) {
    const tag = f.id ?? "(senza id)";
    // R1: ogni finding è ancorato a una citazione esistente nel sorgente
    if (!f.line || !f.quote) {
      err("UNGROUNDED", `${tag}: manca line/quote`);
    } else {
      const lo = Math.max(0, f.line - 3), hi = Math.min(lines.length, f.line + 2);
      if (!norm(lines.slice(lo, hi).join(" ")).includes(norm(f.quote))) err("UNGROUNDED", `${tag}: la citazione non compare alla riga ${f.line}`);
    }
    // R2: High/Critical solo se confermati con prova
    if (HIGH.has(f.severity)) {
      if (f.status !== "confirmed") err("UNPROVEN_HIGH", `${tag}: ${f.severity} non confermato`);
      else if (!f.confirmation?.reviewer && !f.confirmation?.poc) err("UNPROVEN_HIGH", `${tag}: confermato senza reviewer né PoC`);
      else if (f.confirmation?.poc) checkArtifact(f.confirmation.poc, `${tag}.poc`);
    }
    // R5: il finding deve essere sostenuto da un fatto coerente con la sua categoria
    const fact = factById.get(f.evidence?.fact_id);
    if (f.evidence?.type === "static_fact" && !fact) err("NO_FACT", `${tag}: fact_id inesistente`);
    if (f.category === "delegatecall" && !(fact?.kind === "delegatecall" && fact.reachable))
      err("FACT_MISMATCH", `${tag}: finding delegatecall senza delegatecall raggiungibile`);
    if (f.category === "upgrade" && !(factById.get("F-upgradeability")?.upgradeable))
      err("FACT_MISMATCH", `${tag}: finding upgrade su contratto non upgradeable`);
    if (f.source && report.tools?.[f.source]?.result_count === 0)
      err("TOOL_MISMATCH", `${tag}: attribuito a ${f.source}, che ha riportato 0 risultati`);
  }

  // R3: ogni claim richiede un artefatto con hash verificato
  function checkArtifact(a, label) {
    const p = a?.artifact?.path ?? a?.path;
    const h = a?.artifact?.sha256 ?? a?.sha256;
    if (!p || !h) return err("CLAIM_NO_ARTIFACT", `${label}: manca artefatto (path+sha256)`);
    const data = readArtifact(p);
    if (data === null || data === undefined) return err("CLAIM_NO_ARTIFACT", `${label}: file non trovato (${p})`);
    if (sha256(data) !== h) err("CLAIM_HASH", `${label}: hash non corrisponde`);
  }
  for (const k of Object.keys(report.claims || {})) {
    if (!CLAIM_KEYS.includes(k)) warnings.push(`claim sconosciuto: ${k}`);
    checkArtifact(report.claims[k], `claims.${k}`);
  }

  // R4: la narrativa non può affermare ciò che manual_review nega
  const reviewed = report.manual_review?.performed === true && !!report.manual_review?.reviewer?.name;
  if (report.manual_review?.performed && !report.manual_review?.reviewer?.name) err("REVIEWER", "manual_review.performed senza reviewer con nome");
  const text = JSON.stringify(report.narrative ?? {});
  if (!reviewed && FORBIDDEN_WITHOUT_REVIEW.test(text)) err("NARRATIVE_CONTRADICTION", "la narrativa dichiara una revisione/readiness non supportata");

  // R6: verdetto coerente
  const unresolved = (report.findings || []).some((f) => f.status === "candidate");
  if (/RECOMMENDED/.test(report.verdict ?? "") && report.verdict !== "NOT_RECOMMENDED" && (unresolved || !reviewed))
    err("VERDICT", "verdetto positivo con candidati non risolti o senza revisione");

  // R9: l'hash dichiarato deve essere quello del JSON che si pubblica
  if (report.integrity && report.integrity.report_sha256 !== reportDigest(report)) err("REPORT_HASH", "integrity.report_sha256 non corrisponde al contenuto del report");

  // R8: niente punteggi senza metodo
  if ("score" in report && !report.score_method) err("SCORE", "score senza score_method");

  const publishable = errors.length === 0 && !unresolved && reviewed;
  return { ok: errors.length === 0, publishable, errors, warnings, unresolved_candidates: unresolved };
}
