export interface TokenData {
  tokenAddress?: string
  tokenName?: string
  tokenSymbol?: string
  network?: string
  tokenNetwork?: string
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: string
  mintAuthority?: string | null
  freezeAuthority?: string | null
  owner?: string | null
  topHolders?: { address: string; balance?: string; percentage?: number; label?: string }[]
  totalHolders?: number
  holders?: number
  liquidityPools?: { dex: string; pair: string; liquidity: string; lpLocked: boolean }[]
  price?: number
  marketCap?: number
  volume24h?: number
  isVerified?: boolean
  hasMintFunction?: boolean
  hasPauseFunction?: boolean
  hasBlacklistFunction?: boolean
}

export interface AnalysisData {
  tokenName?: string
  tokenSymbol?: string
  tokenAddress?: string
  tokenNetwork?: string
  marketCap?: number
  liquidity?: number
  price?: number
  volume24h?: number
  holders?: number
  executiveSummary?: string
  tokenEconomics?: string
  whaleDistribution?: string
  insiderWallets?: string
  devWalletAnalysis?: string
  supplyAnalysis?: string
  rugPullRisk?: string
  priceManipulation?: string
  hiddenGovernance?: string
  complexBugs?: string
  liquidityAnalysis?: string
  clusterAnalysis?: string
  scenarioAnalysis?: string
  overallRiskScore?: number
  scores?: {
    smartContractSecurity?: number
    decentralization?: number
    liquidityHealth?: number
    manipulationRisk?: string
  }
  recommendation?: string
}

export interface OnChainAnalysis {
  tokenData: TokenData
  analysis: AnalysisData
  timestamp?: string
}
