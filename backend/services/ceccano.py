from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import cos, pi, sin
from statistics import mean
from typing import Any


CENTER_LON = 13.5647
CENTER_LAT = 41.4925

ZONE_TARGETS = {
    "HIGH": 3.0,
    "CENTER": 3.5,
    "LOW": 4.5,
    "PLAIN": 5.0,
}

CRITICAL_PROFILES = {
    "CED-04": {
        "loss_pct": 68,
        "pressure_bar": 1.8,
        "loss_day_pct": 45,
        "status": "critical",
        "issue": "High leakage and corrosion across 1500 m of network",
    },
    "CED-07": {
        "loss_pct": 52,
        "pressure_bar": 2.1,
        "loss_day_pct": 38,
        "status": "emergency",
        "issue": "Broken pipes across roughly 200 m",
    },
    "CED-12": {
        "loss_pct": 74,
        "pressure_bar": 1.2,
        "loss_day_pct": 52,
        "status": "critical",
        "issue": "Pipe break with pressure outside threshold",
    },
    "CED-15": {
        "loss_pct": 89,
        "pressure_bar": 0.8,
        "loss_day_pct": 28,
        "status": "emergency",
        "issue": "East zone with widespread leaks and weak geological stability",
    },
}

MATERIALS = ["ductile_iron", "steel", "polyethylene", "copper"]


def _district_zone(index: int) -> str:
    if index <= 5:
        return "HIGH"
    if index <= 10:
        return "CENTER"
    if index <= 13:
        return "LOW"
    return "PLAIN"


def _zone_altitude(zone: str, index: int) -> tuple[int, int]:
    base = {
        "HIGH": (420, 520),
        "CENTER": (350, 450),
        "LOW": (280, 360),
        "PLAIN": (250, 290),
    }[zone]
    offset = (index % 5) * 4
    return base[0] + offset, base[1] + offset


def _ring_point(index: int, total: int, radius_lon: float, radius_lat: float) -> tuple[float, float]:
    angle = (index / total) * 2 * pi - pi / 2
    return CENTER_LON + cos(angle) * radius_lon, CENTER_LAT + sin(angle) * radius_lat


def _district_polygon(index: int) -> list[list[float]]:
    lon, lat = _ring_point(index - 1, 15, 0.035, 0.025)
    size_lon = 0.009
    size_lat = 0.0065
    return [
        [lon - size_lon, lat - size_lat],
        [lon + size_lon, lat - size_lat],
        [lon + size_lon, lat + size_lat],
        [lon - size_lon, lat + size_lat],
        [lon - size_lon, lat - size_lat],
    ]


def build_districts() -> list[dict[str, Any]]:
    districts: list[dict[str, Any]] = []
    names = [
        "High Colle Leo",
        "High Badia",
        "High Madonna",
        "Center Castle",
        "Center Borgo",
        "Center Valley",
        "North Station",
        "Center Sacco",
        "Center Maiura",
        "Low Le Sterpare",
        "Low Anime Sante",
        "South Rail Yard",
        "Low Cardegna",
        "River Plain",
        "East Morena",
    ]
    for index in range(1, 16):
        district_id = f"CED-{index:02d}"
        zone = _district_zone(index)
        alt_min, alt_max = _zone_altitude(zone, index)
        profile = CRITICAL_PROFILES.get(district_id)
        loss_pct = profile["loss_pct"] if profile else 8 + (index * 3) % 11
        pressure_target = ZONE_TARGETS[zone]
        pressure_actual = profile["pressure_bar"] if profile else round(pressure_target + (((index % 4) - 1.5) * 0.22), 2)
        district = {
            "id": district_id,
            "name": names[index - 1],
            "zone": zone,
            "altitude_min_m": alt_min,
            "altitude_max_m": alt_max,
            "territory_km2": round(1.2 + index * 0.18, 2),
            "users": 520 + index * 95,
            "consumption_m3_day": round(430 + index * 38 + (120 if profile else 0), 1),
            "pressure_target_bar": pressure_target,
            "pressure_actual_bar": pressure_actual,
            "loss_pct": loss_pct,
            "loss_day_pct": profile["loss_day_pct"] if profile else round(loss_pct * 0.7, 1),
            "status": profile["status"] if profile else "normal",
            "issue": profile["issue"] if profile else "Stable pressure and losses inside control band",
            "quality_rating": max(1, round(9.4 - (loss_pct / 14), 1)),
            "water_efficacy_pct": max(8, 100 - loss_pct),
            "moisture_percentage": round(22 + (index % 6) * 4.3, 1),
            "humidity_avg": round(49 + (index % 5) * 3.1, 1),
            "araise_rank": index,
            "violations": 2 if profile and profile["status"] == "critical" else 1 if profile else 0,
            "geometry": {
                "type": "Polygon",
                "coordinates": [_district_polygon(index)],
            },
        }
        districts.append(district)
    return districts


