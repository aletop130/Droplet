def get_tank_kpi(tank_id: int) -> dict:
    from services.db import get_tank_kpis

    return get_tank_kpis(tank_id)
