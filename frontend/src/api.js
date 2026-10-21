import { analyzeTripClient } from './lib/analyze'

// GitHub Pages / static hosts: run analysis in the browser (no Django needed).
// Local Django: set VITE_USE_CLIENT=false and use Vite proxy / VITE_API_BASE.
const USE_CLIENT =
  import.meta.env.VITE_USE_CLIENT !== 'false' &&
  import.meta.env.VITE_USE_CLIENT !== '0'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function analyzeTrip(payload) {
  if (USE_CLIENT) {
    return analyzeTripClient(payload)
  }
  const res = await fetch(`${API_BASE}/analyze/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Request failed (${res.status})`)
  }
  return data
}

export async function fetchRiskRules() {
  if (USE_CLIENT) {
    return {
      wind_mph: {
        Low: '<25',
        Moderate: '25–34',
        High: '35–44',
        Severe: '45–54',
        'No Travel': '≥55',
      },
      recommendation_order: [
        'Fewest Severe miles',
        'Fewest High miles',
        'Lowest average risk',
        'Shortest travel time',
      ],
    }
  }
  const res = await fetch(`${API_BASE}/risk-rules/`)
  if (!res.ok) throw new Error('Failed to load risk rules')
  return res.json()
}
