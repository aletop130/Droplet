from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from db.supabase import get_connection


ARERA_INDICATORS: list[dict[str, Any]] = [
    {
        "code": "A1",
        "label": "Network yield",
        "weight": 0.25,
        "baseline": 0.58,
        "target": 0.72,
        "current": 0.61,
        "impact_area": "reduction of technical losses and district metering gaps",
    },
    {
        "code": "A2",
        "label": "Water losses",
        "weight": 0.30,
        "baseline": 0.69,
        "target": 0.52,
        "current": 0.65,
        "impact_area": "priority replacement on high PHI pipes and pressure stabilization",
    },
    {
        "code": "A3",
        "label": "Supply interruptions",
        "weight": 0.15,
        "baseline": 0.41,
        "target": 0.30,
        "current": 0.38,
        "impact_area": "new wells and source redundancy near high-demand corridors",
    },
    {
        "code": "A4",
        "label": "Zone pressure",
        "weight": 0.10,
        "baseline": 0.46,
        "target": 0.58,
        "current": 0.51,
        "impact_area": "DMA pressure rebalancing and valve control",
    },
    {
        "code": "A5",
        "label": "Water quality",
        "weight": 0.20,
        "baseline": 0.67,
        "target": 0.78,
        "current": 0.70,
        "impact_area": "source protection and low-residence-time routing",
    },
]


SYNTHETIC_OPPORTUNITIES: list[dict[str, Any]] = [
    {
        "node_id": 1482,
        "lat": 41.668,
        "lon": 13.432,
        "falde_id": "FALDA-LIRI-01",
        "profondita_m": 34.0,
        "tipo_acqua": "spring/well blend",
        "consumo_storico": 920000.0,
        "rendimento_attuale": 0.58,
        "intervento_priorita": "critical",
        "estimated_cost_eur": 840000.0,
        "arera_roi_pct": 34.8,
        "payback_years": 5.4,
        "recommended_action": "New well tie-in plus 742 m pipe renewal in DMA-1",
    },
    {
        "node_id": 1501,
        "lat": 41.596,
        "lon": 13.486,
        "falde_id": "FALDA-SACCO-03",
        "profondita_m": 22.0,
        "tipo_acqua": "shallow aquifer",
        "consumo_storico": 610000.0,
        "rendimento_attuale": 0.64,
        "intervento_priorita": "warning",
        "estimated_cost_eur": 420000.0,
        "arera_roi_pct": 28.1,
        "payback_years": 6.1,
        "recommended_action": "Source protection and pressure control on southern feeder",
    },
    {
        "node_id": 1483,
        "lat": 41.684,
        "lon": 13.538,
        "falde_id": "FALDA-ERNICI-02",
        "profondita_m": 61.0,
        "tipo_acqua": "deep aquifer",
        "consumo_storico": 770000.0,
        "rendimento_attuale": 0.55,
        "intervento_priorita": "critical",
        "estimated_cost_eur": 1180000.0,
        "arera_roi_pct": 25.9,
        "payback_years": 7.2,
        "recommended_action": "Deep well feasibility, storage buffer and critical pipe replacement",
    },
]


@dataclass(frozen=True)
class InvestmentInput:
    capital_cost_eur: float = 840000.0
    line_length_m: float = 742.0
    diameter_mm: float = 250.0
    useful_life_years: int = 30
    saved_consumption_m3_year: float = 56000.0
    avoided_losses_m3_year: float = 112000.0
    tariff_eur_m3: float = 1.72
    water_value_eur_m3: float = 0.68
    annual_maintenance_eur: float = 18000.0
    indicator_delta_a1: float = 0.07
    indicator_delta_a2: float = 0.09


def _feature_from_opportunity(item: dict[str, Any]) -> dict[str, Any]:
    properties = dict(item)
    lon = float(properties.pop("lon"))
    lat = float(properties.pop("lat"))
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": properties,
    }


def _fallback_overlay() -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [_feature_from_opportunity(item) for item in SYNTHETIC_OPPORTUNITIES],
        "metadata": {
            "source": "synthetic_hackathon",
            "layers": ["gis_network", "hydrogeology", "consumption_hotspots", "intervention_points"],
        },
    }


