/**
 * SOLAY39 Multi-Chain Registry
 * 
 * Enterprise-grade support for 25+ blockchain networks.
 * Each chain includes compiler info, vulnerability patterns, explorer APIs, and RPC endpoints.
 * 
 * Supports: EVM chains, Solana, Move-based (Sui/Aptos), CosmWasm, ink!, TON, and more.
 */

export type ChainCategory = 'EVM' | 'SOLANA' | 'MOVE' | 'COSMWASM' | 'INK' | 'TON' | 'OTHER'

export interface ChainConfig {
  id: string
  name: string
  symbol: string
  category: ChainCategory
  chainId?: number // For EVM chains
  
  // Compiler info
  language: string
  compilerVersions: string[]
  frameworks: string[]
  
  // Network info
  mainnetRPC: string
  testnetRPC?: string
  explorerUrl: string
  explorerApiUrl?: string
  
  // Security features
  nativeMultisig?: string
  hasTimelock?: boolean
  upgradePattern?: string
  
  // Specific vulnerability patterns for this chain
  specificPatterns: ChainSpecificPattern[]
  
  // Known audit stats
  totalAudited?: number
  totalTVL?: string
  majorExploits?: { name: string; date: string; loss: string }[]
  
  // Documentation
  docsUrl: string
  securityGuideUrl?: string
}

export interface ChainSpecificPattern {
  id: string
  name: string
  pattern: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  description: string
  remediation: string
  chainSpecific: true
}

// ============================================================================
// EVM CHAINS (15 chains)
// ============================================================================

