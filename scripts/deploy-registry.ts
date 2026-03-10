// ═══════════════════════════════════════════════════════════════════════════
// FIX 05: Deploy Solay39AuditRegistry + Auto-attest Venice Token
// 
// Esegui con: npx hardhat run scripts/deploy-registry.ts --network bsc
// Oppure: npx ts-node scripts/deploy-registry.ts (se usi ethers direttamente)
// 
// Richiede: AUDITOR_PRIVATE_KEY in .env
// ═══════════════════════════════════════════════════════════════════════════

import { ethers } from "ethers"
import * as fs from "fs"
import * as path from "path"

// Configurazione
const AUDITOR_PRIVATE_KEY = process.env.AUDITOR_PRIVATE_KEY ?? ""
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL ?? "https://bsc-dataseed.binance.org/"
const REGISTRY_BYTECODE = process.env.REGISTRY_BYTECODE ?? ""

// Venice Token audit data (FIX 05: auto-attestation)
const VENICE_AUDIT_DATA = {
  auditKey: "solay39-audit-venice-token-1773135687075",
  projectName: "Venice Token",
  reportHash: "0xc1839c4a09ae06e0226e657948d403c9b82a5dcba759f13a8c005c1b5d04a06f",
  contractAddress: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf",
  ipfsCid: "bafkreicrloanotxrdd33ejdj43v3fjutjgmjnrlhepfgavejy4sxzw4pzu",
  score: 86,  // FIX 06: Corrected score (was 83)
  criticals: 0,
  highs: 0,   // FIX 06: LP lock removed from score (was 1)
}

// ABI per Solay39AuditRegistry (versione completa)
const REGISTRY_ABI = [
  "constructor()",
  "function publishAudit(string auditKey, string projectName, bytes32 reportHash, address contractAddr, uint8 score, uint8 criticals, uint8 highs, string ipfsCid) external returns (bytes32)",
  "function verifyReport(bytes32 auditKey, bytes32 hash) view returns (bool valid, tuple(string reportId, string projectName, bytes32 reportHash, address contractAddr, uint256 auditDate, uint8 score, uint8 criticalCount, uint8 highCount, string ipfsCid, bool isActive) record)",
  "function getAllAudits() view returns (bytes32[])",
  "function getValidAuditCount() view returns (uint256)",
  "function totalAudits() view returns (uint256)",
  "function owner() view returns (address)",
  "event AuditPublished(bytes32 indexed auditKey, string reportId, address contractAddr, bytes32 reportHash, uint256 timestamp)",
]

async function main() {
  console.log("═══════════════════════════════════════════")
  console.log("  Solay39 Audit Registry — Deployment")
  console.log("═══════════════════════════════════════════")

  if (!AUDITOR_PRIVATE_KEY) {
    console.error("Error: AUDITOR_PRIVATE_KEY not set in .env")
    console.log("\nSteps to set up:")
    console.log("1. Create a .env file in the project root")
    console.log("2. Add: AUDITOR_PRIVATE_KEY=0x<your_private_key>")
    console.log("3. Make sure you have at least 0.01 BNB for gas")
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(AUDITOR_PRIVATE_KEY, provider)
  const network = await provider.getNetwork()

  console.log(`  Network:  ${network.name} (chainId: ${network.chainId})`)
  console.log(`  Deployer: ${wallet.address}`)
  
  const balance = await provider.getBalance(wallet.address)
  console.log(`  Balance:  ${ethers.formatEther(balance)} BNB`)
  console.log("═══════════════════════════════════════════")

  if (balance < ethers.parseEther("0.01")) {
    console.error("\nError: Insufficient BNB for deployment. Need at least 0.01 BNB.")
    process.exit(1)
  }

  // Check if bytecode is provided
  if (!REGISTRY_BYTECODE) {
    console.log("\n⚠️  REGISTRY_BYTECODE not set.")
    console.log("\nTo get the bytecode:")
    console.log("1. Go to https://remix.ethereum.org")
    console.log("2. Create new file: Solay39AuditRegistry.sol")
    console.log("3. Paste the contract from contracts/Solay39AuditRegistry.sol")
    console.log("4. Compile with solc 0.8.20")
    console.log("5. Click 'Compilation Details' -> copy bytecode")
    console.log("6. Add to .env: REGISTRY_BYTECODE=0x<bytecode>")
    console.log("7. Re-run this script\n")
    
    // Provide manual instructions as fallback
    console.log("Or deploy manually via Remix and update REGISTRY_ADDRESSES in:")
    console.log("  lib/onchain-attestation.ts")
    return
  }

  // Deploy the registry
  console.log("\n  → Deploying Solay39AuditRegistry...")
  
  const factory = new ethers.ContractFactory(REGISTRY_ABI, REGISTRY_BYTECODE, wallet)
  const contract = await factory.deploy()
  await contract.waitForDeployment()

  const registryAddress = await contract.getAddress()
  console.log(`  ✓ Registry deployed: ${registryAddress}`)

  // Save address to .env.local
  const envPath = path.join(process.cwd(), ".env.local")
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : ""
  
  const registryLine = `NEXT_PUBLIC_REGISTRY_ADDRESS=${registryAddress}`
  const updated = envContent.includes("NEXT_PUBLIC_REGISTRY_ADDRESS")
    ? envContent.replace(/NEXT_PUBLIC_REGISTRY_ADDRESS=.*/, registryLine)
    : envContent + "\n" + registryLine
  
  fs.writeFileSync(envPath, updated)
  console.log("  ✓ Address saved to .env.local")

  // Auto-attest Venice Token audit
  console.log("\n  → Attesting Venice Token audit...")
  
  try {
    const tx = await contract.publishAudit(
      VENICE_AUDIT_DATA.auditKey,
      VENICE_AUDIT_DATA.projectName,
      VENICE_AUDIT_DATA.reportHash,
      VENICE_AUDIT_DATA.contractAddress,
      VENICE_AUDIT_DATA.score,
      VENICE_AUDIT_DATA.criticals,
      VENICE_AUDIT_DATA.highs,
      VENICE_AUDIT_DATA.ipfsCid
    )
    const receipt = await tx.wait()
    console.log(`  ✓ Venice Token audit attested: ${receipt.hash}`)
  } catch (err) {
    console.log(`  ⚠️ Venice attestation failed: ${err instanceof Error ? err.message : err}`)
    console.log("  You can manually attest later via the registry contract")
  }

  // Summary
  console.log("")
  console.log("  ═══════════════════════════════════════════")
  console.log("  DEPLOYMENT COMPLETE")
  console.log("  ═══════════════════════════════════════════")
  console.log(`  Registry: ${registryAddress}`)
  console.log(`  Explorer: https://bscscan.com/address/${registryAddress}`)
  console.log("")
  console.log("  Next steps:")
  console.log("  1. Update REGISTRY_ADDRESSES in lib/onchain-attestation.ts")
  console.log(`     bsc: "${registryAddress}"`)
  console.log("  2. Verify contract on BscScan (optional)")
  console.log("  3. Test verification with: verifyAuditOnChain()")
  console.log("")
}

main().catch(err => {
  console.error("\n❌ Deployment failed:", err.message || err)
  process.exit(1)
})
