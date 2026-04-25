from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class AlertEvent(BaseModel):
    type: Literal[
        "anomaly",
        "incident_created",
        "incident_updated",
        "control_recommendation_created",
        "explain_ready",
        "tank_state",
        "epanet_tick",
    ]
    payload: dict[str, Any]
    ts: datetime
