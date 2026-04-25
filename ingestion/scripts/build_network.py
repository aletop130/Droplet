from __future__ import annotations

import math
from pathlib import Path
import json
import os

import geopandas as gpd
import networkx as nx
import osmnx as ox
import psycopg
from dotenv import load_dotenv
from shapely.geometry import Polygon


ROOT = Path(__file__).resolve().parents[2]
GRAPH_PATH = ROOT / "data" / "raw" / "osm" / "frosinone_drive.graphml"
ISTAT_PATH = ROOT / "data" / "processed" / "istat_frosinone.json"
LOAD_DOTENV = load_dotenv(ROOT / "backend" / ".env")

ALLOWED_HIGHWAYS = {
    "primary",
    "secondary",
    "tertiary",
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "trunk",
    "trunk_link",
    "motorway_link",
}

DMA_DEFS = [
    ("DMA-1 Ceccano Corridor", Polygon([(13.20, 41.65), (13.40, 41.65), (13.40, 41.90), (13.20, 41.90)]), 12200),
    ("DMA-2 Frosinone North", Polygon([(13.40, 41.65), (13.60, 41.65), (13.60, 41.90), (13.40, 41.90)]), 13500),
    ("DMA-3 Veroli / Alatri East", Polygon([(13.60, 41.65), (13.80, 41.65), (13.80, 41.90), (13.60, 41.90)]), 11600),
    ("DMA-4 Ceprano / Pontecorvo", Polygon([(13.20, 41.40), (13.40, 41.40), (13.40, 41.65), (13.20, 41.65)]), 10800),
    ("DMA-5 Frosinone South", Polygon([(13.40, 41.40), (13.60, 41.40), (13.60, 41.65), (13.40, 41.65)]), 12300),
    ("DMA-6 Cassino Axis", Polygon([(13.60, 41.40), (13.80, 41.40), (13.80, 41.65), (13.60, 41.65)]), 10300),
]

MATERIAL_WEIGHTS = [
    ("grey_cast_iron", 0.28),
    ("ductile_iron", 0.24),
    ("pvc", 0.20),
    ("steel", 0.14),
    ("hdpe", 0.10),
    ("prestressed_concrete", 0.04),
]

DIAMETER_WEIGHTS = [
    (150, 0.18),
    (180, 0.22),
    (200, 0.20),
    (250, 0.16),
    (300, 0.12),
    (350, 0.07),
    (450, 0.05),
]


def load_istat_priors() -> dict:
    if not ISTAT_PATH.exists():
        return {"source": "fallback"}
    with ISTAT_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return {
        "source": "data/processed/istat_frosinone.json",
        "lazio_source_mix": data.get("tav3_lazio_2020_million_m3", {}),
        "frosinone_nrw_pct": data.get("tav17_frosinone", {}).get("nrw_pct"),
        "frosinone_operator_share_pct": data.get("tav23_frosinone_gestione", {}).get("acqua_immessa_specializzata_pct"),
        "note": "The workbook on disk does not expose a direct Lazio pipe-material table; material/diameter weights are deterministic synthetic priors documented in attrs.",
    }


def weighted_pick(weighted_values: list[tuple[object, float]], idx: int):
    cursor = ((idx * 37) % 1000) / 1000.0
    cumulative = 0.0
    for value, weight in weighted_values:
        cumulative += weight
        if cursor <= cumulative:
            return value
    return weighted_values[-1][0]


def connect_supabase():
    password = os.getenv("SUPABASE_DB_PASSWORD")
    if password:
        return psycopg.connect(
            host=os.getenv("SUPABASE_DB_HOST", "aws-1-eu-central-1.pooler.supabase.com"),
            port=int(os.getenv("SUPABASE_DB_PORT", "5432")),
            dbname=os.getenv("SUPABASE_DB_NAME", "postgres"),
            user=os.getenv("SUPABASE_DB_USER", "postgres.cnqwlkkoikcymavbnnfu"),
            password=password,
            sslmode=os.getenv("SUPABASE_DB_SSLMODE", "require"),
            autocommit=True,
        )
    return psycopg.connect(os.environ["SUPABASE_DB_POOLER_URL"], autocommit=True)


