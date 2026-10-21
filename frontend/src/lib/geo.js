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

export function corridorGrid(coords, spacingMi = 28, maxPoints = 80) {
  const lons = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  const pad = 0.5
  const bbox = {
    min_lon: Math.min(...lons) - pad,
    min_lat: Math.min(...lats) - pad,
    max_lon: Math.max(...lons) + pad,
    max_lat: Math.max(...lats) + pad,
  }
  const midLat = (bbox.min_lat + bbox.max_lat) / 2
  const latStep = spacingMi / 69
  const lonStep = spacingMi / Math.max(69 * Math.cos((midLat * Math.PI) / 180), 1e-6)
  const stride = Math.max(1, Math.floor(coords.length / 60))
  const points = []

  for (let lat = bbox.min_lat; lat <= bbox.max_lat && points.length < maxPoints; lat += latStep) {
    for (let lon = bbox.min_lon; lon <= bbox.max_lon && points.length < maxPoints; lon += lonStep) {
      let near = false
      for (let i = 0; i < coords.length; i += stride) {
        const [clon, clat] = coords[i]
        if (haversineMi(lat, lon, clat, clon) <= spacingMi * 1.6) {
          near = true
          break
        }
      }
      if (near) points.push({ lat: +lat.toFixed(4), lon: +lon.toFixed(4) })
    }
  }
  return points
}
