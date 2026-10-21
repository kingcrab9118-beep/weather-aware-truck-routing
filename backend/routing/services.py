"""Trip analysis orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .geo import route_length_mi, sample_along_route
from .geocoding import geocode
from .providers import fetch_routes
from .risk import classify_checkpoint_weather, recommend_routes, summarize_route_risk
from .weather import fetch_heatmap_forecast, fetch_weather_at_points

__all__ = ["analyze_trip", "geocode"]


def analyze_trip(
    origin_query: str,
    destination_query: str,
    departure_iso: str,
    load_lb: float,
    sample_interval_mi: int = 25,
) -> dict[str, Any]:
    if sample_interval_mi not in (10, 25, 50):
        raise ValueError("sample_interval_mi must be 10, 25, or 50")
    if load_lb < 0:
        raise ValueError("load_lb must be non-negative")

    departure = datetime.fromisoformat(departure_iso.replace("Z", "+00:00"))
    if departure.tzinfo is None:
        departure = departure.replace(tzinfo=timezone.utc)

    origin = geocode(origin_query)
    destination = geocode(destination_query)
    raw_routes = fetch_routes(origin, destination)

    analyzed: list[dict] = []
    route_coords_list: list[list[tuple[float, float]]] = []

    for route in raw_routes:
        coords = [(c[0], c[1]) for c in route["geometry"]["coordinates"]]
        route_coords_list.append(coords)
        total_mi = route["distance_mi"] or route_length_mi(coords)
        samples = sample_along_route(coords, float(sample_interval_mi))
        with_weather = fetch_weather_at_points(
            samples,
            departure=departure,
            route_duration_sec=route["duration_sec"],
            total_miles=total_mi,
        )

        checkpoints = []
        for point in with_weather:
            w = point["weather"]
            classified = classify_checkpoint_weather(
                wind_mph=w["wind_mph"],
                rain_in_hr=w["rain_in_hr"],
                snow_in_hr=w["snow_in_hr"],
                load_lb=load_lb,
            )
            checkpoints.append(
                {
                    "index": point["index"],
                    "lat": point["lat"],
                    "lon": point["lon"],
                    "distance_mi": point["distance_mi"],
                    "eta": point["eta"],
                    "weather": w,
                    **classified,
                }
            )

        analyzed.append(
            {
                **route,
                "distance_mi": round(total_mi, 2),
                "duration_min": round(route["duration_sec"] / 60.0, 1),
                "checkpoints": checkpoints,
                "risk_summary": summarize_route_risk(checkpoints, total_mi),
                "sample_interval_mi": sample_interval_mi,
            }
        )

    ranked = recommend_routes(analyzed)
    recommended = next((r for r in ranked if r.get("recommended")), ranked[0] if ranked else None)

    # Prefer recommended corridor first so heatmap samples hug the primary choice;
    # still include alternate route polylines as separate corridors (not concatenated).
    ordered_coords = route_coords_list
    if recommended:
        rec_coords = [
            (c[0], c[1]) for c in recommended["geometry"]["coordinates"]
        ]
        ordered_coords = [rec_coords] + [
            c for c in route_coords_list if c != rec_coords
        ]

    return {
        "origin": origin,
        "destination": destination,
        "departure": departure.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "load_lb": load_lb,
        "sample_interval_mi": sample_interval_mi,
        "routes": ranked,
        "recommended_route_id": recommended["id"] if recommended else None,
        "heatmap": fetch_heatmap_forecast(ordered_coords, hours=48),
    }
