from __future__ import annotations

import math
from datetime import date, datetime, timezone
from functools import lru_cache
from typing import Any

from db.supabase import get_connection


def _serialize_feature(geometry: Any, properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def fetch_segments(dma_id: int | None = None, bbox: str | None = None) -> dict[str, Any]:
    where = []
    params: list[Any] = []
    if dma_id is not None:
        where.append("ps.dma_id = %s")
        params.append(dma_id)
    if bbox:
        west, south, east, north = [float(item) for item in bbox.split(",")]
        where.append("ps.geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)")
        params.extend([west, south, east, north])
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    query = f"""
        WITH latest_anomaly AS (
            SELECT DISTINCT ON (segment_id)
              segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
            FROM anomaly_scores
            ORDER BY segment_id, ts DESC
        )
        SELECT
          ps.id,
          ST_AsGeoJSON(ps.geom)::json,
          ps.dma_id,
          ps.material,
          ps.diameter_mm,
          ps.install_year,
          ps.length_m,
          COALESCE(la.subsidence, 0.0),
          COALESCE(la.ndvi, 0.0),
          COALESCE(la.thermal, 0.0),
          COALESCE(la.hydraulic, 0.0),
          COALESCE(la.tank_signal, 0.0),
          COALESCE(la.phi, 0),
          COALESCE(la.phi_confidence, 0.0),
          la.ts,
          COALESCE(la.explanation, ''),
          COALESCE(ps.attrs, '{{}}'::jsonb)
        FROM pipe_segments ps
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        {clause}
        ORDER BY COALESCE(la.phi, 0) DESC, ps.id
        LIMIT 6000
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    features = [
        _serialize_feature(
            row[1],
            {
                "id": row[0],
                "dma_id": row[2],
                "material": row[3],
                "diameter_mm": row[4],
                "install_year": row[5],
                "length_m": row[6],
                "subsidence": float(row[7]),
                "ndvi": float(row[8]),
                "thermal": float(row[9]),
                "hydraulic": float(row[10]),
                "tank_signal": float(row[11]),
                "phi": int(row[12]),
                "phi_confidence": float(row[13]),
                "latest_ts": row[14].isoformat() if row[14] else None,
                "explanation": row[15],
                "attrs": row[16] or {},
            },
        )
        for row in rows
    ]
    return {"type": "FeatureCollection", "features": features}


def get_segment_detail(segment_id: int) -> dict[str, Any] | None:
    query = """
        WITH latest_anomaly AS (
            SELECT DISTINCT ON (segment_id)
              segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
            FROM anomaly_scores
            WHERE segment_id = %s
            ORDER BY segment_id, ts DESC
        ),
        latest_incidents AS (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', id,
                  'title', title,
                  'severity', severity,
                  'status', status,
                  'updated_at', updated_at
                ) ORDER BY updated_at DESC
              ) FILTER (WHERE id IS NOT NULL),
              '[]'::json
            ) AS items
            FROM incidents
            WHERE entity_type = 'segment' AND entity_id = %s
        )
        SELECT
          ps.id,
          ST_AsGeoJSON(ps.geom)::json,
          ps.dma_id,
          d.name,
          ps.material,
          ps.diameter_mm,
          ps.install_year,
          ps.length_m,
          COALESCE(la.subsidence, 0.0),
          COALESCE(la.ndvi, 0.0),
          COALESCE(la.thermal, 0.0),
          COALESCE(la.hydraulic, 0.0),
          COALESCE(la.tank_signal, 0.0),
          COALESCE(la.phi, 0),
          COALESCE(la.phi_confidence, 0.0),
          la.ts,
          COALESCE(la.explanation, ''),
          COALESCE(li.items, '[]'::json)
        FROM pipe_segments ps
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        LEFT JOIN dmas d ON d.id = ps.dma_id
        CROSS JOIN latest_incidents li
        WHERE ps.id = %s
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (segment_id, segment_id, segment_id))
        row = cur.fetchone()
    if not row:
        return None
    return {
        "segment": _serialize_feature(
            row[1],
            {
                "id": row[0],
                "dma_id": row[2],
                "dma_name": row[3],
                "material": row[4],
                "diameter_mm": row[5],
                "install_year": row[6],
                "length_m": row[7],
                "subsidence": float(row[8]),
                "ndvi": float(row[9]),
                "thermal": float(row[10]),
                "hydraulic": float(row[11]),
                "tank_signal": float(row[12]),
                "phi": int(row[13]),
                "phi_confidence": float(row[14]),
                "latest_ts": row[15].isoformat() if row[15] else None,
                "explanation": row[16],
            },
        ),
        "incidents": row[17] or [],
    }


