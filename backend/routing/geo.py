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
    """
    Build heatmap sample points along the route corridor.

    Samples along the polyline (not a south→north bbox fill) so long east–west
    hauls are not dominated by southern alternate legs when max_points is hit.
    """
    if not coords:
        return []

    # Centerline first so long hauls are covered end-to-end before any
    # lateral offsets consume the max_points budget (old bug: only the
    # origin tip was sampled when offsets × spacing hit the cap early).
    centerline = sample_along_route(coords, spacing_mi)
    if not centerline:
        lon, lat = coords[0]
        centerline = [{"lat": lat, "lon": lon, "distance_mi": 0.0, "index": 0}]

    mid_lat = sum(c[1] for c in coords) / len(coords)
    lat_off = spacing_mi / 69.0 * 0.55
    lon_off = spacing_mi / max(69.0 * math.cos(math.radians(mid_lat)), 1e-6) * 0.55

    seen: set[tuple[float, float]] = set()
    points: list[dict] = []

    def _add(lat: float, lon: float) -> bool:
        key = (round(lat, 3), round(lon, 3))
        if key in seen:
            return False
        seen.add(key)
        points.append({"lat": key[0], "lon": key[1]})
        return len(points) >= max_points

    for cp in centerline:
        if _add(cp["lat"], cp["lon"]):
            return points

    # Lateral offsets: stride along the centerline so both ends get thickness
    # (filling from the origin first left the destination half bare).
    remaining = max_points - len(points)
    if remaining > 0 and centerline:
        stride = max(1, len(centerline) // max(1, remaining // 4))
        for cp in centerline[::stride]:
            for dlat, dlon in ((lat_off, 0.0), (-lat_off, 0.0), (0.0, lon_off), (0.0, -lon_off)):
                if _add(cp["lat"] + dlat, cp["lon"] + dlon):
                    return points
    return points
