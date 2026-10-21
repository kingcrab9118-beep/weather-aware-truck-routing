export const RISK_COLORS = {
  Low: '#2f9e6b',
  Moderate: '#c9a227',
  High: '#d97706',
  Severe: '#c2410c',
  'No Travel': '#7f1d1d',
}

export const ROUTE_PALETTE = ['#1d6b5c', '#3b6ea5', '#8b5a2b']

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h <= 0) return `${m} min`
  return `${h}h ${m}m`
}

export function formatEta(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
