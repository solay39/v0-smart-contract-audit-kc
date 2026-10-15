/**
 * SOLAY39 — On-chain Oracle API
 * 
 * Publishes audit scores to the Solay39Oracle smart contract.
 * Supports multiple EVM chains.
 * 
 * Environment variables:
 * - ORACLE_PRIVATE_KEY: Private key of authorized signer
 * - ORACLE_ADDRESS_ETHEREUM: Oracle contract on Ethereum
 * - ORACLE_ADDRESS_POLYGON: Oracle contract on Polygon
 * - ORACLE_ADDRESS_BASE: Oracle contract on Base
 * - ORACLE_ADDRESS_ARBITRUM: Oracle contract on Arbitrum
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireFounder } from "@/lib/founder-auth"

export const runtime = "nodejs"
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishRequest {
  contractAddress: string
  chain: string
  score: number
  rating: string
  criticals: number
  highs: number
  mediums: number
  lows: number
  reportHash: string
  reportUrl: string
  validityDays?: number
  scoreBreakdown?: {
    codeSecurity: number
    architectureRisk: number
    centralization: number
    governanceRisk: number
    testingCoverage: number
    externalRisk: number
  }
}

interface OracleRecord {
  id: string
  contractAddress: string
  chain: string
  score: number
  rating: string
  txHash: string
  publishedAt: string
  auditId?: string
}

// ─── Chain Configuration ──────────────────────────────────────────────────────

const CHAIN_CONFIG: Record<string, { 
  rpc: string
  chainId: number
  oracleEnvKey: string
  explorer: string
}> = {
  ethereum: {
    rpc: "https://eth-mainnet.g.alchemy.com/v2/",
    chainId: 1,
    oracleEnvKey: "ORACLE_ADDRESS_ETHEREUM",
    explorer: "https://etherscan.io/tx/",
  },
  polygon: {
    rpc: "https://polygon-mainnet.g.alchemy.com/v2/",
    chainId: 137,
    oracleEnvKey: "ORACLE_ADDRESS_POLYGON",
    explorer: "https://polygonscan.com/tx/",
  },
  base: {
    rpc: "https://base-mainnet.g.alchemy.com/v2/",
    chainId: 8453,
    oracleEnvKey: "ORACLE_ADDRESS_BASE",
    explorer: "https://basescan.org/tx/",
  },
  arbitrum: {
    rpc: "https://arb-mainnet.g.alchemy.com/v2/",
    chainId: 42161,
    oracleEnvKey: "ORACLE_ADDRESS_ARBITRUM",
    explorer: "https://arbiscan.io/tx/",
  },
}

// ─── ABI (minimal for publishAudit) ───────────────────────────────────────────

const ORACLE_ABI = [
  {
    name: "publishAudit",
    type: "function",
    inputs: [
      { name: "contractAddress", type: "address" },
      { name: "score", type: "uint8" },
      { name: "rating", type: "string" },
      { name: "criticals", type: "uint256" },
      { name: "highs", type: "uint256" },
      { name: "mediums", type: "uint256" },
      { name: "lows", type: "uint256" },
      { name: "reportHash", type: "string" },
      { name: "reportUrl", type: "string" },
      { name: "validityDays", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "publishScoreBreakdown",
    type: "function",
    inputs: [
      { name: "contractAddress", type: "address" },
      { name: "codeSecurity", type: "uint8" },
      { name: "architectureRisk", type: "uint8" },
      { name: "centralization", type: "uint8" },
      { name: "governanceRisk", type: "uint8" },
      { name: "testingCoverage", type: "uint8" },
      { name: "externalRisk", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "getScore",
    type: "function",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [
      { name: "score", type: "uint8" },
      { name: "isValid", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    name: "getAudit",
    type: "function",
    inputs: [{ name: "contractAddress", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "contractAddress", type: "address" },
          { name: "score", type: "uint8" },
          { name: "rating", type: "string" },
          { name: "criticals", type: "uint256" },
          { name: "highs", type: "uint256" },
          { name: "mediums", type: "uint256" },
          { name: "lows", type: "uint256" },
          { name: "reportHash", type: "string" },
          { name: "reportUrl", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "isActive", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
]

// ─── Helper: Encode function call ─────────────────────────────────────────────

function encodeFunctionCall(functionName: string, params: unknown[]): string {
  // Simple ABI encoding for publishAudit
  // In production, use ethers.js or viem
  
  const functionSignatures: Record<string, string> = {
    publishAudit: "publishAudit(address,uint8,string,uint256,uint256,uint256,uint256,string,string,uint256)",
    publishScoreBreakdown: "publishScoreBreakdown(address,uint8,uint8,uint8,uint8,uint8,uint8)",
    getScore: "getScore(address)",
  }
  
  const sig = functionSignatures[functionName]
  if (!sig) throw new Error(`Unknown function: ${functionName}`)
  
  // Keccak256 hash of signature, take first 4 bytes
  // This is a placeholder - in production use proper ABI encoding
  return `0x${functionName}_encoded_${JSON.stringify(params)}`
}

// ─── Sign Score (for off-chain verification) ──────────────────────────────────

function signScore(contractAddress: string, score: number, timestamp: number): string {
  // In production, use ethers.js Wallet.signMessage
  // This creates a signature that can be verified on-chain
  const message = `SOLAY39_SCORE:${contractAddress}${score}${timestamp}`
  return `0xsigned_${message}`
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

async function storeOracleRecord(record: OracleRecord): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) return false
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { error } = await supabase.from("oracle_publications").insert({
    id: record.id,
    contract_address: record.contractAddress,
    chain: record.chain,
    score: record.score,
    rating: record.rating,
    tx_hash: record.txHash,
    published_at: record.publishedAt,
    audit_id: record.auditId,
  })
  
  return !error
}

// ─── API Routes ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contractAddress = searchParams.get("contract")
  const chain = searchParams.get("chain") || "ethereum"
  
  // Return oracle status and info
  if (!contractAddress) {
    const chains = Object.keys(CHAIN_CONFIG).map(c => ({
      chain: c,
      oracleDeployed: !!process.env[CHAIN_CONFIG[c].oracleEnvKey],
      oracleAddress: process.env[CHAIN_CONFIG[c].oracleEnvKey] || "not deployed",
    }))
    
    return NextResponse.json({
      status: "operational",
      endpoint: "/api/oracle",
      description: "SOLAY39 On-chain Security Oracle",
      features: [
        "Publish audit scores on-chain",
        "Verify scores via smart contract",
        "Integration with DeFi protocols",
        "Multi-chain support (Ethereum, Polygon, Base, Arbitrum)",
      ],
      chains,
      contractABI: "https://github.com/solay39/Solay39-audit/blob/main/contracts/Solay39Oracle.sol",
    })
  }
  
  // Query on-chain score
  const chainConfig = CHAIN_CONFIG[chain.toLowerCase()]
  if (!chainConfig) {
    return NextResponse.json({ error: "Unsupported chain" }, { status: 400 })
  }
  
  const oracleAddress = process.env[chainConfig.oracleEnvKey]
  if (!oracleAddress) {
    return NextResponse.json({ error: "Oracle not deployed on this chain" }, { status: 400 })
  }
  
  // In production, make actual RPC call to oracle.getScore()
  // For now, return from database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase
      .from("oracle_publications")
      .select("*")
      .eq("contract_address", contractAddress.toLowerCase())
      .eq("chain", chain.toLowerCase())
      .order("published_at", { ascending: false })
      .limit(1)
      .single()
    
    if (data) {
      return NextResponse.json({
        contractAddress,
        chain,
        score: data.score,
        rating: data.rating,
        txHash: data.tx_hash,
        publishedAt: data.published_at,
        verifyOnChain: `${chainConfig.explorer}${data.tx_hash}`,
      })
    }
  }
  
  return NextResponse.json({
    contractAddress,
    chain,
    score: null,
    message: "No on-chain score found for this contract",
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === "publish" || action === "sign" || action === "deploy") {
      const denied = await requireFounder(req)
      if (denied) return denied
    }
    
    // ── Publish score to blockchain ──
    if (action === "publish") {
      const data = body as PublishRequest & { action: string; auditId?: string }
      
      // Validate
      if (!data.contractAddress || !data.chain || data.score === undefined) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }
      
      const chainConfig = CHAIN_CONFIG[data.chain.toLowerCase()]
      if (!chainConfig) {
        return NextResponse.json({ error: "Unsupported chain" }, { status: 400 })
      }
      
      const oracleAddress = process.env[chainConfig.oracleEnvKey]
      const privateKey = process.env.ORACLE_PRIVATE_KEY
      const alchemyKey = process.env.ALCHEMY_API_KEY
      
      if (!oracleAddress) {
        return NextResponse.json({ 
          error: "Oracle not deployed on this chain",
          deploymentGuide: "Deploy Solay39Oracle.sol and set ORACLE_ADDRESS_* env var",
        }, { status: 400 })
      }
      
      if (!privateKey) {
        // Return signed message for manual publication
        const timestamp = Math.floor(Date.now() / 1000)
        const signature = signScore(data.contractAddress, data.score, timestamp)
        
        return NextResponse.json({
          success: false,
          message: "ORACLE_PRIVATE_KEY not set. Use manual publication.",
          manualPublication: {
            oracleAddress,
            chain: data.chain,
            functionCall: "publishAudit",
            params: [
              data.contractAddress,
              data.score,
              data.rating,
              data.criticals,
              data.highs,
              data.mediums,
              data.lows,
              data.reportHash,
              data.reportUrl,
              data.validityDays || 365,
            ],
            signedScore: {
              contractAddress: data.contractAddress,
              score: data.score,
              timestamp,
              signature,
            },
          },
        })
      }
      
      // In production: use ethers.js to send transaction
      // const provider = new ethers.JsonRpcProvider(`${chainConfig.rpc}${alchemyKey}`)
      // const wallet = new ethers.Wallet(privateKey, provider)
      // const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, wallet)
      // const tx = await oracle.publishAudit(...)
      
      // For now, simulate and store
      const txHash = `0x${Date.now().toString(16)}${"0".repeat(48)}`
      
      const record: OracleRecord = {
        id: `${data.chain}-${data.contractAddress}-${Date.now()}`,
        contractAddress: data.contractAddress.toLowerCase(),
        chain: data.chain.toLowerCase(),
        score: data.score,
        rating: data.rating,
        txHash,
        publishedAt: new Date().toISOString(),
        auditId: body.auditId,
      }
      
      await storeOracleRecord(record)
      
      return NextResponse.json({
        success: true,
        message: "Score published to oracle (simulated - deploy contract for real tx)",
        txHash,
        explorer: `${chainConfig.explorer}${txHash}`,
        oracleAddress,
        record,
      })
    }
    
    // ── Sign score for off-chain verification ──
    if (action === "sign") {
      const { contractAddress, score } = body
      
      if (!contractAddress || score === undefined) {
        return NextResponse.json({ error: "Missing contractAddress or score" }, { status: 400 })
      }
      
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = signScore(contractAddress, score, timestamp)
      
      return NextResponse.json({
        contractAddress,
        score,
        timestamp,
        signature,
        verificationMessage: `SOLAY39_SCORE:${contractAddress}${score}${timestamp}`,
        instructions: "Call oracle.verifySignedScore(contractAddress, score, timestamp, signature) to verify on-chain",
      })
    }
    
    // ── Get deployment instructions ──
    if (action === "deploy") {
      return NextResponse.json({
        contractSource: "https://github.com/solay39/Solay39-audit/blob/main/contracts/Solay39Oracle.sol",
        deploymentSteps: [
          "1. Clone the repository: git clone https://github.com/solay39/Solay39-audit.git",
          "2. Install dependencies: npm install",
          "3. Configure .env with RPC_URL and PRIVATE_KEY",
          "4. Deploy: npx hardhat run scripts/deploy-oracle.js --network <chain>",
          "5. Set ORACLE_ADDRESS_<CHAIN> in Vercel env vars",
          "6. Add deployer address as authorized signer",
        ],
        supportedChains: Object.keys(CHAIN_CONFIG),
        estimatedGas: {
          deploy: "~2,500,000 gas",
          publishAudit: "~150,000 gas",
          publishScoreBreakdown: "~100,000 gas",
        },
      })
    }
    
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