const EVM_CHAINS: ChainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 1,
    language: 'Solidity',
    compilerVersions: ['0.4.x', '0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry', 'Truffle', 'Brownie'],
    mainnetRPC: 'https://eth.llamarpc.com',
    testnetRPC: 'https://rpc.sepolia.org',
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    nativeMultisig: 'Safe (Gnosis)',
    hasTimelock: true,
    upgradePattern: 'UUPS/Transparent Proxy',
    specificPatterns: [
      {
        id: 'ETH-001',
        name: 'EIP-1559 Fee Manipulation',
        pattern: 'baseFee|maxFeePerGas|maxPriorityFeePerGas',
        severity: 'MEDIUM',
        description: 'Incorrect handling of EIP-1559 fee parameters',
        remediation: 'Use block.basefee and proper fee calculations',
        chainSpecific: true
      },
      {
        id: 'ETH-002',
        name: 'Shanghai Upgrade: PUSH0 Compatibility',
        pattern: 'pragma solidity.*0\\.8\\.(1[0-9]|[0-9])[^0-9]',
        severity: 'LOW',
        description: 'Contract may not be compatible with PUSH0 opcode on older chains',
        remediation: 'Use Solidity >= 0.8.20 for Shanghai compatibility or specify EVM version',
        chainSpecific: true
      }
    ],
    totalAudited: 5000,
    totalTVL: '$50B+',
    majorExploits: [
      { name: 'The DAO', date: '2016-06', loss: '$60M' },
      { name: 'Parity Wallet', date: '2017-07', loss: '$31M' },
      { name: 'Euler Finance', date: '2023-03', loss: '$197M' }
    ],
    docsUrl: 'https://ethereum.org/developers/docs',
    securityGuideUrl: 'https://consensys.github.io/smart-contract-best-practices/'
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    category: 'EVM',
    chainId: 56,
    language: 'Solidity',
    compilerVersions: ['0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry', 'Truffle'],
    mainnetRPC: 'https://bsc-dataseed.binance.org',
    testnetRPC: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://bscscan.com',
    explorerApiUrl: 'https://api.bscscan.com/api',
    specificPatterns: [
      {
        id: 'BSC-001',
        name: 'BEP-20 Deflationary Token Issue',
        pattern: 'reflectionFromToken|tokenFromReflection|_rTotal',
        severity: 'MEDIUM',
        description: 'Reflection token mechanics can cause issues with DEX integrations',
        remediation: 'Ensure compatibility with AMM contracts, test with actual swaps',
        chainSpecific: true
      }
    ],
    totalAudited: 3000,
    totalTVL: '$5B+',
    majorExploits: [
      { name: 'Pancake Bunny', date: '2021-05', loss: '$45M' },
      { name: 'Venus Protocol', date: '2021-05', loss: '$200M' }
    ],
    docsUrl: 'https://docs.bnbchain.org',
    securityGuideUrl: 'https://docs.bnbchain.org/docs/security'
  },
  {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    category: 'EVM',
    chainId: 137,
    language: 'Solidity',
    compilerVersions: ['0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry', 'Truffle'],
    mainnetRPC: 'https://polygon-rpc.com',
    testnetRPC: 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://polygonscan.com',
    explorerApiUrl: 'https://api.polygonscan.com/api',
    specificPatterns: [
      {
        id: 'POLY-001',
        name: 'Polygon Bridge Specific',
        pattern: 'RootChainManager|ChildChainManager|FxRoot|FxChild',
        severity: 'HIGH',
        description: 'Custom bridge contracts need special attention',
        remediation: 'Follow official Polygon bridge documentation for state sync',
        chainSpecific: true
      }
    ],
    totalAudited: 2500,
    totalTVL: '$1B+',
    docsUrl: 'https://docs.polygon.technology',
    securityGuideUrl: 'https://docs.polygon.technology/docs/develop/security-best-practices'
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    symbol: 'ARB',
    category: 'EVM',
    chainId: 42161,
    language: 'Solidity',
    compilerVersions: ['0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://arb1.arbitrum.io/rpc',
    testnetRPC: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    explorerApiUrl: 'https://api.arbiscan.io/api',
    specificPatterns: [
      {
        id: 'ARB-001',
        name: 'Arbitrum Sequencer Dependency',
        pattern: 'block\\.timestamp|block\\.number',
        severity: 'MEDIUM',
        description: 'Sequencer delays can affect time-sensitive operations',
        remediation: 'Account for potential sequencer downtime in time-critical functions',
        chainSpecific: true
      },
      {
        id: 'ARB-002',
        name: 'L1 Block Number Usage',
        pattern: 'ArbSys|arbBlockNumber',
        severity: 'LOW',
        description: 'Mixing L1 and L2 block numbers can cause issues',
        remediation: 'Use consistent block number source (L1 or L2)',
        chainSpecific: true
      }
    ],
    totalAudited: 1500,
    totalTVL: '$2B+',
    docsUrl: 'https://docs.arbitrum.io',
    securityGuideUrl: 'https://docs.arbitrum.io/for-devs/concepts/differences-between-arbitrum-ethereum'
  },
  {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'OP',
    category: 'EVM',
    chainId: 10,
    language: 'Solidity',
    compilerVersions: ['0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://mainnet.optimism.io',
    testnetRPC: 'https://sepolia.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    explorerApiUrl: 'https://api-optimistic.etherscan.io/api',
    specificPatterns: [
      {
        id: 'OP-001',
        name: 'Optimism Custom Gas Token',
        pattern: 'gasPriceOracle|l1BaseFee',
        severity: 'LOW',
        description: 'Custom gas calculations for L2',
        remediation: 'Use Optimism gas oracle for accurate gas estimates',
        chainSpecific: true
      }
    ],
    totalAudited: 1200,
    totalTVL: '$700M+',
    majorExploits: [
      { name: 'Wintermute', date: '2022-09', loss: '$160M' }
    ],
    docsUrl: 'https://docs.optimism.io',
    securityGuideUrl: 'https://docs.optimism.io/chain/differences'
  },
  {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    symbol: 'AVAX',
    category: 'EVM',
    chainId: 43114,
    language: 'Solidity',
    compilerVersions: ['0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry', 'Truffle'],
    mainnetRPC: 'https://api.avax.network/ext/bc/C/rpc',
    testnetRPC: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    explorerApiUrl: 'https://api.snowtrace.io/api',
    specificPatterns: [
      {
        id: 'AVAX-001',
        name: 'Avalanche Subnet Bridging',
        pattern: 'IWarp|teleporter|bridge.*subnet',
        severity: 'HIGH',
        description: 'Cross-subnet communication needs careful validation',
        remediation: 'Validate all subnet bridge messages thoroughly',
        chainSpecific: true
      }
    ],
    totalAudited: 800,
    totalTVL: '$500M+',
    docsUrl: 'https://docs.avax.network',
    securityGuideUrl: 'https://docs.avax.network/build/dapp/smart-contracts/security'
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 8453,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://mainnet.base.org',
    testnetRPC: 'https://sepolia.base.org',
    explorerUrl: 'https://basescan.org',
    explorerApiUrl: 'https://api.basescan.org/api',
    specificPatterns: [],
    totalAudited: 500,
    totalTVL: '$1B+',
    docsUrl: 'https://docs.base.org',
    securityGuideUrl: 'https://docs.base.org/differences/'
  },
  {
    id: 'zksync',
    name: 'zkSync Era',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 324,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat (zkSync plugin)', 'Foundry (limited)'],
    mainnetRPC: 'https://mainnet.era.zksync.io',
    testnetRPC: 'https://sepolia.era.zksync.dev',
    explorerUrl: 'https://explorer.zksync.io',
    explorerApiUrl: 'https://block-explorer-api.mainnet.zksync.io/api',
    specificPatterns: [
      {
        id: 'ZK-001',
        name: 'zkSync Precompile Differences',
        pattern: 'ecrecover|sha256|ripemd160|modexp|ecAdd|ecMul',
        severity: 'HIGH',
        description: 'Some precompiles behave differently on zkSync',
        remediation: 'Test all precompile usage on zkSync specifically',
        chainSpecific: true
      },
      {
        id: 'ZK-002',
        name: 'zkSync Native Account Abstraction',
        pattern: 'IAccount|validateTransaction|payForTransaction',
        severity: 'MEDIUM',
        description: 'Custom account contracts need special attention',
        remediation: 'Follow zkSync account abstraction guidelines',
        chainSpecific: true
      }
    ],
    totalAudited: 300,
    totalTVL: '$500M+',
    majorExploits: [
      { name: 'EraLend', date: '2023-07', loss: '$3.4M' }
    ],
    docsUrl: 'https://docs.zksync.io',
    securityGuideUrl: 'https://docs.zksync.io/build/developer-reference/differences-with-ethereum'
  },
  {
    id: 'linea',
    name: 'Linea',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 59144,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://rpc.linea.build',
    testnetRPC: 'https://rpc.sepolia.linea.build',
    explorerUrl: 'https://lineascan.build',
    specificPatterns: [],
    totalAudited: 200,
    totalTVL: '$200M+',
    docsUrl: 'https://docs.linea.build'
  },
  {
    id: 'scroll',
    name: 'Scroll',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 534352,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://rpc.scroll.io',
    testnetRPC: 'https://sepolia-rpc.scroll.io',
    explorerUrl: 'https://scrollscan.com',
    specificPatterns: [],
    totalAudited: 150,
    totalTVL: '$100M+',
    docsUrl: 'https://docs.scroll.io'
  },
  {
    id: 'mantle',
    name: 'Mantle',
    symbol: 'MNT',
    category: 'EVM',
    chainId: 5000,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://rpc.mantle.xyz',
    testnetRPC: 'https://rpc.sepolia.mantle.xyz',
    explorerUrl: 'https://explorer.mantle.xyz',
    specificPatterns: [],
    totalAudited: 100,
    totalTVL: '$200M+',
    docsUrl: 'https://docs.mantle.xyz'
  },
  {
    id: 'blast',
    name: 'Blast',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 81457,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://rpc.blast.io',
    testnetRPC: 'https://sepolia.blast.io',
    explorerUrl: 'https://blastscan.io',
    specificPatterns: [
      {
        id: 'BLAST-001',
        name: 'Blast Native Yield',
        pattern: 'YIELD|IBlast|configureClaimableYield|claimYield',
        severity: 'MEDIUM',
        description: 'Blast has native yield that contracts must handle',
        remediation: 'Configure yield mode and handle native yield properly',
        chainSpecific: true
      }
    ],
    totalAudited: 200,
    totalTVL: '$1B+',
    docsUrl: 'https://docs.blast.io'
  },
  {
    id: 'fantom',
    name: 'Fantom',
    symbol: 'FTM',
    category: 'EVM',
    chainId: 250,
    language: 'Solidity',
    compilerVersions: ['0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Foundry', 'Truffle'],
    mainnetRPC: 'https://rpc.ftm.tools',
    testnetRPC: 'https://rpc.testnet.fantom.network',
    explorerUrl: 'https://ftmscan.com',
    explorerApiUrl: 'https://api.ftmscan.com/api',
    specificPatterns: [],
    totalAudited: 500,
    totalTVL: '$100M+',
    docsUrl: 'https://docs.fantom.foundation'
  },
  {
    id: 'cronos',
    name: 'Cronos',
    symbol: 'CRO',
    category: 'EVM',
    chainId: 25,
    language: 'Solidity',
    compilerVersions: ['0.5.x', '0.6.x', '0.7.x', '0.8.x'],
    frameworks: ['Hardhat', 'Truffle'],
    mainnetRPC: 'https://evm.cronos.org',
    explorerUrl: 'https://cronoscan.com',
    specificPatterns: [],
    totalAudited: 200,
    totalTVL: '$100M+',
    docsUrl: 'https://docs.cronos.org'
  },
  {
    id: 'mode',
    name: 'Mode',
    symbol: 'ETH',
    category: 'EVM',
    chainId: 34443,
    language: 'Solidity',
    compilerVersions: ['0.8.x'],
    frameworks: ['Hardhat', 'Foundry'],
    mainnetRPC: 'https://mainnet.mode.network',
    explorerUrl: 'https://explorer.mode.network',
    specificPatterns: [],
    totalAudited: 50,
    totalTVL: '$100M+',
    docsUrl: 'https://docs.mode.network'
  }
]

// ============================================================================
// NON-EVM CHAINS (10 chains)
// ============================================================================

const NON_EVM_CHAINS: ChainConfig[] = [
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    category: 'SOLANA',
    language: 'Rust',
    compilerVersions: ['1.60+'],
    frameworks: ['Anchor', 'Native Solana Programs'],
    mainnetRPC: 'https://api.mainnet-beta.solana.com',
    testnetRPC: 'https://api.devnet.solana.com',
    explorerUrl: 'https://solscan.io',
    specificPatterns: [
      {
        id: 'SOL-001',
        name: 'Missing Signer Check',
        pattern: 'AccountInfo(?!.*is_signer)|Signer<|has_one|constraint.*signer',
        severity: 'CRITICAL',
        description: 'Account not verified as signer allows unauthorized access',
        remediation: 'Add is_signer check or use Anchor Signer type',
        chainSpecific: true
      },
      {
        id: 'SOL-002',
        name: 'Missing Owner Check',
        pattern: 'AccountInfo(?!.*owner)|Account<|constraint.*owner',
        severity: 'CRITICAL',
        description: 'Account owner not verified allows program substitution',
        remediation: 'Verify account owner matches expected program ID',
        chainSpecific: true
      },
      {
        id: 'SOL-003',
        name: 'PDA Seed Manipulation',
        pattern: 'find_program_address|create_program_address|seeds\\s*=',
        severity: 'HIGH',
        description: 'Improper PDA seed handling can lead to account confusion',
        remediation: 'Use unique seeds and bump, verify PDA derivation',
        chainSpecific: true
      },
      {
        id: 'SOL-004',
        name: 'Type Cosplay (Account Confusion)',
        pattern: 'try_from_slice|deserialize(?!.*discriminator)|borsh::BorshDeserialize',
        severity: 'HIGH',
        description: 'Missing discriminator allows passing wrong account type',
        remediation: 'Use Anchor account discriminators or manual type checks',
        chainSpecific: true
      },
      {
        id: 'SOL-005',
        name: 'Closing Account Without Zero Balance',
        pattern: 'close_account|lamports.*=.*0|close\\s*=',
        severity: 'MEDIUM',
        description: 'Closing account without zeroing data allows revival attacks',
        remediation: 'Zero out account data and transfer all lamports when closing',
        chainSpecific: true
      }
    ],
    totalAudited: 2000,
    totalTVL: '$2B+',
    majorExploits: [
      { name: 'Wormhole', date: '2022-02', loss: '$326M' },
      { name: 'Mango Markets', date: '2022-10', loss: '$114M' },
      { name: 'Cashio', date: '2022-03', loss: '$52M' }
    ],
    docsUrl: 'https://solana.com/docs',
    securityGuideUrl: 'https://github.com/coral-xyz/sealevel-attacks'
  },
  {
    id: 'sui',
    name: 'Sui',
    symbol: 'SUI',
    category: 'MOVE',
    language: 'Move',
    compilerVersions: ['1.0+'],
    frameworks: ['Sui Move'],
    mainnetRPC: 'https://fullnode.mainnet.sui.io',
    testnetRPC: 'https://fullnode.testnet.sui.io',
    explorerUrl: 'https://suiscan.xyz',
    specificPatterns: [
      {
        id: 'SUI-001',
        name: 'Object Ownership Confusion',
        pattern: 'transfer::share_object|transfer::freeze_object|owned|shared',
        severity: 'HIGH',
        description: 'Incorrect object ownership can lead to access control issues',
        remediation: 'Carefully design object ownership model (owned vs shared)',
        chainSpecific: true
      },
      {
        id: 'SUI-002',
        name: 'Missing Capability Check',
        pattern: 'Capability|AdminCap|OwnerCap(?!.*assert|.*require)',
        severity: 'CRITICAL',
        description: 'Capability-based auth not properly enforced',
        remediation: 'Always verify capability ownership before privileged operations',
        chainSpecific: true
      }
    ],
    totalAudited: 300,
    totalTVL: '$500M+',
    docsUrl: 'https://docs.sui.io',
    securityGuideUrl: 'https://docs.sui.io/guides/developer/app-examples/e2e-counter'
  },
  {
    id: 'aptos',
    name: 'Aptos',
    symbol: 'APT',
    category: 'MOVE',
    language: 'Move',
    compilerVersions: ['1.0+'],
    frameworks: ['Aptos Move'],
    mainnetRPC: 'https://fullnode.mainnet.aptoslabs.com',
    testnetRPC: 'https://fullnode.testnet.aptoslabs.com',
    explorerUrl: 'https://aptoscan.com',
    specificPatterns: [
      {
        id: 'APT-001',
        name: 'Resource Account Vulnerability',
        pattern: 'resource_account|SignerCapability|create_resource_account',
        severity: 'HIGH',
        description: 'Resource account signer capability can be misused',
        remediation: 'Properly manage and restrict signer capability usage',
        chainSpecific: true
      }
    ],
    totalAudited: 200,
    totalTVL: '$300M+',
    docsUrl: 'https://aptos.dev',
    securityGuideUrl: 'https://aptos.dev/guides/move-guides/move-security-guidelines'
  },
  {
    id: 'cosmos',
    name: 'Cosmos Hub',
    symbol: 'ATOM',
    category: 'COSMWASM',
    language: 'Rust (CosmWasm)',
    compilerVersions: ['1.0+'],
    frameworks: ['CosmWasm'],
    mainnetRPC: 'https://cosmos-rpc.polkachu.com',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    specificPatterns: [
      {
        id: 'COSM-001',
        name: 'Unbounded Iteration',
        pattern: 'range\\(|iter\\(\\)|for.*in.*query',
        severity: 'HIGH',
        description: 'Unbounded iteration can exceed gas limits',
        remediation: 'Use pagination for all queries that could return many results',
        chainSpecific: true
      },
      {
        id: 'COSM-002',
        name: 'Missing Reply Handler',
        pattern: 'SubMsg::reply_on_success|SubMsg::reply_on_error|reply_always',
        severity: 'MEDIUM',
        description: 'Missing reply handling can leave state inconsistent',
        remediation: 'Always handle replies for submessages that can fail',
        chainSpecific: true
      }
    ],
    totalAudited: 400,
    totalTVL: '$1B+',
    docsUrl: 'https://docs.cosmos.network',
    securityGuideUrl: 'https://docs.cosmwasm.com/docs/1.0/smart-contracts/security/'
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'DOT',
    category: 'INK',
    language: 'Rust (ink!)',
    compilerVersions: ['1.0+'],
    frameworks: ['ink!', 'Substrate'],
    mainnetRPC: 'wss://rpc.polkadot.io',
    explorerUrl: 'https://polkadot.subscan.io',
    specificPatterns: [
      {
        id: 'DOT-001',
        name: 'ink! Reentrancy via Cross-Contract Calls',
        pattern: 'call_builder|invoke|CallBuilder',
        severity: 'HIGH',
        description: 'Cross-contract calls in ink! can be reentered',
        remediation: 'Use checks-effects-interactions pattern, consider mutex',
        chainSpecific: true
      }
    ],
    totalAudited: 200,
    totalTVL: '$500M+',
    docsUrl: 'https://wiki.polkadot.network',
    securityGuideUrl: 'https://use.ink/basics/security/'
  },
  {
    id: 'ton',
    name: 'TON',
    symbol: 'TON',
    category: 'TON',
    language: 'FunC / Tact',
    compilerVersions: ['0.4+'],
    frameworks: ['Blueprint', 'TON SDK'],
    mainnetRPC: 'https://toncenter.com/api/v2/jsonRPC',
    testnetRPC: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    explorerUrl: 'https://tonscan.org',
    specificPatterns: [
      {
        id: 'TON-001',
        name: 'Incorrect Bounce Handling',
        pattern: 'bounced|bounce.*handler|on_bounce',
        severity: 'HIGH',
        description: 'Improper bounce handling can lead to fund loss',
        remediation: 'Always handle bounced messages for fund transfers',
        chainSpecific: true
      },
      {
        id: 'TON-002',
        name: 'Gas Estimation in Async Calls',
        pattern: 'send_raw_message|SEND_MODE|mode::',
        severity: 'MEDIUM',
        description: 'Async messaging needs proper gas forwarding',
        remediation: 'Calculate and forward sufficient gas for chain of calls',
        chainSpecific: true
      }
    ],
    totalAudited: 100,
    totalTVL: '$200M+',
    docsUrl: 'https://docs.ton.org',
    securityGuideUrl: 'https://docs.ton.org/develop/smart-contracts/security/'
  },
  {
    id: 'near',
    name: 'NEAR Protocol',
    symbol: 'NEAR',
    category: 'OTHER',
    language: 'Rust / AssemblyScript',
    compilerVersions: ['1.60+'],
    frameworks: ['NEAR SDK'],
    mainnetRPC: 'https://rpc.mainnet.near.org',
    testnetRPC: 'https://rpc.testnet.near.org',
    explorerUrl: 'https://nearblocks.io',
    specificPatterns: [
      {
        id: 'NEAR-001',
        name: 'Promise Callback Attack',
        pattern: 'Promise::then|ext_|promise_result',
        severity: 'HIGH',
        description: 'Cross-contract call callbacks can be exploited',
        remediation: 'Validate promise results, use proper callback patterns',
        chainSpecific: true
      }
    ],
    totalAudited: 300,
    totalTVL: '$200M+',
    majorExploits: [
      { name: 'Rainbow Bridge Attempt', date: '2022-05', loss: '$0 (prevented)' }
    ],
    docsUrl: 'https://docs.near.org',
    securityGuideUrl: 'https://docs.near.org/concepts/basics/security/'
  },
  {
    id: 'algorand',
    name: 'Algorand',
    symbol: 'ALGO',
    category: 'OTHER',
    language: 'PyTeal / TEAL',
    compilerVersions: ['PyTeal 0.20+'],
    frameworks: ['Beaker', 'PyTeal'],
    mainnetRPC: 'https://mainnet-api.algonode.cloud',
    testnetRPC: 'https://testnet-api.algonode.cloud',
    explorerUrl: 'https://algoexplorer.io',
    specificPatterns: [
      {
        id: 'ALGO-001',
        name: 'Rekeying Attack',
        pattern: 'RekeyTo|rekey|AuthAddr',
        severity: 'CRITICAL',
        description: 'Account rekeying can transfer control to attacker',
        remediation: 'Always check for rekey transactions in security-critical apps',
        chainSpecific: true
      }
    ],
    totalAudited: 150,
    totalTVL: '$100M+',
    docsUrl: 'https://developer.algorand.org',
    securityGuideUrl: 'https://developer.algorand.org/docs/get-details/dapps/smart-contracts/security/'
  },
  {
    id: 'tezos',
    name: 'Tezos',
    symbol: 'XTZ',
    category: 'OTHER',
    language: 'Michelson / LIGO / SmartPy',
    compilerVersions: ['LIGO 1.0+', 'SmartPy 0.16+'],
    frameworks: ['LIGO', 'SmartPy'],
    mainnetRPC: 'https://mainnet.api.tez.ie',
    testnetRPC: 'https://ghostnet.tezos.marigold.dev',
    explorerUrl: 'https://tzkt.io',
    specificPatterns: [
      {
        id: 'TEZ-001',
        name: 'View Reentrancy',
        pattern: 'view|callback|get_entrypoint',
        severity: 'MEDIUM',
        description: 'Views and callbacks can introduce reentrancy',
        remediation: 'Be aware of callback patterns in Tezos contracts',
        chainSpecific: true
      }
    ],
    totalAudited: 100,
    totalTVL: '$50M+',
    docsUrl: 'https://tezos.com/developers/',
    securityGuideUrl: 'https://opentezos.com/smart-contracts/avoiding-flaws/'
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    category: 'OTHER',
    language: 'Plutus (Haskell) / Aiken',
    compilerVersions: ['Plutus V2+', 'Aiken 1.0+'],
    frameworks: ['Plutus', 'Aiken', 'Lucid'],
    mainnetRPC: 'https://cardano-mainnet.blockfrost.io',
    explorerUrl: 'https://cardanoscan.io',
    specificPatterns: [
      {
        id: 'ADA-001',
        name: 'Double Satisfaction',
        pattern: 'validator|spend|mint.*validator',
        severity: 'CRITICAL',
        description: 'Same UTXO can satisfy multiple validators incorrectly',
        remediation: 'Ensure validators check they are the sole consumers',
        chainSpecific: true
      }
    ],
    totalAudited: 100,
    totalTVL: '$100M+',
    majorExploits: [
      { name: 'Minswap V1', date: '2022-03', loss: 'Vulnerability found pre-launch' }
    ],
    docsUrl: 'https://developers.cardano.org',
    securityGuideUrl: 'https://developers.cardano.org/docs/smart-contracts/plutus/#security'
  },
  {
    id: 'casper',
    name: 'Casper',
    symbol: 'CSPR',
    category: 'OTHER',
    language: 'Rust (WASM)',
    compilerVersions: ['rustc 1.65+', 'casper-contract 3.0+'],
    frameworks: ['casper-client', 'casper-js-sdk', 'odra'],
    mainnetRPC: 'https://rpc.mainnet.casperlabs.io/rpc',
    testnetRPC: 'https://rpc.testnet.casperlabs.io/rpc',
    explorerUrl: 'https://cspr.live',
    explorerApiUrl: 'https://event-store-api-clarity-mainnet.make.services',
    specificPatterns: [
      {
        id: 'CSPR-001',
        name: 'Unsafe unwrap() in Entry Points',
        pattern: '\\.unwrap\\(\\)|expect\\(.*\\)',
        severity: 'HIGH',
        description: 'Using unwrap() in Casper entry points can panic and fail the deploy',
        remediation: 'Use proper error handling with Result types and custom ApiError',
        chainSpecific: true
      },
      {
        id: 'CSPR-002',
        name: 'Missing Access Control on Entry Points',
        pattern: '#\\[no_mangle\\]|pub extern.*fn',
        severity: 'CRITICAL',
        description: 'Entry points without caller validation can be called by anyone',
        remediation: 'Validate runtime::get_caller() against authorized accounts/contracts',
        chainSpecific: true
      },
      {
        id: 'CSPR-003',
        name: 'Unbounded Dictionary Growth',
        pattern: 'storage::dictionary_put|new_dictionary',
        severity: 'MEDIUM',
        description: 'Casper dictionaries without size limits can become expensive to maintain',
        remediation: 'Implement pagination or size limits for dictionary entries',
        chainSpecific: true
      },
      {
        id: 'CSPR-004',
        name: 'Insufficient Gas for Nested Calls',
        pattern: 'runtime::call_contract|call_versioned_contract',
        severity: 'HIGH',
        description: 'Cross-contract calls need sufficient gas forwarding',
        remediation: 'Calculate and forward appropriate gas using RuntimeArgs',
        chainSpecific: true
      },
      {
        id: 'CSPR-005',
        name: 'Mutable Global State Misuse',
        pattern: 'storage::new_uref|CLValue::from_t',
        severity: 'MEDIUM',
        description: 'Improper URef access rights can expose sensitive data',
        remediation: 'Use appropriate AccessRights (READ, WRITE, ADD, READ_ADD_WRITE)',
        chainSpecific: true
      },
      {
        id: 'CSPR-006',
        name: 'Missing Named Key Validation',
        pattern: 'runtime::get_key|get_named_arg',
        severity: 'HIGH',
        description: 'Getting keys without validation can return None and cause failures',
        remediation: 'Always validate named keys exist before accessing them',
        chainSpecific: true
      }
    ],
    totalAudited: 50,
    totalTVL: '$30M+',
    majorExploits: [],
    docsUrl: 'https://docs.casper.network',
    securityGuideUrl: 'https://docs.casper.network/developers/writing-onchain-code/best-practices/'
  }
]