def get_segment_history(segment_id: int, days: int = 90) -> list[dict[str, Any]]:
    query = """
        SELECT ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi
        FROM anomaly_scores
        WHERE segment_id = %s
          AND ts >= NOW() - (%s || ' days')::interval
        ORDER BY ts ASC
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (segment_id, days))
        rows = cur.fetchall()
    return [
        {
            "ts": row[0].isoformat(),
            "subsidence": float(row[1] or 0.0),
            "ndvi": float(row[2] or 0.0),
            "thermal": float(row[3] or 0.0),
            "hydraulic": float(row[4] or 0.0),
            "tank_signal": float(row[5] or 0.0),
            "phi": int(row[6] or 0),
        }
        for row in rows
    ]


def _tank_select_query(where_clause: str) -> str:
    return f"""
        WITH latest_state AS (
            SELECT DISTINCT ON (tank_id)
              tank_id, ts, level_m, volume_m3, inflow_lps, outflow_lps, downstream_pressure_bar
            FROM tank_state
            ORDER BY tank_id, ts DESC
        ),
        latest_balance AS (
            SELECT DISTINCT ON (tank_id)
              tank_id, day, residual_pct, flag
            FROM tank_balance
            ORDER BY tank_id, day DESC
        ),
        latest_anomaly AS (
            SELECT DISTINCT ON (tank_id)
              tank_id, ts, severity, score, detector
            FROM tank_anomalies
            ORDER BY tank_id, ts DESC
        ),
        tank_dma AS (
            SELECT DISTINCT ON (n.id)
              n.id AS tank_id, d.id AS dma_id, d.name AS dma_name
            FROM pipe_nodes n
            LEFT JOIN dmas d ON ST_Intersects(n.geom, d.geom)
            WHERE n.node_type = 'tank'
            ORDER BY n.id, d.id
        )
        SELECT
          pn.id,
          COALESCE(pn.name, 'TK-' || pn.id::text),
          ST_AsGeoJSON(pn.geom)::json,
          COALESCE((pn.attrs->>'capacity_m3')::float, 1200.0),
          COALESCE((pn.attrs->>'max_level_m')::float, 6.0),
          COALESCE((pn.attrs->>'min_level_m')::float, 1.2),
          COALESCE(pn.elevation_m, 0.0),
          COALESCE(pn.attrs->>'data_source', 'unknown'),
          tank_dma.dma_id,
          tank_dma.dma_name,
          ls.ts,
          COALESCE(
            ls.level_m,
            GREATEST(
              COALESCE((pn.attrs->>'min_level_m')::float, 1.2),
              COALESCE((pn.attrs->>'max_level_m')::float, 6.0) * (0.27 + (MOD(pn.id, 7) * 0.035))
            )
          ),
          COALESCE(
            ls.volume_m3,
            COALESCE((pn.attrs->>'capacity_m3')::float, 1200.0) * (0.27 + (MOD(pn.id, 7) * 0.035))
          ),
          COALESCE(ls.inflow_lps, 0.0),
          COALESCE(ls.outflow_lps, 0.0),
          COALESCE(ls.downstream_pressure_bar, 0.0),
          COALESCE(lb.residual_pct, 0.0),
          COALESCE(lb.flag, 'normal'),
          COALESCE(la.severity, 0),
          COALESCE(la.score, 0.0),
          COALESCE(la.detector, 'none')
        FROM pipe_nodes pn
        LEFT JOIN latest_state ls ON ls.tank_id = pn.id
        LEFT JOIN latest_balance lb ON lb.tank_id = pn.id
        LEFT JOIN latest_anomaly la ON la.tank_id = pn.id
        LEFT JOIN tank_dma ON tank_dma.tank_id = pn.id
        WHERE {where_clause}
    """


def _tank_feature_from_row(row: Any) -> dict[str, Any]:
    capacity = float(row[3] or 0.0)
    max_level = max(float(row[4] or 0.1), 0.1)
    level = float(row[11] or 0.0)
    headroom_pct = max(0.0, min(100.0, 100.0 - ((level / max_level) * 100.0)))
    net_lps = float(row[13] or 0.0) - float(row[14] or 0.0)
    resilience_hours = round(max(0.5, ((capacity * max(headroom_pct, 1.0) / 100.0) / max(abs(net_lps) * 3.6, 1.0))), 2)
    return _serialize_feature(
        row[2],
        {
            "id": row[0],
            "name": row[1],
            "capacity_m3": capacity,
            "max_level_m": max_level,
            "min_level_m": float(row[5] or 0.0),
            "elevation_m": float(row[6] or 0.0),
            "data_source": row[7],
            "dma_id": row[8],
            "dma_name": row[9],
            "latest_ts": row[10].isoformat() if row[10] else None,
            "level_m": level,
            "volume_m3": float(row[12] or 0.0),
            "inflow_lps": float(row[13] or 0.0),
            "outflow_lps": float(row[14] or 0.0),
            "downstream_pressure_bar": float(row[15] or 0.0),
            "headroom_pct": round(headroom_pct, 2),
            "residual_pct": float(row[16] or 0.0),
            "balance_flag": row[17],
            "phi_signal": int(row[18] or 0),
            "anomaly_score": float(row[19] or 0.0),
            "anomaly_detector": row[20],
            "resilience_hours": resilience_hours,
        },
    )


def fetch_tanks(dma_id: int | None = None) -> dict[str, Any]:
    where = ["pn.node_type = 'tank'"]
    params: list[Any] = []
    if dma_id is not None:
        where.append("tank_dma.dma_id = %s")
        params.append(dma_id)
    clause = " AND ".join(where)
    query = _tank_select_query(clause) + "\n ORDER BY COALESCE(la.severity, 0) DESC, pn.id\n LIMIT 300"
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    return {"type": "FeatureCollection", "features": [_tank_feature_from_row(row) for row in rows]}


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _line_midpoint(coordinates: list[list[float]] | list[tuple[float, float]]) -> tuple[float, float]:
    if not coordinates:
        return 0.0, 0.0
    middle = coordinates[len(coordinates) // 2]
    return float(middle[0]), float(middle[1])


def _pipe_flow(diameter_mm: int | None, hydraulic: float, phi: int, segment_id: int) -> tuple[float, float, float]:
    diameter = max(float(diameter_mm or 150), 50.0)
    max_flow = _clamp((diameter * diameter) * 0.00175, 18.0, 280.0)
    load = _clamp(0.24 + (hydraulic * 0.52) + (phi * 0.06) + ((segment_id % 17) * 0.008), 0.15, 0.95)
    flow = _clamp(max_flow * load, 10.0, 220.0)
    fill = _clamp((flow / max_flow) * 100.0, 0.0, 100.0)
    return round(flow, 2), round(max_flow, 2), round(fill, 2)


def list_network_areas() -> list[dict[str, Any]]:
    query = """
        SELECT
          d.id,
          d.name,
          COUNT(DISTINCT ps.id)::int AS pipe_count,
          COUNT(DISTINCT pn.id)::int AS tank_count,
          ST_AsGeoJSON(ST_Envelope(d.geom))::json AS bounds
        FROM dmas d
        LEFT JOIN pipe_segments ps ON ps.dma_id = d.id
        LEFT JOIN pipe_nodes pn ON pn.node_type = 'tank' AND ST_Intersects(pn.geom, d.geom)
        GROUP BY d.id, d.name, d.geom
        ORDER BY d.id
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "name": row[1],
            "pipe_count": int(row[2] or 0),
            "tank_count": int(row[3] or 0),
            "bounds": row[4],
        }
        for row in rows
    ]