DISTRICTS = build_districts()


def build_reservoirs() -> list[dict[str, Any]]:
    reservoirs: list[dict[str, Any]] = []
    elevations = [420, 480, 520, 350, 390, 450, 280, 320, 360, 250, 290, 430, 370, 305, 265]
    for index, elevation in enumerate(elevations, start=1):
        lon, lat = _ring_point(index - 1, 15, 0.026, 0.018)
        reservoirs.append(
            {
                "id": f"CER-{index:02d}",
                "name": f"Ceccano Reservoir {index:02d}",
                "district_id": f"CED-{index:02d}",
                "capacity_m3": 900 + index * 140,
                "level_pct": max(32, 84 - (index * 3) % 31),
                "elevation_m": elevation,
                "age_years": 8 + (index * 2) % 34,
                "maintenance_due": "2026-05-15" if index in {4, 7, 12, 15} else "2026-10-01",
                "coordinates": [round(lon, 6), round(lat, 6)],
            }
        )
    return reservoirs


RESERVOIRS = build_reservoirs()


def build_valves() -> list[dict[str, Any]]:
    valves: list[dict[str, Any]] = []
    for index, district in enumerate(DISTRICTS, start=1):
        lon, lat = _ring_point(index - 1, 15, 0.031, 0.022)
        mode = "day" if index <= 10 else "night"
        is_critical = district["status"] in {"critical", "emergency"}
        valves.append(
            {
                "valve_id": f"CEV-{index:02d}",
                "district_id": district["id"],
                "zone": district["zone"],
                "altitude_m": round((district["altitude_min_m"] + district["altitude_max_m"]) / 2),
                "type": mode,
                "name": f"Valve {district['id']}",
                "loc_pos_x": round(lon, 6),
                "loc_pos_y": round(lat, 6),
                "posxx": round(0.2 + index * 0.07, 2),
                "posyy": round(0.4 + index * 0.05, 2),
                "target_curve": f"{district['zone'].lower()}-day",
                "target_night": f"{district['zone'].lower()}-night",
                "stat_today_pct": 55 if is_critical else 80,
                "stat_night_pct": 34 if is_critical else 40,
                "flow_today_m3h": 980 if is_critical else 1500 - index * 18,
                "flow_night_m3h": 260 if is_critical else 300 + index * 3,
                "recommended_open_pct": _recommended_opening(district),
            }
        )
    return valves


def _recommended_opening(district: dict[str, Any]) -> int:
    if district["id"] == "CED-04":
        return 50
    if district["id"] == "CED-07":
        return 72
    if district["id"] == "CED-12":
        return 45
    if district["id"] == "CED-15":
        return 70
    return 80 if district["zone"] != "PLAIN" else 68


VALVES = build_valves()


def build_conduits() -> list[dict[str, Any]]:
    conduits: list[dict[str, Any]] = []
    for index in range(1, 26):
        start = _ring_point((index - 1) % 15, 15, 0.018 + (index % 3) * 0.003, 0.013)
        end = _ring_point(index % 15, 15, 0.018 + ((index + 1) % 3) * 0.003, 0.013)
        conduits.append(
            {
                "id": f"CEC-{index:02d}",
                "from_district_id": f"CED-{((index - 1) % 15) + 1:02d}",
                "to_district_id": f"CED-{(index % 15) + 1:02d}",
                "length_m": 280 + index * 42,
                "diameter_mm": 150 + (index % 5) * 50,
                "material": MATERIALS[index % len(MATERIALS)],
                "flow_rate_m3h": round(260 + index * 18.5, 1),
                "pressure_drop_bar": round(0.16 + (index % 6) * 0.08, 2),
                "coordinates": [[round(start[0], 6), round(start[1], 6)], [round(end[0], 6), round(end[1], 6)]],
            }
        )
    return conduits


