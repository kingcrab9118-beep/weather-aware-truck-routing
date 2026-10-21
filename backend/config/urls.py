from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views.decorators.cache import never_cache
from django.views.static import serve


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

# Explicit asset routes so new Vite hashes work even if WhiteNoise's
# startup index is stale; SPA fallback must not swallow /assets/*.
if Path(settings.FRONTEND_DIST).is_dir():
    assets_root = Path(settings.FRONTEND_DIST) / "assets"
    urlpatterns += [
        re_path(
            r"^assets/(?P<path>.*)$",
            serve,
            {"document_root": str(assets_root)},
        ),
        re_path(
            r"^favicon\.svg$",
            serve,
            {"document_root": str(settings.FRONTEND_DIST), "path": "favicon.svg"},
        ),
        re_path(r"^(?!api/|admin/|assets/).*$", spa_index),
    ]