def normalize_highway(value) -> list[str]:
    values = value if isinstance(value, list) else [value]
    return [str(item) for item in values if item is not None]


def material_for(highway: str, idx: int) -> str:
    if "motorway" in highway or "trunk" in highway:
        weighted = [("ductile_iron", 0.34), ("steel", 0.28), ("prestressed_concrete", 0.22), ("grey_cast_iron", 0.16)]
    elif "primary" in highway or "secondary" in highway:
        weighted = [("ductile_iron", 0.30), ("grey_cast_iron", 0.24), ("steel", 0.18), ("pvc", 0.16), ("hdpe", 0.12)]
    else:
        weighted = MATERIAL_WEIGHTS
    return str(weighted_pick(weighted, idx))


def diameter_for(highway: str, length_m: float) -> int:
    if "motorway" in highway or "trunk" in highway:
        return 450 if length_m > 450 else 350
    if "primary" in highway:
        return 350 if length_m > 320 else 300
    if "secondary" in highway:
        return 300 if length_m > 340 else 250
    return int(weighted_pick(DIAMETER_WEIGHTS, int(length_m)))


def install_year_for(idx: int) -> int:
    buckets = [1968, 1978, 1988, 1998, 2008, 2016]
    return buckets[idx % len(buckets)]


def clean_json(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {key: clean_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean_json(item) for item in value]
    return value


def load_and_simplify():
    graph = ox.load_graphml(str(GRAPH_PATH))
    working = graph.copy()
    remove_edges = []
    for u, v, k, data in working.edges(keys=True, data=True):
        if not any(item in ALLOWED_HIGHWAYS for item in normalize_highway(data.get("highway"))):
            remove_edges.append((u, v, k))
    working.remove_edges_from(remove_edges)
    working.remove_nodes_from(list(nx.isolates(working)))

    projected = ox.project_graph(working)
    simplified = ox.simplification.consolidate_intersections(
        projected,
        tolerance=80,
        rebuild_graph=True,
        dead_ends=False,
    )
    nodes_gdf, edges_gdf = ox.graph_to_gdfs(simplified, nodes=True, edges=True)
    nodes_gdf = nodes_gdf.to_crs(4326)
    edges_gdf = edges_gdf.to_crs(4326)
    return nodes_gdf, edges_gdf


def seed_dmas() -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        [
            {"id": idx, "name": name, "population": population, "operator": "Acea ATO 5", "geometry": geometry}
            for idx, (name, geometry, population) in enumerate(DMA_DEFS, start=1)
        ],
        crs=4326,
    )


def assign_dma_id(geometry) -> int:
    x, y = geometry.centroid.x, geometry.centroid.y
    for idx, (_, polygon, _) in enumerate(DMA_DEFS, start=1):
        if polygon.contains(geometry.centroid):
            return idx
    east_band = 0 if x < 13.4 else 1 if x < 13.6 else 2
    south_band = 3 if y < 41.65 else 0
    return min(6, east_band + south_band + 1)


def truncate_topology(cur):
    cur.execute("TRUNCATE TABLE pipe_segments, pipe_nodes, dmas RESTART IDENTITY CASCADE")


def insert_dmas(cur, dmas_gdf: gpd.GeoDataFrame):
    rows = [
        (
            row["id"],
            row["name"],
            row.geometry.wkt,
            row["population"],
            row["operator"],
        )
        for _, row in dmas_gdf.iterrows()
    ]
    cur.executemany(
        """
        INSERT INTO dmas (id, name, geom, population, operator, attrs)
        VALUES (%s, %s, ST_GeomFromText(%s, 4326), %s, %s, '{}'::jsonb)
        """,
        rows,
    )