CONDUITS = build_conduits()


def calculate_pressure(height_m: float, flow_m3h: float, diameter_mm: float, reservoir_height_m: float) -> float:
    zeta = 0.012 * height_m
    dynamic_pressure = flow_m3h / max(diameter_mm * 23, 1)
    static_pressure = max(0, reservoir_height_m - height_m) / 10
    return round(zeta + dynamic_pressure + static_pressure, 2)


def get_ceccano_overview() -> dict[str, Any]:
    critical = [item for item in DISTRICTS if item["status"] == "critical"]
    emergency = [item for item in DISTRICTS if item["status"] == "emergency"]
    avg_pressure = round(mean(item["pressure_actual_bar"] for item in DISTRICTS), 2)
    avg_loss = round(mean(item["loss_pct"] for item in DISTRICTS), 1)
    return {
        "network": "Ceccano Water Network",
        "center": {"lat": CENTER_LAT, "lon": CENTER_LON},
        "counts": {
            "districts": len(DISTRICTS),
            "valves": len(VALVES),
            "reservoirs": len(RESERVOIRS),
            "conduits": len(CONDUITS),
            "sensors": 40,
            "users": 120,
        },
        "status": {
            "critical": len(critical),
            "emergency": len(emergency),
            "normal": len(DISTRICTS) - len(critical) - len(emergency),
            "avg_pressure_bar": avg_pressure,
            "avg_loss_pct": avg_loss,
            "db_load_pct": 63,
            "night_mode": True,
        },
        "targets": ZONE_TARGETS,
        "ai_summary": (
            "4 districts exceed the 50% loss threshold. Prioritize CED-12 and CED-15, "
            "then rebalance CED-04 through partial valve closure and flow support from stable zones."
        ),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_districts() -> list[dict[str, Any]]:
    return DISTRICTS


def get_district(district_id: str) -> dict[str, Any] | None:
    return next((item for item in DISTRICTS if item["id"].lower() == district_id.lower()), None)


def get_valves() -> list[dict[str, Any]]:
    return VALVES


def get_valve(valve_id: str) -> dict[str, Any] | None:
    return next((item for item in VALVES if item["valve_id"].lower() == valve_id.lower()), None)


def get_reservoirs() -> list[dict[str, Any]]:
    return RESERVOIRS


def get_bar_metrics() -> dict[str, Any]:
    metrics = []
    for district in DISTRICTS:
        reservoir = next((item for item in RESERVOIRS if item["district_id"] == district["id"]), RESERVOIRS[0])
        conduit = next((item for item in CONDUITS if item["from_district_id"] == district["id"]), CONDUITS[0])
        calculated = calculate_pressure(
            district["altitude_max_m"],
            conduit["flow_rate_m3h"],
            conduit["diameter_mm"],
            reservoir["elevation_m"],
        )
        metrics.append(
            {
                "district_id": district["id"],
                "zone": district["zone"],
                "target_bar": district["pressure_target_bar"],
                "actual_bar": district["pressure_actual_bar"],
                "calculated_bar": calculated,
                "delta_bar": round(district["pressure_actual_bar"] - district["pressure_target_bar"], 2),
                "status": "low" if district["pressure_actual_bar"] < district["pressure_target_bar"] - 0.6 else "ok",
            }
        )
    return {"items": metrics, "formula": "zeta + dynamic_pressure + static_pressure", "targets": ZONE_TARGETS}


def get_night_mode() -> dict[str, Any]:
    return {
        "enabled": True,
        "window": "22:00-06:00",
        "day": {"pressure_target_bar": 4.5, "flow_limit_m3h": 1500, "default_open_pct": 80},
        "night": {"pressure_target_bar": 2.0, "flow_limit_m3h": 300, "default_open_pct": 40},
        "valves": [
            {
                "valve_id": valve["valve_id"],
                "district_id": valve["district_id"],
                "day_open_pct": valve["stat_today_pct"],
                "night_open_pct": valve["stat_night_pct"],
                "recommended_open_pct": valve["recommended_open_pct"],
            }
            for valve in VALVES
        ],
    }


def get_forecast() -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    points = []
    for hour in range(24):
        demand_factor = 0.62 + 0.38 * max(0, sin((hour - 5) / 24 * 2 * pi))
        points.append(
            {
                "ts": (now + timedelta(hours=hour)).isoformat(),
                "expected_flow_m3h": round(660 + demand_factor * 880, 1),
                "expected_pressure_bar": round(2.1 + demand_factor * 2.4, 2),
                "risk_score": round(min(0.96, 0.24 + demand_factor * 0.52 + (0.12 if hour in {7, 8, 20, 21} else 0)), 2),
            }
        )
    return {
        "horizon_hours": 24,
        "points": points,
        "bottlenecks": [
            {"district_id": "CED-12", "hour_window": "07:00-10:00", "risk": "critical"},
            {"district_id": "CED-15", "hour_window": "20:00-23:00", "risk": "high"},
        ],
    }


def get_gis_overlay() -> dict[str, Any]:
    return {
        "type": "ceccano-gis-overlay",
        "center": [CENTER_LON, CENTER_LAT],
        "layers": {
            "districts": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": district["geometry"],
                        "properties": {
                            "id": district["id"],
                            "name": district["name"],
                            "zone": district["zone"],
                            "status": district["status"],
                            "loss_pct": district["loss_pct"],
                        },
                    }
                    for district in DISTRICTS
                ],
            },
            "reservoirs": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": reservoir["coordinates"]},
                        "properties": reservoir,
                    }
                    for reservoir in RESERVOIRS
                ],
            },
            "conduits": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "LineString", "coordinates": conduit["coordinates"]},
                        "properties": conduit,
                    }
                    for conduit in CONDUITS
                ],
            },
            "valves": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [valve["loc_pos_x"], valve["loc_pos_y"]]},
                        "properties": valve,
                    }
                    for valve in VALVES
                ],
            },
            "sensors": {
                "count": 40,
                "status": {"ok": 31, "warning": 5, "critical": 4},
            },
            "users": {"count": 120, "cluster": True},
        },
    }


