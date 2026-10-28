// Rilevamento proxy/upgradeability che NON si fa ingannare da librerie OpenZeppelin incluse nel file
// (es. Address.functionDelegateCall) né da commenti/stringhe.
// Una regex sull'intero sorgente flattened vede "delegatecall" in qualunque token ERC20 => falso "Upgradeable Proxy".

function stripCommentsAndStrings(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
}

// Rimuove i blocchi `library X { ... }` (bilanciando le graffe): il codice di libreria non è "il contratto".
function stripLibraries(code: string): string {
  let out = ""
  let i = 0
  const re = /\blibrary\s+\w+\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    out += code.slice(i, m.index)
    let depth = 1
    let j = re.lastIndex
    while (j < code.length && depth > 0) {
      if (code[j] === "{") depth++
      else if (code[j] === "}") depth--
      j++
    }
    i = j
    re.lastIndex = j
  }
  return out + code.slice(i)
}

export interface ProxyDetection {
  hasProxy: boolean
  reasons: string[]
}

export function detectProxy(code: string): ProxyDetection {
  const clean = stripLibraries(stripCommentsAndStrings(code))
  const reasons: string[] = []
  // 1) il contratto EREDITA da un'implementazione upgradeable/proxy
  const inherits = clean.match(/\bcontract\s+\w+\s+is\s+([^{]+)\{/g) ?? []
  for (const decl of inherits) {
    if (/\b(UUPSUpgradeable|TransparentUpgradeableProxy|ERC1967Proxy|BeaconProxy|Initializable|\w+Upgradeable)\b/.test(decl)) {
      reasons.push(`eredita: ${decl.replace(/\s+/g, " ").slice(0, 80)}`)
    }
  }
  // 2) funzioni tipiche di upgrade DEFINITE nel contratto
  if (/\bfunction\s+(_authorizeUpgrade|upgradeTo|upgradeToAndCall|_upgradeTo)\s*\(/.test(clean)) reasons.push("definisce una funzione di upgrade")
  // 3) delegatecall in un contratto (non in libreria), dentro assembly o come chiamata low-level
  if (/\.delegatecall\s*\(|\bdelegatecall\s*\(/.test(clean)) reasons.push("delegatecall nel codice del contratto (fuori dalle librerie)")
  return { hasProxy: reasons.length > 0, reasons }
}
