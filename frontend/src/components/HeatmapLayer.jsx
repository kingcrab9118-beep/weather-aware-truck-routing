import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'

/**
 * Weather intensity heatmap for the selected forecast hour.
 * points: [{ lat, lon, intensities: number[] }]
 */
export default function HeatmapLayer({ points, hourIndex, visible }) {
  const map = useMap()

  useEffect(() => {
    if (!visible || !points?.length) return undefined

    const latlngs = points
      .map((p) => {
        const intensity = p.intensities?.[hourIndex] ?? 0
        if (intensity <= 0.01) return null
        // Soft floor so the corridor reads as a band, not isolated dots
        const weight = Math.min(1, 0.18 + intensity * 0.92)
        return [p.lat, p.lon, weight]
      })
      .filter(Boolean)

    const layer = L.heatLayer(latlngs, {
      radius: 42,
      blur: 32,
      maxZoom: 11,
      max: 1,
      minOpacity: 0.4,
      gradient: {
        0.15: '#1a4d3a',
        0.35: '#2f9e6b',
        0.55: '#c9a227',
        0.75: '#d97706',
        0.9: '#c2410c',
        1.0: '#7f1d1d',
      },
    })

    layer.addTo(map)
    return () => {
      map.removeLayer(layer)
    }
  }, [map, points, hourIndex, visible])

  return null
}
