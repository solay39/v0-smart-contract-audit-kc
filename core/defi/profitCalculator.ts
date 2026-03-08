/**
 * DeFi Profit Calculator
 * 
 * Calculate profitability of exploit attempts.
 * Factors in gas costs, flash loan fees, slippage.
 */

import { ethers } from "ethers"

export interface ProfitCalculation {
  grossProfit: bigint
  gasCost: bigint
  flashLoanFee: bigint
  slippage: bigint
  netProfit: bigint
  profitable: boolean
  roi: number // percentage
  breakEvenGasPrice: bigint
}

export interface AttackCosts {
  gasUsed: bigint
  gasPrice: bigint
  borrowed?: bigint
  flashLoanFeeRate?: number // 0.0009 for Aave (0.09%)
  expectedSlippage?: number // 0.01 for 1%
}

/**
 * Calculate profit from attack
 */
export function calculateProfit(
  drained: bigint,
  costs: AttackCosts
): ProfitCalculation {
  const gasCost = costs.gasUsed * costs.gasPrice
  
  // Flash loan fee (default Aave: 0.09%)
  const flashLoanFeeRate = costs.flashLoanFeeRate ?? 0.0009
  const flashLoanFee = costs.borrowed 
    ? (costs.borrowed * BigInt(Math.floor(flashLoanFeeRate * 10000))) / 10000n
    : 0n

  // Slippage (default 1%)
  const slippageRate = costs.expectedSlippage ?? 0.01
  const slippage = (drained * BigInt(Math.floor(slippageRate * 10000))) / 10000n

  const grossProfit = drained
  const netProfit = drained - gasCost - flashLoanFee - slippage

  // ROI = (netProfit / totalCost) * 100
  const totalCost = gasCost + flashLoanFee
  const roi = totalCost > 0n 
    ? Number((netProfit * 10000n) / totalCost) / 100
    : 0

  // Break-even gas price
  const breakEvenGasPrice = costs.gasUsed > 0n && drained > flashLoanFee + slippage
    ? (drained - flashLoanFee - slippage) / costs.gasUsed
    : 0n

  return {
    grossProfit,
    gasCost,
    flashLoanFee,
    slippage,
    netProfit,
    profitable: netProfit > 0n,
    roi,
    breakEvenGasPrice,
  }
}

/**
 * Calculate flash loan attack profitability
 */
export function calculateFlashLoanProfit(params: {
  borrowed: bigint
  drained: bigint
  gasUsed: bigint
  gasPrice: bigint
  lendingProtocol: "aave" | "dydx" | "uniswap" | "balancer"
}): ProfitCalculation & { protocol: string; fee: string } {
  // Flash loan fee rates by protocol
  const feeRates: Record<string, number> = {
    aave: 0.0009,      // 0.09%
    dydx: 0,           // Free (but requires callback)
    uniswap: 0.003,    // 0.3% (via swap)
    balancer: 0,       // Free flash loans
  }

  const feeRate = feeRates[params.lendingProtocol] ?? 0.0009

  const result = calculateProfit(params.drained, {
    gasUsed: params.gasUsed,
    gasPrice: params.gasPrice,
    borrowed: params.borrowed,
    flashLoanFeeRate: feeRate,
  })

  return {
    ...result,
    protocol: params.lendingProtocol,
    fee: `${(feeRate * 100).toFixed(2)}%`,
  }
}

/**
 * Calculate arbitrage profit
 */
export function calculateArbitrageProfit(params: {
  buyPrice: bigint
  sellPrice: bigint
  amount: bigint
  gasUsed: bigint
  gasPrice: bigint
  dexFeeRate?: number // Default 0.3%
}): ProfitCalculation & { priceSpread: number } {
  const dexFeeRate = params.dexFeeRate ?? 0.003

  // Buy cost
  const buyCost = (params.amount * params.buyPrice) / ethers.parseEther("1")
  
  // Sell revenue (after DEX fee)
  const sellRevenue = (params.amount * params.sellPrice) / ethers.parseEther("1")
  const dexFee = (sellRevenue * BigInt(Math.floor(dexFeeRate * 10000))) / 10000n
  const netSellRevenue = sellRevenue - dexFee

  // Profit
  const grossProfit = netSellRevenue - buyCost
  const gasCost = params.gasUsed * params.gasPrice
  const netProfit = grossProfit - gasCost

  // Price spread percentage
  const priceSpread = params.buyPrice > 0n
    ? Number(((params.sellPrice - params.buyPrice) * 10000n) / params.buyPrice) / 100
    : 0

  return {
    grossProfit,
    gasCost,
    flashLoanFee: 0n,
    slippage: dexFee,
    netProfit,
    profitable: netProfit > 0n,
    roi: buyCost > 0n ? Number((netProfit * 10000n) / buyCost) / 100 : 0,
    breakEvenGasPrice: params.gasUsed > 0n && grossProfit > 0n
      ? grossProfit / params.gasUsed
      : 0n,
    priceSpread,
  }
}

