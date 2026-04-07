# Formal Verification Backend

Python service for mathematical proof verification using **Coq** and **K Framework (KEVM)**.

## Deploy to Railway

```bash
cd formal-verify-backend
railway login
railway init
railway up
```

Then set in Vercel:
```
FORMAL_VERIFY_BACKEND_URL=https://<your-service>.railway.app
```

## Local Development

```bash
pip install -r requirements.txt
python server.py
```

## Endpoints

### POST /verify
```json
{
  "tool": "coq" | "kframework",
  "contractSource": "// Solidity code...",
  "propertySpec": "Coq or K spec...",
  "propertyId": "erc20Invariant"
}
```

### GET /health
Returns tool availability status.

## Properties Verified

### Coq Properties
- `erc20Invariant` - Sum of balances = totalSupply
- `noOverflow` - Arithmetic overflow safety
- `accessControl` - Role-based access correctness

### K Framework Properties  
- `reentrancyFreedom` - No state modification after external call
- `flashLoanSafety` - Oracle manipulation resistance
- `ownershipIntegrity` - Owner transfer validation
