"""Route providers: OpenRouteService (preferred) and OSRM (fallback)."""

from __future__ import annotations

import logging

from django.conf import settings

from .http_client import http_get, http_post, request_headers

logger = logging.getLogger(__name__)

M_TO_MI = 0.000621371


def _route_dict(route_id: str, label: str, provider: str, coords, distance_m: float, duration_sec: float) -> dict:
    return {
        "id": route_id,
        "label": label,
        "provider": provider,
        "geometry": {"type": "LineString", "coordinates": coords},
        "distance_m": float(distance_m),
        "duration_sec": float(duration_sec),
        "distance_mi": float(distance_m) * M_TO_MI,
    }


def _ors_headers() -> dict[str, str]:
    return request_headers(
        Authorization=settings.ORS_API_KEY,
        **{"Content-Type": "application/json"},
    )


def _parse_ors_features(features: list) -> list[dict]:
    routes = []
    for i, feat in enumerate(features[:3]):
        props = feat.get("properties", {})
        summary = props.get("summary", {})
        coords = feat["geometry"]["coordinates"]
        distance_m = summary.get("distance") or props.get("segments", [{}])[0].get("distance", 0)
        duration_s = summary.get("duration") or props.get("segments", [{}])[0].get("duration", 0)
        routes.append(
            _route_dict(f"ors-{i + 1}", f"Route {chr(65 + i)}", "openrouteservice", coords, distance_m, duration_s)
        )
    return routes


def _ors_directions(coordinates: list[list[float]], profile: str, extras: dict | None = None) -> list[dict]:
    url = f"https://api.openrouteservice.org/v2/directions/{profile}/geojson"
    body = {"coordinates": coordinates, "instructions": False}
    if extras:
        body.update(extras)
    resp = http_post(url, json=body, headers=_ors_headers(), timeout=60)
    if resp.status_code >= 400:
        logger.warning("ORS %s failed (%s): %s", profile, resp.status_code, resp.text[:400])
        return []
    return _parse_ors_features(resp.json().get("features", []))


def _routes_from_ors(origin: dict, destination: dict) -> list[dict]:
    """
    Up to 3 ORS routes. Free-tier alternative_routes only works under ~100 km;
    longer hauls use a primary route plus via-point variants.
    """
    if not settings.ORS_API_KEY:
        logger.info("ORS_API_KEY not set; skipping OpenRouteService")
        return []

    start = [origin["lon"], origin["lat"]]
    end = [destination["lon"], destination["lat"]]
    profiles = ("driving-hgv", "driving-car")

    primary: list[dict] = []
    for profile in profiles:
        primary = _ors_directions(
            [start, end],
            profile,
            extras={
                "alternative_routes": {
                    "share_factor": 0.6,
                    "target_count": 2,
                    "weight_factor": 1.4,
                }
            },
        )
        if len(primary) >= 2:
            for i, r in enumerate(primary):
                r["id"] = f"ors-{i + 1}"
                r["label"] = f"Route {chr(65 + i)}"
            return primary[:3]

        primary = _ors_directions([start, end], profile)
        if primary:
            break

    if not primary:
        return []

    routes = primary[:1]
    mid = routes[0]["geometry"]["coordinates"][len(routes[0]["geometry"]["coordinates"]) // 2]
    offsets = [(0.8, 0.35), (-0.8, -0.35), (0.0, 0.9)]
    profile_used = "driving-hgv"

    for offset in offsets:
        if len(routes) >= 3:
            break
        via = [mid[0] + offset[0], mid[1] + offset[1]]
        variant: list[dict] = []
        for profile in profiles:
            variant = _ors_directions([start, via, end], profile)
            if variant:
                profile_used = profile
                break
        if not variant:
            continue
        candidate = variant[0]
        if any(abs(candidate["distance_m"] - existing["distance_m"]) < 5000 for existing in routes):
            continue
        idx = len(routes)
        candidate["id"] = f"ors-via-{idx + 1}"
        candidate["label"] = f"Route {chr(65 + idx)}"
        routes.append(candidate)

    logger.info("ORS returned %s route(s) via %s", len(routes), profile_used)
    return routes[:3]


def _routes_from_osrm(origin: dict, destination: dict) -> list[dict]:
    coords = f"{origin['lon']},{origin['lat']};{destination['lon']},{destination['lat']}"
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{coords}"
    resp = http_get(
        url,
        params={
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true",
            "steps": "false",
        },
        headers=request_headers(),
        timeout=45,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("code") != "Ok":
        raise RuntimeError(f"OSRM error: {payload.get('message', payload.get('code'))}")

    routes = []
    for i, route in enumerate(payload.get("routes", [])[:3]):
        routes.append(
            _route_dict(
                f"osrm-{i + 1}",
                f"Route {chr(65 + i)}",
                "osrm",
                route["geometry"]["coordinates"],
                route["distance"],
                route["duration"],
            )
        )

    if len(routes) < 3 and routes:
        mid = routes[0]["geometry"]["coordinates"][len(routes[0]["geometry"]["coordinates"]) // 2]
        for offset in [(0.15, 0.0), (-0.15, 0.0), (0.0, 0.15)]:
            if len(routes) >= 3:
                break
            via_coords = (
                f"{origin['lon']},{origin['lat']};"
                f"{mid[0] + offset[0]},{mid[1] + offset[1]};"
                f"{destination['lon']},{destination['lat']}"
            )
            try:
                via_resp = http_get(
                    f"{settings.OSRM_BASE_URL}/route/v1/driving/{via_coords}",
                    params={"overview": "full", "geometries": "geojson", "steps": "false"},
                    headers=request_headers(),
                    timeout=30,
                )
                via_resp.raise_for_status()
                via_payload = via_resp.json()
                if via_payload.get("code") != "Ok" or not via_payload.get("routes"):
                    continue
                r = via_payload["routes"][0]
                if any(abs(r["distance"] - existing["distance_m"]) < 2000 for existing in routes):
                    continue
                idx = len(routes)
                routes.append(
                    _route_dict(
                        f"osrm-via-{idx + 1}",
                        f"Route {chr(65 + idx)}",
                        "osrm",
                        r["geometry"]["coordinates"],
                        r["distance"],
                        r["duration"],
                    )
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to build OSRM via route: %s", exc)

    return routes[:3]


def fetch_routes(origin: dict, destination: dict) -> list[dict]:
    routes = _routes_from_ors(origin, destination)
    if len(routes) >= 2:
        return routes[:3]

    osrm = _routes_from_osrm(origin, destination)
    if not osrm:
        raise RuntimeError("No routes found between the given locations.")

    if routes:
        known = {r["id"] for r in routes}
        for r in osrm:
            if r["id"] not in known and len(routes) < 3:
                routes.append(r)
        return routes[:3]
    return osrm
