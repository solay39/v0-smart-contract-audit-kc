import { NextResponse } from "next/server"
import { ethers } from "ethers"

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") || ""
  if (!ethers.isAddress(address)) return NextResponse.json({ error: "Valid EVM address required" }, { status: 400 })
  const rpcUrl = process.env.EVM_RPC_URL || (process.env.ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "")
  if (!rpcUrl) return NextResponse.json({ error: "EVM RPC is not configured; snapshot unavailable" }, { status: 503 })
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const [network, blockNumber, code] = await Promise.all([provider.getNetwork(), provider.getBlockNumber(), provider.getCode(address)])
    return NextResponse.json({ chainId: network.chainId.toString(), address, blockNumber, bytecodeSha256: code === "0x" ? null : ethers.keccak256(code), bytecodePresent: code !== "0x", status: "snapshot_only" })
  } catch {
    return NextResponse.json({ error: "RPC snapshot failed; no safety conclusion can be drawn" }, { status: 502 })
  }
}
