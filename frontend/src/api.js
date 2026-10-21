const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export async function analyzeTrip(payload) {
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
  const res = await fetch(`${API_BASE}/risk-rules/`)
  if (!res.ok) throw new Error('Failed to load risk rules')
  return res.json()
}
