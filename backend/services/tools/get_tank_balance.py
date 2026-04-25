def get_tank_balance(tank_id: int, window_hours: int = 24) -> dict:
    from services.db import build_tank_balance_summary, get_tank_history, get_tank_latest_balance

    latest_balance = get_tank_latest_balance(tank_id)
    state = get_tank_history(tank_id, hours=window_hours)
    return build_tank_balance_summary(tank_id, state, latest_balance, window_hours=window_hours)
