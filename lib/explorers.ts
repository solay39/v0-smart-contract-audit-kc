// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Multi-Chain Block Explorer Utilities
// ═══════════════════════════════════════════════════════════════════

export interface ExplorerInfo {
  name: string
  url: string
  addressUrl: (addr: string) => string
  txUrl: (tx: string) => string
}

const EXPLORERS: Record<string, ExplorerInfo> = {
  Ethereum:    { name: "Etherscan",   url: "https://etherscan.io",                  addressUrl: (a) => `https://etherscan.io/address/${a}#code`,            txUrl: (t) => `https://etherscan.io/tx/${t}` },
  BSC:         { name: "BscScan",     url: "https://bscscan.com",                   addressUrl: (a) => `https://bscscan.com/address/${a}#code`,             txUrl: (t) => `https://bscscan.com/tx/${t}` },
  "BNB Chain": { name: "BscScan",     url: "https://bscscan.com",                   addressUrl: (a) => `https://bscscan.com/address/${a}#code`,             txUrl: (t) => `https://bscscan.com/tx/${t}` },
  Arbitrum:    { name: "Arbiscan",    url: "https://arbiscan.io",                   addressUrl: (a) => `https://arbiscan.io/address/${a}#code`,             txUrl: (t) => `https://arbiscan.io/tx/${t}` },
  Optimism:    { name: "OP Etherscan",url: "https://optimistic.etherscan.io",       addressUrl: (a) => `https://optimistic.etherscan.io/address/${a}#code`, txUrl: (t) => `https://optimistic.etherscan.io/tx/${t}` },
  Polygon:     { name: "PolygonScan", url: "https://polygonscan.com",               addressUrl: (a) => `https://polygonscan.com/address/${a}#code`,         txUrl: (t) => `https://polygonscan.com/tx/${t}` },
  Avalanche:   { name: "Snowscan",   url: "https://snowscan.xyz",                  addressUrl: (a) => `https://snowscan.xyz/address/${a}#code`,            txUrl: (t) => `https://snowscan.xyz/tx/${t}` },
  Base:        { name: "BaseScan",    url: "https://basescan.org",                  addressUrl: (a) => `https://basescan.org/address/${a}#code`,            txUrl: (t) => `https://basescan.org/tx/${t}` },
  Fantom:      { name: "FTMScan",     url: "https://ftmscan.com",                   addressUrl: (a) => `https://ftmscan.com/address/${a}#code`,             txUrl: (t) => `https://ftmscan.com/tx/${t}` },
  Cronos:      { name: "CronosScan",  url: "https://cronoscan.com",                addressUrl: (a) => `https://cronoscan.com/address/${a}#code`,           txUrl: (t) => `https://cronoscan.com/tx/${t}` },
  Gnosis:      { name: "GnosisScan",  url: "https://gnosisscan.io",                addressUrl: (a) => `https://gnosisscan.io/address/${a}#code`,           txUrl: (t) => `https://gnosisscan.io/tx/${t}` },
  Linea:       { name: "LineaScan",   url: "https://lineascan.build",               addressUrl: (a) => `https://lineascan.build/address/${a}#code`,         txUrl: (t) => `https://lineascan.build/tx/${t}` },
  Scroll:      { name: "ScrollScan",  url: "https://scrollscan.com",               addressUrl: (a) => `https://scrollscan.com/address/${a}#code`,          txUrl: (t) => `https://scrollscan.com/tx/${t}` },
  Blast:       { name: "BlastScan",   url: "https://blastscan.io",                 addressUrl: (a) => `https://blastscan.io/address/${a}#code`,             txUrl: (t) => `https://blastscan.io/tx/${t}` },
  zkSync:      { name: "zkSync Era",  url: "https://era.zksync.network",           addressUrl: (a) => `https://era.zksync.network/address/${a}#code`,       txUrl: (t) => `https://era.zksync.network/tx/${t}` },
  Moonbeam:    { name: "Moonscan",    url: "https://moonscan.io",                  addressUrl: (a) => `https://moonscan.io/address/${a}`,                   txUrl: (t) => `https://moonscan.io/tx/${t}` },
  Celo:        { name: "CeloScan",    url: "https://celoscan.io",                  addressUrl: (a) => `https://celoscan.io/address/${a}#code`,              txUrl: (t) => `https://celoscan.io/tx/${t}` },
  Mantle:      { name: "MantleScan",  url: "https://mantlescan.xyz",               addressUrl: (a) => `https://mantlescan.xyz/address/${a}#code`,           txUrl: (t) => `https://mantlescan.xyz/tx/${t}` },
  Solana:      { name: "Solscan",     url: "https://solscan.io",                   addressUrl: (a) => `https://solscan.io/account/${a}`,                    txUrl: (t) => `https://solscan.io/tx/${t}` },
  Sui:         { name: "SuiScan",     url: "https://suiscan.xyz",                  addressUrl: (a) => `https://suiscan.xyz/mainnet/account/${a}`,           txUrl: (t) => `https://suiscan.xyz/mainnet/tx/${t}` },
  Aptos:       { name: "Aptos Explorer", url: "https://explorer.aptoslabs.com",    addressUrl: (a) => `https://explorer.aptoslabs.com/account/${a}`,        txUrl: (t) => `https://explorer.aptoslabs.com/txn/${t}` },
  Tron:        { name: "TronScan",    url: "https://tronscan.org",                 addressUrl: (a) => `https://tronscan.org/#/contract/${a}`,               txUrl: (t) => `https://tronscan.org/#/transaction/${t}` },
  Near:        { name: "NearBlocks",  url: "https://nearblocks.io",                addressUrl: (a) => `https://nearblocks.io/address/${a}`,                 txUrl: (t) => `https://nearblocks.io/txns/${t}` },
  Injective:   { name: "Injective Explorer", url: "https://explorer.injective.network", addressUrl: (a) => `https://explorer.injective.network/contract/${a}`, txUrl: (t) => `https://explorer.injective.network/transaction/${t}` },
  Sei:         { name: "SeiScan",     url: "https://www.seiscan.app",              addressUrl: (a) => `https://www.seiscan.app/pacific-1/contracts/${a}`,   txUrl: (t) => `https://www.seiscan.app/pacific-1/txs/${t}` },
  Ton:         { name: "TonViewer",   url: "https://tonviewer.com",                addressUrl: (a) => `https://tonviewer.com/${a}`,                         txUrl: (t) => `https://tonviewer.com/transaction/${t}` },
  Starknet:    { name: "Starkscan",   url: "https://starkscan.co",                 addressUrl: (a) => `https://starkscan.co/contract/${a}`,                 txUrl: (t) => `https://starkscan.co/tx/${t}` },
}

