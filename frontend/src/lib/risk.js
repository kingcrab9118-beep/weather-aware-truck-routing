export const RISK_LEVELS = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']
export const RISK_SCORES = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Severe: 4,
  'No Travel': 5,
}

export function classifyWind(mph) {
  if (mph < 25) return 'Low'
  if (mph < 35) return 'Moderate'
  if (mph < 45) return 'High'
  if (mph < 55) return 'Severe'
  return 'No Travel'
}

export function classifyRain(inchesPerHour) {
  if (inchesPerHour < 0.1) return 'Low'
  if (inchesPerHour <= 0.25) return 'Moderate'
  if (inchesPerHour <= 0.5) return 'High'
  if (inchesPerHour <= 1.0) return 'Severe'
  return 'No Travel'
}

export function classifySnow(inchesPerHour) {
  if (inchesPerHour < 0.5) return 'Low'
  if (inchesPerHour <= 1.0) return 'Moderate'
  if (inchesPerHour <= 2.0) return 'High'
  if (inchesPerHour <= 3.0) return 'Severe'
  return 'No Travel'
}

export function worseRisk(a, b) {
  return RISK_SCORES[a] >= RISK_SCORES[b] ? a : b
}

export function applyLoadRules(baseRisk, windMph, loadLb) {
  let risk = baseRisk
  if (windMph >= 55) return 'No Travel'
  if (windMph >= 45 && windMph < 55 && loadLb > 30000) return 'No Travel'
  if (windMph >= 35 && windMph < 45 && loadLb > 40000) {
    risk = worseRisk(risk, 'Severe')
  }
  return risk
}

export function classifyCheckpointWeather(windMph, rainInHr, snowInHr, loadLb) {
  const windRisk = classifyWind(windMph)
  const rainRisk = classifyRain(rainInHr)
  const snowRisk = classifySnow(snowInHr)
  let weatherRisk = worseRisk(worseRisk(windRisk, rainRisk), snowRisk)
  const finalRisk = applyLoadRules(weatherRisk, windMph, loadLb)

  const drivers = []
  const maxComponent = Math.max(
    RISK_SCORES[windRisk],
    RISK_SCORES[rainRisk],
    RISK_SCORES[snowRisk],
  )
  if (RISK_SCORES[windRisk] === maxComponent) drivers.push('wind')
  if (RISK_SCORES[rainRisk] === maxComponent) drivers.push('rain')
  if (RISK_SCORES[snowRisk] === maxComponent) drivers.push('snow')
  if (finalRisk !== weatherRisk) drivers.push('load')

  return {
    risk: finalRisk,
    score: RISK_SCORES[finalRisk],
    components: {
      wind: windRisk,
      rain: rainRisk,
      snow: snowRisk,
      weather_only: weatherRisk,
      after_load: finalRisk,
    },
    drivers: drivers.length ? drivers : ['clear'],
  }
}

export function summarizeRouteRisk(checkpoints, totalMiles) {
  if (!checkpoints.length) {
    return {
      severe_miles: 0,
      high_miles: 0,
      no_travel_miles: 0,
      avg_risk: 0,
      max_risk: 'Low',
      risk_miles: Object.fromEntries(RISK_LEVELS.map((l) => [l, 0])),
      has_no_travel: false,
    }
  }

  const riskMiles = Object.fromEntries(RISK_LEVELS.map((l) => [l, 0]))
  let scoreMileSum = 0
  let maxScore = 1
  const n = checkpoints.length

  checkpoints.forEach((cp, i) => {
    let seg
    if (n === 1) seg = totalMiles
    else if (i === 0) seg = (checkpoints[1].distance_mi - cp.distance_mi) / 2
    else if (i === n - 1) {
      seg = (cp.distance_mi - checkpoints[i - 1].distance_mi) / 2
      seg += Math.max(totalMiles - cp.distance_mi, 0)
    } else {
      seg = (checkpoints[i + 1].distance_mi - checkpoints[i - 1].distance_mi) / 2
    }
    seg = Math.max(seg, 0)
    riskMiles[cp.risk] = (riskMiles[cp.risk] || 0) + seg
    scoreMileSum += cp.score * seg
    maxScore = Math.max(maxScore, cp.score)
  })

  const avgRisk = totalMiles > 0 ? scoreMileSum / totalMiles : 0
  const maxRisk = Object.keys(RISK_SCORES).find((k) => RISK_SCORES[k] === maxScore)

  return {
    severe_miles: +riskMiles.Severe.toFixed(2),
    high_miles: +riskMiles.High.toFixed(2),
    no_travel_miles: +riskMiles['No Travel'].toFixed(2),
    avg_risk: +avgRisk.toFixed(3),
    max_risk: maxRisk,
    risk_miles: Object.fromEntries(
      Object.entries(riskMiles).map(([k, v]) => [k, +v.toFixed(2)]),
    ),
    has_no_travel: riskMiles['No Travel'] > 0,
  }
}

export function recommendRoutes(routes) {
  const ranked = [...routes].sort((a, b) => {
    const sa = a.risk_summary
    const sb = b.risk_summary
    const key = (s, r) => [
      s.has_no_travel ? 1 : 0,
      s.no_travel_miles,
      s.severe_miles,
      s.high_miles,
      s.avg_risk,
      r.duration_sec,
    ]
    const ka = key(sa, a)
    const kb = key(sb, b)
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i]
    }
    return 0
  })

  ranked.forEach((route, idx) => {
    route.rank = idx + 1
    route.recommended = idx === 0 && !route.risk_summary.has_no_travel
    if (idx === 0 && route.risk_summary.has_no_travel) {
      route.recommended = false
      route.recommendation_note =
        'All routes include No Travel segments; delay departure or reduce load.'
    } else if (idx === 0) {
      route.recommendation_note =
        'Best balance of weather risk and travel time under the project rules.'
    } else {
      route.recommendation_note = null
    }
  })
  return ranked
}
