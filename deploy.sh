#!/bin/bash
# Deploy dashboard and/or tablet to alblue (staging) or algreen (pilot).
#
# Usage: ./deploy.sh [staging|pilot] [dashboard|tablet|all]
#   staging → alblue.duckdns.org + alblue-tablet.duckdns.org → /opt/alblue/
#   pilot   → tracker-api.algreen.rs → /opt/algreen/  (FROZEN, see pilot-deploy-gate)
#
# Sentry: shared mes-api project, distinguished by VITE_SENTRY_ENVIRONMENT.
# The DSN is a public identifier (gets baked into the JS bundle either way),
# so committing it here gives no extra exposure.
set -e

SENTRY_DSN="https://315954545e637502fd5497b3090b5c9c@o4511398917177344.ingest.de.sentry.io/4511398994313296"

TARGET=${1:-}
APP=${2:-all}

if [ "$TARGET" = "staging" ]; then
  DASHBOARD_API=https://alblue.duckdns.org
  TABLET_API=https://alblue-tablet.duckdns.org
  HOST=root@46.101.166.137
  REMOTE_BASE=/opt/alblue
  SENTRY_ENV=alblue-staging
elif [ "$TARGET" = "pilot" ]; then
  DASHBOARD_API=https://tracker-api.algreen.rs
  TABLET_API=https://tracker-api.algreen.rs
  HOST=root@46.101.166.137
  REMOTE_BASE=/opt/algreen
  SENTRY_ENV=algreen-pilot
else
  echo "Usage: ./deploy.sh [staging|pilot] [dashboard|tablet|all]"
  echo "  staging → /opt/alblue/   (alblue.duckdns.org + alblue-tablet.duckdns.org)"
  echo "  pilot   → /opt/algreen/  (tracker-api.algreen.rs)  FROZEN"
  exit 1
fi

SENTRY_RELEASE=$(git rev-parse --short HEAD)

if [ "$APP" = "dashboard" ] || [ "$APP" = "all" ]; then
  echo "🔨 Building dashboard ($TARGET, $SENTRY_RELEASE)..."
  VITE_API_BASE_URL="${DASHBOARD_API}/api" \
  VITE_SIGNALR_URL="${DASHBOARD_API}/hubs/production" \
  VITE_SENTRY_DSN="$SENTRY_DSN" \
  VITE_SENTRY_ENVIRONMENT="$SENTRY_ENV" \
  VITE_SENTRY_RELEASE="$SENTRY_RELEASE" \
  pnpm --filter dashboard build
  echo "📦 Uploading dashboard → ${HOST}:${REMOTE_BASE}/dashboard/ ..."
  rsync -az --delete apps/dashboard/dist/ "${HOST}:${REMOTE_BASE}/dashboard/"
  echo "✅ Dashboard deployed!"
fi

if [ "$APP" = "tablet" ] || [ "$APP" = "all" ]; then
  echo "🔨 Building tablet ($TARGET, $SENTRY_RELEASE)..."
  VITE_API_BASE_URL="${TABLET_API}/api" \
  VITE_SIGNALR_URL="${TABLET_API}/hubs/production" \
  VITE_SENTRY_DSN="$SENTRY_DSN" \
  VITE_SENTRY_ENVIRONMENT="$SENTRY_ENV" \
  VITE_SENTRY_RELEASE="$SENTRY_RELEASE" \
  pnpm --filter tablet build
  echo "📦 Uploading tablet → ${HOST}:${REMOTE_BASE}/tablet/ ..."
  rsync -az --delete apps/tablet/dist/ "${HOST}:${REMOTE_BASE}/tablet/"
  echo "✅ Tablet deployed!"
fi

if [ "$APP" != "dashboard" ] && [ "$APP" != "tablet" ] && [ "$APP" != "all" ]; then
  echo "Usage: ./deploy.sh [staging|pilot] [dashboard|tablet|all]"
  exit 1
fi
