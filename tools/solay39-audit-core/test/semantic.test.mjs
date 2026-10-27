import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileProject } from "../src/compile.mjs";
import { extractFacts } from "../src/facts.mjs";
import { buildReport, seal, renderMarkdown, reportDigest } from "../src/report.mjs";
import { validateReport } from "../src/validate.mjs";
import { groundLlmFindings, runAudit } from "../src/pipeline.mjs";
import { slitherToFindings } from "../src/tools.mjs";

const fx = (n) => path.resolve("fixtures", n);
function scan(name, contract) {
  const compiled = compileProject(fx(name));
  const factsResult = extractFacts(compiled, contract);
  return { compiled, factsResult, report: buildReport({ compiled, factsResult, sourcePath: fx(name) }) };
}

test("fatti semantici: owner bypass, prelievo privilegiato, 75% al tesoro, pool+min0, signer setter", () => {
  const { report } = scan("Semantic.sol", "Sem");
  const kinds = report.facts.map((f) => f.kind);
  for (const k of ["owner_bypass", "privileged_withdrawal", "mint_to_constant_recipient", "pool_init_zero_min", "signer_setter", "supply_budget"])
    assert.ok(kinds.includes(k), `manca ${k}`);
  assert.equal(report.facts.find((f) => f.kind === "mint_to_constant_recipient").pctOfMaxSupply, 75);
  assert.equal(report.facts.find((f) => f.kind === "signer_setter").hasTimelock, false);
  const cats = report.findings.map((f) => f.category);
  for (const c of ["centralization", "token-distribution", "launch-frontrun", "uncapped-mint"]) assert.ok(cats.includes(c), c);
});

test("budget di supply: MAX - mint a importo costante", () => {
  const { report } = scan("Semantic.sol", "Sem");
  const b = report.facts.find((f) => f.id === "F-supply-budget");
  assert.equal(b.maxSupply, "400"); assert.equal(b.unallocated, "100");
});

test("senza fatti semantici su un contratto pulito", () => {
  const { report } = scan("CappedToken.sol", "Capped");
  assert.equal(report.findings.length, 0);
});

test("LLM: citazione inventata, delegatecall/upgrade senza fatto e severity imposta vengono scartati", () => {
  const { compiled, factsResult } = scan("SafeLikeTagger.sol", "Token");
  const src = compiled.primaryText;
  const good = { title: "ok", category: "x", severity_hint: "Medium", line: 13, quote: "uint256 public constant MAX_SUPPLY = 1000;", severity: "Critical" };
  const bad = [
    { title: "inventata", line: 13, quote: "function nonEsiste()" },
    { title: "delegatecall", category: "delegatecall", line: 13, quote: "uint256 public constant MAX_SUPPLY = 1000;" },
    { title: "upgrade", category: "upgrade", line: 13, quote: "uint256 public constant MAX_SUPPLY = 1000;" },
    { title: "senza quote", line: 13 },
  ];
  const { accepted, rejected } = groundLlmFindings([good, ...bad], { sourceText: src, facts: factsResult.facts });
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 4);
  assert.equal(accepted[0].severity, undefined);        // il modello non assegna la severity finale
  assert.equal(accepted[0].status, "candidate");
});

test("pipeline con LLM finto: accetta solo i grounded e registra gli scarti", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
  const llm = async () => [
    { title: "vero", line: 13, quote: "uint256 public constant MAX_SUPPLY = 1000;", severity_hint: "Low" },
    { title: "falso", category: "delegatecall", line: 13, quote: "uint256 public constant MAX_SUPPLY = 1000;" },
  ];
  const { report, validation } = await runAudit({ file: fx("SafeLikeTagger.sol"), contract: "Token", outDir: out, llm });
  assert.equal(report.llm.accepted, 1);
  assert.equal(report.llm.rejected.length, 1);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.ok(fs.existsSync(path.join(out, "REPORT.md")));
});

test("sigillo: l'hash cambia se il report viene modificato (R9)", () => {
  const { report, compiled } = scan("Semantic.sol", "Sem");
  seal(report);
  assert.equal(validateReport(report, { sourceText: compiled.primaryText }).ok, true);
  report.findings[0].title = "modificato dopo la firma";
  assert.ok(validateReport(report, { sourceText: compiled.primaryText }).errors.some((e) => e.code === "REPORT_HASH"));
  assert.notEqual(report.integrity.report_sha256, reportDigest(report));
});

test("REPORT.md generato dal JSON non contiene claim vietati", () => {
  const { report } = scan("Semantic.sol", "Sem");
  seal(report);
  const md = renderMarkdown(report);
  assert.ok(!/production[- ]ready|line-by-line|dual review|independent review completed/i.test(md));
  assert.ok(/Revisione manuale: NO/.test(md));
  assert.ok(/AUTOMATED_SCAN_PENDING_REVIEW/.test(md));
});

test("Slither (JSON sintetico) -> candidati ancorati; informational/optimization ignorati", () => {
  const src = "line1\n  x.call{value: 1}(\"\");\nline3\n";
  const parsed = { results: { detectors: [
    { check: "reentrancy-eth", impact: "High", confidence: "Medium", description: "desc", elements: [{ source_mapping: { filename_relative: "T.sol", lines: [2] } }] },
    { check: "naming-convention", impact: "Informational", description: "x", elements: [] },
    { check: "other", impact: "Medium", description: "y", elements: [{ source_mapping: { filename_relative: "Lib.sol", lines: [1] } }] },
  ] } };
  const { findings, unmapped } = slitherToFindings(parsed, src, "T.sol");
  assert.equal(findings.length, 1); assert.equal(unmapped, 1);
  assert.equal(findings[0].line, 2); assert.match(findings[0].quote, /x\.call/);
});
