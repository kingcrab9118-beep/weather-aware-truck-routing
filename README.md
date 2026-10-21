# Weather-Aware Truck Routing

React + Django app that helps a truck driver pick the safest route using **weather**, **load weight**, and **travel time**.

## Features

- Geocode origin & destination
- Generate up to **3 routes** (OpenRouteService if `ORS_API_KEY` is set, else OSRM)
- Sample weather every **10 / 25 / 50 miles** at each checkpoint ETA (Open-Meteo)
- Apply wind / rain / snow thresholds and load rules
- Recommend by: fewest Severe → High → lowest avg risk → shortest time
- Map with routes, checkpoints, ETAs, and a **0–48h corridor heatmap** slider

## Project layout

```
backend/                 Django API
  routing/
    risk.py              Risk thresholds, load rules, recommendation
    geo.py               Checkpoint sampling & corridor grid
    geocoding.py         Nominatim
    providers.py         ORS + OSRM routing
    weather.py           Open-Meteo checkpoints & heatmap
    services.py          Trip analysis orchestration
    views.py             REST endpoints
frontend/                React (Vite) + Leaflet
scripts/                 Local run helpers
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env    # or: cp .env.example .env
python manage.py migrate
python manage.py runserver 8001
```

API: `http://127.0.0.1:8001/api/`

Optional: set `ORS_API_KEY` in `backend/.env`  
(free key → https://openrouteservice.org/)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://127.0.0.1:5173` (proxies `/api` → Django `:8001`)

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health/` | Health + whether ORS key is loaded |
| GET | `/api/risk-rules/` | Thresholds & recommendation order |
| GET | `/api/geocode/?q=` | Geocode a place |
| POST | `/api/analyze/` | Full trip analysis |

### `POST /api/analyze/` body

```json
{
  "origin": "Chicago, IL",
  "destination": "Denver, CO",
  "departure": "2026-10-21T18:00:00.000Z",
  "load_lb": 35000,
  "sample_interval_mi": 25
}
```

## Tests

```bash
cd backend
python manage.py test routing
```

## Deploy (Render — one service)

The production build serves the React SPA and Django API from **one URL**.

1. Push this repo to GitHub (public or private).
2. Go to [Render Blueprint deploy](https://render.com/deploy) and connect the repo  
   (or use **New → Blueprint** and select this repo — it reads `render.yaml`).
3. Optional: set `ORS_API_KEY` in the Render dashboard (OpenRouteService).
4. After deploy, open `https://<service>.onrender.com` — UI at `/`, API at `/api/`.

Local production-style build:

```bash
cd frontend && npm install && npm run build
# Windows PowerShell:
Remove-Item -Recurse -Force ..\backend\frontend_dist -ErrorAction SilentlyContinue
Copy-Item -Recurse dist ..\backend\frontend_dist
cd ..\backend
pip install -r requirements.txt
gunicorn config.wsgi:application --bind 127.0.0.1:8001 --timeout 120
```

Free Render instances sleep after idle time; the first request may take ~30–60s to wake.

## Deliverables checklist

- [x] Working React + Django app
- [ ] GitHub repository
- [ ] Hosted application
- [ ] 5–10 min Loom walkthrough
