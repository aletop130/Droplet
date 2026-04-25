def get_anomaly_breakdown(segment_id: int) -> dict:
    from services.db import get_segment_detail

    detail = get_segment_detail(segment_id)
    if not detail:
        return {"segment_id": segment_id, "phi": None}
    props = detail["segment"]["properties"]
    return {
        "segment_id": segment_id,
        "subsidence": props["subsidence"],
        "ndvi": props["ndvi"],
        "thermal": props["thermal"],
        "hydraulic": props["hydraulic"],
        "tank_signal": props["tank_signal"],
        "phi": props["phi"],
    }
