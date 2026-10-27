// Esecuzione di Slither/Mythril con artefatti hashati. NON provato in questo ambiente (tool non installati):
// il parsing è coperto da test su JSON sintetici, l'esecuzione va provata nel vostro container.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { sha256 } from "./report.mjs";

function exec(cmd, args, { cwd, timeoutMs = 300_000 } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd });
    let stdout = "", stderr = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => (stderr += d));
    p.on("error", (e) => { clearTimeout(t); resolve({ code: null, stdout, stderr: String(e), missing: e.code === "ENOENT" }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
  });
}

// docker: esecuzione senza rete, filesystem in sola lettura per i sorgenti
function wrap(docker, hostDir, outDir, cmd, args) {
  if (!docker) return { cmd, args, srcDir: hostDir };
  return {
    cmd: "docker",
    args: ["run", "--rm", "--network", "none", "--cap-drop", "ALL", "--pids-limit", "256", "--memory", "2g",
      "-v", `${hostDir}:/work:ro`, "-v", `${outDir}:/out`, "-w", "/work", docker, cmd, ...args],
    srcDir: "/work",
  };
}

export async function runSlither(file, outDir, { docker } = {}) {
  const abs = path.resolve(file), dir = path.dirname(abs), name = path.basename(abs);
  const art = path.join(outDir, "artifacts");
  fs.mkdirSync(art, { recursive: true });
  const jsonHost = path.join(art, "slither.json");
  const w = wrap(docker, dir, art, "slither", [docker ? `/work/${name}` : abs, "--json", docker ? "/out/slither.json" : jsonHost]);
  const v = await exec(docker ? "docker" : "slither", docker ? ["run", "--rm", docker, "slither", "--version"] : ["--version"]);
  if (v.missing) return { name: "slither", status: "skipped", reason: "slither non installato" };
  const r = await exec(w.cmd, w.args, { cwd: dir });
  if (!fs.existsSync(jsonHost)) return { name: "slither", status: "failed", exit_code: r.code, stderr: r.stderr.slice(0, 2000) };
  const raw = fs.readFileSync(jsonHost);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { name: "slither", status: "failed", exit_code: r.code, reason: "JSON non valido" }; }
  if (parsed.success === false) return { name: "slither", status: "failed", exit_code: r.code, reason: parsed.error };
  return {
    name: "slither", status: "success", exit_code: r.code, version: v.stdout.trim(),
    result_count: (parsed.results?.detectors ?? []).length, parsed,
    artifact: { path: "artifacts/slither.json", sha256: sha256(raw) },
  };
}

export async function runMythril(file, outDir, { docker, timeout = 120 } = {}) {
  const abs = path.resolve(file), dir = path.dirname(abs), name = path.basename(abs);
  const art = path.join(outDir, "artifacts");
  fs.mkdirSync(art, { recursive: true });
  const v = await exec(docker ? "docker" : "myth", docker ? ["run", "--rm", docker, "myth", "version"] : ["version"]);
  if (v.missing) return { name: "mythril", status: "skipped", reason: "mythril non installato" };
  const w = wrap(docker, dir, art, "myth", ["analyze", docker ? `/work/${name}` : abs, "-o", "json", "--execution-timeout", String(timeout)]);
  const r = await exec(w.cmd, w.args, { cwd: dir, timeoutMs: (timeout + 60) * 1000 });
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch { return { name: "mythril", status: "failed", exit_code: r.code, stderr: r.stderr.slice(0, 2000) }; }
  if (parsed.success === false) return { name: "mythril", status: "failed", exit_code: r.code, reason: String(parsed.error) };
  fs.writeFileSync(path.join(art, "mythril.json"), r.stdout);
  return {
    name: "mythril", status: "success", exit_code: r.code, version: v.stdout.trim(),
    result_count: (parsed.issues ?? []).length, parsed,
    artifact: { path: "artifacts/mythril.json", sha256: sha256(r.stdout) },
  };
}

// Slither -> candidati ancorati a una riga reale del file principale
export function slitherToFindings(parsed, sourceText, primaryFile) {
  const lines = sourceText.split("\n");
  const out = [];
  let unmapped = 0;
  for (const d of parsed?.results?.detectors ?? []) {
    const impact = String(d.impact).toLowerCase();
    if (!["high", "medium", "low"].includes(impact)) continue;
    const el = (d.elements || []).find((e) => e.source_mapping?.lines?.length && String(e.source_mapping.filename_relative ?? "").endsWith(primaryFile));
    if (!el) { unmapped++; continue; }
    const line = el.source_mapping.lines[0];
    out.push({
      title: `Slither: ${d.check}`, category: `slither:${d.check}`, severity_hint: impact[0].toUpperCase() + impact.slice(1),
      status: "candidate", source: "slither", file: primaryFile, line, quote: (lines[line - 1] ?? "").trim(),
      description: String(d.description).slice(0, 600), evidence: { type: "tool", tool: "slither", confidence: d.confidence },
    });
  }
  return { findings: out, unmapped };
}
