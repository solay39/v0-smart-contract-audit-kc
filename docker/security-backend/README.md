# Solay39 Security Backend

Backend server reale per eseguire Slither, Mythril e Foundry.

## Deploy su Railway

1. **Crea progetto su Railway:**
   ```bash
   cd docker/security-backend
   railway login
   railway init
   ```

2. **Configura variabili ambiente:**
   ```bash
   railway variables set SECURITY_API_KEY=<tua-chiave-segreta>
   railway variables set PORT=3001
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

4. **Ottieni URL:**
   ```bash
   railway domain
   # Esempio: solay39-security.up.railway.app
   ```

5. **Configura Solay39:**
   Su Vercel, aggiungi variabile ambiente:
   ```
   STATIC_ANALYSIS_API_URL=https://solay39-security.up.railway.app
   SECURITY_API_KEY=<tua-chiave-segreta>
   ```

## Endpoints

### Health Check
```bash
GET /health
```

### Slither Analysis
```bash
POST /api/slither
Headers: x-api-key: <key>
Body: { "code": "...", "contractName": "MyContract" }
```

### Mythril Analysis
```bash
POST /api/mythril
Headers: x-api-key: <key>
Body: { "code": "...", "contractName": "MyContract", "timeout": 120 }
```

### Foundry Fuzzing
```bash
POST /api/foundry/fuzz
Headers: x-api-key: <key>
Body: { "code": "...", "contractName": "MyContract", "fuzzRuns": 5000 }
```

### Combined Analysis
```bash
POST /api/analyze
Headers: x-api-key: <key>
Body: { "code": "...", "contractName": "MyContract", "tools": ["slither", "mythril"] }
```

## Test Locale

```bash
# Build
docker build -t solay39-security .

# Run
docker run -p 3001:3001 -e SECURITY_API_KEY=test solay39-security

# Test
curl http://localhost:3001/health
```

## Costi Railway

- **Hobby Plan:** $5/mese (500 ore)
- **Pro Plan:** $20/mese (illimitate)

Il container usa ~1GB RAM durante l'analisi Mythril.
