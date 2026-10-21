"""Geodesic helpers for sampling checkpoints along a route."""

from __future__ import annotations

import math
from typing import Sequence

EARTH_RADIUS_MI = 3958.7613


def haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(a))


def route_length_mi(coords: Sequence[tuple[float, float]]) -> float:
    """coords are (lon, lat) GeoJSON order."""
    total = 0.0
    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1]
        lon2, lat2 = coords[i]
        total += haversine_mi(lat1, lon1, lat2, lon2)
    return total


def sample_along_route(
    coords: Sequence[tuple[float, float]],
    interval_mi: float,
) -> list[dict]:
    """
    Sample points every `interval_mi` along the polyline, always including start and end.
    coords: list of (lon, lat)
    """
    if not coords:
        return []
    if len(coords) == 1:
        lon, lat = coords[0]
        return [{"lat": lat, "lon": lon, "distance_mi": 0.0, "index": 0}]

    samples: list[dict] = []
    lon0, lat0 = coords[0]
    samples.append({"lat": lat0, "lon": lon0, "distance_mi": 0.0, "index": 0})

    next_target = interval_mi
    traveled = 0.0
    sample_idx = 1

    for i in range(1, len(coords)):
        lon1, lat1 = coords[i - 1]
        lon2, lat2 = coords[i]
        seg_len = haversine_mi(lat1, lon1, lat2, lon2)
        if seg_len == 0:
            continue

        while traveled + seg_len >= next_target:
            remain = next_target - traveled
            t = remain / seg_len
            lat = lat1 + (lat2 - lat1) * t
            lon = lon1 + (lon2 - lon1) * t
            samples.append(
                {
                    "lat": lat,
                    "lon": lon,
                    "distance_mi": round(next_target, 3),
                    "index": sample_idx,
                }
            )
            sample_idx += 1
            next_target += interval_mi

        traveled += seg_len

    lon_e, lat_e = coords[-1]
    if samples[-1]["distance_mi"] < traveled - 0.05:
        samples.append(
            {
                "lat": lat_e,
                "lon": lon_e,
                "distance_mi": round(traveled, 3),
                "index": sample_idx,
            }
        )
    else:
        # Snap last sample to exact end
        samples[-1] = {
            "lat": lat_e,
            "lon": lon_e,
            "distance_mi": round(traveled, 3),
            "index": samples[-1]["index"],
        }

    return samples


def bounding_box(coords: Sequence[tuple[float, float]], pad_deg: float = 0.35) -> dict:
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return {
        "min_lon": min(lons) - pad_deg,
        "min_lat": min(lats) - pad_deg,
        "max_lon": max(lons) + pad_deg,
        "max_lat": max(lats) + pad_deg,
    }


def corridor_grid(
    coords: Sequence[tuple[float, float]],
    spacing_mi: float = 28.0,
    max_points: int = 120,
) -> list[dict]:
    """Build a grid covering the route corridor for heatmap forecasting."""
    bbox = bounding_box(coords, pad_deg=0.5)
    # Approximate degrees per mile
    mid_lat = (bbox["min_lat"] + bbox["max_lat"]) / 2
    lat_step = spacing_mi / 69.0
    lon_step = spacing_mi / max(69.0 * math.cos(math.radians(mid_lat)), 1e-6)

    points: list[dict] = []
    lat = bbox["min_lat"]
    while lat <= bbox["max_lat"] and len(points) < max_points:
        lon = bbox["min_lon"]
        while lon <= bbox["max_lon"] and len(points) < max_points:
            # Keep points near the route (within ~spacing)
            near = False
            for cloni, clati in coords[:: max(1, len(coords) // 60)]:
                if haversine_mi(lat, lon, clati, cloni) <= spacing_mi * 1.6:
                    near = True
                    break
            if near:
                points.append({"lat": round(lat, 4), "lon": round(lon, 4)})
            lon += lon_step
        lat += lat_step

    return points
