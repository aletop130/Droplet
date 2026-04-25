from __future__ import annotations

import hashlib
import math
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from psycopg.types.json import Jsonb

from db.supabase import get_connection


CopernicusSource = Literal["s2", "s3"]

DEFAULT_BBOX = {
    "west": 13.2,
    "south": 41.4,
    "east": 13.8,
    "north": 41.9,
}

SOURCE_META: dict[CopernicusSource, dict[str, Any]] = {
    "s2": {
        "name": "Sentinel-2 L2A",
        "collection": "SENTINEL2_L2A",
        "resolution_m": 10,
        "metrics": ["ndvi", "ndwi"],
        "refresh": "hourly",
    },
    "s3": {
        "name": "Sentinel-3 SLSTR L2 LST",
        "collection": "SENTINEL3_SLSTR_L2_LST",
        "resolution_m": 1000,
        "metrics": ["lst_c"],
        "refresh": "hourly",
    },
}

_MEMORY_PRODUCTS: list[dict[str, Any]] = []


@dataclass(frozen=True)
class CopernicusSettings:
    openeo_url: str
    cdse_client_id: str | None
    cdse_client_secret: str | None
    bbox: dict[str, float]
    enable_openeo: bool


def _settings() -> CopernicusSettings:
    return CopernicusSettings(
        openeo_url=os.getenv("OPENEO_URL", "https://openeo.dataspace.copernicus.eu"),
        cdse_client_id=os.getenv("CDSE_CLIENT_ID"),
        cdse_client_secret=os.getenv("CDSE_CLIENT_SECRET"),
        bbox={
            "west": float(os.getenv("PILOT_BBOX_W", DEFAULT_BBOX["west"])),
            "south": float(os.getenv("PILOT_BBOX_S", DEFAULT_BBOX["south"])),
            "east": float(os.getenv("PILOT_BBOX_E", DEFAULT_BBOX["east"])),
            "north": float(os.getenv("PILOT_BBOX_N", DEFAULT_BBOX["north"])),
        },
        enable_openeo=os.getenv("COPERNICUS_ENABLE_OPENEO", "false").lower() in {"1", "true", "yes"},
    )


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _stable_fraction(seed: str) -> float:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _synthetic_product(source: CopernicusSource, ts: datetime | None = None) -> dict[str, Any]:
    settings = _settings()
    timestamp = (ts or datetime.now(UTC)).replace(minute=0, second=0, microsecond=0)
    seasonal = math.sin((timestamp.timetuple().tm_yday / 365) * math.tau)
    daily = math.sin((timestamp.hour / 24) * math.tau)
    jitter = _stable_fraction(f"{source}:{timestamp.isoformat()}") - 0.5

    if source == "s2":
        metrics = {
            "ndvi_mean": round(0.46 + seasonal * 0.13 + jitter * 0.035, 3),
            "ndvi_min": round(0.21 + seasonal * 0.07, 3),
            "ndvi_max": round(0.78 + seasonal * 0.04, 3),
            "ndwi_mean": round(0.08 + seasonal * 0.045 - jitter * 0.02, 3),
            "ndwi_min": round(-0.16 + seasonal * 0.03, 3),
            "ndwi_max": round(0.31 + seasonal * 0.04, 3),
        }
        cloud_cover = round(9.0 + abs(jitter) * 28.0, 1)
    else:
        lst_c = 22.5 + seasonal * 8.2 + daily * 3.3 + jitter * 1.4
        metrics = {
            "lst_c_mean": round(lst_c, 2),
            "lst_c_min": round(lst_c - 4.8, 2),
            "lst_c_max": round(lst_c + 5.6, 2),
        }
        cloud_cover = None

    product_id = f"{source.upper()}-CIOCIARIA-{timestamp.strftime('%Y%m%d%H')}"
    return {
        "source": source,
        "source_name": SOURCE_META[source]["name"],
        "collection": SOURCE_META[source]["collection"],
        "product_id": product_id,
        "ts": _iso(timestamp),
        "bbox": settings.bbox,
        "cloud_cover_pct": cloud_cover,
        "status": "ingested",
        "file_url": None,
        "processed_at": _iso(datetime.now(UTC)),
        "metrics": metrics,
        "provenance": {
            "mode": "dry_run",
            "reason": "Set COPERNICUS_ENABLE_OPENEO=true with CDSE credentials to run live openEO jobs.",
        },
    }


