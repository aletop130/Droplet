from fastapi import APIRouter, Query

from services.copernicus_connector import (
    get_existing_layers,
    get_history,
    get_latest_source,
    get_status,
    ingest_latest,
)


router = APIRouter(prefix="/api/copernicus", tags=["copernicus"])


@router.get("/status")
def status():
    return get_status()


@router.get("/sentinel2")
def sentinel2():
    return get_latest_source("s2")


@router.get("/sentinel3")
def sentinel3():
    return get_latest_source("s3")


@router.get("/history")
def history(hours: int = Query(default=24, ge=1, le=168)):
    return get_history(hours=hours)


@router.post("/ingest")
def ingest():
    return ingest_latest(manual=True)


@router.get("/era5")
def era5():
    return get_existing_layers()["era5"]


@router.get("/ecostress")
def ecostress():
    return get_existing_layers()["ecostress"]


@router.get("/gsw")
def gsw():
    return get_existing_layers()["gsw"]
