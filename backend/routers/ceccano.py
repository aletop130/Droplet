from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ceccano import (
    adjust_valve,
    get_alerts,
    get_bar_metrics,
    get_ceccano_overview,
    get_district,
    get_districts,
    get_forecast,
    get_gis_overlay,
    get_night_mode,
    get_reservoirs,
    get_valve,
    get_valves,
)

router = APIRouter(prefix="/api/ceccano", tags=["ceccano"])


class ValveAdjustRequest(BaseModel):
    valve_id: str
    target_open_pct: int = Field(ge=0, le=100)
    mode: str | None = None
    operator_id: str = "operator"
    reason: str | None = None


@router.get("/overview")
def overview():
    return get_ceccano_overview()


@router.get("/distretti")
def distretti():
    return {"items": get_districts(), "total": len(get_districts())}


@router.get("/distretti/{district_id}")
def distretto(district_id: str):
    item = get_district(district_id)
    if not item:
        raise HTTPException(status_code=404, detail="district not found")
    return item


@router.get("/valves")
def valves():
    return {"items": get_valves(), "total": len(get_valves())}


@router.get("/valves/{valve_id}")
def valve(valve_id: str):
    item = get_valve(valve_id)
    if not item:
        raise HTTPException(status_code=404, detail="valve not found")
    return item


@router.get("/valves-{valve_id}")
def valve_legacy_route(valve_id: str):
    return valve(valve_id)


@router.post("/adjust")
def adjust(payload: ValveAdjustRequest):
    result = adjust_valve(payload.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="valve not found")
    return result


@router.get("/GIS")
def gis():
    return get_gis_overlay()


@router.get("/GIS-overlay")
def gis_overlay():
    return get_gis_overlay()


@router.get("/forecast")
def forecast():
    return get_forecast()


@router.get("/bar")
def bar():
    return get_bar_metrics()


@router.get("/reservoirs")
def reservoirs():
    return {"items": get_reservoirs(), "total": len(get_reservoirs())}


@router.get("/night-mode")
def night_mode():
    return get_night_mode()


@router.get("/alert")
def alert():
    return get_alerts()


@router.post("/alert")
def alert_trigger():
    return get_alerts()
