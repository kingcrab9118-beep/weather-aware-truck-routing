"""Nominatim geocoding."""

from __future__ import annotations

from typing import Any

from django.conf import settings

from .http_client import http_get, request_headers


def geocode(query: str) -> dict[str, Any]:
    resp = http_get(
        f"{settings.NOMINATIM_BASE_URL}/search",
        params={"q": query, "format": "json", "limit": 1},
        headers=request_headers(),
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data:
        raise ValueError(f"Could not geocode: {query}")
    hit = data[0]
    return {
        "query": query,
        "name": hit.get("display_name", query),
        "lat": float(hit["lat"]),
        "lon": float(hit["lon"]),
    }
