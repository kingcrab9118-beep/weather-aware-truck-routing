import { RISK_COLORS, formatEta } from '../riskColors'

export default function CheckpointList({ route, sampleIntervalMi }) {
  if (!route) return null

  return (
    <section className="panel">
      <h2>
        Checkpoints · every {sampleIntervalMi} mi · {route.label}
      </h2>
      <div className="checkpoint-list">
        {route.checkpoints.map((cp) => (
          <div key={cp.index} className="checkpoint-item">
            <span className="dot" style={{ background: RISK_COLORS[cp.risk] }} />
            <div>
              <div>
                mi {cp.distance_mi.toFixed(1)} · {cp.risk}
              </div>
              <div className="muted">
                {cp.weather.wind_mph} mph wind · {cp.weather.rain_in_hr} in rain ·{' '}
                {cp.weather.snow_in_hr} in snow
              </div>
            </div>
            <span className="eta">{formatEta(cp.eta)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
