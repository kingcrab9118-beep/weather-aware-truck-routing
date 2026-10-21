"""Shared HTTP helpers for third-party APIs."""

from __future__ import annotations

import warnings

import requests
import urllib3
from django.conf import settings

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

_SESSION: requests.Session | None = None


def _session() -> requests.Session:
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
        _SESSION.verify = False
        _SESSION.headers.update({"User-Agent": settings.REQUEST_USER_AGENT})
    return _SESSION


def request_headers(**extra) -> dict[str, str]:
    headers = {"User-Agent": settings.REQUEST_USER_AGENT}
    headers.update(extra)
    return headers


def http_get(url: str, **kwargs):
    kwargs.setdefault("timeout", 45)
    return _session().get(url, **kwargs)


def http_post(url: str, **kwargs):
    kwargs.setdefault("timeout", 45)
    return _session().post(url, **kwargs)
