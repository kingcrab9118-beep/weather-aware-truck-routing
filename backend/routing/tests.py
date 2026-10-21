from django.test import SimpleTestCase

from .risk import (
    apply_load_rules,
    classify_checkpoint_weather,
    classify_rain,
    classify_snow,
    classify_wind,
    recommend_routes,
    summarize_route_risk,
)
from .geo import haversine_mi, sample_along_route


class RiskRulesTests(SimpleTestCase):
    def test_wind_thresholds(self):
        self.assertEqual(classify_wind(24.9), "Low")
        self.assertEqual(classify_wind(25), "Moderate")
        self.assertEqual(classify_wind(35), "High")
        self.assertEqual(classify_wind(45), "Severe")
        self.assertEqual(classify_wind(55), "No Travel")

    def test_rain_thresholds(self):
        self.assertEqual(classify_rain(0.09), "Low")
        self.assertEqual(classify_rain(0.10), "Moderate")
        self.assertEqual(classify_rain(0.25), "Moderate")
        self.assertEqual(classify_rain(0.26), "High")
        self.assertEqual(classify_rain(0.50), "High")
        self.assertEqual(classify_rain(0.51), "Severe")
        self.assertEqual(classify_rain(1.01), "No Travel")

    def test_snow_thresholds(self):
        self.assertEqual(classify_snow(0.49), "Low")
        self.assertEqual(classify_snow(0.5), "Moderate")
        self.assertEqual(classify_snow(1.0), "Moderate")
        self.assertEqual(classify_snow(2.0), "High")
        self.assertEqual(classify_snow(3.0), "Severe")
        self.assertEqual(classify_snow(3.1), "No Travel")

    def test_load_rules(self):
        self.assertEqual(apply_load_rules("Low", 55, 1000), "No Travel")
        self.assertEqual(apply_load_rules("Severe", 50, 30_001), "No Travel")
        self.assertEqual(apply_load_rules("High", 40, 40_001), "Severe")
        self.assertEqual(apply_load_rules("Moderate", 40, 20_000), "Moderate")

    def test_checkpoint_combines_worst(self):
        result = classify_checkpoint_weather(20, 0.3, 0, 10000)
        self.assertEqual(result["risk"], "High")  # rain drives High


class RecommendationTests(SimpleTestCase):
    def test_prefers_fewer_severe_miles(self):
        routes = [
            {
                "id": "a",
                "duration_sec": 1000,
                "risk_summary": {
                    "severe_miles": 10,
                    "high_miles": 0,
                    "no_travel_miles": 0,
                    "avg_risk": 2.0,
                    "has_no_travel": False,
                },
            },
            {
                "id": "b",
                "duration_sec": 2000,
                "risk_summary": {
                    "severe_miles": 0,
                    "high_miles": 5,
                    "no_travel_miles": 0,
                    "avg_risk": 2.5,
                    "has_no_travel": False,
                },
            },
        ]
        ranked = recommend_routes(routes)
        self.assertEqual(ranked[0]["id"], "b")
        self.assertTrue(ranked[0]["recommended"])


class GeoTests(SimpleTestCase):
    def test_haversine_known_distance(self):
        # ~69 miles per degree latitude
        d = haversine_mi(40.0, -75.0, 41.0, -75.0)
        self.assertAlmostEqual(d, 69.1, delta=1.0)

    def test_sample_interval(self):
        # Straight-ish line ~100 miles north
        coords = [(-75.0, 40.0), (-75.0, 41.45)]
        samples = sample_along_route(coords, 25)
        self.assertGreaterEqual(len(samples), 4)
        self.assertEqual(samples[0]["distance_mi"], 0.0)
