import type { AuditProject } from "@/lib/types"

// UI sample records intentionally contain no audit evidence or asserted security scores.
// Replace these with persisted, evidence-backed audit records before publication.
export const mockAudits: AuditProject[] = [
  {
    id: "injective-token",
    name: "Injective Token",
    ticker: "INJ",
    network: "Ethereum",
    category: "DeFi",
    score: null,
    rating: null,
    status: "PENDING",
    price: "—",
    change24h: "",
    marketCap: "—",
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    description: "Sample project record. Audit findings and score will be displayed only after report evidence is supplied.",
    evidence: { reportHash: "", reviewerNames: [], ciArtifacts: [], commitHash: "", attestationCount: 0 },
    tags: ["Layer 1", "DeFi", "ERC-20"],
  },
  {
    id: "fetch-ai",
    name: "Fetch.ai",
    ticker: "FET",
    network: "Ethereum",
    category: "AI / Infrastructure",
    score: null,
    rating: null,
    status: "PENDING",
    price: "—",
    change24h: "",
    marketCap: "—",
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    description: "Sample project record. No audit conclusion is asserted by this demo entry.",
    evidence: { reportHash: "", reviewerNames: [], ciArtifacts: [], commitHash: "", attestationCount: 0 },
    tags: ["AI", "Infrastructure", "ERC-20"],
  },
  {
    id: "chiliz",
    name: "chiliZ",
    ticker: "CHZ",
    network: "Ethereum",
    category: "Fan Tokens",
    score: null,
    rating: null,
    status: "PENDING",
    price: "—",
    change24h: "",
    marketCap: "—",
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    description: "Sample project record. Add reviewed findings and evidence before presenting an audit result.",
    evidence: { reportHash: "", reviewerNames: [], ciArtifacts: [], commitHash: "", attestationCount: 0 },
    tags: ["Sports", "Fan Token", "ERC-20"],
  },
]

export async function getAllAudits(): Promise<AuditProject[]> {
  return mockAudits
}

export async function getAuditById(id: string): Promise<AuditProject | null> {
  return mockAudits.find((audit) => audit.id === id) ?? null
}