def get_investment_overlay() -> dict[str, Any]:
    query = """
        WITH latest_anomaly AS (
          SELECT DISTINCT ON (segment_id)
            segment_id, hydraulic, phi
          FROM anomaly_scores
          ORDER BY segment_id, ts DESC
        )
        SELECT
          ps.id,
          ST_Y(ST_LineInterpolatePoint(ps.geom, 0.5)) AS lat,
          ST_X(ST_LineInterpolatePoint(ps.geom, 0.5)) AS lon,
          COALESCE(ps.length_m, 500.0),
          COALESCE(ps.diameter_mm, 180),
          COALESCE(la.hydraulic, 0.52),
          COALESCE(la.phi, 1),
          COALESCE(ps.attrs->>'material', ps.material, 'unknown')
        FROM pipe_segments ps
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        ORDER BY COALESCE(la.phi, 0) DESC, COALESCE(la.hydraulic, 0) DESC, ps.id
        LIMIT 12
    """
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except Exception:
        return _fallback_overlay()

    if not rows:
        return _fallback_overlay()

    opportunities: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        hydraulic = float(row[5] or 0.0)
        phi = int(row[6] or 0)
        depth = 18.0 + (phi * 14.0) + ((index % 3) * 5.0)
        priority = "critical" if phi >= 3 or depth > 50 else "warning" if phi >= 2 or depth >= 25 else "ok"
        cost = max(220000.0, float(row[3] or 500.0) * float(row[4] or 180.0) * 4.2)
        roi = 18.0 + (phi * 4.1) + (hydraulic * 9.5)
        opportunities.append(
            {
                "node_id": int(row[0]),
                "lat": float(row[1]),
                "lon": float(row[2]),
                "falde_id": f"FALDA-CIOCIARIA-{index + 1:02d}",
                "profondita_m": round(depth, 1),
                "tipo_acqua": "deep aquifer" if depth > 50 else "shallow aquifer",
                "consumo_storico": round(480000.0 + hydraulic * 520000.0 + phi * 60000.0, 2),
                "rendimento_attuale": round(max(0.35, 0.74 - hydraulic * 0.16 - phi * 0.035), 3),
                "intervento_priorita": priority,
                "estimated_cost_eur": round(cost, 2),
                "arera_roi_pct": round(roi, 2),
                "payback_years": round(max(3.2, 10.5 - roi / 7.0), 1),
                "recommended_action": "Prioritize source redundancy and renewal for ARERA quality indicators",
            }
        )

    return {
        "type": "FeatureCollection",
        "features": [_feature_from_opportunity(item) for item in opportunities],
        "metadata": {
            "source": "database_derived",
            "layers": ["gis_network", "hydrogeology", "consumption_hotspots", "intervention_points"],
        },
    }


def calculate_investment(payload: InvestmentInput) -> dict[str, Any]:
    annual_saving = (
        payload.saved_consumption_m3_year * payload.tariff_eur_m3
        + payload.avoided_losses_m3_year * payload.water_value_eur_m3
    )
    total_spend = payload.capital_cost_eur + payload.annual_maintenance_eur * payload.useful_life_years
    indicator_benefit = (
        payload.indicator_delta_a1 * ARERA_INDICATORS[0]["weight"]
        + payload.indicator_delta_a2 * ARERA_INDICATORS[1]["weight"]
    )
    arera_bonus = indicator_benefit * payload.capital_cost_eur
    lifetime_benefit = annual_saving * payload.useful_life_years + arera_bonus
    roi_pct = (lifetime_benefit / total_spend) * 100 if total_spend else 0.0
    payback_years = total_spend / annual_saving if annual_saving else None

    return {
        "annual_saving_eur": round(annual_saving, 2),
        "total_spend_eur": round(total_spend, 2),
        "indicator_benefit_score": round(indicator_benefit, 4),
        "estimated_arera_bonus_eur": round(arera_bonus, 2),
        "lifetime_benefit_eur": round(lifetime_benefit, 2),
        "roi_pct": round(roi_pct, 2),
        "payback_years": round(payback_years, 2) if payback_years is not None else None,
        "recommendation": "invest" if roi_pct >= 25.0 else "review",
    }


def get_investment_strategy(roi_target_pct: float = 25.0) -> dict[str, Any]:
    overlay = get_investment_overlay()
    features = overlay["features"]
    ranked = sorted(
        features,
        key=lambda item: (
            item["properties"].get("arera_roi_pct", 0.0),
            item["properties"].get("consumo_storico", 0.0),
        ),
        reverse=True,
    )
    selected = [item for item in ranked if item["properties"].get("arera_roi_pct", 0.0) >= roi_target_pct]
    return {
        "summary": "Prioritize high-consumption nodes where hydrogeology and network losses improve ARERA quality indicators.",
        "roi_target_pct": roi_target_pct,
        "opportunities": selected or ranked[:3],
        "indicators": ARERA_INDICATORS,
        "disclaimer": "Hackathon mode: estimates use public or simulated data and require validation before production decisions.",
    }


def db_saturation_status() -> dict[str, Any]:
    query = """
        SELECT
          t.schemaname,
          t.tablename,
          pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)::regclass) AS total_bytes,
          COALESCE(s.n_live_tup, 0)::bigint AS records
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = t.schemaname
        WHERE t.schemaname = 'public'
        ORDER BY total_bytes DESC
        LIMIT 12
    """
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    except Exception:
        return {
            "status": "unknown",
            "threshold": 0.8,
            "tables": [],
            "message": "Database connection is not configured; batch throttle is in dry-run mode.",
        }

    max_table_bytes = 1_000_000_000
    tables = []
    highest_load = 0.0
    for row in rows:
        load = min(float(row[2] or 0) / max_table_bytes, 1.0)
        highest_load = max(highest_load, load)
        tables.append(
            {
                "schema": row[0],
                "table": row[1],
                "total_bytes": int(row[2] or 0),
                "records": int(row[3] or 0),
                "load_ratio": round(load, 4),
                "status": "CRITICAL" if load > 0.8 else "WARNING" if load > 0.6 else "OK",
            }
        )

    return {
        "status": "CRITICAL" if highest_load > 0.8 else "WARNING" if highest_load > 0.6 else "OK",
        "threshold": 0.8,
        "tables": tables,
        "message": "Pause investment batch inserts when any table reaches the 80% threshold.",
    }
