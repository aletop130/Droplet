---
title: Droplet Backend
emoji: 💧
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Water-network intelligence — CASSINI 11 EU Space for Water
---

# Droplet Backend

FastAPI backend for the Droplet water-network intelligence platform — pilot in Ciociaria (Frosinone, Italy), built for the 11th CASSINI Hackathon.

## Run locally
```bash
pip install -r requirements.txt
cp .env.example .env     # fill in secrets
uvicorn app:app --reload --port 7860
```

## Endpoints (scaffold)
- `GET /` — app info
- `GET /healthz` — liveness probe

Full API (coming soon): `/api/segments`, `/api/explain/{entity_type}/{id}` (SSE), `/api/dmas/{id}/balance`, `/api/audit`, `/ws/alerts`.

## Secrets
Production secrets are injected via HF Space → Settings → Variables and secrets. Local dev uses `.env` (gitignored). See `.env.example`.
