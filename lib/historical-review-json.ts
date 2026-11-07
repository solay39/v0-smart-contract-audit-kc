/**
 * Preserve raw JSON number tokens beyond JS's exact integer range as strings.
 * Source strings (including Solidity code and numeric-looking text) are untouched.
 * Original artifact bytes remain independently SHA-256 bound by the dossier.
 */
export function parseEvidenceJson(text: string): unknown {
  const pieces: string[] = []
  let quoted = false
  let escaped = false
  let last = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') quoted = false
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c !== "-" && (c < "0" || c > "9")) continue
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i))
    if (!match) continue // Standard JSON.parse below still rejects malformed JSON.
    const token = match[0]
    const value = Number(token)
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      pieces.push(text.slice(last, i), JSON.stringify(token))
      last = i + token.length
    }
    i += token.length - 1
  }
  pieces.push(text.slice(last))
  return JSON.parse(pieces.join(""))
}
