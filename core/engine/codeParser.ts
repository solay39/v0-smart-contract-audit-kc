/**
 * Code Parser - Parses Solidity/Rust contracts into AST-like structure
 * Extracts functions, state variables, modifiers, events, and dependencies
 */

export interface ParsedFunction {
  name: string
  visibility: "public" | "external" | "internal" | "private"
  mutability: "pure" | "view" | "payable" | "nonpayable"
  modifiers: string[]
  parameters: { name: string; type: string }[]
  returns: string[]
  body: string
  lineStart: number
  lineEnd: number
  hasExternalCall: boolean
  hasStateChange: boolean
  hasDelegateCall: boolean
  hasSelfdestruct: boolean
}

export interface ParsedVariable {
  name: string
  type: string
  visibility: "public" | "private" | "internal"
  isMutable: boolean
  isMapping: boolean
  lineNumber: number
}

export interface ParsedEvent {
  name: string
  parameters: { name: string; type: string; indexed: boolean }[]
  lineNumber: number
}

export interface ParsedModifier {
  name: string
  parameters: { name: string; type: string }[]
  body: string
  lineNumber: number
}

export interface ParsedImport {
  path: string
  symbols: string[]
  isRelative: boolean
  lineNumber: number
}

export interface ParsedContract {
  name: string
  type: "contract" | "interface" | "library" | "abstract"
  inherits: string[]
  functions: ParsedFunction[]
  variables: ParsedVariable[]
  events: ParsedEvent[]
  modifiers: ParsedModifier[]
  imports: ParsedImport[]
  pragmaVersion: string
  license: string
  linesOfCode: number
  complexity: number
}

export interface ParseResult {
  contracts: ParsedContract[]
  errors: string[]
  warnings: string[]
  metadata: {
    totalFunctions: number
    totalVariables: number
    totalEvents: number
    externalCalls: number
    delegateCalls: number
    assemblyBlocks: number
    inlineAssembly: boolean
  }
}

