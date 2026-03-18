#!/bin/bash
set -e

export VITE_API_BASE_URL=https://tracker-api.algreen.rs/api
export VITE_SIGNALR_URL=https://tracker-api.algreen.rs/hubs/production

TARGET=${1:-all}

if [ "$TARGET" = "dashboard" ] || [ "$TARGET" = "all" ]; then
  echo "🔨 Building dashboard..."
  pnpm --filter dashboard build
  echo "📦 Uploading dashboard..."
  rsync -az --delete apps/dashboard/dist/ root@46.101.166.137:/opt/algreen/dashboard/
  echo "✅ Dashboard deployed!"
fi

if [ "$TARGET" = "tablet" ] || [ "$TARGET" = "all" ]; then
  echo "🔨 Building tablet..."
  pnpm --filter tablet build
  echo "📦 Uploading tablet..."
  rsync -az --delete apps/tablet/dist/ root@46.101.166.137:/opt/algreen/tablet/
  echo "✅ Tablet deployed!"
fi

if [ "$TARGET" != "dashboard" ] && [ "$TARGET" != "tablet" ] && [ "$TARGET" != "all" ]; then
  echo "Usage: ./deploy.sh [dashboard|tablet|all]"
  exit 1
fi
