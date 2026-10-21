#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DJANGO_DEBUG="${DJANGO_DEBUG:-False}"
export DJANGO_ALLOWED_HOSTS="${DJANGO_ALLOWED_HOSTS:-*}"
export DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-replit-weather-truck-routing-change-me}"
export PORT="${PORT:-8000}"

# Always rebuild SPA against Django API (same-origin /api)
cd frontend
npm install
VITE_BASE=/ VITE_USE_CLIENT=false npm run build
cd "$ROOT"

rm -rf backend/frontend_dist
mkdir -p backend/frontend_dist
cp -r frontend/dist/. backend/frontend_dist/

cd backend
python -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt waitress
exec python -m waitress --listen="0.0.0.0:${PORT}" --channel-timeout=120 config.wsgi:application