const DEFAULT_EXPLORER: ExplorerInfo = {
  name: "Explorer",
  url: "",
  addressUrl: (a) => `https://etherscan.io/address/${a}`,
  txUrl: (t) => `https://etherscan.io/tx/${t}`,
}

export function getExplorer(network: string): ExplorerInfo {
  return EXPLORERS[network] || DEFAULT_EXPLORER
}

/** Returns true if the address looks valid for the given network */
export function isValidAddress(address: string, network: string): boolean {
  const trimmed = address.trim()
  if (!trimmed) return false

  // Solana: base58, 32-44 chars
  if (network === "Solana") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)
  }
  // Tron: starts with T, 34 chars
  if (network === "Tron") {
    return /^T[a-zA-Z0-9]{33}$/.test(trimmed)
  }
  // Cosmos/Injective/Sei: bech32
  if (["Cosmos", "Injective", "Sei"].includes(network)) {
    return /^[a-z]{2,10}1[a-z0-9]{38,58}$/.test(trimmed)
  }
  // Near: account names or hex
  if (network === "Near") {
    return /^[a-z0-9._-]{2,64}$/.test(trimmed) || /^[0-9a-f]{64}$/.test(trimmed)
  }
  // Ton: raw or user-friendly
  if (network === "Ton") {
    return trimmed.length >= 10
  }
  // Aptos/Sui: 0x + 64 hex chars
  if (["Aptos", "Sui"].includes(network)) {
    return /^0x[a-fA-F0-9]{1,64}$/.test(trimmed)
  }
  // Starknet: 0x + up to 64 hex
  if (network === "Starknet") {
    return /^0x[a-fA-F0-9]{1,64}$/.test(trimmed)
  }
  // Default EVM: 0x + 40 hex chars
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed)
}

/** Human-readable chain language */
export function chainLanguage(network: string): string {
  if (network === "Solana") return "Rust / Anchor"
  if (["Sui", "Aptos"].includes(network)) return "Move"
  if (["Cosmos", "Injective", "Sei"].includes(network)) return "CosmWasm (Rust)"
  if (network === "Near") return "Rust / AssemblyScript"
  if (network === "Ton") return "FunC / Tact"
  if (network === "Starknet") return "Cairo"
  if (network === "Tron") return "Solidity"
  return "Solidity"
}
