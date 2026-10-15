// Generates a Foundry exploit test for every finding the multi-engine consensus
// marked CONFIRMED. When the Slither/Mythril backend is online the PoC is also
// compiled there with `forge build`; otherwise it is generated locally only.

import { generateExploitForFinding } from "@/core/poc/exploitGenerator"
import { getStaticBackendUrl, staticBackendHeaders } from "@/lib/static-backend"

export interface ConsensusPoC {
  findingId: string
  findingTitle: string
  severity: string
  exploitType: string
  vulnerableFunction: string
  pocFile: string
  pocCode: string
  runCommand: string
  compiled: boolean | null
  source: "backend" | "local"
}

interface PoCInputFinding {
  id?: unknown
  title?: unknown
  severity?: unknown
  location?: unknown
  consensusLevel?: unknown
}

const MAX_POCS = 8

function extractFunctionName(location: string): string {
  const m = location.match(/([A-Za-z_]\w*)\s*\(/) || location.match(/function\s+([A-Za-z_]\w*)/)
  return m?.[1] ?? "targetFunction"
}

function extractContractName(code: string): string {
  return code.match(/\bcontract\s+([A-Za-z_]\w*)/)?.[1] ?? "Target"
}

async function compileOnBackend(
  code: string,
  contractName: string,
  title: string,
  exploitType: string,
  location: string,
): Promise<{ poc: string; compiles: boolean } | null> {
  const url = getStaticBackendUrl()
  if (!url) return null
  try {
    const res = await fetch(`${url}/exploit`, {
      method: "POST",
      headers: staticBackendHeaders(),
      body: JSON.stringify({ code, contractName, findingTitle: title, findingType: exploitType, location }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const body = await res.json()
    return typeof body?.poc === "string" ? { poc: body.poc, compiles: Boolean(body.compiles) } : null
  } catch {
    return null
  }
}

export async function generateConsensusPoCs(
  code: string,
  findings: PoCInputFinding[],
  options: { contractAddress?: string; backendOnline: boolean },
): Promise<ConsensusPoC[]> {
  const contractName = extractContractName(code)
  const confirmed = findings
    .filter((f) => f.consensusLevel === "CONFIRMED")
    .slice(0, MAX_POCS)

  return Promise.all(
    confirmed.map(async (f, i) => {
      const title = String(f.title ?? "Finding")
      const location = String(f.location ?? "")
      const findingId = String(f.id ?? `SOL-${String(i + 1).padStart(3, "0")}`)
      const vulnerableFunction = extractFunctionName(location)
      const local = generateExploitForFinding(title, {
        contractName,
        vulnerableFunction,
        contractAddress: options.contractAddress,
        findingId,
      })
      const remote = options.backendOnline
        ? await compileOnBackend(code, contractName, title, local.exploitType, location)
        : null
      const testName = local.pocFile.split("/").pop() ?? local.pocFile
      return {
        findingId,
        findingTitle: title,
        severity: String(f.severity ?? "MEDIUM"),
        exploitType: local.exploitType,
        vulnerableFunction,
        pocFile: local.pocFile,
        pocCode: remote?.poc ?? local.pocCode,
        runCommand: `forge test --match-path test/${testName} -vvvv`,
        compiled: remote ? remote.compiles : null,
        source: remote ? "backend" : "local",
      } satisfies ConsensusPoC
    }),
  )
}
