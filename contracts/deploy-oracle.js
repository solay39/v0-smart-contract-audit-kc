/**
 * SOLAY39 Oracle Deployment Script
 * 
 * Deploy the Solay39Oracle contract to any EVM chain.
 * 
 * Usage:
 *   npx hardhat run contracts/deploy-oracle.js --network ethereum
 *   npx hardhat run contracts/deploy-oracle.js --network polygon
 *   npx hardhat run contracts/deploy-oracle.js --network base
 *   npx hardhat run contracts/deploy-oracle.js --network arbitrum
 * 
 * Required env vars:
 *   - PRIVATE_KEY: Deployer wallet private key
 *   - ALCHEMY_API_KEY: Alchemy API key for RPC
 *   - INITIAL_SIGNER: Address to authorize as first signer (optional, defaults to deployer)
 */

const hre = require("hardhat")

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  
  console.log("═══════════════════════════════════════════════════════════")
  console.log("SOLAY39 Oracle Deployment")
  console.log("═══════════════════════════════════════════════════════════")
  console.log("Network:", hre.network.name)
  console.log("Deployer:", deployer.address)
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH")
  console.log("")

  // Initial signer (defaults to deployer)
  const initialSigner = process.env.INITIAL_SIGNER || deployer.address
  console.log("Initial Signer:", initialSigner)
  console.log("")

  // Deploy Oracle
  console.log("Deploying Solay39Oracle...")
  const Oracle = await hre.ethers.getContractFactory("Solay39Oracle")
  const oracle = await Oracle.deploy(initialSigner)
  await oracle.waitForDeployment()
  
  const oracleAddress = await oracle.getAddress()
  console.log("✓ Solay39Oracle deployed to:", oracleAddress)
  console.log("")

  // Deploy Security Gate (example integration)
  console.log("Deploying Solay39SecurityGate...")
  const minScore = 70 // Minimum score requirement
  const maxCriticals = 0 // No critical findings allowed
  
  const Gate = await hre.ethers.getContractFactory("Solay39SecurityGate")
  const gate = await Gate.deploy(oracleAddress, minScore, maxCriticals)
  await gate.waitForDeployment()
  
  const gateAddress = await gate.getAddress()
  console.log("✓ Solay39SecurityGate deployed to:", gateAddress)
  console.log("")

  // Verify contracts on Etherscan (if API key is set)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Verifying contracts on Etherscan...")
    try {
      await hre.run("verify:verify", {
        address: oracleAddress,
        constructorArguments: [initialSigner],
      })
      console.log("✓ Solay39Oracle verified")
      
      await hre.run("verify:verify", {
        address: gateAddress,
        constructorArguments: [oracleAddress, minScore, maxCriticals],
      })
      console.log("✓ Solay39SecurityGate verified")
    } catch (err) {
      console.log("Verification failed (may already be verified):", err.message)
    }
    console.log("")
  }

  // Output summary
  console.log("═══════════════════════════════════════════════════════════")
  console.log("DEPLOYMENT COMPLETE")
  console.log("═══════════════════════════════════════════════════════════")
  console.log("")
  console.log("Add to your Vercel environment variables:")
  console.log("")
  console.log(`  ORACLE_ADDRESS_${hre.network.name.toUpperCase()}=${oracleAddress}`)
  console.log("")
  console.log("Contract addresses:")
  console.log(`  Oracle:        ${oracleAddress}`)
  console.log(`  Security Gate: ${gateAddress}`)
  console.log("")
  console.log("Next steps:")
  console.log("  1. Add the env var above to Vercel")
  console.log("  2. Set ORACLE_PRIVATE_KEY to enable auto-publishing")
  console.log("  3. Test with: curl -X POST /api/oracle -d '{\"action\":\"publish\",...}'")
  console.log("")
  
  // Return addresses for programmatic use
  return {
    oracle: oracleAddress,
    gate: gateAddress,
    network: hre.network.name,
    deployer: deployer.address,
  }
}

main()
  .then((result) => {
    console.log("Deployment result:", JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error("Deployment failed:", error)
    process.exit(1)
  })
