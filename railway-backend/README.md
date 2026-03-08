# Solay39 Security Backend (Railway)

Backend per static analysis reale con Slither, Mythril, e Foundry.

## Deploy su Railway

```bash
# 1. Clona questa cartella
cd railway-backend

# 2. Crea repo Git
git init
git add .
git commit -m "Solay39 backend v2"

# 3. Push a GitHub
gh repo create solay39-backend --public
git push -u origin main

# 4. Vai su https://railway.app
# - New Project → Deploy from GitHub
# - Seleziona solay39-backend
# - Railway detecta Dockerfile automaticamente

# 5. Settings → Variables:
STATIC_ANALYSIS_API_KEY=solay39-railway-2025
PORT=8000

# 6. Deploy!
```

## Configura Vercel

Aggiungi queste env vars su vercel.com → solay39 → Settings → Environment Variables:

```
STATIC_ANALYSIS_API_URL=https://YOUR-RAILWAY-APP.railway.app
STATIC_ANALYSIS_API_KEY=solay39-railway-2025
ALCHEMY_API_KEY=tua_alchemy_key
TELEGRAM_BOT_TOKEN=...  (opzionale)
TELEGRAM_CHAT_ID=...    (opzionale)
```

## Verifica

```bash
curl https://YOUR-RAILWAY-APP.railway.app/health
```

Risposta:
```json
{
  "status": "ok",
  "tools": {
    "slither": { "available": true, "version": "0.10.4" },
    "mythril": { "available": true, "version": "0.24.8" },
    "foundry": { "available": true, "version": "forge 0.2.0" }
  }
}
```

## Endpoints

- `GET /health` - Status tools
- `POST /analyze` - Analisi completa (Slither + Mythril + Foundry)
- `POST /exploit` - Genera PoC Foundry per finding

## Costi

Railway: ~$5-10/mese per usage moderato
