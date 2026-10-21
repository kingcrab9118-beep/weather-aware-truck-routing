"""Open-Meteo weather sampling and corridor heatmap."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from django.conf import settings

from .geo import corridor_grid
from .http_client import http_get, request_headers

MM_TO_INCH = 1 / 25.4
MS_TO_MPH = 2.236936


def _pick_hourly_index(times: list[str], target: datetime) -> int:
    if not times:
        return 0
    target_naive = target.astimezone(timezone.utc).replace(tzinfo=None)
    best_i = 0
    best_diff = None
    for i, t in enumerate(times):
        parsed = datetime.fromisoformat(t.replace("Z", ""))
        diff = abs((parsed - target_naive).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_i = i
    return best_i


def _precip_to_inches(precip_mm: float, snow_cm: float) -> tuple[float, float]:
    snow_in_hr = snow_cm / 2.54
    rain_in_hr = max(precip_mm * MM_TO_INCH - snow_in_hr, 0.0)
    return rain_in_hr, snow_in_hr


def _weather_intensity(wind_mph: float, rain_in: float, snow_in: float) -> float:
    wind_i = min(wind_mph / 55.0, 1.0)
    rain_i = min(rain_in / 1.0, 1.0)
    snow_i = min(snow_in / 3.0, 1.0)
    return max(wind_i * 0.55, rain_i * 0.85, snow_i)


def fetch_weather_at_points(
    points: list[dict],
    departure: datetime,
    route_duration_sec: float,
    total_miles: float,
) -> list[dict]:
    if not points:
        return []

    enriched: list[dict] = []
    chunk_size = 20
    for start in range(0, len(points), chunk_size):
        chunk = points[start : start + chunk_size]
        resp = http_get(
            f"{settings.OPEN_METEO_BASE_URL}/forecast",
            params={
                "latitude": ",".join(str(p["lat"]) for p in chunk),
                "longitude": ",".join(str(p["lon"]) for p in chunk),
                "hourly": "temperature_2m,precipitation,snowfall,windspeed_10m,weathercode",
                "windspeed_unit": "ms",
                "precipitation_unit": "mm",
                "forecast_days": 3,
                "timezone": "UTC",
            },
            headers=request_headers(),
            timeout=45,
        )
        resp.raise_for_status()
        payload = resp.json()
        series_list = payload if isinstance(payload, list) else [payload]

        for p, series in zip(chunk, series_list):
            frac = (p["distance_mi"] / total_miles) if total_miles > 0 else 0.0
            eta = departure + timedelta(seconds=route_duration_sec * frac)
            hourly = series.get("hourly", {})
            times = hourly.get("time", [])
            idx = _pick_hourly_index(times, eta)

            wind_mph = float((hourly.get("windspeed_10m") or [0])[idx] or 0) * MS_TO_MPH
            precip_mm = float((hourly.get("precipitation") or [0])[idx] or 0)
            snow_cm = float((hourly.get("snowfall") or [0])[idx] or 0)
            temp_c = float((hourly.get("temperature_2m") or [0])[idx] or 0)
            rain_in_hr, snow_in_hr = _precip_to_inches(precip_mm, snow_cm)

            enriched.append(
                {
                    **p,
                    "eta": eta.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "weather": {
                        "wind_mph": round(wind_mph, 1),
                        "rain_in_hr": round(rain_in_hr, 3),
                        "snow_in_hr": round(snow_in_hr, 3),
                        "temp_c": round(temp_c, 1),
                        "weathercode": (hourly.get("weathercode") or [None])[idx],
                    },
                }
            )

    return enriched


def fetch_heatmap_forecast(coords: list[tuple[float, float]], hours: int = 48) -> dict[str, Any]:
    # Denser corridor grid → smoother heatmap (still capped for Open-Meteo URL size)
    grid = corridor_grid(coords, spacing_mi=28.0, max_points=120)
    if not grid:
        return {"hours": [], "points": []}

    resp = http_get(
        f"{settings.OPEN_METEO_BASE_URL}/forecast",
        params={
            "latitude": ",".join(str(p["lat"]) for p in grid),
            "longitude": ",".join(str(p["lon"]) for p in grid),
            "hourly": "precipitation,snowfall,windspeed_10m",
            "windspeed_unit": "ms",
            "precipitation_unit": "mm",
            "forecast_days": 3,
            "timezone": "UTC",
        },
        headers=request_headers(),
        timeout=60,
    )
    resp.raise_for_status()
    payload = resp.json()
    series_list = payload if isinstance(payload, list) else [payload]
    hour_labels = (series_list[0].get("hourly") or {}).get("time", [])[: hours + 1]

    points_out = []
    for p, series in zip(grid, series_list):
        hourly = series.get("hourly", {})
        intensities = []
        for i in range(len(hour_labels)):
            wind_mph = float((hourly.get("windspeed_10m") or [0])[i] or 0) * MS_TO_MPH
            precip_mm = float((hourly.get("precipitation") or [0])[i] or 0)
            snow_cm = float((hourly.get("snowfall") or [0])[i] or 0)
            rain_in, snow_in = _precip_to_inches(precip_mm, snow_cm)
            intensities.append(round(_weather_intensity(wind_mph, rain_in, snow_in), 3))
        points_out.append({"lat": p["lat"], "lon": p["lon"], "intensities": intensities})

    return {"hours": hour_labels, "points": points_out}