def adjust_valve(payload: dict[str, Any]) -> dict[str, Any] | None:
    valve_id = str(payload.get("valve_id") or payload.get("id") or "")
    valve = get_valve(valve_id)
    if not valve:
        return None
    target_open_pct = int(payload.get("target_open_pct", valve["recommended_open_pct"]))
    target_open_pct = max(0, min(100, target_open_pct))
    district = get_district(valve["district_id"])
    pressure_delta = round((target_open_pct - valve["stat_today_pct"]) / 100 * 1.1, 2)
    expected_pressure = round((district["pressure_actual_bar"] if district else 3.0) + pressure_delta, 2)
    return {
        "accepted": True,
        "valve_id": valve["valve_id"],
        "district_id": valve["district_id"],
        "previous_open_pct": valve["stat_today_pct"],
        "target_open_pct": target_open_pct,
        "expected_pressure_bar": expected_pressure,
        "expected_flow_m3h": round(valve["flow_today_m3h"] * target_open_pct / max(valve["stat_today_pct"], 1), 1),
        "audit": {
            "operator_id": payload.get("operator_id", "operator"),
            "mode": payload.get("mode", valve["type"]),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        "rationale": (
            f"Adjust {valve['valve_id']} toward {target_open_pct}% to bring "
            f"{valve['district_id']} close to the {valve['zone']} zone target."
        ),
    }


def get_alerts() -> dict[str, Any]:
    items = [
        {
            "id": f"ceccano-alert-{district['id'].lower()}",
            "district_id": district["id"],
            "severity": district["status"],
            "title": f"{district['id']} loss {district['loss_pct']}% over threshold",
            "recommendation": f"Set {next(v for v in VALVES if v['district_id'] == district['id'])['valve_id']} to recommended opening.",
        }
        for district in DISTRICTS
        if district["status"] in {"critical", "emergency"}
    ]
    db_load = get_ceccano_overview()["status"]["db_load_pct"]
    return {
        "items": items,
        "db_load_pct": db_load,
        "db_status": "warning" if db_load >= 60 else "ok",
        "threshold_pct": 80,
    }