def insert_nodes(cur, nodes_gdf: gpd.GeoDataFrame) -> dict[int, int]:
    mapping: dict[int, int] = {}
    rows = []
    for original_id, (_, row) in enumerate(nodes_gdf.iterrows(), start=1):
        source_node_id = int(row.name)
        mapping[source_node_id] = original_id
        rows.append(
            (
                original_id,
                row.geometry.wkt,
                None,
                "junction",
                f"JN-{original_id:05d}",
                {"street_count": int(row.get("street_count") or 0), "source_osmid": row.get("osmid_original")},
            )
        )
    cur.executemany(
        """
        INSERT INTO pipe_nodes (id, geom, elevation_m, node_type, name, attrs)
        VALUES (%s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s::jsonb)
        """,
        [
            (rid, wkt, elev, node_type, name, psycopg.types.json.Jsonb(clean_json(attrs)))
            for rid, wkt, elev, node_type, name, attrs in rows
        ],
    )
    return mapping


def insert_segments(cur, edges_gdf: gpd.GeoDataFrame, node_id_map: dict[int, int]):
    istat_priors = load_istat_priors()
    rows = []
    for idx, (_, row) in enumerate(edges_gdf.iterrows(), start=1):
        highway_values = normalize_highway(row.get("highway"))
        highway = highway_values[0] if highway_values else "tertiary"
        length_m = float(row.get("length") or row.geometry.length * 111_000)
        dma_id = assign_dma_id(row.geometry)
        rows.append(
            (
                idx,
                row.geometry.wkt,
                length_m,
                diameter_for(highway, length_m),
                material_for(highway, idx),
                install_year_for(idx),
                dma_id,
                node_id_map[int(row.name[0])],
                node_id_map[int(row.name[1])],
                {
                    "highway": highway,
                    "name": row.get("name"),
                    "source_u": int(row.get("u_original") or row.name[0]),
                    "source_v": int(row.get("v_original") or row.name[1]),
                    "diameter_prior_source": "ISTAT-derived synthetic prior",
                    "material_prior_source": "ISTAT-derived synthetic prior",
                    "istat_priors": istat_priors,
                },
            )
        )
    cur.executemany(
        """
        INSERT INTO pipe_segments (
          id, geom, length_m, diameter_mm, material, install_year, dma_id, from_node, to_node, attrs
        )
        VALUES (
          %s, ST_GeomFromText(%s, 4326), %s, %s, %s, %s, %s, %s, %s, %s::jsonb
        )
        """,
        [
            (
                seg_id,
                wkt,
                length_m,
                diameter_mm,
                material,
                install_year,
                dma_id,
                from_node,
                to_node,
                psycopg.types.json.Jsonb(clean_json(attrs)),
            )
            for seg_id, wkt, length_m, diameter_mm, material, install_year, dma_id, from_node, to_node, attrs in rows
        ],
    )


def main():
    nodes_gdf, edges_gdf = load_and_simplify()
    dmas_gdf = seed_dmas()

    with connect_supabase() as conn:
        with conn.cursor() as cur:
            truncate_topology(cur)
            insert_dmas(cur, dmas_gdf)
            node_id_map = insert_nodes(cur, nodes_gdf)
            insert_segments(cur, edges_gdf, node_id_map)

            cur.execute("SELECT COUNT(*) FROM pipe_nodes")
            node_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM pipe_segments")
            segment_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM dmas")
            dma_count = cur.fetchone()[0]

    print(
        {
            "pipe_nodes": node_count,
            "pipe_segments": segment_count,
            "dmas": dma_count,
            "simplified_from": {"nodes": 18843, "edges": 45367},
            "simplified_to": {"nodes": len(nodes_gdf), "edges": len(edges_gdf)},
        }
    )


if __name__ == "__main__":
    main()
