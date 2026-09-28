#!/usr/bin/env bash
#
# Deploys the API to Vercel production.
#
# Usage: npm run deploy [-- --seed]
#
# Reads MONGODB_URI, CORS_ORIGIN and (optionally) JWT_SECRET from the environment or
# from .env.production. Existing Vercel values are replaced; JWT_SECRET is generated
# only when the project does not have one yet, so issued tokens stay valid across deploys.

set -euo pipefail

cd "$(dirname "$0")/.."

SEED=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v vercel >/dev/null || fail "Vercel CLI not found. Install it with: npm i -g vercel"
vercel whoami >/dev/null 2>&1 || fail "Not logged in to Vercel. Run: vercel login"

load_env_file() {
  local key value
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    value="${value%$'\r'}"
    value="${value#\"}"; value="${value%\"}"
    [[ -z "${!key:-}" && -n "$value" ]] && export "$key=$value"
  done < "$1"
}

[[ -f .env.production ]] && load_env_file .env.production

[[ -n "${MONGODB_URI:-}" ]] || fail "MONGODB_URI is not set (export it or add it to .env.production)"
[[ -n "${CORS_ORIGIN:-}" ]] || fail "CORS_ORIGIN is not set (the frontend URL, e.g. https://secure-notes-web.vercel.app)"

[[ -d .vercel ]] || { log "Linking Vercel project"; vercel link --yes --project secure-notes-api >/dev/null; }

set_env() {
  local name="$1" value="$2"
  vercel env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$name" production >/dev/null
  log "Set $name"
}

has_env() {
  vercel env ls production 2>/dev/null | awk '{print $1}' | grep -qx "$1"
}

log "Checking database connectivity"
node --input-type=module -e "
  import mongoose from 'mongoose';
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.db.admin().ping();
  await mongoose.disconnect();
" 2>/dev/null || fail "Cannot reach MongoDB. In Atlas, check Network Access allows 0.0.0.0/0 and the user credentials are correct."

set_env MONGODB_URI "$MONGODB_URI"
set_env CORS_ORIGIN "$CORS_ORIGIN"
if [[ -n "${JWT_SECRET:-}" ]]; then
  set_env JWT_SECRET "$JWT_SECRET"
elif ! has_env JWT_SECRET; then
  set_env JWT_SECRET "$(openssl rand -hex 32)"
else
  log "Keeping existing JWT_SECRET"
fi

log "Deploying to production"
DEPLOY_OUTPUT="$(vercel deploy --prod --yes 2>&1)" || { echo "$DEPLOY_OUTPUT"; fail "Deployment failed"; }
API_URL="$(grep -Eo 'Aliased[[:space:]]+https://[^[:space:]]+' <<<"$DEPLOY_OUTPUT" | awk '{print $2}' | tail -1)"
[[ -n "$API_URL" ]] || API_URL="$(grep -Eo 'https://[^[:space:]"]+\.vercel\.app' <<<"$DEPLOY_OUTPUT" | tail -1)"
log "Deployed: $API_URL"

if [[ "$SEED" == true ]]; then
  log "Seeding database"
  MONGODB_URI="$MONGODB_URI" JWT_SECRET="${JWT_SECRET:-seed-only-secret-seed-only-secret}" node scripts/seed.js
fi

log "Smoke testing"
status="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/health")"
[[ "$status" == 200 ]] || fail "GET /api/health returned $status"
status="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"email":"smoke-test@example.com","password":"not-a-real-password"}' "$API_URL/api/auth/login")"
[[ "$status" == 401 ]] || fail "POST /api/auth/login returned $status (expected 401 for unknown user)"

log "API is live at $API_URL"
