# Solay39 Audit Registry - Deploy Instructions

## Owner Wallet
```
0x2A9386C3636c9b520687BC8F11190abaf8bf98Af
```

## Quick Deploy via Remix IDE

### Step 1: Open Remix
Go to https://remix.ethereum.org

### Step 2: Create Contract File
1. In File Explorer (left panel), click "+" to create new file
2. Name it: `Solay39AuditRegistry.sol`
3. Copy the entire content from `/contracts/Solay39AuditRegistry.sol`

### Step 3: Compile
1. Click "Solidity Compiler" tab (left sidebar)
2. Select compiler version: `0.8.20`
3. Click "Compile Solay39AuditRegistry.sol"
4. Ensure no errors (green checkmark)

### Step 4: Deploy
1. Click "Deploy & Run Transactions" tab
2. Environment: Select **"Injected Provider - MetaMask"**
3. MetaMask will popup - select your wallet
4. **Important**: Switch MetaMask to the correct network:
   - **BSC Mainnet**: Chain ID 56
   - **Arbitrum One**: Chain ID 42161
   - **BSC Testnet**: Chain ID 97 (for testing)
5. Click "Deploy"
6. Confirm transaction in MetaMask

### Step 5: Save Contract Address
After deployment, copy the contract address from Remix.

Example: `0x1234567890abcdef1234567890abcdef12345678`

### Step 6: Update App Configuration
Edit `/lib/onchain-attestation.ts` and update:

```typescript
export const REGISTRY_ADDRESSES: Record<string, `0x${string}`> = {
  bsc: "0xYOUR_BSC_CONTRACT_ADDRESS_HERE",
  arbitrum: "0xYOUR_ARBITRUM_CONTRACT_ADDRESS_HERE",
  // ... other chains
}
```

---

## Network Details

### BSC Mainnet
- Chain ID: 56
- RPC: https://bsc-dataseed.binance.org/
- Explorer: https://bscscan.com
- Gas: ~$0.10-0.50 per tx

### Arbitrum One
- Chain ID: 42161
- RPC: https://arb1.arbitrum.io/rpc
- Explorer: https://arbiscan.io
- Gas: ~$0.05-0.20 per tx

### BSC Testnet (for testing)
- Chain ID: 97
- RPC: https://data-seed-prebsc-1-s1.binance.org:8545/
- Explorer: https://testnet.bscscan.com
- Faucet: https://testnet.bnbchain.org/faucet-smart

---

## Contract Functions

### registerAudit (Owner only)
```solidity
function registerAudit(
    string projectName,    // "MyToken"
    string reportHash,     // "abc123..." (SHA-256)
    string codeReference,  // "0x..." or "commit:abc123"
    string ipfsCid,        // "bafkrei..."
    uint8 score            // 0-100
) external returns (bytes32 auditId)
```

### verifyAudit (Public)
```solidity
function verifyAudit(bytes32 auditId) external view returns (
    bool exists,
    bool valid,
    string projectName,
    string reportHash,
    string ipfsCid,
    uint8 score,
    uint256 timestamp
)
```

### verifyByHash (Public)
```solidity
function verifyByHash(string reportHash) external view returns (
    bool exists,
    bytes32 auditId,
    bool valid,
    uint8 score,
    uint256 timestamp
)
```

---

## Verify Contract on Explorer (Optional)

After deploying, verify the contract source code:

1. Go to BscScan/Arbiscan
2. Find your contract address
3. Click "Verify & Publish"
4. Select:
   - Compiler Type: Solidity (Single file)
   - Compiler Version: v0.8.20
   - License: MIT
5. Paste contract source code
6. Click "Verify"

This allows anyone to read the verified source code directly on the explorer.
