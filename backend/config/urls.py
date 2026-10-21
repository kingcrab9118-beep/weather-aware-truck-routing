from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views.decorators.cache import never_cache


@never_cache
def spa_index(_request):
    """Serve the Vite-built SPA for non-API routes."""
    index = Path(settings.FRONTEND_DIST) / "index.html"
    if not index.is_file():
        raise Http404("Frontend build not found. Run the production build first.")
    return FileResponse(open(index, "rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("routing.urls")),
]

# SPA fallback (WhiteNoise still serves /assets/* from WHITENOISE_ROOT)
if Path(settings.FRONTEND_DIST).is_dir():
    urlpatterns += [
        re_path(r"^(?!api/|admin/).*$", spa_index),
    ]