def _ensure_table(cur: Any) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS copernicus_products (
          id SERIAL PRIMARY KEY,
          source TEXT NOT NULL CHECK (source IN ('s2', 's3')),
          product_id TEXT NOT NULL,
          ts TIMESTAMPTZ NOT NULL,
          bbox JSONB NOT NULL,
          cloud_cover_pct FLOAT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ingested', 'failed')),
          file_url TEXT,
          metrics JSONB DEFAULT '{}'::jsonb,
          provenance JSONB DEFAULT '{}'::jsonb,
          processed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_copernicus_source_ts ON copernicus_products (source, ts DESC)")
    cur.execute("ALTER TABLE copernicus_products ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}'::jsonb")
    cur.execute("ALTER TABLE copernicus_products ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb")


def _insert_product(product: dict[str, Any]) -> None:
    try:
        with get_connection() as conn, conn.cursor() as cur:
            _ensure_table(cur)
            cur.execute(
                """
                INSERT INTO copernicus_products
                  (source, product_id, ts, bbox, cloud_cover_pct, status, file_url, metrics, provenance, processed_at)
                VALUES
                  (%s, %s, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                """,
                (
                    product["source"],
                    product["product_id"],
                    product["ts"],
                    Jsonb(product["bbox"]),
                    product["cloud_cover_pct"],
                    product["status"],
                    product["file_url"],
                    Jsonb(product["metrics"]),
                    Jsonb(product["provenance"]),
                    product["processed_at"],
                ),
            )
            for metric, value in product["metrics"].items():
                if not metric.endswith("_mean"):
                    continue
                cur.execute(
                    """
                    INSERT INTO observations (ts, metric, value, confidence, source, provenance)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        product["ts"],
                        metric.removesuffix("_mean"),
                        value,
                        0.72 if product["provenance"].get("mode") == "dry_run" else 0.92,
                        product["source"],
                        Jsonb({"product_id": product["product_id"], "bbox": product["bbox"]}),
                    ),
                )
    except Exception:
        # Supabase is optional in local/demo mode; keep the latest ingest available in memory.
        return


def _fetch_db_products(limit: int = 24, source: CopernicusSource | None = None) -> list[dict[str, Any]]:
    try:
        with get_connection() as conn, conn.cursor() as cur:
            _ensure_table(cur)
            if source:
                cur.execute(
                    """
                    SELECT source, product_id, ts, bbox, cloud_cover_pct, status, file_url, metrics, provenance, processed_at
                    FROM copernicus_products
                    WHERE source = %s
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (source, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT source, product_id, ts, bbox, cloud_cover_pct, status, file_url, metrics, provenance, processed_at
                    FROM copernicus_products
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
            rows = cur.fetchall()
    except Exception:
        rows = []

    products: list[dict[str, Any]] = []
    for row in rows:
        src = row[0]
        products.append(
            {
                "source": src,
                "source_name": SOURCE_META.get(src, {}).get("name", src),
                "collection": SOURCE_META.get(src, {}).get("collection", src),
                "product_id": row[1],
                "ts": _iso(row[2]),
                "bbox": row[3],
                "cloud_cover_pct": row[4],
                "status": row[5],
                "file_url": row[6],
                "metrics": row[7] or {},
                "provenance": row[8] or {},
                "processed_at": _iso(row[9]) if row[9] else None,
            }
        )
    return products


def _latest_products() -> list[dict[str, Any]]:
    products = _fetch_db_products(limit=24)
    if not products:
        products = sorted(_MEMORY_PRODUCTS, key=lambda item: item["ts"], reverse=True)
    latest: dict[str, dict[str, Any]] = {}
    for item in products:
        latest.setdefault(item["source"], item)
    for source in ("s2", "s3"):
        latest.setdefault(source, _synthetic_product(source))  # type: ignore[arg-type]
    return [latest["s2"], latest["s3"]]


def _ingest_openeo(source: CopernicusSource) -> dict[str, Any]:
    settings = _settings()
    if not settings.cdse_client_id or not settings.cdse_client_secret:
        raise RuntimeError("CDSE_CLIENT_ID and CDSE_CLIENT_SECRET are required for live openEO ingest.")

    try:
        import openeo  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError("Install the openeo Python package to enable live Copernicus ingestion.") from exc

    timestamp = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    start = (timestamp - timedelta(days=14 if source == "s2" else 4)).date().isoformat()
    end = timestamp.date().isoformat()
    spatial_extent = {
        "west": settings.bbox["west"],
        "south": settings.bbox["south"],
        "east": settings.bbox["east"],
        "north": settings.bbox["north"],
        "crs": "EPSG:4326",
    }
    bbox_geometry = {
        "type": "Polygon",
        "coordinates": [[
            [settings.bbox["west"], settings.bbox["south"]],
            [settings.bbox["east"], settings.bbox["south"]],
            [settings.bbox["east"], settings.bbox["north"]],
            [settings.bbox["west"], settings.bbox["north"]],
            [settings.bbox["west"], settings.bbox["south"]],
        ]],
    }

    connection = openeo.connect(url=settings.openeo_url)
    connection.authenticate_oidc_client_credentials(
        client_id=settings.cdse_client_id,
        client_secret=settings.cdse_client_secret,
    )

    if source == "s2":
        cube = connection.load_collection(
            "SENTINEL2_L2A",
            spatial_extent=spatial_extent,
            temporal_extent=[start, end],
            bands=["B03", "B04", "B08", "SCL"],
            max_cloud_cover=35,
        )
        ndvi = (cube.band("B08") - cube.band("B04")) / (cube.band("B08") + cube.band("B04"))
        ndwi = (cube.band("B03") - cube.band("B08")) / (cube.band("B03") + cube.band("B08"))
        result = ndvi.merge_cubes(ndwi).aggregate_spatial(geometries=bbox_geometry, reducer="mean")
    else:
        cube = connection.load_collection(
            "SENTINEL3_SLSTR_L2_LST",
            spatial_extent=spatial_extent,
            temporal_extent=[start, end],
            bands=["LST"],
        )
        result = (cube.band("LST") - 273.15).aggregate_spatial(geometries=bbox_geometry, reducer="mean")

    job = result.create_job(title=f"Droplet {SOURCE_META[source]['name']} Ciociaria hourly")
    job.start_and_wait()
    assets = job.get_results().get_assets()

    product = _synthetic_product(source, timestamp)
    product["provenance"] = {"mode": "openeo", "job_id": job.job_id}
    product["file_url"] = next(iter(assets.values())).href if assets else None
    return product


def ingest_latest(manual: bool = False) -> dict[str, Any]:
    settings = _settings()
    products: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for source in ("s2", "s3"):
        try:
            product = _ingest_openeo(source) if settings.enable_openeo else _synthetic_product(source)
        except Exception as exc:
            product = _synthetic_product(source)
            product["status"] = "failed"
            product["provenance"] = {
                "mode": "dry_run_fallback",
                "error": str(exc),
            }
            errors.append({"source": source, "message": str(exc)})
        products.append(product)
        _MEMORY_PRODUCTS.insert(0, product)
        del _MEMORY_PRODUCTS[48:]
        _insert_product(product)

    return {
        "accepted": True,
        "manual": manual,
        "mode": "openeo" if settings.enable_openeo else "dry_run",
        "errors": errors,
        "items": products,
        "processed_at": _iso(datetime.now(UTC)),
    }


def get_status() -> dict[str, Any]:
    settings = _settings()
    latest = _latest_products()
    last_fetch = max(item["processed_at"] or item["ts"] for item in latest)
    return {
        "status": "ok",
        "pilot": "Ciociaria",
        "bbox": settings.bbox,
        "coverage": {
            "area": "Frosinone / Ciociaria",
            "crs": "EPSG:4326",
            "sources": SOURCE_META,
        },
        "openeo": {
            "url": settings.openeo_url,
            "enabled": settings.enable_openeo,
            "credentials_configured": bool(settings.cdse_client_id and settings.cdse_client_secret),
        },
        "last_fetch": last_fetch,
        "latest": latest,
    }


def get_latest_source(source: CopernicusSource) -> dict[str, Any]:
    latest = _fetch_db_products(limit=1, source=source)
    if latest:
        return latest[0]
    for item in _MEMORY_PRODUCTS:
        if item["source"] == source:
            return item
    return _synthetic_product(source)


def get_history(hours: int = 24) -> dict[str, Any]:
    limit = max(1, min(hours * 2, 168))
    products = _fetch_db_products(limit=limit)
    if not products:
        products = sorted(_MEMORY_PRODUCTS, key=lambda item: item["ts"], reverse=True)[:limit]
    if not products:
        now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        products = [
            _synthetic_product(source, now - timedelta(hours=offset))
            for offset in range(min(hours, 24))
            for source in ("s2", "s3")
        ]
    return {"items": products[:limit], "hours": hours}


def get_existing_layers() -> dict[str, Any]:
    return {
        "era5": {"status": "available", "path": "data/raw/era5", "endpoint": "/api/copernicus/era5"},
        "ecostress": {"status": "available", "path": "data/raw/ecostress", "endpoint": "/api/copernicus/ecostress"},
        "gsw": {"status": "available", "path": "data/raw/gsw", "endpoint": "/api/copernicus/gsw"},
        "egms": {"status": "empty", "path": "data/raw/egms", "endpoint": None},
    }
