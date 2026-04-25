from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

from routers import alerts, audit, ceccano, chat, control, copernicus, daily_digest, dmas, explain, gis, healthz, incidents, investments, network, segments, source, tanks
from services.epanet_sim import sim_service


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    allowed_origins: str = "*"
    droplet_enable_sim: bool = False


settings = Settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.droplet_enable_sim:
        await sim_service.start()
    try:
        yield
    finally:
        if settings.droplet_enable_sim:
            await sim_service.stop()


app = FastAPI(title="Droplet Backend", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(healthz.router)
app.include_router(segments.router)
app.include_router(tanks.router)
app.include_router(dmas.router)
app.include_router(incidents.router)
app.include_router(network.router)
app.include_router(gis.router)
app.include_router(source.router)
app.include_router(explain.router)
app.include_router(audit.router)
app.include_router(chat.router)
app.include_router(alerts.router)
app.include_router(control.router)
app.include_router(investments.router)
app.include_router(daily_digest.router)
app.include_router(ceccano.router)
app.include_router(copernicus.router)


@app.get("/")
def root():
    return {
        "app": "droplet",
        "status": "ok",
        "pilot": "Ciociaria",
        "hackathon": "CASSINI 11 - EU Space for Water",
    }
