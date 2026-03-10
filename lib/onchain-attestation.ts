import { createPublicClient, createWalletClient, http, custom, encodeFunctionData, parseAbi, keccak256, toBytes, Hex } from "viem"
import { mainnet, sepolia, base, arbitrum, bsc, bscTestnet } from "viem/chains"

// ══════════════════════════════════════════════════════════════════════════════
// SOLAY39 AUDIT REGISTRY - ON-CHAIN ATTESTATION
// ══════════════════════════════════════════════════════════════════════════════
// Owner: 0x2A9386C3636c9b520687BC8F11190abaf8bf98Af
// ══════════════════════════════════════════════════════════════════════════════

// Deployed contract addresses (update after deployment via Remix)
export const REGISTRY_ADDRESSES: Record<string, `0x${string}`> = {
  bsc: "0x0000000000000000000000000000000000000000",        // BSC Mainnet - DEPLOY HERE
  bscTestnet: "0x0000000000000000000000000000000000000000", // BSC Testnet - Test first
  arbitrum: "0x0000000000000000000000000000000000000000",   // Arbitrum One
  mainnet: "0x0000000000000000000000000000000000000000",    // Ethereum Mainnet
  sepolia: "0x0000000000000000000000000000000000000000",    // Sepolia Testnet
  base: "0x0000000000000000000000000000000000000000",       // Base
}

// ABI for Solay39AuditRegistry contract (matches the Solidity contract)
// Note: Using struct definition format for viem/abitype compatibility
const REGISTRY_ABI = [
  // Struct definition (required for tuple returns)
  {
    type: "function",
    name: "getAuditRecord",
    inputs: [{ name: "auditId", type: "bytes32" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "projectName", type: "string" },
        { name: "reportHash", type: "string" },
        { name: "codeReference", type: "string" },
        { name: "ipfsCid", type: "string" },
        { name: "score", type: "uint8" },
        { name: "auditor", type: "address" },
        { name: "timestamp", type: "uint256" },
        { name: "valid", type: "bool" },
      ],
    }],
    stateMutability: "view",
  },
  // Other functions using parseAbi-compatible format
  ...parseAbi([
    "function registerAudit(string projectName, string reportHash, string codeReference, string ipfsCid, uint8 score) external returns (bytes32)",
    "function invalidateAudit(bytes32 auditId, string reason) external",
    "function verifyAudit(bytes32 auditId) external view returns (bool exists, bool valid, string projectName, string reportHash, string ipfsCid, uint8 score, uint256 timestamp)",
    "function verifyByHash(string reportHash) external view returns (bool exists, bytes32 auditId, bool valid, uint8 score, uint256 timestamp)",
    "function getAllAuditIds() external view returns (bytes32[])",
    "function getValidAuditCount() external view returns (uint256)",
    "function totalAudits() external view returns (uint256)",
    "function owner() external view returns (address)",
    "event AuditRegistered(bytes32 indexed auditId, string projectName, string reportHash, string ipfsCid, uint8 score, address auditor, uint256 timestamp)",
    "event AuditInvalidated(bytes32 indexed auditId, string reason)",
  ]),
] as const

// Supported chains - BSC and Arbitrum are primary targets
export const SUPPORTED_CHAINS = {
  bsc: { chain: bsc, name: "BSC Mainnet", explorer: "https://bscscan.com", deployed: false },
  bscTestnet: { chain: bscTestnet, name: "BSC Testnet", explorer: "https://testnet.bscscan.com", deployed: false },
  arbitrum: { chain: arbitrum, name: "Arbitrum One", explorer: "https://arbiscan.io", deployed: false },
  mainnet: { chain: mainnet, name: "Ethereum Mainnet", explorer: "https://etherscan.io", deployed: false },
  sepolia: { chain: sepolia, name: "Sepolia Testnet", explorer: "https://sepolia.etherscan.io", deployed: false },
  base: { chain: base, name: "Base", explorer: "https://basescan.org", deployed: false },
}

export type SupportedChain = keyof typeof SUPPORTED_CHAINS

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC CLIENT (READ OPERATIONS)
// ══════════════════════════════════════════════════════════════════════════════

