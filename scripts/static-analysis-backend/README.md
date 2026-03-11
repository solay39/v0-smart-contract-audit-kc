# SOLAY39 Static Analysis Backend

This Docker container runs **real** Slither, Mythril, Foundry, and Halmos analysis on Solidity smart contracts.

## Deploy to Railway (Recommended)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Deploy
cd scripts/static-analysis-backend
railway init
railway up
```

After deployment, Railway will give you a URL like `https://solay39-static-analysis.railway.app`.

## Configure Vercel

Add these environment variables to your Vercel project:

```
STATIC_ANALYSIS_API_URL=https://your-app.railway.app
STATIC_ANALYSIS_API_KEY=your-api-key (optional)
```

## What's Included

| Tool | Version | Purpose |
|------|---------|---------|
| Slither | 0.10.4 | Static analysis (150+ detectors) |
| Mythril | 0.24.8 | Symbolic execution |
| Foundry | latest | Fuzzing (10,000 runs) |
| Halmos | 0.1.14 | Formal verification |
| Z3 | 4.12.4 | SMT solver for Halmos |

## API Endpoints

### POST /api/analyze
Run analysis on Solidity code.

```json
{
  "code": "// Solidity code",
  "contractName": "MyContract",
  "tools": ["slither", "mythril", "foundry", "halmos"]
}
```

### GET /api/health
Health check and tool versions.

## Local Development

```bash
docker build -t solay39-static-analysis .
docker run -p 8080:8080 solay39-static-analysis
```

## Cost

Railway free tier: ~$5/month for light usage
Railway Pro: $20/month for unlimited