/**
 * Calculate sandwich attack profit
 */
export function calculateSandwichProfit(params: {
  victimTxValue: bigint
  frontrunBuyAmount: bigint
  priceImpact: number // e.g., 0.02 for 2%
  gasUsed: bigint
  gasPrice: bigint
}): ProfitCalculation & { extractedValue: number } {
  // Extracted value from victim's slippage
  const extractedValue = (params.victimTxValue * BigInt(Math.floor(params.priceImpact * 10000))) / 10000n
  
  // Our profit is a portion of extracted value (minus our own slippage)
  const ourSlippage = 0.005 // 0.5%
  const grossProfit = extractedValue - (extractedValue * BigInt(Math.floor(ourSlippage * 10000))) / 10000n

  const gasCost = params.gasUsed * params.gasPrice * 2n // 2 txs (frontrun + backrun)
  const netProfit = grossProfit - gasCost

  return {
    grossProfit,
    gasCost,
    flashLoanFee: 0n,
    slippage: (extractedValue * BigInt(Math.floor(ourSlippage * 10000))) / 10000n,
    netProfit,
    profitable: netProfit > 0n,
    roi: params.frontrunBuyAmount > 0n
      ? Number((netProfit * 10000n) / params.frontrunBuyAmount) / 100
      : 0,
    breakEvenGasPrice: params.gasUsed > 0n && grossProfit > 0n
      ? grossProfit / (params.gasUsed * 2n)
      : 0n,
    extractedValue: Number(ethers.formatEther(extractedValue)),
  }
}

/**
 * Estimate gas price for profitability
 */
export function estimateRequiredGasPrice(params: {
  targetProfit: bigint
  gasUsed: bigint
  borrowed?: bigint
  flashLoanFeeRate?: number
}): { maxGasPrice: bigint; maxGasPriceGwei: number } {
  const flashLoanFee = params.borrowed && params.flashLoanFeeRate
    ? (params.borrowed * BigInt(Math.floor(params.flashLoanFeeRate * 10000))) / 10000n
    : 0n

  const availableForGas = params.targetProfit - flashLoanFee
  
  const maxGasPrice = params.gasUsed > 0n && availableForGas > 0n
    ? availableForGas / params.gasUsed
    : 0n

  return {
    maxGasPrice,
    maxGasPriceGwei: Number(ethers.formatUnits(maxGasPrice, "gwei")),
  }
}

/**
 * Format profit report
 */
export function formatProfitReport(calc: ProfitCalculation): string {
  const formatEth = (wei: bigint) => `${Number(ethers.formatEther(wei)).toFixed(6)} ETH`
  
  return `
╔══════════════════════════════════════════╗
║           PROFIT CALCULATION             ║
╠══════════════════════════════════════════╣
║ Gross Profit:     ${formatEth(calc.grossProfit).padStart(18)}  ║
║ Gas Cost:        -${formatEth(calc.gasCost).padStart(18)}  ║
║ Flash Loan Fee:  -${formatEth(calc.flashLoanFee).padStart(18)}  ║
║ Slippage:        -${formatEth(calc.slippage).padStart(18)}  ║
╠══════════════════════════════════════════╣
║ NET PROFIT:       ${formatEth(calc.netProfit).padStart(18)}  ║
║ ROI:              ${(calc.roi.toFixed(2) + "%").padStart(18)}  ║
║ Profitable:       ${(calc.profitable ? "YES ✓" : "NO ✗").padStart(18)}  ║
╚══════════════════════════════════════════╝
`
}
