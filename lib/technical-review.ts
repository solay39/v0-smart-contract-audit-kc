import { observeEntryGuard, sourceFunctions } from "./solidity-access-review"

export interface TechnicalReview {
  sourceSha256: string
  method: string
  functions: { name: string; visibility: string; location: string; observation: string }[]
  checks: { area: string; status: string; evidence: string }[]
  callFlow: string
  dependencies: string[]
}

/** Source observations only; not a compiler call graph, entrypoint list or review approval. */
export function buildTechnicalReview(code: string, sourceSha256: string): TechnicalReview {
  const functions = sourceFunctions(code)
  return {
    sourceSha256, method: "Lexical source inventory; compiler-backed reachability and founder validation pending.",
    functions: functions.slice(0, 200).map(fn => {
      const guard = observeEntryGuard(fn)
      return {
        name: fn.signature.replace(/\s+/g, " "), visibility: fn.visibility,
        location: `source lines ${fn.line}-${fn.endLine}`,
        observation: guard.evidence
          ? `Entry-check observation: ${guard.evidence}`
          : "Authorization not classified. Public visibility is not itself a vulnerability.",
      }
    }),
    checks: [
      { area: "Source function inventory", status: "SOURCE_OBSERVATION", evidence: `${functions.length} implemented definitions found; at most 200 listed, including libraries/base contracts. Not a deployed-entrypoint list.` },
      { area: "Authorization and delegation", status: "NOT_RUN", evidence: "Function-local checks are observations only. Resolve modifiers, inheritance, helpers and minter/admin delegation." },
      { area: "Supply and business policy", status: "NOT_RUN", evidence: "Distinguish authorized emissions from an unauthorized mint; review any external minter policy." },
      { area: "Runtime, fuzzing and invariants", status: "NOT_RUN", evidence: "Only actual source-bound harness outputs can record an execution. No test success is inferred from this inventory." },
      { area: "Compiler and deployed bytecode", status: "NOT_RUN", evidence: "Exact settings, constructor arguments and bytecode correspondence need separate evidence." },
      { area: "Whole-protocol integrations", status: "OUT_OF_SCOPE", evidence: "A token source inventory does not audit pools, gauges, emissions, governance or external integrations." },
    ],
    callFlow: "Call flow not established by the lexical inventory. Attach a source-reviewed flow and compiler-backed call graph.",
    dependencies: [],
  }
}

/** Persisted inputs are untrusted declarations, including claimed test outcomes. */
export function technicalReviewModel(input: unknown): TechnicalReview | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return
  const raw = input as Record<string, unknown>
  const text = (value: unknown, limit = 2000) => typeof value === "string" ? value.slice(0, limit) : ""
  const rows = (value: unknown) => Array.isArray(value) ? value.filter(x => x && typeof x === "object" && !Array.isArray(x)).slice(0, 200) as Record<string, unknown>[] : []
  const hash = text(raw.sourceSha256)
  return {
    sourceSha256: /^[a-f0-9]{64}$/i.test(hash) ? hash : "Not established",
    method: text(raw.method),
    functions: rows(raw.functions).map(row => ({
      name: text(row.name), visibility: text(row.visibility), location: text(row.location), observation: text(row.observation),
    })),
    checks: rows(raw.checks).map(row => ({
      area: text(row.area), evidence: text(row.evidence),
      status: ["SOURCE_OBSERVATION", "RECORDED_TEST", "NOT_RUN", "OUT_OF_SCOPE"].includes(text(row.status)) ? text(row.status) : "NOT_RUN",
    })),
    callFlow: text(raw.callFlow, 12000),
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies.filter(x => typeof x === "string").slice(0, 40).map(x => text(x)) : [],
  }
}

export function technicalReviewMarkdown(input: unknown): string {
  const model = technicalReviewModel(input)
  if (!model) return ""
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ")
  return [
    "## Function inventory and verification matrix",
    "Submitted source observations, not validated findings, successful security checks or founder approval.",
    `Inventory source SHA-256 (declared): ${model.sourceSha256}\n\nMethod: ${model.method}`,
    model.functions.length ? ["### Implemented source definitions", "| Function | Visibility | Source location | Observation |", "| --- | --- | --- | --- |",
      ...model.functions.map(row => `| ${[row.name, row.visibility, row.location, row.observation].map(cell).join(" | ")} |`)].join("\n") : "",
    model.checks.length ? ["### Verification matrix", "| Area | Declared evidence category | Evidence or missing work |", "| --- | --- | --- |",
      ...model.checks.map(row => `| ${[row.area, row.status, row.evidence].map(cell).join(" | ")} |`)].join("\n") : "",
    model.callFlow ? `### Submitted call flow\n\n${model.callFlow.split("\n").map(line => "    " + line).join("\n")}` : "",
    model.dependencies.length ? `### Dependencies and exclusions\n\n${model.dependencies.map(item => "- " + item).join("\n")}` : "",
  ].filter(Boolean).join("\n\n")
}
