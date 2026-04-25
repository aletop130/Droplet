def predict_tank_depletion(tank_id: int) -> dict:
    from services.db import get_tank_detail

    detail = get_tank_detail(tank_id)
    if not detail or not detail["state_24h"]:
        return {"tank_id": tank_id, "hours_to_empty": None, "method": "linear_extrapolation", "confidence": 0.0}
    tank = detail["tank"]["properties"]
    latest = detail["state_24h"][-1]
    volume = float(latest["volume_m3"])
    draw_lps = max(float(latest["outflow_lps"]) - float(latest["inflow_lps"]), 0.1)
    hours_to_empty = volume / (draw_lps * 3.6)
    return {
        "tank_id": tank_id,
        "hours_to_empty": round(hours_to_empty, 2),
        "method": "linear_extrapolation",
        "confidence": 0.67,
        "current_volume_m3": volume,
        "capacity_m3": tank["capacity_m3"],
    }
