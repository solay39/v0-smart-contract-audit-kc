# Solay39 Security Backend

Backend server per analisi statiche e dinamiche di smart contracts usando Slither, Mythril, Foundry e Echidna.

## Tools Inclusi

- **Slither** - Analisi statica
- **Mythril** - Symbolic execution
- **Foundry** - Fuzzing e testing
- **Echidna** - Property-based testing
- **Puppeteer** - Generazione PDF

## Build & Run

```bash
# Build Docker image
docker build -t solay39-backend .

# Run container
docker run -d -p 3001:3001 \
  -e SECURITY_API_KEY=your-api-key \
  -e MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  solay39-backend
```

## API Endpoints

### Health Check
```
GET /health
```

### Slither Analysis
```
POST /api/slither
Content-Type: application/json
x-api-key: your-api-key

{
  "code": "// Solidity code",
  "contractName": "MyContract",
  "solcVersion": "0.8.20"
}
```

### Mythril Analysis
```
POST /api/mythril
{
  "code": "// Solidity code",
  "timeout": 120
}
```

### Foundry Fuzzing
```
POST /api/foundry/fuzz
{
  "code": "// Solidity code",
  "fuzzRuns": 1000
}
```

### Combined Analysis
```
POST /api/analyze
{
  "code": "// Solidity code",
  "tools": ["slither", "mythril"]
}
```

### PDF Generation
```
POST /api/generate-pdf
{
  "html": "<html>...</html>"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `SECURITY_API_KEY` | API key for authentication |
| `MAINNET_RPC_URL` | Ethereum mainnet RPC for fork testing |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path for PDF generation |

## Deploy su Railway/Fly.io

```bash
# Railway
railway up

# Fly.io
fly launch
fly deploy
```

Poi configura su Vercel:
- `STATIC_ANALYSIS_API_URL` = URL del backend
- `SECURITY_API_KEY` = Stessa key usata nel backend
