import { RISK_COLORS, ROUTE_PALETTE, formatDuration } from '../riskColors'

const RISK_ORDER = ['Severe', 'High', 'Moderate', 'Low', 'No Travel']

export default function RouteList({ routes, selectedId, onSelect }) {
  return (
    <section className="panel">
      <h2>Route options</h2>
      <div className="route-list">
        {routes.map((route, i) => (
          <button
            key={route.id}
            type="button"
            className={[
              'route-card',
              selectedId === route.id ? 'active' : '',
              route.recommended ? 'recommended' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(route.id)}
          >
            <div className="route-card-top">
              <span className="route-title">
                #{route.rank} {route.label}
              </span>
              {route.recommended && <span className="badge">Recommended</span>}
            </div>
            <div className="meta-row">
              <span>{route.distance_mi} mi</span>
              <span>{formatDuration(route.duration_min)}</span>
              <span>max {route.risk_summary.max_risk}</span>
            </div>
            <div className="risk-pills">
              {RISK_ORDER.map((level) => {
                const miles = route.risk_summary.risk_miles?.[level] || 0
                if (miles <= 0) return null
                return (
                  <span
                    key={level}
                    className="pill"
                    style={{ background: RISK_COLORS[level] }}
                    title={`${level}: ${miles} mi`}
                  >
                    {level} {miles} mi
                  </span>
                )
              })}
            </div>
            <div className="meta-row meta-row-spaced">
              <span style={{ color: ROUTE_PALETTE[i % ROUTE_PALETTE.length] }}>
                Corridor {String.fromCharCode(65 + i)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