export function getPublicClient(chainId: SupportedChain = "sepolia") {
  const { chain } = SUPPORTED_CHAINS[chainId]
  return createPublicClient({
    chain,
    transport: http(),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// WALLET CLIENT (WRITE OPERATIONS)
// ══════════════════════════════════════════════════════════════════════════════

export async function getWalletClient(chainId: SupportedChain = "sepolia") {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.")
  }

  const { chain } = SUPPORTED_CHAINS[chainId]
  
  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// ON-CHAIN VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

export interface OnChainAuditRecord {
  exists: boolean
  isValid: boolean
  auditId: string
  reportHash: Hex
  codeHash?: Hex
  auditedContract: `0x${string}`
  auditor: `0x${string}`
  score: number
  ipfsCid: string
  timestamp: number
  chain: SupportedChain
  txHash?: Hex
}

/**
 * Verify an audit by its report hash
 */
export async function verifyAuditByHash(
  reportHash: Hex,
  chainId: SupportedChain = "sepolia"
): Promise<OnChainAuditRecord | null> {
  const client = getPublicClient(chainId)
  const registryAddress = REGISTRY_ADDRESSES[chainId]
  
  if (registryAddress === "0x0000000000000000000000000000000000000000") {
    console.warn(`Registry not deployed on ${chainId}`)
    return null
  }

  try {
    const result = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "verifyByHash",
      args: [reportHash],
    }) as [boolean, boolean, string, `0x${string}`, number, bigint]

    const [exists, isValid, auditId, auditor, score, timestamp] = result

    if (!exists) return null

    return {
      exists,
      isValid,
      auditId,
      reportHash,
      auditedContract: "0x0000000000000000000000000000000000000000",
      auditor,
      score,
      ipfsCid: "",
      timestamp: Number(timestamp),
      chain: chainId,
    }
  } catch (error) {
    console.error("Error verifying audit by hash:", error)
    return null
  }
}

/**
 * Verify an audit by its ID
 */
export async function verifyAuditById(
  auditId: string,
  chainId: SupportedChain = "sepolia"
): Promise<OnChainAuditRecord | null> {
  const client = getPublicClient(chainId)
  const registryAddress = REGISTRY_ADDRESSES[chainId]
  
  if (registryAddress === "0x0000000000000000000000000000000000000000") {
    return null
  }

  try {
    const result = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "verifyById",
      args: [auditId],
    }) as [boolean, boolean, Hex, `0x${string}`, `0x${string}`, number, string, bigint]

    const [exists, isValid, reportHash, auditedContract, auditor, score, ipfsCid, timestamp] = result

    if (!exists) return null

    return {
      exists,
      isValid,
      auditId,
      reportHash,
      auditedContract,
      auditor,
      score,
      ipfsCid,
      timestamp: Number(timestamp),
      chain: chainId,
    }
  } catch (error) {
    console.error("Error verifying audit by ID:", error)
    return null
  }
}

/**
 * Check if a contract has been audited
 */
