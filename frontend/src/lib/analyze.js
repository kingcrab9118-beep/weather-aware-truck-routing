/**
 * Browser-side trip analysis (no Django host required).
 * Uses Open-Meteo geocoding + weather, and public OSRM routing.
 */
import { corridorGrid, routeLengthMi, sampleAlongRoute } from './geo'
import {
  classifyCheckpointWeather,
  recommendRoutes,
  summarizeRouteRisk,
} from './risk'

const MS_TO_MPH = 2.236936
const MM_TO_INCH = 1 / 25.4
const M_TO_MI = 0.000621371
const OSRM_BASE = 'https://router.project-osrm.org'
const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast'

function precipToInches(precipMm, snowCm) {
  const snowInHr = snowCm / 2.54
  const rainInHr = Math.max(precipMm * MM_TO_INCH - snowInHr, 0)
  return [rainInHr, snowInHr]
}

function weatherIntensity(windMph, rainIn, snowIn) {
  return Math.max(
    Math.min(windMph / 55, 1) * 0.55,
    Math.min(rainIn / 1, 1) * 0.85,
    Math.min(snowIn / 3, 1),
  )
}

function pickHourlyIndex(times, target) {
  if (!times?.length) return 0
  const tMs = target.getTime()
  let best = 0
  let bestDiff = Infinity
  times.forEach((t, i) => {
    const diff = Math.abs(new Date(t + 'Z').getTime() - tMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  })
  return best
}

async function geocode(query) {
  const url = new URL(GEOCODE_BASE)
  url.searchParams.set('name', query)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  const data = await res.json()
  const hit = data.results?.[0]
  if (!hit) throw new Error(`Could not geocode: ${query}`)
  return {
    query,
    name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    lat: hit.latitude,
    lon: hit.longitude,
  }
}

function routeDict(id, label, coords, distanceM, durationSec) {
  return {
    id,
    label,
    provider: 'osrm',
    geometry: { type: 'LineString', coordinates: coords },
    distance_m: distanceM,
    duration_sec: durationSec,
    distance_mi: distanceM * M_TO_MI,
  }
}

async function fetchOsrmRoutes(origin, destination) {
  const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`
  const url = new URL(`${OSRM_BASE}/route/v1/driving/${coords}`)
  url.searchParams.set('overview', 'full')
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('alternatives', 'true')
  url.searchParams.set('steps', 'false')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Routing failed (${res.status})`)
  const payload = await res.json()
  if (payload.code !== 'Ok' || !payload.routes?.length) {
    throw new Error(payload.message || 'No routes found between the given locations.')
  }

  const routes = payload.routes.slice(0, 3).map((r, i) =>
    routeDict(
      `osrm-${i + 1}`,
      `Route ${String.fromCharCode(65 + i)}`,
      r.geometry.coordinates,
      r.distance,
      r.duration,
    ),
  )

  if (routes.length < 3 && routes[0]) {
    const mid = routes[0].geometry.coordinates[
      Math.floor(routes[0].geometry.coordinates.length / 2)
    ]
    for (const [dLon, dLat] of [
      [0.15, 0],
      [-0.15, 0],
      [0, 0.15],
    ]) {
      if (routes.length >= 3) break
      const via = `${origin.lon},${origin.lat};${mid[0] + dLon},${mid[1] + dLat};${destination.lon},${destination.lat}`
      try {
        const viaUrl = new URL(`${OSRM_BASE}/route/v1/driving/${via}`)
        viaUrl.searchParams.set('overview', 'full')
        viaUrl.searchParams.set('geometries', 'geojson')
        viaUrl.searchParams.set('steps', 'false')
        const viaRes = await fetch(viaUrl)
        if (!viaRes.ok) continue
        const viaPayload = await viaRes.json()
        const r = viaPayload.routes?.[0]
        if (!r) continue
        if (routes.some((e) => Math.abs(e.distance_m - r.distance) < 2000)) continue
        const idx = routes.length
        routes.push(
          routeDict(
            `osrm-via-${idx + 1}`,
            `Route ${String.fromCharCode(65 + idx)}`,
            r.geometry.coordinates,
            r.distance,
            r.duration,
          ),
        )
      } catch {
        /* skip via failure */
      }
    }
  }
  return routes.slice(0, 3)
}

async function fetchWeatherBatch(points) {
  if (!points.length) return []
  const url = new URL(WEATHER_BASE)
  url.searchParams.set('latitude', points.map((p) => p.lat).join(','))
  url.searchParams.set('longitude', points.map((p) => p.lon).join(','))
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,snowfall,windspeed_10m,weathercode',
  )
  url.searchParams.set('windspeed_unit', 'ms')
  url.searchParams.set('precipitation_unit', 'mm')
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('timezone', 'UTC')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  const payload = await res.json()
  return Array.isArray(payload) ? payload : [payload]
}

