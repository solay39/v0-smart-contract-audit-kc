import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileProject } from "../src/compile.mjs";
import { extractFacts } from "../src/facts.mjs";
import { buildReport, sha256 } from "../src/report.mjs";
import { validateReport } from "../src/validate.mjs";

const fx = (n) => path.resolve("fixtures", n);
function scan(name, contract) {
  const compiled = compileProject(fx(name));
  const factsResult = extractFacts(compiled, contract);
  const report = buildReport({ compiled, factsResult, sourcePath: fx(name) });
  return { compiled, factsResult, report, src: compiled.primaryText };
}
const fact = (r, id) => r.facts.find((f) => f.id === id);

test("delegatecall in libreria mai chiamata NON è raggiungibile (niente falso positivo H-01)", () => {
  const { report } = scan("SafeLikeTagger.sol", "Token");
  const d = fact(report, "F-delegatecall");
  assert.equal(d.reachable, false);
  assert.equal(d.presentButUnreachable.length, 1);
  assert.ok(!report.findings.some((f) => f.category === "delegatecall"));
  assert.equal(fact(report, "F-upgradeability").upgradeable, false); // niente falso positivo C-01
});

test("trova MAX_SUPPLY non applicato, mint senza cap, firma senza dominio, slippage zero", () => {
  const { report } = scan("SafeLikeTagger.sol", "Token");
  const cats = report.findings.map((f) => f.category);
  for (const c of ["unenforced-invariant", "uncapped-mint", "signature-domain", "slippage"]) assert.ok(cats.includes(c), c);
});

test("un contratto con cap applicato non produce finding di mint/limite", () => {
  const { report } = scan("CappedToken.sol", "Capped");
  const cats = report.findings.map((f) => f.category);
  assert.ok(!cats.includes("uncapped-mint"));
  assert.ok(!cats.includes("unenforced-invariant"));
});

test("delegatecall vero (fallback) è raggiungibile", () => {
  const { report } = scan("RealDelegate.sol", "Proxyish");
  const d = fact(report, "F-delegatecall");
  assert.equal(d.reachable, true);
  assert.ok(report.findings.some((f) => f.category === "delegatecall"));
});

test("sorgente che non compila: nessun report", () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a-")), "Bad.sol");
  fs.writeFileSync(tmp, "pragma solidity 0.8.26; contract X { function f( }");
  assert.throws(() => compileProject(tmp), /COMPILATION FAILED/);
});

test("report generato: valido ma NON pubblicabile (candidati + nessuna review)", () => {
  const { report, src } = scan("SafeLikeTagger.sol", "Token");
  const v = validateReport(report, { sourceText: src });
  assert.equal(v.ok, true);
  assert.equal(v.publishable, false);
});

// ---- il validatore blocca esattamente gli errori trovati nel report di Tagger ----
const base = () => scan("SafeLikeTagger.sol", "Token");

test("blocca finding C-01/H-01 inventati (delegatecall/upgrade senza fatto)", () => {
  const { report, src } = base();
  report.findings.push({ id: "X-1", category: "delegatecall", status: "candidate", severity_hint: "High", file: "x", line: 1, quote: "pragma solidity 0.8.26;", evidence: { type: "static_fact", fact_id: "F-delegatecall" } });
  report.findings.push({ id: "X-2", category: "upgrade", status: "candidate", severity_hint: "Critical", file: "x", line: 1, quote: "pragma solidity 0.8.26;", evidence: { type: "static_fact", fact_id: "F-upgradeability" } });
  const codes = validateReport(report, { sourceText: src }).errors.map((e) => e.code);
  assert.ok(codes.filter((c) => c === "FACT_MISMATCH").length === 2);
});

test("blocca Critical/High non confermato", () => {
  const { report, src } = base();
  report.findings[0].severity = "Critical";
  assert.ok(validateReport(report, { sourceText: src }).errors.some((e) => e.code === "UNPROVEN_HIGH"));
});

test("blocca citazioni non presenti nel sorgente", () => {
  const { report, src } = base();
  report.findings[0].quote = "function inventedFunction() external";
  assert.ok(validateReport(report, { sourceText: src }).errors.some((e) => e.code === "UNGROUNDED"));
});

test("blocca claim 96/96 test, 94% copertura, fuzzing senza artefatti", () => {
  const { report, src } = base();
  report.claims = { tests: { summary: "96/96 passed" }, coverage: { summary: "94%" }, fuzzing: { artifact: { path: "nope.json", sha256: "00" } } };
  const codes = validateReport(report, { sourceText: src }).errors.map((e) => e.code);
  assert.equal(codes.filter((c) => c === "CLAIM_NO_ARTIFACT").length, 3);
});

test("claim con artefatto reale e hash corretto passa; hash errato no", () => {
  const { report, src } = base();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "art-"));
  const p = path.join(dir, "forge.txt");
  fs.writeFileSync(p, "Suite result: ok. 96 passed");
  report.claims = { tests: { artifact: { path: "forge.txt", sha256: sha256(fs.readFileSync(p)) } } };
  assert.equal(validateReport(report, { sourceText: src, baseDir: dir }).ok, true);
  report.claims.tests.artifact.sha256 = "deadbeef";
  assert.ok(validateReport(report, { sourceText: src, baseDir: dir }).errors.some((e) => e.code === "CLAIM_HASH"));
});

test("blocca 'manual review FULL', 'PRODUCTION READY', 'dual review' senza revisore", () => {
  const { report, src } = base();
  report.narrative.posture = "PRODUCTION READY - line-by-line review, independent review completed";
  assert.ok(validateReport(report, { sourceText: src }).errors.some((e) => e.code === "NARRATIVE_CONTRADICTION"));
});

test("blocca verdetto positivo con candidati aperti", () => {
  const { report, src } = base();
  report.verdict = "CONDITIONALLY_RECOMMENDED";
  assert.ok(validateReport(report, { sourceText: src }).errors.some((e) => e.code === "VERDICT"));
});

test("blocca finding attribuito a Slither se Slither ha 0 risultati", () => {
  const { report, src } = base();
  report.tools = { slither: { result_count: 0 } };
  report.findings[0].source = "slither";
  assert.ok(validateReport(report, { sourceText: src }).errors.some((e) => e.code === "TOOL_MISMATCH"));
});

test("blocca punteggio senza metodo e sorgente modificato", () => {
  const { report, src } = base();
  report.score = 69;
  const codes = validateReport(report, { sourceText: src + "\n// modificato" }).errors.map((e) => e.code);
  assert.ok(codes.includes("SCORE") && codes.includes("SOURCE_HASH"));
});

test("pubblicabile solo con reviewer nominato e candidati risolti", () => {
  const { report, src } = base();
  report.manual_review = { performed: true, reviewer: { name: "Mario Rossi" } };
  report.findings.forEach((f) => { f.status = "rejected"; });
  assert.equal(validateReport(report, { sourceText: src }).publishable, true);
});