// ============================================================================
// CHAIN REGISTRY CLASS
// ============================================================================

export class ChainRegistry {
  private chains: Map<string, ChainConfig> = new Map()
  
  constructor() {
    // Register all chains
    for (const chain of [...EVM_CHAINS, ...NON_EVM_CHAINS]) {
      this.chains.set(chain.id, chain)
    }
  }
  
  /**
   * Get chain by ID
   */
  getChain(id: string): ChainConfig | undefined {
    return this.chains.get(id.toLowerCase())
  }
  
  /**
   * Get all chains
   */
  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values())
  }
  
  /**
   * Get chains by category
   */
  getChainsByCategory(category: ChainCategory): ChainConfig[] {
    return this.getAllChains().filter(c => c.category === category)
  }
  
  /**
   * Get EVM chains
   */
  getEVMChains(): ChainConfig[] {
    return this.getChainsByCategory('EVM')
  }
  
  /**
   * Get non-EVM chains
   */
  getNonEVMChains(): ChainConfig[] {
    return this.getAllChains().filter(c => c.category !== 'EVM')
  }
  
  /**
   * Get chain-specific vulnerability patterns
   */
  getChainPatterns(chainId: string): ChainSpecificPattern[] {
    const chain = this.getChain(chainId)
    return chain?.specificPatterns || []
  }
  
  /**
   * Detect chain from code
   */
  detectChainFromCode(code: string): ChainConfig[] {
    const matches: ChainConfig[] = []
    const lowerCode = code.toLowerCase()
    
    // Check for Solidity (EVM)
    if (/pragma\s+solidity/.test(code)) {
      matches.push(...this.getEVMChains())
    }
    
    // Check for Solana/Anchor
    if (/use\s+anchor_lang|use\s+solana_program|#\[program\]/.test(code)) {
      const solana = this.getChain('solana')
      if (solana) matches.push(solana)
    }
    
    // Check for Move
    if (/module\s+\w+::\w+\s*\{|use\s+sui::|use\s+aptos/.test(code)) {
      if (/sui::/.test(lowerCode)) {
        const sui = this.getChain('sui')
        if (sui) matches.push(sui)
      }
      if (/aptos/.test(lowerCode)) {
        const aptos = this.getChain('aptos')
        if (aptos) matches.push(aptos)
      }
    }
    
    // Check for CosmWasm
    if (/use\s+cosmwasm|#\[entry_point\]|ExecuteMsg|QueryMsg/.test(code)) {
      const cosmos = this.getChain('cosmos')
      if (cosmos) matches.push(cosmos)
    }
    
    // Check for ink!
    if (/#\[ink::contract\]|ink_lang/.test(code)) {
      const polkadot = this.getChain('polkadot')
      if (polkadot) matches.push(polkadot)
    }
    
    // Check for FunC/Tact (TON)
    if (/impure|inline_ref|recv_internal|get_data/.test(code)) {
      const ton = this.getChain('ton')
      if (ton) matches.push(ton)
    }
    
    return matches
  }
  
  /**
   * Get statistics about chain coverage
   */
  getStats(): ChainRegistryStats {
    const allChains = this.getAllChains()
    const evmChains = this.getEVMChains()
    const nonEvmChains = this.getNonEVMChains()
    
    const totalPatterns = allChains.reduce((sum, c) => sum + c.specificPatterns.length, 0)
    const totalAudited = allChains.reduce((sum, c) => sum + (c.totalAudited || 0), 0)
    const totalExploits = allChains.reduce((sum, c) => sum + (c.majorExploits?.length || 0), 0)
    
    const languages = new Set(allChains.map(c => c.language))
    
    return {
      totalChains: allChains.length,
      evmChains: evmChains.length,
      nonEvmChains: nonEvmChains.length,
      languages: Array.from(languages),
      totalChainSpecificPatterns: totalPatterns,
      totalAuditedProjects: totalAudited,
      trackedExploits: totalExploits,
      categories: ['EVM', 'SOLANA', 'MOVE', 'COSMWASM', 'INK', 'TON', 'OTHER'] as ChainCategory[]
    }
  }
}

export interface ChainRegistryStats {
  totalChains: number
  evmChains: number
  nonEvmChains: number
  languages: string[]
  totalChainSpecificPatterns: number
  totalAuditedProjects: number
  trackedExploits: number
  categories: ChainCategory[]
}

// Export singleton instance
export const chainRegistry = new ChainRegistry()
