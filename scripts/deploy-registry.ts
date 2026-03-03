// ================================================================
// Deploy Solay39AuditRegistry su BSC Mainnet
// Esegui con: npx ts-node scripts/deploy-registry.ts
// ================================================================

import { ethers } from "ethers"

const REGISTRY_BYTECODE = process.env.REGISTRY_BYTECODE ?? ""
const AUDITOR_PRIVATE_KEY = process.env.AUDITOR_PRIVATE_KEY ?? ""
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL ?? "https://bsc-dataseed.binance.org/"

async function main() {
  if (!AUDITOR_PRIVATE_KEY) throw new Error("AUDITOR_PRIVATE_KEY not set in .env")

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(AUDITOR_PRIVATE_KEY, provider)

  console.log("Deploying from:", wallet.address)
  const balance = await provider.getBalance(wallet.address)
  console.log("Balance:", ethers.formatEther(balance), "BNB")

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient BNB for deployment. Need at least 0.01 BNB.")
  }

  // Il bytecode va compilato con solc o hardhat prima
  // Se non hai hardhat, usa: https://remix.ethereum.org -> compila -> copia bytecode
  if (!REGISTRY_BYTECODE) {
    console.log("\nREGISTRY_BYTECODE not set.")
    console.log("Steps to deploy:")
    console.log("1. Go to https://remix.ethereum.org")
    console.log("2. Paste the Solay39AuditRegistry.sol contract")
    console.log("3. Compile with solc 0.8.20")
    console.log("4. Copy bytecode from 'Compilation Details'")
    console.log("5. Set REGISTRY_BYTECODE=0x... in .env")
    console.log("6. Re-run this script\n")
    return
  }

  const ABI = [
    "constructor()",
    "function registerAudit(string,string,string) external returns (bytes32)",
    "function verifyAudit(bytes32) external view returns (tuple(string,string,string,address,uint256,bool))",
    "function totalAudits() external view returns (uint256)",
  ]

  const factory = new ethers.ContractFactory(ABI, REGISTRY_BYTECODE, wallet)
  const contract = await factory.deploy()
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log("\nSolay39AuditRegistry deployed!")
  console.log("Address:", address)
  console.log("Explorer: https://bscscan.com/address/" + address)
  console.log("\nAdd to .env:")
  console.log("AUDIT_REGISTRY_ADDRESS=" + address)
}

main().catch(console.error)
