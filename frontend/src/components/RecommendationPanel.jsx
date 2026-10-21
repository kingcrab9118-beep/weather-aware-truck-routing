import { formatDuration } from '../riskColors'

export default function RecommendationPanel({ routes }) {
  const rec = routes.find((r) => r.recommended) || routes[0]
  if (!rec) return null

  return (
    <section className="panel rec-banner">
      <h2>Recommendation</h2>
      <strong>{rec.label}</strong>
      <p className="panel-note">{rec.recommendation_note}</p>
      <div className="meta-row meta-row-spaced">
        <span>{rec.distance_mi} mi</span>
        <span>{formatDuration(rec.duration_min)}</span>
        <span>avg risk {rec.risk_summary.avg_risk}</span>
      </div>
    </section>
  )
}
