#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { compileProject } from "../src/compile.mjs";
import { extractFacts } from "../src/facts.mjs";
import { buildReport } from "../src/report.mjs";
import { validateReport } from "../src/validate.mjs";
import { runAudit } from "../src/pipeline.mjs";
import { llmReview } from "../src/llm-review.mjs";

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };

if (cmd === "scan") {
  const out = opt("--out") ?? "out";
  fs.mkdirSync(out, { recursive: true });
  const compiled = compileProject(file);
  const factsResult = extractFacts(compiled, opt("--contract"));
  const report = buildReport({ compiled, factsResult, sourcePath: file });
  const v = validateReport(report, { sourceText: compiled.primaryText, baseDir: path.dirname(file) });
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(`Target: ${report.target.contract}  sha256=${report.target.sha256.slice(0, 12)}…  ${report.toolchain.solc}`);
  for (const f of report.findings) console.log(`  [${f.severity_hint}] ${f.id} L${f.line} ${f.title}`);
  console.log(`Validazione: ${v.ok ? "OK" : "ERRORI"}  pubblicabile: ${v.publishable}`);
  v.errors.forEach((e) => console.log("  ✗", e.code, e.msg));
} else if (cmd === "run") {
  const tools = (opt("--tools") ?? "").split(",").filter(Boolean);
  const llm = rest.includes("--llm") ? (a) => llmReview(a) : undefined;
  const { report, validation } = await runAudit({ file, contract: opt("--contract"), outDir: opt("--out") ?? "out", tools, docker: opt("--docker-image"), llm });
  console.log(`${report.target.contract}: ${report.findings.length} candidati · tool: ${Object.entries(report.tools).map(([k, v]) => `${k}=${v.status}`).join(" ") || "nessuno"}`);
  console.log(`stato: ${report.status} · valido: ${validation.ok} · pubblicabile: ${validation.publishable}`);
  validation.errors.forEach((e) => console.log("  ✗", e.code, e.msg));
  console.log(`Output: ${opt("--out") ?? "out"}/REPORT.md e report.json`);
} else if (cmd === "validate") {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const src = fs.readFileSync(opt("--source"), "utf8");
  const v = validateReport(report, { sourceText: src, baseDir: path.dirname(file) });
  console.log(JSON.stringify(v, null, 2));
  process.exit(v.ok ? 0 : 1);
} else {
  console.log("uso: audit.mjs run <file.sol> [--contract N] [--tools slither,mythril] [--docker-image IMG] [--llm] [--out dir]\n     audit.mjs scan <file.sol> [--contract Nome] [--out dir]\n     audit.mjs validate <report.json> --source <file.sol>");
}
