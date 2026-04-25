from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.investments import (
    ARERA_INDICATORS,
    InvestmentInput,
    calculate_investment,
    db_saturation_status,
    get_investment_strategy,
)

router = APIRouter(prefix="/api/investments", tags=["investments"])


class InvestmentCalculatorRequest(BaseModel):
    capital_cost_eur: float = Field(default=840000.0, ge=0)
    line_length_m: float = Field(default=742.0, ge=0)
    diameter_mm: float = Field(default=250.0, ge=0)
    useful_life_years: int = Field(default=30, ge=1, le=80)
    saved_consumption_m3_year: float = Field(default=56000.0, ge=0)
    avoided_losses_m3_year: float = Field(default=112000.0, ge=0)
    tariff_eur_m3: float = Field(default=1.72, ge=0)
    water_value_eur_m3: float = Field(default=0.68, ge=0)
    annual_maintenance_eur: float = Field(default=18000.0, ge=0)
    indicator_delta_a1: float = Field(default=0.07, ge=0, le=1)
    indicator_delta_a2: float = Field(default=0.09, ge=0, le=1)


@router.get("/arera-indicators")
def arera_indicators():
    return {"items": ARERA_INDICATORS}


@router.get("/calculator")
def calculator_defaults():
    payload = InvestmentInput()
    return {
        "input": payload.__dict__,
        "result": calculate_investment(payload),
    }


@router.post("/calculator")
def calculate(payload: InvestmentCalculatorRequest):
    return calculate_investment(InvestmentInput(**payload.model_dump()))


@router.post("/strategy")
def strategy(roi_target_pct: float = 25.0):
    return get_investment_strategy(roi_target_pct=roi_target_pct)


@router.get("/supabase-status")
def supabase_status():
    return db_saturation_status()
