import { useMemo, useState } from 'react'
import { analyzeTrip } from './api'
import TripForm, { toLocalInputValue } from './components/TripForm'
import RouteMap from './components/RouteMap'
import RecommendationPanel from './components/RecommendationPanel'
import RouteList from './components/RouteList'
import CheckpointList from './components/CheckpointList'
import MapOverlay from './components/MapOverlay'

const DEFAULT_FORM = {
  origin: 'Chicago, IL',
  destination: 'Denver, CO',
  departure: toLocalInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  load_lb: '35000',
  sample_interval_mi: 25,
}

export default function App() {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [hourIndex, setHourIndex] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const selectedRoute = useMemo(() => {
    if (!result?.routes?.length) return null
    return result.routes.find((r) => r.id === selectedRouteId) || result.routes[0]
  }, [result, selectedRouteId])

  const hourLabel = result?.heatmap?.hours?.[hourIndex]
    ? new Date(result.heatmap.hours[hourIndex]).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
      })
    : `+${hourIndex}h`

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    try {
      const data = await analyzeTrip({
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        departure: new Date(form.departure).toISOString(),
        load_lb: Number(form.load_lb),
        sample_interval_mi: Number(form.sample_interval_mi),
      })
      setResult(data)
      setSelectedRouteId(data.recommended_route_id || data.routes?.[0]?.id)
      setHourIndex(0)
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <div className="brand-mark">Weather-Aware</div>
          <h1>Truck Routing</h1>
          <p>
            Compare three routes with weather sampled at each checkpoint ETA, then pick the safest
            balance of risk and time.
          </p>
        </header>

        <TripForm value={form} onChange={setForm} onSubmit={handleAnalyze} loading={loading} />
        {error && <div className="error-banner">{error}</div>}

        {result && (
          <>
            <RecommendationPanel routes={result.routes} />
            <RouteList
              routes={result.routes}
              selectedId={selectedRoute?.id}
              onSelect={setSelectedRouteId}
            />
            <CheckpointList route={selectedRoute} sampleIntervalMi={result.sample_interval_mi} />
          </>
        )}

        <section className="panel">
          <h2>Risk & load rules</h2>
          <ul className="rules-list">
            <li>Wind / rain / snow use the project thresholds (Low → No Travel).</li>
            <li>≥55 mph wind → No Travel for any load.</li>
            <li>45–54 mph + &gt;30,000 lb → No Travel.</li>
            <li>35–44 mph + &gt;40,000 lb → Severe.</li>
            <li>Recommend: fewest Severe miles, then High, then avg risk, then time.</li>
          </ul>
        </section>
      </aside>

      <main className="map-stage">
        <RouteMap
          result={result}
          selectedRouteId={selectedRoute?.id}
          onSelectRoute={setSelectedRouteId}
          hourIndex={hourIndex}
          showHeatmap={showHeatmap}
        />
        <MapOverlay
          result={result}
          hourIndex={hourIndex}
          hourLabel={hourLabel}
          showHeatmap={showHeatmap}
          onHourChange={setHourIndex}
          onToggleHeatmap={setShowHeatmap}
        />
      </main>
    </div>
  )
}
