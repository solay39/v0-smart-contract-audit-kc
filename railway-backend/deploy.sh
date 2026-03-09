#!/bin/bash
# Solay39 Railway Deploy Script

set -e

echo "=== Solay39 Railway Backend Deploy ==="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm i -g @railway/cli
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway:"
    railway login
fi

# Initialize project if not already
if [ ! -f ".railway/config.json" ]; then
    echo "Creating new Railway project..."
    railway init --name solay39-backend
fi

# Set environment variables
echo "Setting environment variables..."
railway variables set STATIC_ANALYSIS_API_KEY="${STATIC_ANALYSIS_API_KEY:-solay39-railway-$(date +%Y%m%d)}"
railway variables set PORT=8000

# Deploy
echo "Deploying to Railway..."
railway up --detach

# Get domain
echo ""
echo "=== Deploy Complete ==="
echo ""
echo "Getting deployment URL..."
DOMAIN=$(railway domain 2>/dev/null || echo "pending...")

echo ""
echo "Your Railway URL: https://$DOMAIN"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Add these to Vercel Environment Variables:"
echo "   STATIC_ANALYSIS_API_URL=https://$DOMAIN"
echo "   STATIC_ANALYSIS_API_KEY=solay39-railway-$(date +%Y%m%d)"
echo ""
echo "2. Test the endpoint:"
echo "   curl https://$DOMAIN/health"
echo ""
echo "Done!"