def fetch_network_topology(
    dma_id: int | None = None,
    tank_limit: int | None = None,
    pipe_limit: int | None = None,
) -> dict[str, Any]:
    tank_where = "pn.node_type = 'tank'"
    tank_params: list[Any] = []
    if dma_id is not None:
        tank_where += " AND tank_dma.dma_id = %s"
        tank_params.append(dma_id)
    tank_query = _tank_select_query(tank_where) + """
        ORDER BY COALESCE(la.severity, 0) DESC, pn.id
    """
    if tank_limit is not None:
        tank_query += " LIMIT %s"
        tank_params.append(tank_limit)

    segment_where = "WHERE ps.dma_id = %s" if dma_id is not None else ""
    segment_params: list[Any] = [dma_id] if dma_id is not None else []
    segment_query = f"""
        WITH latest_anomaly AS (
            SELECT DISTINCT ON (segment_id)
              segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence
            FROM anomaly_scores
            ORDER BY segment_id, ts DESC
        )
        SELECT
          ps.id,
          ST_AsGeoJSON(ps.geom)::json,
          ps.dma_id,
          d.name,
          ps.material,
          ps.diameter_mm,
          ps.install_year,
          ps.length_m,
          ps.from_node,
          ps.to_node,
          fn.node_type,
          tn.node_type,
          COALESCE(la.subsidence, 0.0),
          COALESCE(la.ndvi, 0.0),
          COALESCE(la.thermal, 0.0),
          COALESCE(la.hydraulic, 0.0),
          COALESCE(la.tank_signal, 0.0),
          COALESCE(la.phi, 0)
        FROM pipe_segments ps
        LEFT JOIN dmas d ON d.id = ps.dma_id
        LEFT JOIN pipe_nodes fn ON fn.id = ps.from_node
        LEFT JOIN pipe_nodes tn ON tn.id = ps.to_node
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        {segment_where}
        ORDER BY COALESCE(la.phi, 0) DESC, ps.id
    """
    if pipe_limit is not None:
        segment_query += " LIMIT %s"
        segment_params.append(pipe_limit)

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(tank_query, tank_params)
        tank_rows = cur.fetchall()
        cur.execute(segment_query, segment_params)
        segment_rows = cur.fetchall()
        area_row = None
        if dma_id is not None:
            cur.execute(
                """
                SELECT id, name
                FROM dmas
                WHERE id = %s
                """,
                (dma_id,),
            )
            area_row = cur.fetchone()

    pipes = []
    connected_by_tank: dict[int, list[int]] = {}
    edges = []

    for row in segment_rows:
        geometry = row[1] or {}
        coordinates = geometry.get("coordinates") or []
        midpoint = _line_midpoint(coordinates)
        phi = int(row[17] or 0)
        hydraulic = float(row[15] or 0.0)
        flow_rate, max_flow, fill_percent = _pipe_flow(row[5], hydraulic, phi, row[0])
        from_tank = int(row[8]) if row[10] == "tank" and row[8] is not None else None
        to_tank = int(row[9]) if row[11] == "tank" and row[9] is not None else None
        if from_tank is not None:
            connected_by_tank.setdefault(from_tank, []).append(row[0])
            edges.append({"id": f"tank-{from_tank}-pipe-{row[0]}", "from": f"tank:{from_tank}", "to": f"pipe:{row[0]}", "pipe_id": row[0]})
        if to_tank is not None:
            connected_by_tank.setdefault(to_tank, []).append(row[0])
            edges.append({"id": f"pipe-{row[0]}-tank-{to_tank}", "from": f"pipe:{row[0]}", "to": f"tank:{to_tank}", "pipe_id": row[0]})

        pipes.append(
            {
                "id": row[0],
                "type": "pipe",
                "x": midpoint[0],
                "y": midpoint[1],
                "path": [[float(point[0]), float(point[1])] for point in coordinates],
                "flowRate": flow_rate,
                "maxFlow": max_flow,
                "fillPercent": fill_percent,
                "material": row[4] or "unknown",
                "diameter_mm": int(row[5] or 150),
                "length_m": round(float(row[7] or 0.0), 2),
                "phi": phi,
                "subsidence": round(float(row[12] or 0.0), 4),
                "ndvi": round(float(row[13] or 0.0), 4),
                "thermal": round(float(row[14] or 0.0), 4),
                "hydraulic": round(hydraulic, 4),
                "tank_signal": round(float(row[16] or 0.0), 4),
                "install_year": row[6],
                "dma_id": row[2],
                "dma_name": row[3],
                "fromTank": from_tank,
                "toTank": to_tank,
                "fromNode": row[8],
                "toNode": row[9],
            }
        )

    tank_features = [_tank_feature_from_row(row) for row in tank_rows]
    tank_points = [
        (
            int(feature["properties"]["id"]),
            float(feature["geometry"]["coordinates"][0]),
            float(feature["geometry"]["coordinates"][1]),
        )
        for feature in tank_features
    ]

    for pipe in pipes:
        if not tank_points:
            break
        if pipe["fromTank"] is not None and pipe["toTank"] is not None:
            continue
        nearest = sorted(
            tank_points,
            key=lambda item: math.hypot(float(pipe["x"]) - item[1], float(pipe["y"]) - item[2]),
        )
        inferred_from = nearest[0][0]
        inferred_to = nearest[1][0] if len(nearest) > 1 else inferred_from
        if pipe["fromTank"] is None:
            pipe["fromTank"] = inferred_from
            connected_by_tank.setdefault(inferred_from, []).append(pipe["id"])
            edges.append({"id": f"tank-{inferred_from}-pipe-{pipe['id']}", "from": f"tank:{inferred_from}", "to": f"pipe:{pipe['id']}", "pipe_id": pipe["id"]})
        if pipe["toTank"] is None and inferred_to != pipe["fromTank"]:
            pipe["toTank"] = inferred_to
            connected_by_tank.setdefault(inferred_to, []).append(pipe["id"])
            edges.append({"id": f"pipe-{pipe['id']}-tank-{inferred_to}", "from": f"pipe:{pipe['id']}", "to": f"tank:{inferred_to}", "pipe_id": pipe["id"]})

    tanks = []
    for feature in tank_features:
        props = feature["properties"]
        coordinates = feature["geometry"]["coordinates"]
        max_level = max(float(props.get("max_level_m") or 0.1), 0.1)
        level = _clamp(float(props.get("level_m") or 0.0), 0.0, max_level)
        fill_level = _clamp((level / max_level) * 100.0, 0.0, 100.0)
        tank_id = int(props["id"])
        tanks.append(
            {
                "id": tank_id,
                "name": props["name"],
                "type": "tank",
                "x": float(coordinates[0]),
                "y": float(coordinates[1]),
                "lon": float(coordinates[0]),
                "lat": float(coordinates[1]),
                "fillLevel": round(fill_level, 2),
                "level_m": round(level, 2),
                "max_level_m": round(max_level, 2),
                "capacity_m3": round(float(props.get("capacity_m3") or 0.0), 2),
                "inflow_lps": round(float(props.get("inflow_lps") or 0.0), 2),
                "outflow_lps": round(float(props.get("outflow_lps") or 0.0), 2),
                "headroom_pct": round(float(props.get("headroom_pct") or 0.0), 2),
                "resilience_hours": round(float(props.get("resilience_hours") or 0.0), 2),
                "dma_id": props.get("dma_id"),
                "dma_name": props.get("dma_name"),
                "elevation_m": props.get("elevation_m"),
                "data_source": props.get("data_source"),
                "phi": int(props.get("phi_signal") or 0),
                "connectedPipes": sorted(set(connected_by_tank.get(tank_id, []))),
            }
        )

    return {
        "tanks": tanks,
        "pipes": pipes,
        "edges": edges,
        "area": {"id": area_row[0], "name": area_row[1]} if area_row else None,
        "totals": {
            "tanks": len(tanks),
            "pipes": len(pipes),
            "edges": len(edges),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def fetch_segments_by_ids(segment_ids: list[int]) -> list[dict[str, Any]]:
    if not segment_ids:
        return []
    query = """
        WITH latest_anomaly AS (
            SELECT DISTINCT ON (segment_id)
              segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
            FROM anomaly_scores
            WHERE segment_id = ANY(%s)
            ORDER BY segment_id, ts DESC
        )
        SELECT
          ps.id,
          ST_AsGeoJSON(ps.geom)::json,
          ps.dma_id,
          ps.material,
          ps.diameter_mm,
          ps.install_year,
          ps.length_m,
          COALESCE(la.subsidence, 0.0),
          COALESCE(la.ndvi, 0.0),
          COALESCE(la.thermal, 0.0),
          COALESCE(la.hydraulic, 0.0),
          COALESCE(la.tank_signal, 0.0),
          COALESCE(la.phi, 0),
          COALESCE(la.phi_confidence, 0.0),
          la.ts,
          COALESCE(la.explanation, ''),
          COALESCE(ps.attrs, '{}'::jsonb)
        FROM pipe_segments ps
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        WHERE ps.id = ANY(%s)
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (segment_ids, segment_ids))
        rows = cur.fetchall()
    features = [_serialize_feature(
        row[1],
        {
            "id": row[0],
            "dma_id": row[2],
            "material": row[3],
            "diameter_mm": row[4],
            "install_year": row[5],
            "length_m": row[6],
            "subsidence": float(row[7]),
            "ndvi": float(row[8]),
            "thermal": float(row[9]),
            "hydraulic": float(row[10]),
            "tank_signal": float(row[11]),
            "phi": int(row[12]),
            "phi_confidence": float(row[13]),
            "latest_ts": row[14].isoformat() if row[14] else None,
            "explanation": row[15],
            "attrs": row[16] or {},
        },
    ) for row in rows]
    features_by_id = {feature["properties"]["id"]: feature for feature in features}
    return [features_by_id[segment_id] for segment_id in segment_ids if segment_id in features_by_id]


def get_tank_detail(tank_id: int) -> dict[str, Any] | None:
    feature_query = _tank_select_query("pn.node_type = 'tank' AND pn.id = %s")
    query = """
        SELECT ts, level_m, volume_m3, inflow_lps, outflow_lps, downstream_pressure_bar
        FROM tank_state
        WHERE tank_id = %s
          AND ts >= NOW() - interval '24 hours'
        ORDER BY ts ASC
    """
    anomaly_query = """
        SELECT ts, detector, severity, score, explanation, linked_segments
        FROM tank_anomalies
        WHERE tank_id = %s
        ORDER BY ts DESC
        LIMIT 50
    """
    balance_query = """
        SELECT day, inflow_m3, outflow_m3, demand_m3, delta_volume_m3, residual_m3, residual_pct, flag
        FROM tank_balance
        WHERE tank_id = %s
        ORDER BY day DESC
        LIMIT 30
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(feature_query, (tank_id,))
        feature_row = cur.fetchone()
        if not feature_row:
            return None
        cur.execute(query, (tank_id,))
        state_rows = cur.fetchall()
        cur.execute(anomaly_query, (tank_id,))
        anomaly_rows = cur.fetchall()
        cur.execute(balance_query, (tank_id,))
        balance_rows = cur.fetchall()
    return {
        "tank": _tank_feature_from_row(feature_row),
        "state_24h": [
            {
                "ts": row[0].isoformat(),
                "level_m": float(row[1] or 0.0),
                "volume_m3": float(row[2] or 0.0),
                "inflow_lps": float(row[3] or 0.0),
                "outflow_lps": float(row[4] or 0.0),
                "downstream_pressure_bar": float(row[5] or 0.0),
            }
            for row in state_rows
        ],
        "balance": [
            {
                "day": row[0].isoformat(),
                "inflow_m3": float(row[1] or 0.0),
                "outflow_m3": float(row[2] or 0.0),
                "demand_m3": float(row[3] or 0.0),
                "delta_volume_m3": float(row[4] or 0.0),
                "residual_m3": float(row[5] or 0.0),
                "residual_pct": float(row[6] or 0.0),
                "flag": row[7],
            }
            for row in balance_rows
        ],
        "anomalies": [
            {
                "ts": row[0].isoformat(),
                "detector": row[1],
                "severity": int(row[2]),
                "score": float(row[3]),
                "explanation": row[4],
                "linked_segments": row[5] or [],
            }
            for row in anomaly_rows
        ],
    }


def get_tank_latest_balance(tank_id: int) -> dict[str, Any]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT day, inflow_m3, outflow_m3, demand_m3, delta_volume_m3, residual_m3, residual_pct, flag
            FROM tank_balance
            WHERE tank_id = %s
            ORDER BY day DESC
            LIMIT 1
            """,
            (tank_id,),
        )
        row = cur.fetchone()
    if not row:
        return {"tank_id": tank_id, "flag": "unknown"}
    return {
        "tank_id": tank_id,
        "day": row[0].isoformat(),
        "inflow_m3": float(row[1] or 0.0),
        "outflow_m3": float(row[2] or 0.0),
        "demand_m3": float(row[3] or 0.0),
        "delta_volume_m3": float(row[4] or 0.0),
        "residual_m3": float(row[5] or 0.0),
        "residual_pct": float(row[6] or 0.0),
        "flag": row[7],
    }


def extract_tank_latest_balance(detail: dict[str, Any], tank_id: int | None = None) -> dict[str, Any]:
    balance_rows = detail.get("balance") or []
    if not balance_rows:
        return {"tank_id": tank_id or detail["tank"]["properties"]["id"], "flag": "unknown"}
    latest = balance_rows[0]
    return {
        "tank_id": tank_id or detail["tank"]["properties"]["id"],
        "day": latest["day"],
        "inflow_m3": float(latest.get("inflow_m3", 0.0) or 0.0),
        "outflow_m3": float(latest.get("outflow_m3", 0.0) or 0.0),
        "demand_m3": float(latest.get("demand_m3", 0.0) or 0.0),
        "delta_volume_m3": float(latest.get("delta_volume_m3", 0.0) or 0.0),
        "residual_m3": float(latest.get("residual_m3", 0.0) or 0.0),
        "residual_pct": float(latest.get("residual_pct", 0.0) or 0.0),
        "flag": latest.get("flag", "unknown"),
    }


def build_tank_balance_summary(
    tank_id: int,
    state_24h: list[dict[str, Any]],
    latest_balance: dict[str, Any],
    *,
    window_hours: int = 24,
) -> dict[str, Any]:
    if state_24h:
        latest = state_24h[-1]
        inflow_m3h = float(latest["inflow_lps"]) * 3.6
        outflow_m3h = float(latest["outflow_lps"]) * 3.6
    else:
        inflow_m3h = 0.0
        outflow_m3h = 0.0
    return {
        "tank_id": tank_id,
        "window_hours": window_hours,
        "inflow_m3h": round(inflow_m3h, 3),
        "outflow_m3h": round(outflow_m3h, 3),
        "demand_m3h": round(float(latest_balance.get("demand_m3", 0.0)) / 24.0, 3),
        "net_balance_m3h": round(inflow_m3h - outflow_m3h, 3),
        "fill_rate_pcth": round(float(latest_balance.get("residual_pct", 0.0)) / max(window_hours, 1), 3),
        "delta_volume_m3": round(float(latest_balance.get("delta_volume_m3", 0.0)), 3),
        "residual_m3": round(float(latest_balance.get("residual_m3", 0.0)), 3),
        "residual_pct": round(float(latest_balance.get("residual_pct", 0.0)), 3),
        "flag": latest_balance.get("flag", "unknown"),
    }


def build_tank_kpis_from_detail(detail: dict[str, Any]) -> dict[str, Any]:
    tank = detail["tank"]["properties"]
    state = detail["state_24h"]
    balance = detail["balance"][0] if detail["balance"] else {"residual_pct": 0.0}
    latest = state[-1] if state else {"level_m": tank["level_m"], "outflow_lps": tank["outflow_lps"], "inflow_lps": tank["inflow_lps"]}
    max_level = max(float(tank["max_level_m"] or 0.1), 0.1)
    level = float(latest["level_m"] or 0.0)
    capacity = max(float(tank["capacity_m3"] or 1.0), 1.0)
    volume = (level / max_level) * capacity
    outflow_m3h = max(float(latest["outflow_lps"] or 0.0) * 3.6, 0.1)
    inflow_m3h = max(float(latest["inflow_lps"] or 0.0) * 3.6, 0.1)
    resilience_hours = round(volume / outflow_m3h, 2)
    turnover_h = round(capacity / max(outflow_m3h, 0.1), 2)
    residence_time_h = round(capacity / max(inflow_m3h, 0.1), 2)
    return {
        "tank_id": tank["id"],
        "headroom_pct": float(tank["headroom_pct"]),
        "resilience_hours": resilience_hours,
        "turnover_h": turnover_h,
        "residence_time_h": residence_time_h,
        "z_score": round(abs(float(balance["residual_pct"])) / 100.0, 3),
        "days_to_empty": round(resilience_hours / 24.0, 2),
        "days_to_full": round((capacity - volume) / inflow_m3h / 24.0, 2),
        "spill_events_month": 0,
    }


def get_tank_kpis(tank_id: int, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    detail = detail or get_tank_detail(tank_id)
    if not detail:
        return {"tank_id": tank_id}
    return build_tank_kpis_from_detail(detail)


def get_tank_history(tank_id: int, hours: int = 24) -> list[dict[str, Any]]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT ts, level_m, volume_m3, inflow_lps, outflow_lps, downstream_pressure_bar
            FROM tank_state
            WHERE tank_id = %s
              AND ts >= NOW() - (%s || ' hours')::interval
            ORDER BY ts ASC
            """,
            (tank_id, hours),
        )
        rows = cur.fetchall()
    return [
        {
            "ts": row[0].isoformat(),
            "level_m": float(row[1] or 0.0),
            "volume_m3": float(row[2] or 0.0),
            "inflow_lps": float(row[3] or 0.0),
            "outflow_lps": float(row[4] or 0.0),
            "downstream_pressure_bar": float(row[5] or 0.0),
        }
        for row in rows
    ]


def get_sources() -> list[dict[str, Any]]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, node_type, COALESCE(elevation_m, 0), attrs, ST_AsGeoJSON(geom)::json
            FROM pipe_nodes
            WHERE node_type LIKE 'source_%'
            ORDER BY id
            """
        )
        rows = cur.fetchall()
    sources = [
        {
            "id": row[0],
            "name": row[1],
            "kind": row[2],
            "elevation_m": float(row[3] or 0.0),
            "attrs": row[4] or {},
            "geometry": row[5],
        }
        for row in rows
    ]
    if sources:
        return sources

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              id,
              COALESCE(name, 'SRC-' || id::text),
              COALESCE(elevation_m, 0),
              attrs,
              ST_AsGeoJSON(geom)::json
            FROM pipe_nodes
            WHERE node_type = 'junction'
            ORDER BY COALESCE(elevation_m, 0) DESC, id
            LIMIT 5
            """
        )
        fallback_rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "name": row[1],
            "kind": "synthetic_source_hydraulic",
            "elevation_m": float(row[2] or 0.0),
            "attrs": {
                **(row[3] or {}),
                "data_source": "synthetic_hydraulic_fallback",
                "inference": "Top-elevation junction used as provisional supply proxy because the current dataset has no source_* nodes.",
            },
            "geometry": row[4],
        }
        for row in fallback_rows
    ]


