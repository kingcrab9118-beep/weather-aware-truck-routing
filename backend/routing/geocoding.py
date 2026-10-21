"""Geocoding: Open-Meteo first (fast/reliable), Nominatim as fallback."""

from __future__ import annotations

import logging
from typing import Any

import requests
from django.conf import settings

from .http_client import http_get, request_headers

logger = logging.getLogger(__name__)


def _from_open_meteo(query: str) -> dict[str, Any] | None:
    resp = http_get(
        settings.OPEN_METEO_GEOCODING_URL,
        params={
            "name": query,
            "count": 1,
            "language": "en",
            "format": "json",
        },
        headers=request_headers(Accept="application/json"),
        timeout=25,
    )
    resp.raise_for_status()
    payload = resp.json()
    hit = (payload.get("results") or [None])[0]
    if not hit:
        return None
    name = ", ".join(
        part
        for part in (hit.get("name"), hit.get("admin1"), hit.get("country"))
        if part
    )
    return {
        "query": query,
        "name": name or query,
        "lat": float(hit["latitude"]),
        "lon": float(hit["longitude"]),
        "provider": "open-meteo",
    }


def _from_nominatim(query: str) -> dict[str, Any] | None:
    try:
        resp = http_get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params={"q": query, "format": "json", "limit": 1},
            headers=request_headers(Accept="application/json"),
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        hit = data[0]
        return {
            "query": query,
            "name": hit.get("display_name", query),
            "lat": float(hit["lat"]),
            "lon": float(hit["lon"]),
            "provider": "nominatim",
        }
    except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
        logger.warning("Nominatim geocode failed for %r: %s", query, exc)
        return None


def geocode(query: str) -> dict[str, Any]:
    q = (query or "").strip()
    if not q:
        raise ValueError("Geocode query is empty")

    # Prefer Open-Meteo — public Nominatim often times out and stalls the whole analyze.
    try:
        result = _from_open_meteo(q)
        if result is not None:
            return result
    except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
        logger.warning("Open-Meteo geocode failed for %r: %s", q, exc)

    result = _from_nominatim(q)
    if result is not None:
        return result

    raise ValueError(
        f"Could not geocode: {q}. Check the place name and try again."
    )
