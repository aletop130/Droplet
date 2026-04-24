from __future__ import annotations

import math
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd
import psycopg
from dotenv import load_dotenv
from shapely import wkt
from shapely.geometry import Point


ROOT = Path(__file__).resolve().parents[2]
WATER_FEATURES_PATH = ROOT / "data" / "raw" / "osm" / "frosinone_water_features.geojson"
load_dotenv(ROOT / "backend" / ".env")

BBOX = (13.2, 41.4, 13.8, 41.9)


def clean_json(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {key: clean_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean_json(item) for item in value]
    return value


def load_dmas(conn) -> gpd.GeoDataFrame:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, population, operator, ST_AsText(geom) FROM dmas ORDER BY id")
        rows = cur.fetchall()
    frame = pd.DataFrame(rows, columns=["id", "name", "population", "operator", "wkt"])
    frame["geometry"] = frame["wkt"].apply(wkt.loads)
    return gpd.GeoDataFrame(frame.drop(columns=["wkt"]), geometry="geometry", crs=4326)


def load_junction_nodes(conn) -> gpd.GeoDataFrame:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, attrs, ST_AsText(geom)
            FROM pipe_nodes
            WHERE node_type = 'junction'
            ORDER BY id
            """
        )
        rows = cur.fetchall()
    frame = pd.DataFrame(rows, columns=["id", "name", "attrs", "wkt"])
    frame["geometry"] = frame["wkt"].apply(wkt.loads)
    return gpd.GeoDataFrame(frame.drop(columns=["wkt"]), geometry="geometry", crs=4326)


def classify_feature(row) -> tuple[str, str, bool]:
    man_made = str(row.get("man_made") or "")
    landuse = str(row.get("landuse") or "")
    covered = str(row.get("covered") or "")
    if man_made in {"storage_tank", "water_tower", "reservoir_covered", "water_works"}:
        return "osm", man_made, covered == "yes" or man_made == "reservoir_covered"
    if landuse == "reservoir" and covered != "yes":
        return "sentinel_ndwi", "open_basin", False
    return "osm", "reservoir", covered == "yes"


def make_osm_and_ndwi_tanks(dmas: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    water = gpd.read_file(WATER_FEATURES_PATH)
    water = water.cx[BBOX[0] : BBOX[2], BBOX[1] : BBOX[3]].copy()
    water["geometry"] = water.geometry.representative_point()
    joined = gpd.sjoin(water, dmas[["id", "geometry"]], how="left", predicate="within").rename(columns={"id_right": "dma_id"})

    rows = []
    for idx, row in joined.iterrows():
        data_source, tank_class, covered = classify_feature(row)
        area_m2 = float(row.geometry.buffer(0.00035).area * 1.1e10)
        capacity = max(450.0, min(4200.0, area_m2 * 3.5))
        rows.append(
            {
                "name": f"TK-{data_source.upper()}-{idx + 1:03d}",
                "dma_id": int(row["dma_id"]) if pd.notna(row["dma_id"]) else 1,
                "geometry": row.geometry,
                "attrs": {
                    "capacity_m3": round(capacity, 1),
                    "max_level_m": 6.0,
                    "min_level_m": 1.2,
                    "area_m2": round(area_m2, 1),
                    "covered": covered,
                    "tank_class": tank_class,
                    "data_source": data_source,
                    "osm_id": str(row.get("id")),
                    "osm_tags": clean_json(
                        {
                            "man_made": row.get("man_made"),
                            "landuse": row.get("landuse"),
                            "building": row.get("building"),
                            "operator": row.get("operator"),
                        }
                    ),
                },
            }
        )
    return gpd.GeoDataFrame(rows, geometry="geometry", crs=4326)


def make_synthetic_tanks(dmas: gpd.GeoDataFrame, junctions: gpd.GeoDataFrame, existing: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    projected_junctions = junctions.to_crs(32633)
    projected_existing = existing.to_crs(32633) if not existing.empty else existing
    synthetic_rows = []

    for _, dma in dmas.iterrows():
        candidates = junctions[junctions.within(dma.geometry)].copy()
        if candidates.empty:
            continue
        target_count = max(1, round(float(dma.population) / 4000))
        candidates["lat_rank"] = candidates.geometry.y.rank(method="dense", ascending=False)
        candidates["street_count"] = candidates["attrs"].apply(lambda attrs: int((attrs or {}).get("street_count", 0)))
        candidates = candidates.sort_values(["lat_rank", "street_count"], ascending=[True, False])

        chosen = 0
        for _, candidate in candidates.iterrows():
            if chosen >= target_count:
                break
            candidate_geom = gpd.GeoSeries([candidate.geometry], crs=4326).to_crs(32633).iloc[0]
            too_close = False
            if not projected_existing.empty:
                distances = projected_existing.geometry.distance(candidate_geom)
                too_close = bool((distances < 700).any())
            if too_close:
                continue
            synthetic_rows.append(
                {
                    "name": f"TK-SYN-{int(dma.id):02d}-{chosen + 1:02d}",
                    "dma_id": int(dma.id),
                    "geometry": candidate.geometry,
                    "attrs": {
                        "capacity_m3": round(850 + chosen * 120 + float(dma.population) / 28, 1),
                        "max_level_m": 6.5,
                        "min_level_m": 1.5,
                        "area_m2": round(180 + chosen * 14, 1),
                        "covered": True,
                        "tank_class": "synthetic_distribution_tank",
                        "data_source": "synthetic_uni9182",
                        "osm_id": None,
                        "osm_tags": {"seed_dma": dma.name, "source_node_id": int(candidate.id)},
                    },
                }
            )
            projected_existing = pd.concat(
                [
                    projected_existing,
                    gpd.GeoDataFrame([{"geometry": candidate_geom}], geometry="geometry", crs=32633),
                ],
                ignore_index=True,
            )
            chosen += 1

    return gpd.GeoDataFrame(synthetic_rows, geometry="geometry", crs=4326)


def replace_tanks(conn, tanks: gpd.GeoDataFrame):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM pipe_nodes WHERE node_type = 'tank'")
        cur.execute(
            """
            SELECT setval(
              pg_get_serial_sequence('pipe_nodes', 'id'),
              COALESCE((SELECT MAX(id) FROM pipe_nodes), 1),
              true
            )
            """
        )
        cur.executemany(
            """
            INSERT INTO pipe_nodes (geom, elevation_m, node_type, name, attrs)
            VALUES (ST_GeomFromText(%s, 4326), NULL, 'tank', %s, %s::jsonb)
            """,
            [
                (
                    row.geometry.wkt,
                    row["name"],
                    psycopg.types.json.Jsonb(clean_json(row["attrs"])),
                )
                for _, row in tanks.iterrows()
            ],
        )


def main():
    dsn = os.environ["SUPABASE_DB_POOLER_URL"]
    with psycopg.connect(dsn, autocommit=True) as conn:
        dmas = load_dmas(conn)
        junctions = load_junction_nodes(conn)
        base_tanks = make_osm_and_ndwi_tanks(dmas)
        synthetic_tanks = make_synthetic_tanks(dmas, junctions, base_tanks)
        all_tanks = pd.concat([base_tanks, synthetic_tanks], ignore_index=True)
        all_tanks = gpd.GeoDataFrame(all_tanks, geometry="geometry", crs=4326)
        replace_tanks(conn, all_tanks)

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT attrs->>'data_source' AS data_source, COUNT(*)
                FROM pipe_nodes
                WHERE node_type = 'tank'
                GROUP BY 1
                ORDER BY 1
                """
            )
            by_source = cur.fetchall()
            cur.execute("SELECT COUNT(*) FROM pipe_nodes WHERE node_type = 'tank'")
            total = cur.fetchone()[0]

    print({"tank_total": total, "by_source": by_source})


if __name__ == "__main__":
    main()