def list_municipality_kpis() -> list[dict[str, Any]]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT comune, year, nrw_pct, volume_input_m3, volume_distributed_m3, losses_m3, ili, uarl_m3
            FROM municipality_kpis
            ORDER BY year DESC, comune
            """
        )
        rows = cur.fetchall()
    return [
        {
            "comune": row[0],
            "year": row[1],
            "nrw_pct": float(row[2] or 0.0),
            "volume_input_m3": int(row[3] or 0),
            "volume_distributed_m3": int(row[4] or 0),
            "losses_m3": int(row[5] or 0),
            "ili": float(row[6] or 0.0),
            "uarl_m3": float(row[7] or 0.0),
        }
        for row in rows
    ]


def get_source_availability() -> dict[str, Any]:
    sources = get_sources()
    kpis = list_municipality_kpis()
    precip = []
    for day_offset in range(30):
        idx = 29 - day_offset
        seasonal = 18.0 + 9.0 * math.sin((idx / 30.0) * math.tau) + 4.0 * math.cos((idx / 7.0) * math.tau)
        precip.append({"day_index": idx + 1, "precip_mm": round(max(0.0, seasonal), 2)})
    return {
        "pilot": "Ciociaria",
        "sources": sources,
        "era5_precip_30d": precip,
        "grace": {
            "anomaly_mm_equiv": -12.0,
            "anomaly_sigma": -1.8,
            "context": "Deficit moderato persistente coerente con stress stagionale pre-estivo."
        },
        "istat_panel": {
            "frosinone_nrw_pct": next((item["nrw_pct"] for item in kpis if item["comune"] == "Provincia di Frosinone"), 69.5),
            "note": "11 comuni / 31.010 residenti senza depurazione pubblica nel workbook ISTAT caricato."
        },
    }


def get_scarcity_forecast(horizon_days: int) -> dict[str, Any]:
    bands = []
    for day in range(1, horizon_days + 1):
        baseline = 0.42 + 0.0022 * day
        spread = 0.08 + 0.0009 * day
        bands.append(
            {
                "day": day,
                "expected": round(min(0.95, baseline), 4),
                "lower": round(max(0.0, baseline - spread), 4),
                "upper": round(min(1.0, baseline + spread), 4),
            }
        )
    return {"horizon_days": horizon_days, "bands": bands, "points": bands}


def get_segments_for_municipality(comune: str, limit: int = 12) -> dict[str, Any]:
    query = """
        WITH matched_dma AS (
            SELECT id, name, geom
            FROM dmas
            WHERE LOWER(name) LIKE LOWER(%s)
            ORDER BY CASE WHEN LOWER(name) = LOWER(%s) THEN 0 ELSE 1 END, id
            LIMIT 1
        ),
        latest_anomaly AS (
            SELECT DISTINCT ON (segment_id)
              segment_id, phi, subsidence, ndvi, thermal, hydraulic, tank_signal, ts
            FROM anomaly_scores
            ORDER BY segment_id, ts DESC
        )
        SELECT
          d.id,
          d.name,
          ps.id,
          COALESCE(la.phi, 0),
          COALESCE(la.subsidence, 0.0),
          COALESCE(la.ndvi, 0.0),
          COALESCE(la.thermal, 0.0),
          COALESCE(la.hydraulic, 0.0),
          COALESCE(la.tank_signal, 0.0),
          la.ts
        FROM matched_dma d
        JOIN pipe_segments ps ON ST_Intersects(ps.geom, d.geom)
        LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
        ORDER BY COALESCE(la.phi, 0) DESC, ps.id
        LIMIT %s
    """
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, (f"%{comune}%", comune, limit))
        rows = cur.fetchall()
    if not rows:
        return {"comune": comune, "dma_id": None, "dma_name": None, "segments": []}
    return {
        "comune": comune,
        "dma_id": rows[0][0],
        "dma_name": rows[0][1],
        "segments": [
            {
                "id": row[2],
                "phi": int(row[3] or 0),
                "subsidence": float(row[4] or 0.0),
                "ndvi": float(row[5] or 0.0),
                "thermal": float(row[6] or 0.0),
                "hydraulic": float(row[7] or 0.0),
                "tank_signal": float(row[8] or 0.0),
                "latest_ts": row[9].isoformat() if row[9] else None,
            }
            for row in rows
        ],
    }


def list_dmas() -> list[dict[str, Any]]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, population, operator, ST_AsGeoJSON(geom)::json
            FROM dmas
            ORDER BY id
            """
        )
        rows = cur.fetchall()
    return [
        {"id": row[0], "name": row[1], "population": row[2], "operator": row[3], "geometry": row[4]}
        for row in rows
    ]


