import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import HeatmapLayer from './HeatmapLayer'
import { pointsNearRoute } from '../lib/geo'
import { RISK_COLORS, ROUTE_PALETTE, formatEta } from '../riskColors'

/** Free basemap — Carto CDN now watermarks without an API key. */
function BaseTiles() {
  return (
    <TileLayer
      attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      maxZoom={16}
    />
  )
}

function FitBounds({ routes, selectedId }) {
  const map = useMap()

  useEffect(() => {
    if (!routes?.length) return
    const selected = routes.find((r) => r.id === selectedId) || routes[0]
    const coords = selected.geometry.coordinates.map(([lon, lat]) => [lat, lon])
    if (!coords.length) return
    const bounds = L.latLngBounds(coords)
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 9, animate: true })
  }, [map, routes, selectedId])

  return null
}

export default function RouteMap({
  result,
  selectedRouteId,
  onSelectRoute,
  hourIndex,
  showHeatmap,
}) {
  const routes = result?.routes || []
  const selected = routes.find((r) => r.id === selectedRouteId) || routes[0]

  // Heatmap is built from all route corridors; clip to the selected route so
  // weather on southern/northern alternates does not float beside this path.
  const heatmapPoints = useMemo(() => {
    const points = result?.heatmap?.points
    const coords = selected?.geometry?.coordinates
    if (!points?.length || !coords?.length) return points || []
    return pointsNearRoute(points, coords, 38)
  }, [result?.heatmap?.points, selected])

  const center = useMemo(() => {
    if (result?.origin) return [result.origin.lat, result.origin.lon]
    return [39.5, -98.35]
  }, [result])

  if (!result) {
    return (
      <div className="map-stage">
        <MapContainer center={center} zoom={4} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <BaseTiles />
        </MapContainer>
        <div className="empty-map">
          <div>
            <strong>Plan a safer haul</strong>
            Enter origin, destination, departure, and load weight to compare
            weather-aware routes.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="map-stage">
      <MapContainer center={center} zoom={6} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <BaseTiles />
        <FitBounds routes={routes} selectedId={selectedRouteId} />
        <HeatmapLayer
          points={heatmapPoints}
          hourIndex={hourIndex}
          visible={showHeatmap}
        />

        {routes.map((route, i) => {
          const positions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon])
          const isSelected = route.id === selected?.id
          return (
            <Polyline
              key={route.id}
              positions={positions}
              pathOptions={{
                color: ROUTE_PALETTE[i % ROUTE_PALETTE.length],
                weight: isSelected ? 6 : 3,
                opacity: isSelected ? 0.95 : 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              eventHandlers={{
                click: () => onSelectRoute(route.id),
              }}
            />
          )
        })}

        {selected?.checkpoints?.map((cp) => (
          <CircleMarker
            key={`${selected.id}-${cp.index}`}
            center={[cp.lat, cp.lon]}
            radius={7}
            pathOptions={{
              color: '#0f1c18',
              weight: 2,
              fillColor: RISK_COLORS[cp.risk] || '#999',
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div>
                <div>
                  <strong>
                    Mile {cp.distance_mi.toFixed(1)} · {selected.label}
                  </strong>
                </div>
                <div>ETA {formatEta(cp.eta)}</div>
                <div>
                  Wind {cp.weather.wind_mph} mph · Rain {cp.weather.rain_in_hr} in/hr · Snow{' '}
                  {cp.weather.snow_in_hr} in/hr
                </div>
                <div className="popup-risk" style={{ color: RISK_COLORS[cp.risk] }}>
                  {cp.risk}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {result.origin && (
          <CircleMarker
            center={[result.origin.lat, result.origin.lon]}
            radius={9}
            pathOptions={{ color: '#e8c547', fillColor: '#e8c547', fillOpacity: 1, weight: 2 }}
          >
            <Popup>Origin: {result.origin.name}</Popup>
          </CircleMarker>
        )}
        {result.destination && (
          <CircleMarker
            center={[result.destination.lat, result.destination.lon]}
            radius={9}
            pathOptions={{ color: '#7eb8d4', fillColor: '#7eb8d4', fillOpacity: 1, weight: 2 }}
          >
            <Popup>Destination: {result.destination.name}</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}
