from fastapi import APIRouter, HTTPException

from services.db import get_dma_balance, list_dmas as db_list_dmas

router = APIRouter(prefix="/api/dmas", tags=["dmas"])


@router.get("")
def list_dmas():
    return db_list_dmas()


@router.get("/{dma_id}/balance")
def dma_balance(dma_id: int, month: str | None = None):
    balance = get_dma_balance(dma_id, month)
    if not balance:
        raise HTTPException(status_code=404, detail="dma not found")
    return balance