def get_dma_balance(dma_id: int, month: str | None = None) -> dict[str, Any] | None:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, name, population FROM dmas WHERE id = %s", (dma_id,))
        dma = cur.fetchone()
        if not dma:
            return None
        cur.execute(
            """
            SELECT AVG(phi)::float, COUNT(*), SUM(length_m)::float
            FROM pipe_segments ps
            LEFT JOIN LATERAL (
              SELECT phi
              FROM anomaly_scores a
              WHERE a.segment_id = ps.id
              ORDER BY ts DESC
              LIMIT 1
            ) la ON true
            WHERE ps.dma_id = %s
            """,
            (dma_id,),
        )
        seg_stats = cur.fetchone()
        cur.execute(
            """
            SELECT COALESCE(SUM(inflow_m3), 0), COALESCE(SUM(outflow_m3), 0), COALESCE(SUM(demand_m3), 0)
            FROM tank_balance tb
            JOIN pipe_nodes pn ON pn.id = tb.tank_id
            JOIN dmas d ON ST_Intersects(pn.geom, d.geom)
            WHERE d.id = %s
            """,
            (dma_id,),
        )
        balance = cur.fetchone()
    input_m3 = float(balance[0] or 0.0)
    authorised_m3 = float(balance[2] or 0.0)
    real_losses_m3 = max(0.0, input_m3 - authorised_m3)
    apparent_losses_m3 = max(0.0, real_losses_m3 * 0.08)
    nrw_pct = round((real_losses_m3 / input_m3) * 100.0, 2) if input_m3 else 0.0
    return {
        "dma_id": dma[0],
        "dma_name": dma[1],
        "population": dma[2],
        "month": month or f"{date.today():%Y-%m}",
        "system_input_m3": round(input_m3, 2),
        "authorised_m3": round(authorised_m3, 2),
        "apparent_losses_m3": round(apparent_losses_m3, 2),
        "real_losses_m3": round(real_losses_m3, 2),
        "nrw_pct": nrw_pct,
        "avg_phi": round(float(seg_stats[0] or 0.0), 3),
        "segment_count": int(seg_stats[1] or 0),
        "network_length_m": round(float(seg_stats[2] or 0.0), 2),
        "pdf_status": "not_rendered",
    }