async function fetchWeatherAtPoints(points, departure, routeDurationSec, totalMiles) {
  const enriched = []
  const chunkSize = 20
  for (let start = 0; start < points.length; start += chunkSize) {
    const chunk = points.slice(start, start + chunkSize)
    const seriesList = await fetchWeatherBatch(chunk)
    chunk.forEach((p, i) => {
      const series = seriesList[i] || {}
      const hourly = series.hourly || {}
      const times = hourly.time || []
      const frac = totalMiles > 0 ? p.distance_mi / totalMiles : 0
      const eta = new Date(departure.getTime() + routeDurationSec * frac * 1000)
      const idx = pickHourlyIndex(times, eta)
      const windMph = (hourly.windspeed_10m?.[idx] || 0) * MS_TO_MPH
      const precipMm = hourly.precipitation?.[idx] || 0
      const snowCm = hourly.snowfall?.[idx] || 0
      const [rainInHr, snowInHr] = precipToInches(precipMm, snowCm)
      enriched.push({
        ...p,
        eta: eta.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        weather: {
          wind_mph: +windMph.toFixed(1),
          rain_in_hr: +rainInHr.toFixed(3),
          snow_in_hr: +snowInHr.toFixed(3),
          temp_c: +(hourly.temperature_2m?.[idx] || 0).toFixed(1),
          weathercode: hourly.weathercode?.[idx] ?? null,
        },
      })
    })
  }
  return enriched
}

async function fetchHeatmapForecast(routeCoordsList, hours = 48) {
  const routes = Array.isArray(routeCoordsList?.[0]?.[0])
    ? routeCoordsList
    : [routeCoordsList]
  const budgets = [70, ...Array(Math.max(routes.length - 1, 0)).fill(15)]
  const seen = new Set()
  const grid = []
  for (let i = 0; i < routes.length; i++) {
    for (const p of corridorGrid(routes[i], 25, budgets[i] ?? 15)) {
      const key = `${p.lat},${p.lon}`
      if (seen.has(key)) continue
      seen.add(key)
      grid.push(p)
      if (grid.length >= 90) break
    }
    if (grid.length >= 90) break
  }
  if (!grid.length) return { hours: [], points: [] }

  const seriesList = await fetchWeatherBatch(grid)
  const hourLabels = (seriesList[0]?.hourly?.time || []).slice(0, hours + 1)
  const points = grid.map((p, i) => {
    const hourly = seriesList[i]?.hourly || {}
    const intensities = hourLabels.map((_, hi) => {
      const windMph = (hourly.windspeed_10m?.[hi] || 0) * MS_TO_MPH
      const precipMm = hourly.precipitation?.[hi] || 0
      const snowCm = hourly.snowfall?.[hi] || 0
      const [rainIn, snowIn] = precipToInches(precipMm, snowCm)
      return +weatherIntensity(windMph, rainIn, snowIn).toFixed(3)
    })
    return { lat: p.lat, lon: p.lon, intensities }
  })
  return { hours: hourLabels, points }
}

export async function analyzeTripClient({
  origin,
  destination,
  departure,
  load_lb: loadLb,
  sample_interval_mi: sampleIntervalMi = 25,
}) {
  if (![10, 25, 50].includes(Number(sampleIntervalMi))) {
    throw new Error('sample_interval_mi must be 10, 25, or 50')
  }
  if (Number(loadLb) < 0) throw new Error('load_lb must be non-negative')

  const departureDate = new Date(departure)
  const originHit = await geocode(origin)
  const destHit = await geocode(destination)
  const rawRoutes = await fetchOsrmRoutes(originHit, destHit)

  const analyzed = []
  const routeCoordsList = []

  for (const route of rawRoutes) {
    const coords = route.geometry.coordinates
    routeCoordsList.push(coords)
    const totalMi = route.distance_mi || routeLengthMi(coords)
    const samples = sampleAlongRoute(coords, Number(sampleIntervalMi))
    const withWeather = await fetchWeatherAtPoints(
      samples,
      departureDate,
      route.duration_sec,
      totalMi,
    )

    const checkpoints = withWeather.map((point) => {
      const w = point.weather
      const classified = classifyCheckpointWeather(
        w.wind_mph,
        w.rain_in_hr,
        w.snow_in_hr,
        Number(loadLb),
      )
      return {
        index: point.index,
        lat: point.lat,
        lon: point.lon,
        distance_mi: point.distance_mi,
        eta: point.eta,
        weather: w,
        ...classified,
      }
    })

    analyzed.push({
      ...route,
      distance_mi: +totalMi.toFixed(2),
      duration_min: +(route.duration_sec / 60).toFixed(1),
      checkpoints,
      risk_summary: summarizeRouteRisk(checkpoints, totalMi),
      sample_interval_mi: Number(sampleIntervalMi),
    })
  }

  const ranked = recommendRoutes(analyzed)
  const recommended = ranked.find((r) => r.recommended) || ranked[0] || null

  let orderedCoords = routeCoordsList
  if (recommended) {
    const rec = recommended.geometry.coordinates
    orderedCoords = [rec, ...routeCoordsList.filter((c) => c !== rec)]
  }

  return {
    origin: originHit,
    destination: destHit,
    departure: departureDate.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    load_lb: Number(loadLb),
    sample_interval_mi: Number(sampleIntervalMi),
    routes: ranked,
    recommended_route_id: recommended?.id ?? null,
    heatmap: await fetchHeatmapForecast(orderedCoords, 48),
  }
}
