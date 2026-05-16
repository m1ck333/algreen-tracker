#!/bin/bash
# Deploy algreen-tracker-fe → algreen pilot (Mile's production).
#
# IMPORTANT: This repo deploys ONLY to algreen pilot. For alblue staging
# use the alblue-tracker-fe repo, which carries the blue branding and
# title. The two repos have diverged on logos, theme colors and
# localStorage keys — never deploy this one to /opt/alblue/.
#
# Sentry: dormant by default. Set VITE_SENTRY_DSN before invoking to
# activate the FE SDK; otherwise the SDK no-ops. Once the pilot is
# unfrozen and ready for Sprint 3, uncomment the inline SENTRY_DSN.
set -e

export VITE_API_BASE_URL=https://tracker-api.algreen.rs/api
export VITE_SIGNALR_URL=https://tracker-api.algreen.rs/hubs/production

# Sentry — leave empty so SDK no-ops until pilot is unfrozen and ready
# to take Sprint 3 changes. To activate, uncomment the DSN line.
# SENTRY_DSN="https://315954545e637502fd5497b3090b5c9c@o4511398917177344.ingest.de.sentry.io/4511398994313296"
export VITE_SENTRY_DSN="${SENTRY_DSN:-}"
export VITE_SENTRY_ENVIRONMENT="algreen-pilot"
export VITE_SENTRY_RELEASE="$(git rev-parse --short HEAD)"

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
