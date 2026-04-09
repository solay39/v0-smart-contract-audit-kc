import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { ethers } from "ethers"

export const maxDuration = 60

/**
 * SOLAY39 — Hacker Attack Analysis Engine
 * 
 * This endpoint analyzes a transaction hash to identify and explain 
 * a hacker attack in technical detail.
 */

export async function POST(req: NextRequest) {
  try {
    const { txHash, network = "Ethereum" } = await req.json()

    if (!txHash) {
      return NextResponse.json({ error: "Transaction hash is required" }, { status: 400 })
    }

    // 1. Fetch transaction details and logs
    const rpcUrl = getRpcUrl(network)
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    
    let tx, receipt
    try {
      [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash)
      ])
    } catch (err) {
      return NextResponse.json({ error: "Failed to fetch transaction data. Ensure the hash and network are correct." }, { status: 404 })
    }

    if (!tx || !receipt) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // 2. Prepare context for AI analysis
    const logsContext = receipt.logs.slice(0, 10).map(l => ({
      address: l.address,
      topics: l.topics,
      data: l.data.slice(0, 100) + (l.data.length > 100 ? "..." : "")
    }))

    const txContext = {
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value),
      data: tx.data.slice(0, 500) + (tx.data.length > 500 ? "..." : ""),
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "Success" : "Failed",
    }

    // 3. Use AI to analyze the attack
    const { text: analysis } = await generateText({
      model: "openai/gpt-4o",
      system: `You are a world-class smart contract security researcher and hacker attack analyst. 
      Your goal is to provide a deep technical analysis of a potential exploit transaction.
      Identify the attack vector (e.g., Reentrancy, Oracle Manipulation, Flash Loan, Logic Error, Access Control).
      Provide a step-by-step breakdown of how the attack was executed.
      Explain the impact and how to prevent it.
      Use a highly professional and technical tone.`,
      prompt: `Analyze this transaction on ${network}:
      
      TX Hash: ${txHash}
      From: ${txContext.from}
      To: ${txContext.to}
      Value: ${txContext.value} ETH
      Status: ${txContext.status}
      Gas Used: ${txContext.gasUsed}
      
      Input Data (Calldata):
      ${txContext.data}
      
      Event Logs (First 10):
      ${JSON.stringify(logsContext, null, 2)}
      
      Provide a structured report with:
      1. Attack Summary (Type, Severity, Estimated Loss)
      2. Technical Breakdown (Step-by-step analysis of the call flow)
      3. Vulnerability Root Cause (Which code pattern was exploited?)
      4. Remediation (How to fix this in the future)
      5. "Skynet Real-time Signal" (What patterns should have triggered an alert?)`
    })

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        txHash,
        network,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("[Attack Analysis] Error:", error)
    return NextResponse.json({ error: "Internal analysis error" }, { status: 500 })
  }
}

function getRpcUrl(network: string): string {
  const networks: Record<string, string> = {
    "Ethereum": process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    "BSC": "https://binance.llamarpc.com",
    "Polygon": "https://polygon.llamarpc.com",
    "Arbitrum": "https://arbitrum.llamarpc.com",
    "Base": "https://base.llamarpc.com",
    "Optimism": "https://optimism.llamarpc.com",
    "Avalanche": "https://avalanche.llamarpc.com",
  }
  return networks[network] || networks["Ethereum"]
}
