import summary from "../public/evidence/historical-execution-summary.json"
import type { PortfolioProject } from "./solay39-constants"

export const PUBLIC_EXECUTION_SUMMARY = summary
export type HistoricalExecution = typeof summary.targets[number]
export const EXECUTION_LIMITATIONS = [
  "Historical source fixtures were deployed locally with synthetic constructor arguments and test doubles where required. These are not production-fork tests.",
  "Only the listed properties were exercised. Full entrypoint, line and economic invariant coverage are not established.",
  "Current deployed bytecode, live permissions, upgrades and external integrations require separate verification.",
  "Passing tests do not validate submitted findings or establish safety. Formal verification was not run; founder approval remains pending.",
]

/** Address AND network must match. Never infer execution from a token name or ID. */
export function historicalExecutionFor(project: Pick<PortfolioProject, "network" | "contractAddress">): HistoricalExecution | undefined {
  const networks: Record<string, number> = {
    ethereum: 1, bsc: 56, "bnb chain": 56, "binance smart chain": 56,
    base: 8453, polygon: 137, arbitrum: 42161, optimism: 10,
    avalanche: 43114, fantom: 250, gnosis: 100,
  }
  if (typeof project.network !== "string" || typeof project.contractAddress !== "string") return
  const chainId = networks[project.network.trim().toLowerCase()]
  const address = project.contractAddress.toLowerCase()
  if (!chainId || !/^0x[a-f0-9]{40}$/.test(address)) return
  return summary.targets.find(row => row.chainId === chainId && row.address === address)
}

export function executionCounts(row: HistoricalExecution) {
  return {
    passed: row.tests.filter(t => t.status === "passed").length,
    fuzzCases: row.tests.reduce((n, test) => n + (test.category === "fuzz" && "runs" in test ? test.runs || 0 : 0), 0),
    statefulCalls: row.tests.reduce((n, test) => n + (test.category === "invariant" && "calls" in test ? test.calls || 0 : 0), 0),
  }
}

export function historicalExecutionMarkdown(project: PortfolioProject): string {
  const row = historicalExecutionFor(project)
  if (!row) return ""
  const counts = executionCounts(row)
  return [
    "## Historical execution results",
    `Captured on ${summary.capturedOn}. Local source fixtures only, not verification of the current deployment.`,
    `Target: chain ${row.chainId}, ${row.address}.`,
    `Passed properties: ${counts.passed}/${row.tests.length}. Fuzz cases: ${counts.fuzzCases}. Stateful handler calls: ${counts.statefulCalls}.`,
    `Historical source manifest SHA-256: ${row.sourceManifestSha256}`,
    `Execution output SHA-256: ${row.executionOutputSha256}`,
    ...row.tests.map(test => `- ${test.name}: ${test.category}, ${test.status}.`),
    "### Verification limits",
    ...EXECUTION_LIMITATIONS.map(text => `- ${text}`),
    row.chainId === 56 && row.address === "0x208bf3e7da9639f1eaefa2de78c23396b0682025"
      ? "- TAG uses mocked DEX dependencies on local chain 31337. BSC locker behavior and live signer integration were not tested." : "",
    "The historical source digest is separate from any source revision currently declared in this report. This summary does not establish a match to current deployed bytecode.",
    "[Public execution summary](https://www.solay39.eu/evidence/historical-execution-summary.json). The full private evidence archive and review decisions are not published.",
  ].filter(Boolean).join("\n\n")
}