def list_recent_incidents(limit: int = 8, status: str | None = None) -> list[dict[str, Any]]:
    where = []
    params: list[Any] = []
    if status is not None:
        where.append("status = %s")
        params.append(status)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    query = f"""
        SELECT id, updated_at, entity_type, entity_id, severity, title, pre_explanation, status
        FROM incidents
        {clause}
        ORDER BY updated_at DESC
        LIMIT %s
    """
    params.append(limit)
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "updated_at": row[1].isoformat() if row[1] else None,
            "entity_type": row[2],
            "entity_id": row[3],
            "severity": int(row[4] or 0),
            "title": row[5],
            "pre_explanation": row[6],
            "status": row[7],
        }
        for row in rows
    ]


def get_network_overview() -> dict[str, Any]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            WITH latest_anomaly AS (
                SELECT DISTINCT ON (segment_id)
                  segment_id, phi
                FROM anomaly_scores
                ORDER BY segment_id, ts DESC
            )
            SELECT
              COUNT(*)::int,
              COUNT(*) FILTER (WHERE COALESCE(la.phi, 0) = 0)::int,
              COUNT(*) FILTER (WHERE COALESCE(la.phi, 0) = 1)::int,
              COUNT(*) FILTER (WHERE COALESCE(la.phi, 0) = 2)::int,
              COUNT(*) FILTER (WHERE COALESCE(la.phi, 0) = 3)::int
            FROM pipe_segments ps
            LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
            """
        )
        segment_counts = cur.fetchone()

        cur.execute(
            """
            WITH latest_balance AS (
                SELECT DISTINCT ON (tank_id)
                  tank_id, residual_pct, flag
                FROM tank_balance
                ORDER BY tank_id, day DESC
            )
            SELECT
              COUNT(*)::int,
              COUNT(*) FILTER (WHERE COALESCE(lb.flag, 'normal') <> 'normal')::int,
              AVG(COALESCE((pn.attrs->>'capacity_m3')::float, 1200.0))::float
            FROM pipe_nodes pn
            LEFT JOIN latest_balance lb ON lb.tank_id = pn.id
            WHERE pn.node_type = 'tank'
            """
        )
        tank_counts = cur.fetchone()

        cur.execute(
            """
            SELECT COUNT(*)::int
            FROM incidents
            WHERE status IN ('open', 'investigating', 'in_progress')
            """
        )
        open_incidents = cur.fetchone()[0]

        cur.execute(
            """
            WITH latest_anomaly AS (
                SELECT DISTINCT ON (segment_id)
                  segment_id, phi, explanation, ts
                FROM anomaly_scores
                ORDER BY segment_id, ts DESC
            )
            SELECT ps.id, ps.dma_id, COALESCE(la.phi, 0), COALESCE(la.explanation, ''), la.ts
            FROM pipe_segments ps
            LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
            ORDER BY COALESCE(la.phi, 0) DESC, la.ts DESC NULLS LAST, ps.id
            LIMIT 5
            """
        )
        top_segments = cur.fetchall()

        cur.execute(
            """
            WITH latest_balance AS (
                SELECT DISTINCT ON (tank_id)
                  tank_id, residual_pct, flag
                FROM tank_balance
                ORDER BY tank_id, day DESC
            )
            SELECT
              pn.id,
              COALESCE(pn.name, 'TK-' || pn.id::text),
              COALESCE(lb.residual_pct, 0.0),
              COALESCE(lb.flag, 'normal')
            FROM pipe_nodes pn
            LEFT JOIN latest_balance lb ON lb.tank_id = pn.id
            WHERE pn.node_type = 'tank'
            ORDER BY COALESCE(lb.residual_pct, 0.0) DESC, pn.id
            LIMIT 5
            """
        )
        top_tanks = cur.fetchall()

    return {
        "segments": {
            "total": int(segment_counts[0] or 0),
            "phi_counts": {
                "0": int(segment_counts[1] or 0),
                "1": int(segment_counts[2] or 0),
                "2": int(segment_counts[3] or 0),
                "3": int(segment_counts[4] or 0),
            },
        },
        "tanks": {
            "total": int(tank_counts[0] or 0),
            "flagged": int(tank_counts[1] or 0),
            "avg_capacity_m3": round(float(tank_counts[2] or 0.0), 2),
        },
        "incidents": {
            "open_total": int(open_incidents or 0),
            "recent": list_recent_incidents(limit=6),
        },
        "top_segments": [
            {
                "id": row[0],
                "dma_id": row[1],
                "phi": int(row[2] or 0),
                "explanation": row[3],
                "latest_ts": row[4].isoformat() if row[4] else None,
            }
            for row in top_segments
        ],
        "top_tanks": [
            {
                "id": row[0],
                "name": row[1],
                "residual_pct": float(row[2] or 0.0),
                "flag": row[3],
            }
            for row in top_tanks
        ],
        "sources": get_source_availability(),
        "dmas": list_dmas()[:8],
    }
