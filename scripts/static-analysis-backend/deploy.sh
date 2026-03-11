#!/bin/bash
# SOLAY39 Static Analysis Backend - Deploy to Railway
# 
# Prerequisites:
# 1. Install Railway CLI: npm i -g @railway/cli
# 2. Login: railway login
#
# Usage: ./deploy.sh

set -e

echo "=========================================="
echo "SOLAY39 Static Analysis Backend Deploy"
echo "=========================================="

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "Railway CLI not found. Installing..."
    npm i -g @railway/cli
fi

# Initialize project if not exists
if [ ! -f ".railway" ]; then
    echo "Initializing Railway project..."
    railway init
fi

# Set environment variables
echo "Setting environment variables..."
railway variables set API_KEY="$(openssl rand -hex 32)"
railway variables set TIMEOUT="180"

# Deploy
echo "Deploying to Railway..."
railway up --detach

# Get deployment URL
echo ""
echo "=========================================="
echo "Deployment complete!"
echo ""
echo "Your backend URL will be available at:"
railway status
echo ""
echo "Add this to your Vercel environment variables:"
echo "STATIC_ANALYSIS_API_URL=https://your-app.railway.app"
echo "STATIC_ANALYSIS_API_KEY=<the API_KEY above>"
echo "=========================================="
