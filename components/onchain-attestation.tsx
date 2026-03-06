"use client"

import { useState, useEffect } from "react"
import {
  SUPPORTED_CHAINS,
  REGISTRY_ADDRESSES,
  registerAuditOnChain,
  verifyAuditById,
  sha256ToBytes32,
  hashContractCode,
  getExplorerTxUrl,
  getExplorerContractUrl,
  type SupportedChain,
  type OnChainAuditRecord,
} from "@/lib/onchain-attestation"
import type { Hex } from "viem"

interface OnChainAttestationProps {
  auditId: string
  reportHash: string // SHA-256 of report
  score: number
  ipfsCid?: string
  contractCode?: string
  auditedContractAddress?: string
  onAttestationComplete?: (record: OnChainAuditRecord) => void
}

export function OnChainAttestation({
  auditId,
  reportHash,
  score,
  ipfsCid,
  contractCode,
  auditedContractAddress,
  onAttestationComplete,
}: OnChainAttestationProps) {
  const [selectedChain, setSelectedChain] = useState<SupportedChain>("bsc")
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingRecord, setExistingRecord] = useState<OnChainAuditRecord | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Check if wallet is connected
  useEffect(() => {
    async function checkConnection() {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[]
          if (accounts.length > 0) {
            setIsConnected(true)
            setAccount(accounts[0])
          }
        } catch (err) {
          console.error("Error checking wallet connection:", err)
        }
      }
    }
    checkConnection()
  }, [])

  // Check if audit already exists on-chain
  useEffect(() => {
    async function checkExisting() {
      setIsVerifying(true)
      const record = await verifyAuditById(auditId, selectedChain)
      setExistingRecord(record)
      setIsVerifying(false)
    }
    checkExisting()
  }, [auditId, selectedChain])

  // Connect wallet
  async function connectWallet() {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No wallet detected. Please install MetaMask.")
      return
    }

    try {
      const accounts = await window.ethereum.request({ 
        method: "eth_requestAccounts" 
      }) as string[]
      
      if (accounts.length > 0) {
        setIsConnected(true)
        setAccount(accounts[0])
        setError(null)
      }
    } catch (err) {
      setError("Failed to connect wallet")
      console.error(err)
    }
  }

  // Register audit on-chain
  async function handleRegister() {
    if (!isConnected) {
      setError("Please connect your wallet first")
      return
    }

    setIsRegistering(true)
    setError(null)

    try {
      const result = await registerAuditOnChain({
        auditId,
        reportHash: sha256ToBytes32(reportHash),
        codeHash: contractCode ? hashContractCode(contractCode) : sha256ToBytes32("0".repeat(64)),
        auditedContract: auditedContractAddress as `0x${string}` | undefined,
        score,
        ipfsCid: ipfsCid || "",
      }, selectedChain)

      if (result.success && result.txHash) {
        setTxHash(result.txHash)
        
        // Wait for confirmation and fetch record
        setTimeout(async () => {
          const record = await verifyAuditById(auditId, selectedChain)
          if (record) {
            record.txHash = result.txHash
            setExistingRecord(record)
            onAttestationComplete?.(record)
          }
        }, 5000)
      } else {
        setError(result.error || "Failed to register audit")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsRegistering(false)
    }
  }

  const registryAddress = REGISTRY_ADDRESSES[selectedChain]
  const isDeployed = registryAddress !== "0x0000000000000000000000000000000000000000"

  return (
    <div className="border border-amber-900/40 rounded-xl overflow-hidden bg-s39-bg1">
      {/* Header */}
      <div className="p-5 sm:p-6 bg-amber-950/10 border-b border-amber-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[10px] tracking-[0.12em] text-amber-400 font-bold">ON-CHAIN ATTESTATION</span>
          </div>
          {existingRecord && (
            <span className="text-[8px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded font-mono flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              VERIFIED ON-CHAIN
            </span>
          )}
        </div>
        <div className="text-[8px] text-s39-mid leading-relaxed">
          Register this audit immutably on the blockchain. Anyone can verify the audit authenticity using the on-chain registry.
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Chain Selector - BSC and Arbitrum primary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(["bsc", "arbitrum", "bscTestnet"] as SupportedChain[]).map((chainId) => {
            const chainInfo = SUPPORTED_CHAINS[chainId]
            const addr = REGISTRY_ADDRESSES[chainId]
            const deployed = addr !== "0x0000000000000000000000000000000000000000"
            const isPrimary = chainId === "bsc" || chainId === "arbitrum"
            
            return (
              <button
                key={chainId}
                onClick={() => setSelectedChain(chainId)}
                className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                  selectedChain === chainId
                    ? "border-amber-600 bg-amber-950/20"
                    : "border-s39-border bg-s39-bg0 hover:border-amber-800/40"
                } ${isPrimary ? "ring-1 ring-amber-900/30" : ""}`}
              >
                <div className="text-[9px] text-s39-white font-bold flex items-center gap-1">
                  {chainInfo.name}
                  {isPrimary && <span className="text-[6px] text-amber-400 bg-amber-950/40 px-1 rounded">PRIMARY</span>}
                </div>
                <div className={`text-[7px] font-mono ${deployed ? "text-emerald-400" : "text-yellow-400"}`}>
                  {deployed ? "Ready" : "Deploy via Remix"}
                </div>
              </button>
            )
          })}
        </div>

        {/* Registry Contract Info */}
        <div className="bg-s39-bg0 border border-s39-border p-4 rounded">
          <div className="text-[7px] text-s39-dim tracking-widest mb-2">REGISTRY CONTRACT</div>
          {isDeployed ? (
            <a
              href={getExplorerContractUrl(registryAddress, selectedChain)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-amber-400 font-mono hover:text-amber-300 transition-colors break-all"
            >
              {registryAddress}
            </a>
          ) : (
            <div className="space-y-2">
              <div className="text-[9px] text-yellow-400 font-mono flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Contract not yet deployed on {SUPPORTED_CHAINS[selectedChain].name}
              </div>
              <details className="text-[8px] text-s39-dim">
                <summary className="cursor-pointer text-amber-400 hover:text-amber-300">Deploy via Remix IDE</summary>
                <ol className="mt-2 space-y-1 list-decimal list-inside">
                  <li>Open <a href="https://remix.ethereum.org" target="_blank" className="text-cyan-400 hover:underline">remix.ethereum.org</a></li>
                  <li>Create file: Solay39AuditRegistry.sol</li>
                  <li>Copy contract from /contracts/Solay39AuditRegistry.sol</li>
                  <li>Compile with Solidity 0.8.20</li>
                  <li>Deploy tab - Injected Provider (MetaMask)</li>
                  <li>Select {SUPPORTED_CHAINS[selectedChain].name} network</li>
                  <li>Click Deploy</li>
                  <li>Save deployed address</li>
                </ol>
              </details>
            </div>
          )}
        </div>

        {/* Existing Record */}
        {isVerifying ? (
          <div className="bg-s39-bg0 border border-s39-border p-4 rounded flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-s39-mid">Checking on-chain status...</span>
          </div>
        ) : existingRecord ? (
          <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded space-y-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5"/>
              </svg>
              <span className="text-[10px] text-emerald-400 font-bold">AUDIT REGISTERED ON-CHAIN</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[7px] text-s39-dim">Audit ID</div>
                <div className="text-[9px] text-emerald-300 font-mono">{existingRecord.auditId}</div>
              </div>
              <div>
                <div className="text-[7px] text-s39-dim">Score</div>
                <div className="text-[9px] text-emerald-300 font-mono">{existingRecord.score}/100</div>
              </div>
              <div>
                <div className="text-[7px] text-s39-dim">Auditor</div>
                <div className="text-[9px] text-emerald-300 font-mono truncate">{existingRecord.auditor}</div>
              </div>
              <div>
                <div className="text-[7px] text-s39-dim">Timestamp</div>
                <div className="text-[9px] text-emerald-300 font-mono">
                  {new Date(existingRecord.timestamp * 1000).toLocaleString()}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[7px] text-s39-dim mb-1">Report Hash (on-chain)</div>
              <div className="text-[8px] text-emerald-300 font-mono break-all bg-s39-bg0 p-2 rounded">
                {existingRecord.reportHash}
              </div>
            </div>

            {existingRecord.txHash && (
              <a
                href={getExplorerTxUrl(existingRecord.txHash, selectedChain)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
              >
                View Transaction
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M3 9l6-6M4 3h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            )}
          </div>
        ) : isDeployed ? (
          <>
            {/* Audit Details */}
            <div className="bg-s39-bg0 border border-s39-border p-4 rounded space-y-2">
              <div className="text-[7px] text-s39-dim tracking-widest mb-2">ATTESTATION DATA</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[7px] text-s39-dim">Audit ID</div>
                  <div className="text-[9px] text-s39-white font-mono">{auditId}</div>
                </div>
                <div>
                  <div className="text-[7px] text-s39-dim">Score</div>
                  <div className="text-[9px] text-s39-white font-mono">{score}/100</div>
                </div>
              </div>

              <div>
                <div className="text-[7px] text-s39-dim">Report Hash (SHA-256)</div>
                <div className="text-[8px] text-amber-300 font-mono break-all">{reportHash}</div>
              </div>

              {ipfsCid && (
                <div>
                  <div className="text-[7px] text-s39-dim">IPFS CID</div>
                  <div className="text-[8px] text-cyan-300 font-mono">{ipfsCid}</div>
                </div>
              )}

              {auditedContractAddress && (
                <div>
                  <div className="text-[7px] text-s39-dim">Audited Contract</div>
                  <div className="text-[8px] text-s39-cyan font-mono">{auditedContractAddress}</div>
                </div>
              )}
            </div>

            {/* Wallet Connection */}
            {!isConnected ? (
              <button
                onClick={connectWallet}
                className="w-full p-4 rounded bg-amber-600 hover:bg-amber-500 transition-colors text-s39-bg0 font-bold text-[11px] tracking-wide cursor-pointer flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16 12.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="currentColor"/>
                  <path d="M6 6V4a2 2 0 012-2h8a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2"/>
                </svg>
                CONNECT WALLET
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-s39-bg0 border border-emerald-900/30 p-3 rounded flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] text-emerald-400">Connected: </span>
                  <span className="text-[9px] text-s39-white font-mono truncate">{account}</span>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className={`w-full p-4 rounded font-bold text-[11px] tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isRegistering
                      ? "bg-amber-800 text-amber-200 cursor-wait"
                      : "bg-amber-600 hover:bg-amber-500 text-s39-bg0"
                  }`}
                >
                  {isRegistering ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      REGISTERING ON-CHAIN...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      REGISTER ON-CHAIN
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Transaction Hash */}
            {txHash && !existingRecord && (
              <div className="bg-amber-950/20 border border-amber-900/30 p-4 rounded">
                <div className="text-[8px] text-amber-400 mb-2">Transaction submitted!</div>
                <a
                  href={getExplorerTxUrl(txHash, selectedChain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-amber-300 font-mono hover:text-amber-200 transition-colors break-all"
                >
                  {txHash}
                </a>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-950/20 border border-red-900/30 p-4 rounded">
                <div className="text-[9px] text-red-400">{error}</div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-3 bg-s39-bg2 border-t border-s39-border">
        <div className="text-[7px] text-s39-dim font-mono flex items-center gap-4 flex-wrap">
          <span>Contract: AuditRegistry.sol</span>
          <span>|</span>
          <span>Immutable attestation</span>
          <span>|</span>
          <span>Anyone can verify</span>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICATION BADGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface OnChainBadgeProps {
  auditId: string
  chainId?: SupportedChain
  compact?: boolean
}

export function OnChainVerificationBadge({ auditId, chainId = "sepolia", compact = false }: OnChainBadgeProps) {
  const [record, setRecord] = useState<OnChainAuditRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function check() {
      setIsLoading(true)
      const r = await verifyAuditById(auditId, chainId)
      setRecord(r)
      setIsLoading(false)
    }
    check()
  }, [auditId, chainId])

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-s39-bg2 border border-s39-border">
        <div className="w-3 h-3 border border-s39-mid border-t-transparent rounded-full animate-spin" />
        <span className="text-[8px] text-s39-dim">Checking...</span>
      </div>
    )
  }

  if (!record) {
    return compact ? null : (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-s39-bg2 border border-s39-border">
        <span className="text-[8px] text-s39-dim">Not registered on-chain</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/30 border border-emerald-900/40">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-[8px] text-emerald-400 font-bold">ON-CHAIN VERIFIED</span>
      {!compact && (
        <span className="text-[7px] text-emerald-400/70 font-mono">{SUPPORTED_CHAINS[chainId].name}</span>
      )}
    </div>
  )
}
