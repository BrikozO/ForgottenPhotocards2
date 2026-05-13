# ─── Builder: resolve deps via uv ────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

WORKDIR /build
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev


# ─── Runtime: thin python image with the venv copied in ──────────
FROM python:3.13-slim

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /srv
COPY backend/ ./backend/

# SQLite lives here; mount a volume in compose so data survives rebuilds.
RUN mkdir -p /srv/backend/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health', timeout=2).status == 200 else 1)"

# Run from /srv so the `backend` package is importable — module path matches the
# absolute imports inside the code (`from backend.app.X import …`).
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
