from __future__ import annotations

import json
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd
import psycopg
from dotenv import load_dotenv
from neo4j import GraphDatabase
from shapely import wkt


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")

CHUNK_SIZE = 500


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


def chunked(rows: list[dict], size: int = CHUNK_SIZE):
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def load_gdf(conn, query: str, columns: list[str], crs: int = 4326) -> gpd.GeoDataFrame:
    with conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    frame = pd.DataFrame(rows, columns=columns)
    frame["geometry"] = frame["wkt"].apply(wkt.loads)
    return gpd.GeoDataFrame(frame.drop(columns=["wkt"]), geometry="geometry", crs=crs)


def load_data():
    with connect_supabase() as conn:
        dmas = load_gdf(
            conn,
            "SELECT id, name, population, operator, attrs, ST_AsText(geom) AS wkt FROM dmas ORDER BY id",
            ["id", "name", "population", "operator", "attrs", "wkt"],
        )
        nodes = load_gdf(
            conn,
            """
            SELECT id, node_type, name, elevation_m, attrs, ST_AsText(geom) AS wkt
            FROM pipe_nodes
            ORDER BY id
            """,
            ["id", "node_type", "name", "elevation_m", "attrs", "wkt"],
        )
        segments = load_gdf(
            conn,
            """
            SELECT id, length_m, diameter_mm, material, install_year, dma_id, from_node, to_node, attrs, ST_AsText(geom) AS wkt
            FROM pipe_segments
            ORDER BY id
            """,
            ["id", "length_m", "diameter_mm", "material", "install_year", "dma_id", "from_node", "to_node", "attrs", "wkt"],
        )
    return dmas, nodes, segments


def tank_dma_rows(tanks: gpd.GeoDataFrame, dmas: gpd.GeoDataFrame) -> list[dict]:
    joined = gpd.sjoin(tanks, dmas[["id", "name", "geometry"]], how="left", predicate="within").rename(
        columns={"id_right": "dma_id", "name_right": "dma_name"}
    )
    if "id_left" in joined.columns:
        joined = joined.rename(columns={"id_left": "id"})
    if joined["dma_id"].isna().any():
        nearest = gpd.sjoin_nearest(
            joined[joined["dma_id"].isna()].drop(columns=["dma_id", "dma_name"]),
            dmas[["id", "name", "geometry"]],
            how="left",
        ).rename(columns={"id_right": "dma_id", "name_right": "dma_name"})
        joined.loc[joined["dma_id"].isna(), ["dma_id", "dma_name"]] = nearest[["dma_id", "dma_name"]].values
    return joined[["id", "dma_id", "dma_name"]].rename(columns={"id": "tank_id"}).to_dict("records")


def tank_segment_rows(tanks: gpd.GeoDataFrame, segments: gpd.GeoDataFrame, tank_dma_map: dict[int, int]) -> tuple[list[dict], list[dict]]:
    tanks_proj = tanks.to_crs(32633)
    segments_proj = segments.to_crs(32633)
    upstream_rows = []
    downstream_rows = []
    for _, tank in tanks_proj.iterrows():
        dma_id = tank_dma_map.get(int(tank.id))
        scoped = segments_proj[segments_proj["dma_id"] == dma_id].copy()
        if scoped.empty:
            scoped = segments_proj.copy()
        scoped["distance_m"] = scoped.geometry.distance(tank.geometry)
        nearest = scoped.nsmallest(3, "distance_m")
        nearest_ids = nearest["id"].astype(int).tolist()
        if nearest_ids:
            upstream_rows.append({"segment_id": nearest_ids[0], "tank_id": int(tank.id)})
        for segment_id in nearest_ids[1:] or nearest_ids[:1]:
            downstream_rows.append({"segment_id": int(segment_id), "tank_id": int(tank.id)})
    return upstream_rows, downstream_rows


def tank_peer_rows(tanks: gpd.GeoDataFrame, tank_dma_map: dict[int, int]) -> list[dict]:
    projected = tanks.to_crs(32633)
    rows = []
    for dma_id in sorted(set(tank_dma_map.values())):
        group = projected[projected["id"].astype(int).isin([tank_id for tank_id, value in tank_dma_map.items() if value == dma_id])]
        for _, tank in group.iterrows():
            others = group[group["id"] != tank["id"]].copy()
            if others.empty:
                continue
            others["distance_m"] = others.geometry.distance(tank.geometry)
            nearest = others.nsmallest(2, "distance_m")
            for _, peer in nearest.iterrows():
                travel_time = round(float(peer["distance_m"]) / 250.0, 1)
                rows.append({"from_tank_id": int(tank.id), "to_tank_id": int(peer.id), "travel_time_min": max(1.0, travel_time)})
    deduped = {}
    for row in rows:
        deduped[(row["from_tank_id"], row["to_tank_id"])] = row
    return list(deduped.values())


