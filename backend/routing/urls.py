from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("risk-rules/", views.risk_rules, name="risk-rules"),
    path("geocode/", views.geocode_view, name="geocode"),
    path("analyze/", views.analyze, name="analyze"),
]