// Parse Solidity code into structured format
export function parseContract(code: string): ParseResult {
  const lines = code.split("\n")
  const contracts: ParsedContract[] = []
  const errors: string[] = []
  const warnings: string[] = []

  // Extract pragma
  const pragmaMatch = code.match(/pragma\s+solidity\s+([^;]+);/)
  const pragmaVersion = pragmaMatch ? pragmaMatch[1].trim() : "unknown"

  // Extract license
  const licenseMatch = code.match(/\/\/\s*SPDX-License-Identifier:\s*(.+)/)
  const license = licenseMatch ? licenseMatch[1].trim() : "UNLICENSED"

  // Extract imports
  const imports: ParsedImport[] = []
  const importRegex = /import\s+(?:{([^}]+)}\s+from\s+)?["']([^"']+)["'];/g
  let importMatch
  while ((importMatch = importRegex.exec(code)) !== null) {
    imports.push({
      path: importMatch[2],
      symbols: importMatch[1] ? importMatch[1].split(",").map(s => s.trim()) : [],
      isRelative: importMatch[2].startsWith("./") || importMatch[2].startsWith("../"),
      lineNumber: code.substring(0, importMatch.index).split("\n").length,
    })
  }

  // Extract contract definitions
  const contractRegex = /(contract|interface|library|abstract\s+contract)\s+(\w+)(?:\s+is\s+([^{]+))?\s*\{/g
  let contractMatch
  while ((contractMatch = contractRegex.exec(code)) !== null) {
    const contractType = contractMatch[1].includes("interface") ? "interface" :
                        contractMatch[1].includes("library") ? "library" :
                        contractMatch[1].includes("abstract") ? "abstract" : "contract"
    const contractName = contractMatch[2]
    const inherits = contractMatch[3] ? contractMatch[3].split(",").map(s => s.trim()) : []

    // Find contract body
    const startIndex = contractMatch.index + contractMatch[0].length
    let braceCount = 1
    let endIndex = startIndex
    while (braceCount > 0 && endIndex < code.length) {
      if (code[endIndex] === "{") braceCount++
      if (code[endIndex] === "}") braceCount--
      endIndex++
    }
    const contractBody = code.substring(startIndex, endIndex - 1)

    // Parse functions
    const functions = parseFunctions(contractBody, code.substring(0, startIndex).split("\n").length)

    // Parse state variables
    const variables = parseVariables(contractBody)

    // Parse events
    const events = parseEvents(contractBody)

    // Parse modifiers
    const modifiers = parseModifiers(contractBody)

    // Calculate complexity (cyclomatic)
    const complexity = calculateComplexity(contractBody)

    contracts.push({
      name: contractName,
      type: contractType,
      inherits,
      functions,
      variables,
      events,
      modifiers,
      imports,
      pragmaVersion,
      license,
      linesOfCode: contractBody.split("\n").length,
      complexity,
    })
  }

  // Count metadata
  const totalFunctions = contracts.reduce((sum, c) => sum + c.functions.length, 0)
  const totalVariables = contracts.reduce((sum, c) => sum + c.variables.length, 0)
  const totalEvents = contracts.reduce((sum, c) => sum + c.events.length, 0)
  const externalCalls = (code.match(/\.call\(|\.call\{|\.transfer\(|\.send\(/g) || []).length
  const delegateCalls = (code.match(/\.delegatecall\(/g) || []).length
  const assemblyBlocks = (code.match(/assembly\s*\{/g) || []).length

  // Warnings
  if (pragmaVersion.includes("^")) {
    warnings.push("Floating pragma detected - pin to specific version for production")
  }
  if (delegateCalls > 0) {
    warnings.push(`${delegateCalls} delegatecall(s) detected - review for proxy safety`)
  }
  if (assemblyBlocks > 0) {
    warnings.push(`${assemblyBlocks} assembly block(s) detected - manual review required`)
  }

  return {
    contracts,
    errors,
    warnings,
    metadata: {
      totalFunctions,
      totalVariables,
      totalEvents,
      externalCalls,
      delegateCalls,
      assemblyBlocks,
      inlineAssembly: assemblyBlocks > 0,
    },
  }
}

function parseFunctions(body: string, lineOffset: number): ParsedFunction[] {
  const functions: ParsedFunction[] = []
  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(public|external|internal|private)?\s*(view|pure|payable)?\s*((?:\w+\s*)*)\s*(?:returns\s*\(([^)]*)\))?\s*\{/g

  let match
  while ((match = funcRegex.exec(body)) !== null) {
    const name = match[1]
    const paramsStr = match[2]
    const visibility = (match[3] || "internal") as ParsedFunction["visibility"]
    const mutability = (match[4] || "nonpayable") as ParsedFunction["mutability"]
    const modifiersStr = match[5] || ""
    const returnsStr = match[6] || ""

    // Parse parameters
    const parameters = paramsStr.split(",").filter(p => p.trim()).map(p => {
      const parts = p.trim().split(/\s+/)
      return { type: parts[0] || "", name: parts[parts.length - 1] || "" }
    })

    // Parse returns
    const returns = returnsStr.split(",").filter(r => r.trim()).map(r => r.trim().split(/\s+/)[0])

    // Parse modifiers
    const modifiers = modifiersStr.split(/\s+/).filter(m => m && !["returns", "virtual", "override"].includes(m))

    // Find function body
    const startIndex = match.index + match[0].length
    let braceCount = 1
    let endIndex = startIndex
    while (braceCount > 0 && endIndex < body.length) {
      if (body[endIndex] === "{") braceCount++
      if (body[endIndex] === "}") braceCount--
      endIndex++
    }
    const funcBody = body.substring(startIndex, endIndex - 1)

    const lineStart = body.substring(0, match.index).split("\n").length + lineOffset
    const lineEnd = body.substring(0, endIndex).split("\n").length + lineOffset

    functions.push({
      name,
      visibility,
      mutability,
      modifiers,
      parameters,
      returns,
      body: funcBody,
      lineStart,
      lineEnd,
      hasExternalCall: /\.call\(|\.call\{|\.transfer\(|\.send\(/.test(funcBody),
      hasStateChange: /=\s*[^=]|\.push\(|delete\s/.test(funcBody),
      hasDelegateCall: /\.delegatecall\(/.test(funcBody),
      hasSelfdestruct: /selfdestruct\(|suicide\(/.test(funcBody),
    })
  }

  return functions
}

function parseVariables(body: string): ParsedVariable[] {
  const variables: ParsedVariable[] = []
  const varRegex = /^\s*(mapping\s*\([^)]+\)|address|uint\d*|int\d*|bool|bytes\d*|string|bytes)\s*(public|private|internal)?\s*(constant|immutable)?\s*(\w+)/gm

  let match
  let lineNum = 1
  while ((match = varRegex.exec(body)) !== null) {
    lineNum = body.substring(0, match.index).split("\n").length
    variables.push({
      name: match[4],
      type: match[1],
      visibility: (match[2] || "internal") as ParsedVariable["visibility"],
      isMutable: !match[3],
      isMapping: match[1].startsWith("mapping"),
      lineNumber: lineNum,
    })
  }

  return variables
}

function parseEvents(body: string): ParsedEvent[] {
  const events: ParsedEvent[] = []
  const eventRegex = /event\s+(\w+)\s*\(([^)]*)\)/g

  let match
  while ((match = eventRegex.exec(body)) !== null) {
    const params = match[2].split(",").filter(p => p.trim()).map(p => {
      const parts = p.trim().split(/\s+/)
      const indexed = parts.includes("indexed")
      const type = parts[0]
      const name = parts[parts.length - 1]
      return { name, type, indexed }
    })

    events.push({
      name: match[1],
      parameters: params,
      lineNumber: body.substring(0, match.index).split("\n").length,
    })
  }

  return events
}

function parseModifiers(body: string): ParsedModifier[] {
  const modifiers: ParsedModifier[] = []
  const modRegex = /modifier\s+(\w+)\s*(?:\(([^)]*)\))?\s*\{/g

  let match
  while ((match = modRegex.exec(body)) !== null) {
    const params = (match[2] || "").split(",").filter(p => p.trim()).map(p => {
      const parts = p.trim().split(/\s+/)
      return { type: parts[0] || "", name: parts[1] || "" }
    })

    // Find modifier body
    const startIndex = match.index + match[0].length
    let braceCount = 1
    let endIndex = startIndex
    while (braceCount > 0 && endIndex < body.length) {
      if (body[endIndex] === "{") braceCount++
      if (body[endIndex] === "}") braceCount--
      endIndex++
    }

    modifiers.push({
      name: match[1],
      parameters: params,
      body: body.substring(startIndex, endIndex - 1),
      lineNumber: body.substring(0, match.index).split("\n").length,
    })
  }

  return modifiers
}

function calculateComplexity(code: string): number {
  // Cyclomatic complexity approximation
  let complexity = 1
  complexity += (code.match(/\bif\s*\(/g) || []).length
  complexity += (code.match(/\belse\s*\{/g) || []).length
  complexity += (code.match(/\bfor\s*\(/g) || []).length
  complexity += (code.match(/\bwhile\s*\(/g) || []).length
  complexity += (code.match(/\brequire\s*\(/g) || []).length
  complexity += (code.match(/\bassert\s*\(/g) || []).length
  complexity += (code.match(/\?/g) || []).length // ternary
  complexity += (code.match(/&&|\|\|/g) || []).length
  return complexity
}

// Extract all function selectors
export function extractSelectors(parsed: ParseResult): { name: string; selector: string }[] {
  const selectors: { name: string; selector: string }[] = []
  
  for (const contract of parsed.contracts) {
    for (const func of contract.functions) {
      if (func.visibility === "public" || func.visibility === "external") {
        const sig = `${func.name}(${func.parameters.map(p => p.type).join(",")})`
        // Simple keccak256 simulation - in production use ethers.utils.id
        const selector = `0x${simpleHash(sig).substring(0, 8)}`
        selectors.push({ name: func.name, selector })
      }
    }
  }

  return selectors
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, "0")
}

// Get attack surface (public/external functions)
export function getAttackSurface(parsed: ParseResult): ParsedFunction[] {
  const surface: ParsedFunction[] = []
  
  for (const contract of parsed.contracts) {
    for (const func of contract.functions) {
      if (func.visibility === "public" || func.visibility === "external") {
        surface.push(func)
      }
    }
  }

  return surface
}
