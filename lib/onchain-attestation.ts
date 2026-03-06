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
const REGISTRY_ABI = parseAbi([
  // Write functions
  "function registerAudit(string projectName, string reportHash, string codeReference, string ipfsCid, uint8 score) external returns (bytes32)",
  "function invalidateAudit(bytes32 auditId, string reason) external",
  
  // View functions
  "function verifyAudit(bytes32 auditId) external view returns (bool exists, bool valid, string projectName, string reportHash, string ipfsCid, uint8 score, uint256 timestamp)",
  "function verifyByHash(string reportHash) external view returns (bool exists, bytes32 auditId, bool valid, uint8 score, uint256 timestamp)",
  "function getAuditRecord(bytes32 auditId) external view returns (tuple(string projectName, string reportHash, string codeReference, string ipfsCid, uint8 score, address auditor, uint256 timestamp, bool valid))",
  "function getAllAuditIds() external view returns (bytes32[])",
  "function getValidAuditCount() external view returns (uint256)",
  "function totalAudits() external view returns (uint256)",
  "function owner() external view returns (address)",
  
  // Events
  "event AuditRegistered(bytes32 indexed auditId, string projectName, string reportHash, string ipfsCid, uint8 score, address auditor, uint256 timestamp)",
  "event AuditInvalidated(bytes32 indexed auditId, string reason)",
])

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
