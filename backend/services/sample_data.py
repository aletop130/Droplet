from datetime import datetime, timezone


SEGMENTS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[13.33, 41.64], [13.39, 41.66], [13.45, 41.67]],
            },
            "properties": {
                "id": 1482,
                "dma_id": 1,
                "phi": 3,
                "subsidence": 0.82,
                "ndvi": 0.64,
                "thermal": 0.74,
                "hydraulic": 0.88,
                "tank_signal": 0.79,
                "material": "grey cast iron",
                "diameter_mm": 250,
                "install_year": 1978,
                "length_m": 742.4,
            },
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[13.45, 41.67], [13.50, 41.68], [13.56, 41.69]],
            },
            "properties": {
                "id": 1483,
                "dma_id": 1,
                "phi": 2,
                "subsidence": 0.55,
                "ndvi": 0.50,
                "thermal": 0.59,
                "hydraulic": 0.67,
                "tank_signal": 0.61,
                "material": "ductile iron",
                "diameter_mm": 300,
                "install_year": 1994,
                "length_m": 681.2,
            },
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[13.34, 41.58], [13.42, 41.57], [13.51, 41.60]],
            },
            "properties": {
                "id": 1501,
                "dma_id": 2,
                "phi": 1,
                "subsidence": 0.22,
                "ndvi": 0.35,
                "thermal": 0.28,
                "hydraulic": 0.31,
                "tank_signal": 0.18,
                "material": "steel",
                "diameter_mm": 180,
                "install_year": 2002,
                "length_m": 824.1,
            },
        },
    ],
}

TANKS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [13.43, 41.67]},
            "properties": {
                "id": 3,
                "name": "TK-03",
                "dma_id": 1,
                "headroom_pct": 31,
                "severity": 3,
                "capacity_m3": 1800,
                "data_source": "osm",
                "level_m": 3.2,
                "inflow_lps": 21.5,
                "outflow_lps": 35.8,
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [13.55, 41.69]},
            "properties": {
                "id": 5,
                "name": "TK-05",
                "dma_id": 1,
                "headroom_pct": 63,
                "severity": 1,
                "capacity_m3": 2200,
                "data_source": "synthetic_uni9182",
                "level_m": 5.6,
                "inflow_lps": 28.1,
                "outflow_lps": 22.4,
            },
        },
    ],
}

DMAS = [
    {
        "id": 1,
        "name": "DMA-1 Frosinone Nord",
        "population": 18200,
        "operator": "Acea ATO 5",
        "nrw_pct": 69.5,
        "ili": 5.2,
        "geom": {
            "type": "Polygon",
            "coordinates": [
                [[13.28, 41.56], [13.58, 41.56], [13.58, 41.74], [13.28, 41.74], [13.28, 41.56]]
            ],
        },
    }
]

INCIDENTS = [
    {
        "id": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "entity_type": "tank",
        "entity_id": 3,
        "severity": 3,
        "detector_events": [{"detector": "mass_balance", "score": 0.91}],
        "tags": ["tank_drop", "hydraulic", "phi_red"],
        "title": "TK-03 level drop correlated with downstream PHI spike",
        "pre_explanation": "Mass-balance residual and downstream hydraulic anomaly indicate a probable burst in DMA-1.",
        "status": "open",
        "assigned_to": "operator",
    }
]

CONTROL_RECOMMENDATIONS = [
    {
        "id": 1,
        "incident_id": 1,
        "entity_type": "valve",
        "entity_id": 12,
        "parameter": "valve_position_pct",
        "current_value": 100,
        "proposed_value": 60,
        "rationale": "Reduce feeder VC-12 opening in the digital twin to reroute flow while TK-03 is checked.",
        "expected_impact": {"nrw_reduction_pct": 1.2, "pressure_delta_bar": -0.4},
        "confidence": 0.71,
        "risk_flags": ["pressure_transient"],
        "status": "proposed",
    }
]
