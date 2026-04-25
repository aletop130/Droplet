from fastapi import APIRouter

from services.investments import get_investment_overlay

router = APIRouter(prefix="/api/gis", tags=["gis"])


@router.get("/overlay")
def overlay():
    return get_investment_overlay()
