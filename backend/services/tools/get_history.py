def _parse_window(window: str | None, default: str = "90d") -> tuple[str, int]:
    raw = (window or default).strip().lower()
    if not raw:
        raw = default
    if raw.endswith("d"):
        days = max(1, min(int(raw[:-1] or "90"), 365))
        return "days", days
    if raw.endswith("h"):
        hours = max(1, min(int(raw[:-1] or "24"), 24 * 30))
        return "hours", hours
    value = max(1, min(int(raw), 365))
    return "days", value


def get_history(entity_type: str, entity_id: int, window: str = "90d") -> dict:
    from services.db import get_segment_history, get_tank_history

    unit, value = _parse_window(window)
    if entity_type == "segment":
        days = value if unit == "days" else max(1, value // 24)
        series = get_segment_history(entity_id, days)
    elif entity_type == "tank":
        hours = value * 24 if unit == "days" else value
        series = get_tank_history(entity_id, hours=hours)
    else:
        series = []
    normalized_window = f"{value}{'d' if unit == 'days' else 'h'}"
    return {"entity_type": entity_type, "entity_id": entity_id, "window": normalized_window, "series": series}
