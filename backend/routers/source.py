from fastapi import APIRouter, Query

from services.db import get_scarcity_forecast, get_source_availability

router = APIRouter(prefix="/api/source", tags=["source"])


@router.get("/availability")
def availability():
    return get_source_availability()


@router.get("/scarcity-forecast")
def scarcity_forecast(horizon_days: int = Query(default=30)):
    return get_scarcity_forecast(horizon_days)
