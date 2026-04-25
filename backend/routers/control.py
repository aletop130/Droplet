from fastapi import APIRouter, HTTPException, Query

from models.dto import ControlApproveRequest, ControlRejectRequest
from services.control_rec import (
    approve_control_recommendation,
    list_control_recommendations,
    reject_control_recommendation,
)

router = APIRouter(prefix="/api/control-recommendations", tags=["control"])


@router.get("")
def list_recommendations(status: str | None = Query(default=None)):
    return {"items": list_control_recommendations(status), "total": len(list_control_recommendations(status))}


@router.post("/{rec_id}/approve")
def approve(rec_id: int, payload: ControlApproveRequest = ControlApproveRequest()):
    rec = approve_control_recommendation(rec_id, payload.operator_id)
    if not rec:
        raise HTTPException(status_code=404, detail="control recommendation not found")
    return rec


@router.post("/{rec_id}/reject")
def reject(rec_id: int, payload: ControlRejectRequest):
    rec = reject_control_recommendation(rec_id, payload.operator_id, payload.reason)
    if not rec:
        raise HTTPException(status_code=404, detail="control recommendation not found")
    return rec
