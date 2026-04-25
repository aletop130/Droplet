from fastapi import APIRouter

from services.daily_digest import today_digest

router = APIRouter(prefix="/api/daily-digest", tags=["daily-digest"])


@router.get("/today")
def get_today_digest():
    return today_digest()
