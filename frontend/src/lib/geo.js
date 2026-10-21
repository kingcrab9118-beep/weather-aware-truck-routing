const EARTH_RADIUS_MI = 3958.7613

export function haversineMi(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const rlat1 = toRad(lat1)
  const rlon1 = toRad(lon1)
  const rlat2 = toRad(lat2)
  const rlon2 = toRad(lon2)
  const dlat = rlat2 - rlat1
  const dlon = rlon2 - rlon1
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a))
}

export function routeLengthMi(coords) {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    total += haversineMi(lat1, lon1, lat2, lon2)
  }
  return total
}

export function sampleAlongRoute(coords, intervalMi) {
  if (!coords.length) return []
  if (coords.length === 1) {
    const [lon, lat] = coords[0]
    return [{ lat, lon, distance_mi: 0, index: 0 }]
  }

  const samples = []
  const [lon0, lat0] = coords[0]
  samples.push({ lat: lat0, lon: lon0, distance_mi: 0, index: 0 })

  let nextTarget = intervalMi
  let traveled = 0
  let sampleIdx = 1

  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    const segLen = haversineMi(lat1, lon1, lat2, lon2)
    if (segLen === 0) continue

    while (traveled + segLen >= nextTarget) {
      const remain = nextTarget - traveled
      const t = remain / segLen
      samples.push({
        lat: lat1 + (lat2 - lat1) * t,
        lon: lon1 + (lon2 - lon1) * t,
        distance_mi: +nextTarget.toFixed(3),
        index: sampleIdx,
      })
      sampleIdx += 1
      nextTarget += intervalMi
    }
    traveled += segLen
  }

  const [lonE, latE] = coords[coords.length - 1]
  if (samples[samples.length - 1].distance_mi < traveled - 0.05) {
    samples.push({
      lat: latE,
      lon: lonE,
      distance_mi: +traveled.toFixed(3),
      index: sampleIdx,
    })
  } else {
    samples[samples.length - 1] = {
      lat: latE,
      lon: lonE,
      distance_mi: +traveled.toFixed(3),
      index: samples[samples.length - 1].index,
    }
  }
  return samples
}

/**
 * Keep heatmap points that lie near a route polyline (GeoJSON [lon, lat]).
 * Used so the corridor forecast hugs the selected route, not alternate detours.
 */
export function pointsNearRoute(points, routeCoords, maxMi = 40) {
  if (!points?.length || !routeCoords?.length) return []
  const stride = Math.max(1, Math.floor(routeCoords.length / 80))
  return points.filter((p) => {
    for (let i = 0; i < routeCoords.length; i += stride) {
      const [lon, lat] = routeCoords[i]
      if (haversineMi(p.lat, p.lon, lat, lon) <= maxMi) return true
    }
    return false
  })
}

export function corridorGrid(coords, spacingMi = 28, maxPoints = 80) {
  if (!coords?.length) return []

  const centerline = sampleAlongRoute(coords, spacingMi)
  const midLat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const latOff = (spacingMi / 69) * 0.55
  const lonOff = (spacingMi / Math.max(69 * Math.cos((midLat * Math.PI) / 180), 1e-6)) * 0.55
  const seen = new Set()
  const points = []

  const add = (lat, lon) => {
    const keyLat = +lat.toFixed(3)
    const keyLon = +lon.toFixed(3)
    const key = `${keyLat},${keyLon}`
    if (seen.has(key)) return points.length >= maxPoints
    seen.add(key)
    points.push({ lat: keyLat, lon: keyLon })
    return points.length >= maxPoints
  }

  // Centerline first so the full haul is covered before lateral offsets.
  for (const cp of centerline) {
    if (add(cp.lat, cp.lon)) return points
  }
  const remaining = maxPoints - points.length
  if (remaining > 0 && centerline.length) {
    const stride = Math.max(1, Math.floor(centerline.length / Math.max(1, Math.floor(remaining / 4))))
    for (let i = 0; i < centerline.length; i += stride) {
      const cp = centerline[i]
      for (const [dlat, dlon] of [
        [latOff, 0],
        [-latOff, 0],
        [0, lonOff],
        [0, -lonOff],
      ]) {
        if (add(cp.lat + dlat, cp.lon + dlon)) return points
      }
    }
  }
  return points
}
