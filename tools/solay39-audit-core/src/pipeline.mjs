import fs from "node:fs";
import path from "node:path";
import { compileProject } from "./compile.mjs";
import { extractFacts } from "./facts.mjs";
import { buildReport, seal, renderMarkdown } from "./report.mjs";
import { validateReport } from "./validate.mjs";
import { runSlither, runMythril, slitherToFindings } from "./tools.mjs";

const norm = (s) => String(s).replace(/\s+/g, " ").trim();

// Un suggerimento dell'LLM entra solo se è ancorato al codice e coerente con i fatti.
export function groundLlmFindings(candidates, { sourceText, facts }) {
  const lines = sourceText.split("\n");
  const byId = new Map(facts.map((f) => [f.id, f]));
  const accepted = [], rejected = [];
  for (const c of candidates) {
    const reject = (reason) => rejected.push({ title: c.title, reason });
    if (!Number.isInteger(c.line) || !c.quote) { reject("manca line/quote"); continue; }
    const win = norm(lines.slice(Math.max(0, c.line - 3), c.line + 2).join(" "));
    if (!win.includes(norm(c.quote))) { reject(`citazione non trovata alla riga ${c.line}`); continue; }
    if (c.category === "delegatecall" && !byId.get("F-delegatecall")?.reachable) { reject("delegatecall non raggiungibile (fatto)"); continue; }
    if (c.category === "upgrade" && !byId.get("F-upgradeability")?.upgradeable) { reject("contratto non upgradeable (fatto)"); continue; }
    if (/\b(\d+\s*\/\s*\d+\s*(test|passed)|coverage|copertura|fuzz|echidna|formal verification)\b/i.test(`${c.title} ${c.scenario ?? ""}`) && !/missing|manca|non/i.test(`${c.title}`)) {
      reject("afferma esecuzioni di test/fuzzing non provate"); continue;
    }
    const { severity, confirmation, ...safe } = c; // il modello non può assegnare severità finale né conferme
    accepted.push({ ...safe, status: "candidate", file: c.file ?? "source", evidence: { type: "llm_grounded_quote" }, source_kind: "llm" });
  }
  return { accepted, rejected };
}

export async function runAudit({ file, contract, outDir, tools = [], docker, llm }) {
  fs.mkdirSync(outDir, { recursive: true });
  const compiled = compileProject(file);
  const factsResult = extractFacts(compiled, contract);
  const report = buildReport({ compiled, factsResult, sourcePath: file });

  for (const t of tools) {
    const r = t === "slither" ? await runSlither(file, outDir, { docker }) : t === "mythril" ? await runMythril(file, outDir, { docker }) : null;
    if (!r) continue;
    report.tools[t] = { status: r.status, exit_code: r.exit_code, version: r.version, result_count: r.result_count, reason: r.reason ?? r.stderr, artifact: r.artifact };
    if (r.status === "success") {
      report.claims[t] = { artifact: r.artifact };
      report.analysis.performed.push(t);
      report.analysis.not_performed = report.analysis.not_performed.filter((x) => x !== t);
      if (t === "slither") report.findings.push(...slitherToFindings(r.parsed, compiled.primaryText, compiled.primaryFile).findings);
    }
  }

  if (llm) {
    const raw = await llm({ source: compiled.primaryText, factsResult });
    const { accepted, rejected } = groundLlmFindings(raw, { sourceText: compiled.primaryText, facts: factsResult.facts });
    report.findings.push(...accepted.map((f) => ({ ...f, file: compiled.primaryFile })));
    report.llm = { proposed: raw.length, accepted: accepted.length, rejected };
    report.analysis.performed.push("llm_assisted_review(candidates_only)");
  }

  report.findings.forEach((f, i) => (f.id = `C-${String(i + 1).padStart(2, "0")}`));
  seal(report);
  const validation = validateReport(report, { sourceText: compiled.primaryText, baseDir: outDir });
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "REPORT.md"), renderMarkdown(report));
  return { report, validation, compiled };
}
