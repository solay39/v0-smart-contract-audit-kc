// Revisione assistita da LLM, vincolata ai fatti. NON TESTATA (serve ANTHROPIC_API_KEY).
// L'output del modello entra nel report solo se supera il validatore (citazione reale, fatto coerente).
export async function llmReview({ source, factsResult, model = process.env.AUDIT_MODEL, apiKey = process.env.ANTHROPIC_API_KEY }) {
  if (!apiKey || !model) throw new Error("Impostare ANTHROPIC_API_KEY e AUDIT_MODEL");
  const system = [
    "Sei un revisore di smart contract. Ti vengono dati il sorgente e FATTI deterministici estratti dall'AST.",
    "Regole: (1) non contraddire i fatti; se un fatto dice che delegatecall non è raggiungibile, non segnalarlo.",
    "(2) Ogni finding deve avere 'line' e 'quote' copiata ESATTAMENTE dal sorgente.",
    "(3) Non dichiarare test, fuzzing, copertura, formal verification o revisione manuale: non sono stati eseguiti.",
    "(4) Se non sei sicuro, status='candidate' e spiega cosa servirebbe per confermare (PoC/test).",
    "(5) Per ogni finding indica scenario d'attacco concreto, precondizioni (chi deve essere compromesso) e fix.",
    "Rispondi SOLO con JSON: {\"findings\":[{\"title\",\"category\",\"severity_hint\",\"line\",\"quote\",\"scenario\",\"preconditions\",\"fix\",\"how_to_confirm\"}]}",
  ].join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 8000, system,
      messages: [{ role: "user", content: `FATTI:\n${JSON.stringify(factsResult.facts)}\n\nSORGENTE (numerato):\n${source.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n")}` }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const body = await res.json();
  const txt = body.content?.map((c) => c.text).join("") ?? "";
  const json = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  return (json.findings || []).map((f, i) => ({
    ...f, id: `L-${String(i + 1).padStart(2, "0")}`, status: "candidate", source_kind: "llm",
    evidence: { type: "llm_grounded_quote" },
  }));
}