export async function checkContractAudited(
  contractAddress: `0x${string}`,
  chainId: SupportedChain = "sepolia"
): Promise<{ audited: boolean; auditCount: number; latestAuditId: string } | null> {
  const client = getPublicClient(chainId)
  const registryAddress = REGISTRY_ADDRESSES[chainId]
  
  if (registryAddress === "0x0000000000000000000000000000000000000000") {
    return null
  }

  try {
    const result = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "isContractAudited",
      args: [contractAddress],
    }) as [boolean, bigint, string]

    return {
      audited: result[0],
      auditCount: Number(result[1]),
      latestAuditId: result[2],
    }
  } catch (error) {
    console.error("Error checking contract audited:", error)
    return null
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ON-CHAIN REGISTRATION
// ══════════════════════════════════════════════════════════════════════════════

export interface RegisterAuditParams {
  auditId: string
  reportHash: Hex
  codeHash: Hex
  auditedContract?: `0x${string}`
  score: number
  ipfsCid: string
}

/**
 * Register an audit on-chain (requires wallet connection)
 */
export async function registerAuditOnChain(
  params: RegisterAuditParams,
  chainId: SupportedChain = "sepolia"
): Promise<{ success: boolean; txHash?: Hex; error?: string }> {
  const registryAddress = REGISTRY_ADDRESSES[chainId]
  
  if (registryAddress === "0x0000000000000000000000000000000000000000") {
    return { success: false, error: `Registry not deployed on ${chainId}` }
  }

  try {
    const walletClient = await getWalletClient(chainId)
    const [account] = await walletClient.requestAddresses()
    
    if (!account) {
      return { success: false, error: "No account connected" }
    }

    // Encode function data
    const data = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "registerAudit",
      args: [
        params.auditId,
        params.reportHash,
        params.codeHash,
        params.auditedContract || "0x0000000000000000000000000000000000000000",
        params.score,
        params.ipfsCid,
      ],
    })

    // Send transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: registryAddress,
      data,
    })

    return { success: true, txHash }
  } catch (error) {
    console.error("Error registering audit on-chain:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Convert SHA-256 hex string to bytes32
 */
export function sha256ToBytes32(sha256Hex: string): Hex {
  // Remove 0x prefix if present
  const cleanHex = sha256Hex.startsWith("0x") ? sha256Hex.slice(2) : sha256Hex
  return `0x${cleanHex}` as Hex
}

/**
 * Hash contract code to bytes32
 */
export function hashContractCode(code: string): Hex {
  return keccak256(toBytes(code))
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerTxUrl(txHash: Hex, chainId: SupportedChain): string {
  const { explorer } = SUPPORTED_CHAINS[chainId]
  return `${explorer}/tx/${txHash}`
}

/**
 * Get explorer URL for contract
 */
export function getExplorerContractUrl(address: `0x${string}`, chainId: SupportedChain): string {
  const { explorer } = SUPPORTED_CHAINS[chainId]
  return `${explorer}/address/${address}`
}

/**
 * Get total audits count
 */
export async function getTotalAudits(chainId: SupportedChain = "sepolia"): Promise<number> {
  const client = getPublicClient(chainId)
  const registryAddress = REGISTRY_ADDRESSES[chainId]
  
  if (registryAddress === "0x0000000000000000000000000000000000000000") {
    return 0
  }

  try {
    const result = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "totalAudits",
    }) as bigint

    return Number(result)
  } catch {
    return 0
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-CHAIN VERIFICATION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verify an audit across all supported chains
 */
export async function verifyAuditAllChains(auditId: string): Promise<OnChainAuditRecord[]> {
  const results: OnChainAuditRecord[] = []
  
  for (const chainId of Object.keys(SUPPORTED_CHAINS) as SupportedChain[]) {
    const record = await verifyAuditById(auditId, chainId)
    if (record) {
      results.push(record)
    }
  }
  
  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// FIX 05: VERIFIED ON-CHAIN STATUS (instead of PENDING)
// ══════════════════════════════════════════════════════════════════════════════

// Extended ABI for the publishAudit registry format
// Note: abitype does not support named return values, so we use unnamed tuples
const REGISTRY_ABI_V2 = parseAbi([
  "function verifyReport(bytes32, bytes32) view returns (bool, (string, string, bytes32, address, uint256, uint8, uint8, uint8, string, bool))",
  "function getAllAudits() view returns (bytes32[])",
  "event AuditPublished(bytes32 indexed auditKey, string reportId, address contractAddr, bytes32 reportHash, uint256 timestamp)",
])

export interface VerifyAuditResult {
  status: "VERIFIED" | "HASH_MISMATCH" | "NOT_FOUND" | "PENDING" | "ERROR"
  record?: {
    projectName: string
    auditDate: Date
    score: number
    criticals: number
    highs: number
    ipfsCid: string
    txHash?: string
  }
  error?: string
}

/**
 * FIX 05: Verify audit on-chain using the deployed Solay39AuditRegistry contract.
 * 
 * Returns "VERIFIED" if the report hash matches on-chain,
 * "HASH_MISMATCH" if found but hash differs,
 * "NOT_FOUND" if audit not registered,
 * "PENDING" if registry not yet deployed,
 * "ERROR" if RPC call fails.
 */
export async function verifyAuditOnChain(
  auditKey: string,
  reportHash: string,
  network: "bsc" | "ethereum" | "arbitrum" = "bsc"
): Promise<VerifyAuditResult> {
  // Check if registry is deployed from env or use known address
  const REGISTRY_ADDRESS = 
    process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
    REGISTRY_ADDRESSES[network === "ethereum" ? "mainnet" : network]
  
  // If no registry deployed yet, return PENDING
  if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return { 
      status: "PENDING", 
      error: "Registry contract not deployed. Run scripts/deploy-registry.ts" 
    }
  }

  const RPC_URLS: Record<string, string> = {
    bsc: "https://bsc-dataseed.binance.org",
    ethereum: "https://cloudflare-eth.com",
    arbitrum: "https://arb1.arbitrum.io/rpc",
  }

  try {
    const chainKey = network === "ethereum" ? "mainnet" : network
    const client = getPublicClient(chainKey as SupportedChain)
    
    // Convert auditKey to bytes32
    const auditKeyHash = keccak256(toBytes(auditKey))
    const reportHashBytes = sha256ToBytes32(reportHash)
    
    const result = await client.readContract({
      address: REGISTRY_ADDRESS as `0x${string}`,
      abi: REGISTRY_ABI_V2,
      functionName: "verifyReport",
      args: [auditKeyHash, reportHashBytes],
    })
    
    // Type assertion for the tuple return
    const [valid, record] = result as [boolean, {
      reportId: string
      projectName: string
      reportHash: Hex
      contractAddr: `0x${string}`
      auditDate: bigint
      score: number
      criticalCount: number
      highCount: number
      ipfsCid: string
      isActive: boolean
    }]

    if (!record.isActive) {
      return { status: "NOT_FOUND" }
    }

    return {
      status: valid ? "VERIFIED" : "HASH_MISMATCH",
      record: {
        projectName: record.projectName,
        auditDate: new Date(Number(record.auditDate) * 1000),
        score: record.score,
        criticals: record.criticalCount,
        highs: record.highCount,
        ipfsCid: record.ipfsCid,
      },
    }
  } catch (err) {
    console.error("[verifyAuditOnChain] RPC error:", err)
    return {
      status: "ERROR",
      error: err instanceof Error ? err.message : "RPC call failed",
    }
  }
}

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
      isMetaMask?: boolean
    }
  }
}
