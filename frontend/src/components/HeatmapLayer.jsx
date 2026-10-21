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

    // Paint every corridor sample end-to-end. Calm stretches still get a
    // visible teal band; higher intensity brightens toward amber/red.
    const latlngs = points.map((p) => {
      const intensity = Math.max(0, Math.min(1, p.intensities?.[hourIndex] ?? 0))
      // Keep a strong floor so calm western miles stay visible as a teal ribbon
      const weight = Math.min(1, 0.55 + intensity * 0.45)
      return [p.lat, p.lon, weight]
    })

    if (!latlngs.length) return undefined

    const layer = L.heatLayer(latlngs, {
      radius: 48,
      blur: 32,
      maxZoom: 9,
      max: 1,
      minOpacity: 0.55,
      gradient: {
        0.0: '#1f6b4a',
        0.3: '#2f9e6b',
        0.5: '#c9a227',
        0.65: '#d97706',
        0.8: '#c2410c',
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