def source_feed_rows(sources: gpd.GeoDataFrame, tanks: gpd.GeoDataFrame) -> list[dict]:
    if sources.empty or tanks.empty:
        return []
    sources_proj = sources.to_crs(32633)
    tanks_proj = tanks.to_crs(32633)
    rows = []
    for _, tank in tanks_proj.iterrows():
        sources_proj["distance_m"] = sources_proj.geometry.distance(tank.geometry)
        nearest = sources_proj.nsmallest(1, "distance_m")
        if nearest.empty:
            continue
        source = nearest.iloc[0]
        rows.append({"source_id": int(source.id), "tank_id": int(tank.id)})
    return rows


def sync_to_neo4j(dmas: gpd.GeoDataFrame, nodes: gpd.GeoDataFrame, segments: gpd.GeoDataFrame):
    tanks = nodes[nodes["node_type"] == "tank"].copy()
    sources = nodes[nodes["node_type"].str.startswith("source_")].copy()
    tank_dma = tank_dma_rows(tanks, dmas)
    tank_dma_map = {int(row["tank_id"]): int(row["dma_id"]) for row in tank_dma}
    upstream_rows, downstream_rows = tank_segment_rows(tanks, segments, tank_dma_map)
    tank_peer = tank_peer_rows(tanks, tank_dma_map)
    source_feed = source_feed_rows(sources, tanks)

    driver = GraphDatabase.driver(
        os.environ["NEO4J_URI"],
        auth=(os.getenv("NEO4J_USER", "neo4j"), os.environ["NEO4J_PASSWORD"]),
    )
    database = os.getenv("NEO4J_DATABASE", "neo4j")
    with driver:
        driver.execute_query("CREATE CONSTRAINT pipe_segment_id IF NOT EXISTS FOR (n:PipeSegment) REQUIRE n.id IS UNIQUE", database_=database)
        driver.execute_query("CREATE CONSTRAINT pipe_node_id IF NOT EXISTS FOR (n:PipeNode) REQUIRE n.id IS UNIQUE", database_=database)
        driver.execute_query("CREATE CONSTRAINT tank_id IF NOT EXISTS FOR (n:Tank) REQUIRE n.id IS UNIQUE", database_=database)
        driver.execute_query("CREATE CONSTRAINT dma_id IF NOT EXISTS FOR (n:DMA) REQUIRE n.id IS UNIQUE", database_=database)
        driver.execute_query("CREATE CONSTRAINT source_id IF NOT EXISTS FOR (n:Source) REQUIRE n.id IS UNIQUE", database_=database)
        driver.execute_query("MATCH (n) DETACH DELETE n", database_=database)

        dma_rows = [
            {
                "id": int(row.id),
                "name": row.name,
                "population": row.population,
                "operator": row.operator,
                "attrs_json": json.dumps(row.attrs or {}, ensure_ascii=True),
            }
            for row in dmas.itertuples()
        ]
        node_rows = [
            {
                "id": int(row.id),
                "node_type": row.node_type,
                "name": row.name,
                "elevation_m": row.elevation_m,
                "attrs_json": json.dumps(row.attrs or {}, ensure_ascii=True),
                "lon": float(row.geometry.x),
                "lat": float(row.geometry.y),
                "capacity_m3": float((row.attrs or {}).get("capacity_m3") or 0.0),
                "max_level_m": float((row.attrs or {}).get("max_level_m") or 0.0),
                "min_level_m": float((row.attrs or {}).get("min_level_m") or 0.0),
                "data_source": str((row.attrs or {}).get("data_source") or "unknown"),
            }
            for row in nodes.itertuples()
        ]
        segment_rows = [
            {
                "id": int(row.id),
                "length_m": float(row.length_m),
                "diameter_mm": int(row.diameter_mm) if row.diameter_mm is not None else None,
                "material": row.material,
                "install_year": int(row.install_year) if row.install_year is not None else None,
                "dma_id": int(row.dma_id),
                "from_node": int(row.from_node),
                "to_node": int(row.to_node),
                "attrs_json": json.dumps(row.attrs or {}, ensure_ascii=True),
            }
            for row in segments.itertuples()
        ]

        for batch in chunked(dma_rows):
            driver.execute_query(
                """
                UNWIND $rows AS row
                MERGE (d:DMA {id: row.id})
                SET d.name = row.name,
                    d.population = row.population,
                    d.operator = row.operator,
                    d.attrs_json = row.attrs_json
                """,
                rows=batch,
                database_=database,
            )
        for batch in chunked(node_rows):
            driver.execute_query(
                """
                UNWIND $rows AS row
                MERGE (n:PipeNode {id: row.id})
                SET n.node_type = row.node_type,
                    n.name = row.name,
                    n.elevation_m = row.elevation_m,
                    n.attrs_json = row.attrs_json,
                    n.lon = row.lon,
                    n.lat = row.lat,
                    n.capacity_m3 = row.capacity_m3,
                    n.max_level_m = row.max_level_m,
                    n.min_level_m = row.min_level_m,
                    n.data_source = row.data_source
                """,
                rows=batch,
                database_=database,
            )
        driver.execute_query(
            """
            MATCH (n:PipeNode)
            WHERE n.node_type = 'tank'
            SET n:Tank,
                n.capacity_m3 = coalesce(toFloat(n.capacity_m3), 0.0),
                n.max_level_m = coalesce(toFloat(n.max_level_m), 0.0),
                n.data_source = coalesce(toString(n.data_source), 'unknown')
            """,
            database_=database,
        )
        driver.execute_query(
            """
            MATCH (n:PipeNode)
            WHERE n.node_type = 'reservoir'
            SET n:Reservoir,
                n.capacity_m3 = coalesce(toFloat(n.capacity_m3), 0.0),
                n.data_source = coalesce(toString(n.data_source), 'unknown')
            """,
            database_=database,
        )
        driver.execute_query(
            """
            MATCH (n:PipeNode)
            WHERE n.node_type STARTS WITH 'source_'
            SET n:Source,
                n.kind = replace(n.node_type, 'source_', '')
            """,
            database_=database,
        )
        for batch in chunked(segment_rows):
            driver.execute_query(
                """
                UNWIND $rows AS row
                MERGE (s:PipeSegment {id: row.id})
                SET s.length_m = row.length_m,
                    s.diameter_mm = row.diameter_mm,
                    s.material = row.material,
                    s.install_year = row.install_year,
                    s.dma_id = row.dma_id,
                    s.from_node = row.from_node,
                    s.to_node = row.to_node,
                    s.attrs_json = row.attrs_json
                """,
                rows=batch,
                database_=database,
            )
        for batch in chunked(segment_rows):
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (s:PipeSegment {id: row.id})
                MATCH (from:PipeNode {id: row.from_node})
                MATCH (to:PipeNode {id: row.to_node})
                MATCH (dma:DMA {id: row.dma_id})
                MERGE (s)-[:STARTS_AT]->(from)
                MERGE (s)-[:ENDS_AT]->(to)
                MERGE (s)-[:IN_DMA]->(dma)
                """,
                rows=batch,
                database_=database,
            )
        driver.execute_query(
            """
            MATCH (n:PipeNode)<-[:STARTS_AT|ENDS_AT]-(a:PipeSegment),
                  (n)<-[:STARTS_AT|ENDS_AT]-(b:PipeSegment)
            WHERE a.id < b.id
            MERGE (a)-[:CONNECTS_TO]->(b)
            MERGE (b)-[:CONNECTS_TO]->(a)
            """,
            database_=database,
        )
        if tank_dma:
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (t:Tank {id: row.tank_id})
                MATCH (d:DMA {id: row.dma_id})
                MERGE (t)-[:SUPPLIES]->(d)
                """,
                rows=tank_dma,
                database_=database,
            )
        if upstream_rows:
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (s:PipeSegment {id: row.segment_id})
                MATCH (t:Tank {id: row.tank_id})
                MERGE (s)-[:UPSTREAM_OF]->(t)
                """,
                rows=upstream_rows,
                database_=database,
            )
        if downstream_rows:
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (s:PipeSegment {id: row.segment_id})
                MATCH (t:Tank {id: row.tank_id})
                MERGE (s)-[:DOWNSTREAM_OF]->(t)
                """,
                rows=downstream_rows,
                database_=database,
            )
        if tank_peer:
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (a:Tank {id: row.from_tank_id})
                MATCH (b:Tank {id: row.to_tank_id})
                MERGE (a)-[r:UPSTREAM_OF]->(b)
                SET r.travel_time_min = row.travel_time_min
                """,
                rows=tank_peer,
                database_=database,
            )
        if source_feed:
            driver.execute_query(
                """
                UNWIND $rows AS row
                MATCH (s:Source {id: row.source_id})
                MATCH (t:Tank {id: row.tank_id})
                MERGE (s)-[:FEEDS]->(t)
                """,
                rows=source_feed,
                database_=database,
            )

        counts = driver.execute_query(
            """
            RETURN
              COUNT { (:PipeSegment) } AS segments,
              COUNT { (:PipeNode) } AS nodes,
              COUNT { (:Tank) } AS tanks,
              COUNT { (:DMA) } AS dmas,
              COUNT { ()-[:CONNECTS_TO]->() } AS connects_to,
              COUNT { ()-[:UPSTREAM_OF]->(:Tank) } AS segment_tank_upstream,
              COUNT { ()-[:DOWNSTREAM_OF]->(:Tank) } AS segment_tank_downstream
            """,
            database_=database,
        ).records[0]
    return {
        "segments": counts["segments"],
        "nodes": counts["nodes"],
        "tanks": counts["tanks"],
        "dmas": counts["dmas"],
        "connects_to": counts["connects_to"],
        "segment_tank_upstream": counts["segment_tank_upstream"],
        "segment_tank_downstream": counts["segment_tank_downstream"],
    }


def main():
    dmas, nodes, segments = load_data()
    result = sync_to_neo4j(dmas, nodes, segments)
    print(result)


if __name__ == "__main__":
    main()
