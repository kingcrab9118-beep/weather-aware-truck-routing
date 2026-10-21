"""Weather risk classification and load-adjusted rules for truck routing."""

from __future__ import annotations

from typing import Any

RISK_LEVELS = ("Low", "Moderate", "High", "Severe", "No Travel")
RISK_SCORES = {
    "Low": 1,
    "Moderate": 2,
    "High": 3,
    "Severe": 4,
    "No Travel": 5,
}


def classify_wind(mph: float) -> str:
    if mph < 25:
        return "Low"
    if mph < 35:
        return "Moderate"
    if mph < 45:
        return "High"
    if mph < 55:
        return "Severe"
    return "No Travel"


def classify_rain(inches_per_hour: float) -> str:
    if inches_per_hour < 0.10:
        return "Low"
    if inches_per_hour <= 0.25:
        return "Moderate"
    if inches_per_hour <= 0.50:
        return "High"
    if inches_per_hour <= 1.00:
        return "Severe"
    return "No Travel"


def classify_snow(inches_per_hour: float) -> str:
    if inches_per_hour < 0.5:
        return "Low"
    if inches_per_hour <= 1.0:
        return "Moderate"
    if inches_per_hour <= 2.0:
        return "High"
    if inches_per_hour <= 3.0:
        return "Severe"
    return "No Travel"


def worse_risk(a: str, b: str) -> str:
    return a if RISK_SCORES[a] >= RISK_SCORES[b] else b


def apply_load_rules(base_risk: str, wind_mph: float, load_lb: float) -> str:
    """
    Load rules:
    - >=55 mph → No Travel for any load
    - 45–54 mph + >30,000 lb → No Travel
    - 35–44 mph + >40,000 lb → Severe
    """
    risk = base_risk

    if wind_mph >= 55:
        return "No Travel"

    if 45 <= wind_mph < 55 and load_lb > 30_000:
        return "No Travel"

    if 35 <= wind_mph < 45 and load_lb > 40_000:
        risk = worse_risk(risk, "Severe")

    return risk


def classify_checkpoint_weather(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
    load_lb: float,
) -> dict[str, Any]:
    wind_risk = classify_wind(wind_mph)
    rain_risk = classify_rain(rain_in_hr)
    snow_risk = classify_snow(snow_in_hr)

    weather_risk = wind_risk
    weather_risk = worse_risk(weather_risk, rain_risk)
    weather_risk = worse_risk(weather_risk, snow_risk)

    final_risk = apply_load_rules(weather_risk, wind_mph, load_lb)

    drivers: list[str] = []
    max_component = max(
        RISK_SCORES[wind_risk],
        RISK_SCORES[rain_risk],
        RISK_SCORES[snow_risk],
    )
    if RISK_SCORES[wind_risk] == max_component:
        drivers.append("wind")
    if RISK_SCORES[rain_risk] == max_component:
        drivers.append("rain")
    if RISK_SCORES[snow_risk] == max_component:
        drivers.append("snow")
    if final_risk != weather_risk:
        drivers.append("load")

    return {
        "risk": final_risk,
        "score": RISK_SCORES[final_risk],
        "components": {
            "wind": wind_risk,
            "rain": rain_risk,
            "snow": snow_risk,
            "weather_only": weather_risk,
            "after_load": final_risk,
        },
        "drivers": drivers or ["clear"],
    }


def summarize_route_risk(checkpoints: list[dict[str, Any]], total_miles: float) -> dict[str, Any]:
    """Aggregate checkpoint risks into route-level metrics used for ranking."""
    if not checkpoints:
        return {
            "severe_miles": 0.0,
            "high_miles": 0.0,
            "no_travel_miles": 0.0,
            "avg_risk": 0.0,
            "max_risk": "Low",
            "risk_miles": {level: 0.0 for level in RISK_LEVELS},
            "has_no_travel": False,
        }

    risk_miles = {level: 0.0 for level in RISK_LEVELS}
    score_mile_sum = 0.0
    max_score = 1
    n = len(checkpoints)

    for i, cp in enumerate(checkpoints):
        risk = cp["risk"]
        score = cp["score"]
        # Attribute half the distance to previous/next neighbor (Voronoi on the line).
        if n == 1:
            seg = total_miles
        elif i == 0:
            seg = (checkpoints[1]["distance_mi"] - cp["distance_mi"]) / 2
        elif i == n - 1:
            seg = (cp["distance_mi"] - checkpoints[i - 1]["distance_mi"]) / 2
            # Include any remainder to the route end
            seg += max(total_miles - cp["distance_mi"], 0.0)
        else:
            prev_d = checkpoints[i - 1]["distance_mi"]
            next_d = checkpoints[i + 1]["distance_mi"]
            seg = (next_d - prev_d) / 2

        seg = max(seg, 0.0)
        risk_miles[risk] = risk_miles.get(risk, 0.0) + seg
        score_mile_sum += score * seg
        max_score = max(max_score, score)

    avg_risk = score_mile_sum / total_miles if total_miles > 0 else 0.0
    max_risk = next(k for k, v in RISK_SCORES.items() if v == max_score)

    return {
        "severe_miles": round(risk_miles["Severe"], 2),
        "high_miles": round(risk_miles["High"], 2),
        "no_travel_miles": round(risk_miles["No Travel"], 2),
        "avg_risk": round(avg_risk, 3),
        "max_risk": max_risk,
        "risk_miles": {k: round(v, 2) for k, v in risk_miles.items()},
        "has_no_travel": risk_miles["No Travel"] > 0,
    }


def recommend_routes(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Prefer:
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel times

    Routes with any No Travel miles are ranked last.
    """

    def sort_key(route: dict[str, Any]) -> tuple:
        summary = route["risk_summary"]
        return (
            1 if summary["has_no_travel"] else 0,
            summary["no_travel_miles"],
            summary["severe_miles"],
            summary["high_miles"],
            summary["avg_risk"],
            route["duration_sec"],
        )

    ranked = sorted(routes, key=sort_key)
    for idx, route in enumerate(ranked):
        route["rank"] = idx + 1
        route["recommended"] = idx == 0 and not route["risk_summary"]["has_no_travel"]
        # If all have no-travel, still mark the least-bad as recommended=False but note it
        if idx == 0 and route["risk_summary"]["has_no_travel"]:
            route["recommended"] = False
            route["recommendation_note"] = (
                "All routes include No Travel segments; delay departure or reduce load."
            )
        elif idx == 0:
            route["recommendation_note"] = (
                "Best balance of weather risk and travel time under the project rules."
            )
        else:
            route["recommendation_note"] = None

    return ranked
