#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DJANGO_DEBUG="${DJANGO_DEBUG:-False}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-*}"
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-replit-weather-truck-routing-change-me}"
export PORT="${PORT:-8000}"

# Build SPA into Django frontend_dist (served by WhiteNoise + spa_index)
if [[ ! -f frontend/dist/index.html ]]; then
  cd frontend
  npm install
  VITE_BASE=/ npm run build
  cd "$ROOT"
fi

rm -rf backend/frontend_dist
mkdir -p backend/frontend_dist
cp -r frontend/dist/. backend/frontend_dist/

cd backend
python -m pip install -r requirements.txt waitress
exec python -m waitress --listen="0.0.0.0:${PORT}" --channel-timeout=120 config.wsgi:application
