# Droplet

Water-network intelligence platform for mid-size Italian utilities. Built for the 11th CASSINI Hackathon (EU Space for Water). Pilot territory: Ciociaria (Frosinone, Lazio).

Two modules, one backend:
- **Module 1 — Source**: availability modelling + scarcity forecast.
- **Module 2 — Distribution**: pipe-level PHI (Pipe Health Index) fusing EGMS subsidence, Sentinel-2 NDVI corridor anomalies, ECOSTRESS thermal anomalies and live hydraulic telemetry; AI-assisted, EU AI Act Art. 13-compliant explanations.

EU-only stack: Copernicus · Galileo · Regolo AI · Supabase · Qdrant · Neo4j AuraDB · Hugging Face Spaces · Vercel.

See [`plan.md`](./plan.md) for the full architecture, data sources, ENV keys, and deployment sequence.

## Layout
```
backend/       FastAPI app → Hugging Face Spaces
frontend/      Next.js app → Vercel            (pending)
ingestion/     GitHub Actions runners          (pending)
```
