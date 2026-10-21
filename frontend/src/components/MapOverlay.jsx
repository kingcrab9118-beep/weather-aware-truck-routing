import { RISK_COLORS } from '../riskColors'

export default function MapOverlay({
  result,
  hourIndex,
  hourLabel,
  showHeatmap,
  onHourChange,
  onToggleHeatmap,
}) {
  if (!result) return null

  const maxHour = Math.max((result.heatmap?.hours?.length || 49) - 1, 0)

  return (
    <div className="map-overlay">
      <div className="legend">
        {Object.entries(RISK_COLORS).map(([label, color]) => (
          <span key={label} className="legend-item">
            <span className="legend-swatch" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="heatmap-panel">
        <h3>Weather heatmap · corridor forecast</h3>
        <p className="hint">
          Slide 0–48 hours from now. Intensity blends wind, rain, and snow risk along the trip
          corridor.
        </p>
        <div className="slider-row">
          <input
            type="range"
            min={0}
            max={maxHour}
            value={hourIndex}
            onChange={(e) => onHourChange(Number(e.target.value))}
          />
          <span className="hour-label">{hourLabel}</span>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => onToggleHeatmap(e.target.checked)}
          />
          Show heatmap
        </label>
      </div>
    </div>
  )
}
