// Compila con solc-js e restituisce gli AST. Se non compila, NESSUN'analisi viene prodotta.
import solc from "solc";
import fs from "node:fs";
import path from "node:path";

export function compileProject(sourcePath) {
  const abs = path.resolve(sourcePath);
  const base = path.dirname(abs);
  const name = path.basename(abs);
  const text = fs.readFileSync(abs, "utf8");

  const input = {
    language: "Solidity",
    sources: { [name]: { content: text } },
    settings: { optimizer: { enabled: false }, outputSelection: { "*": { "": ["ast"] } } },
  };
  const findImports = (p) => {
    try {
      const f = path.resolve(base, p);
      if (!f.startsWith(base + path.sep)) return { error: "import outside project root" };
      return { contents: fs.readFileSync(f, "utf8") };
    } catch {
      return { error: "import not found" };
    }
  };

  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error("COMPILATION FAILED:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  }

  const sourcesById = new Map();
  const asts = [];
  for (const [file, s] of Object.entries(out.sources)) {
    const content = file === name ? text : findImports(file).contents ?? "";
    sourcesById.set(s.id, { file, buf: Buffer.from(content, "utf8"), text: content });
    asts.push(s.ast);
  }
  return {
    primaryFile: name,
    primaryId: out.sources[name].id,
    primaryText: text,
    asts,
    sourcesById,
    solcVersion: solc.version(),
    warnings: (out.errors || []).filter((e) => e.severity !== "error").map((e) => e.formattedMessage),
  };
}
