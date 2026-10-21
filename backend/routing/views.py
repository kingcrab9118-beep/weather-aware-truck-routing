from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .geocoding import geocode
from .risk import RISK_LEVELS, RISK_SCORES
from .services import analyze_trip


@api_view(["GET"])
def health(_request):
    return Response(
        {
            "status": "ok",
            "service": "weather-aware-truck-routing",
            "ors_key_configured": bool(settings.ORS_API_KEY),
        }
    )


@api_view(["GET"])
def risk_rules(_request):
    return Response(
        {
            "levels": list(RISK_LEVELS),
            "scores": RISK_SCORES,
            "thresholds": {
                "wind_mph": {
                    "Low": "<25",
                    "Moderate": "25–34",
                    "High": "35–44",
                    "Severe": "45–54",
                    "No Travel": "≥55",
                },
                "rain_in_hr": {
                    "Low": "<0.10",
                    "Moderate": "0.10–0.25",
                    "High": "0.25–0.50",
                    "Severe": "0.50–1.00",
                    "No Travel": ">1.00",
                },
                "snow_in_hr": {
                    "Low": "<0.5",
                    "Moderate": "0.5–1.0",
                    "High": "1.0–2.0",
                    "Severe": "2.0–3.0",
                    "No Travel": ">3.0",
                },
            },
            "load_rules": [
                "≥55 mph → No Travel for any load",
                "45–54 mph + >30,000 lb → No Travel",
                "35–44 mph + >40,000 lb → Severe",
            ],
            "recommendation_order": [
                "Fewest Severe miles",
                "Fewest High miles",
                "Lowest average risk",
                "Shortest travel time",
            ],
        }
    )


@api_view(["GET"])
def geocode_view(request):
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response({"detail": "Query parameter q is required."}, status=400)
    try:
        return Response(geocode(q))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=404)
    except Exception as exc:  # noqa: BLE001
        return Response({"detail": f"Geocoding failed: {exc}"}, status=502)


@api_view(["POST"])
def analyze(request):
    data = request.data or {}
    origin = (data.get("origin") or "").strip()
    destination = (data.get("destination") or "").strip()
    departure = data.get("departure")
    load_lb = data.get("load_lb")
    sample_interval_mi = int(data.get("sample_interval_mi") or 25)

    missing = [
        name
        for name, val in [
            ("origin", origin),
            ("destination", destination),
            ("departure", departure),
            ("load_lb", load_lb),
        ]
        if val in (None, "")
    ]
    if missing:
        return Response(
            {"detail": f"Missing required fields: {', '.join(missing)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = analyze_trip(
            origin_query=origin,
            destination_query=destination,
            departure_iso=str(departure),
            load_lb=float(load_lb),
            sample_interval_mi=sample_interval_mi,
        )
        return Response(result)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Analysis failed: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
