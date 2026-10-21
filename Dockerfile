# --- Frontend build ---
FROM node:20-bookworm AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Django + SPA ---
FROM python:3.12-slim
WORKDIR /app

# Hugging Face Spaces expects 7860; Render/others can override PORT
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend /app/frontend/dist /app/backend/frontend_dist

WORKDIR /app/backend
EXPOSE 7860

CMD gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --timeout 120 --workers 2
