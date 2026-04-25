# Step 0.3 - Data Study

## ISTAT workbook

Source: `data/raw/istat/Istat_Tavole_Censimento_acque_2020-21122022.xlsx`

- Workbook sheets found: `Indice tavole`, `Avvertenze`, `Tav 1` ... `Tav 43`.
- Extracted structured output saved to `data/processed/istat_frosinone.json`.

### Tav 17 - Frosinone NRW

| Provincia | Acqua immessa (10^3 m3) | Pro capite immessa (L/ab/g) | Acqua erogata (10^3 m3) | Pro capite erogata (L/ab/g) | Perdite (%) |
|---|---:|---:|---:|---:|---:|
| Frosinone | 106262 | 611 | 32442 | 187 | 69.5 |

### Tav 3 - Lazio 2020

The workbook table is regional, not municipal/provincial. It gives Lazio source mix and total prelievi:

| Regione | Sorgente | Pozzo | Corso d'acqua superficiale | Lago naturale | Bacino artificiale | Acque marine/salmastre | Totale | Pro capite |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Lazio | 846.6 | 298.2 | 3.4 | 1.8 | n/d | 0.4 | 1150.5 | 547 |

Assessment:

- This confirms the Lazio source mix used in the plan narrative.
- It does **not** provide per-comune/per-provincia volumetries for Lazio inside this workbook row. The prompt expectation is stricter than the actual table structure.

### Tav 23

Observed content:

- `Tav 23` in this workbook is **not** pipe material distribution.
- It reports water volumes by **tipologia di gestione** for each province.

Relevant Frosinone row:

| Provincia | Immessa specializzata | % | Immessa comunale | % | Erogata specializzata | % |
|---|---:|---:|---:|---:|---:|---:|
| Frosinone | 105796 | 99.6 | 466 | 0.4 | 32111 | 99.0 |

Assessment:

- The request "Da Tav. 23: distribuzione materiali condotte regione Lazio" does not match the workbook content actually present on disk.
- If pipe material priors are needed, they must come from another table/source or be synthesized.

### Tav 29 - Frosinone

| Provincia | Comuni senza distribuzione | Popolazione | % | Comuni senza depurazione | Popolazione | % |
|---|---:|---:|---:|---:|---:|---:|
| Frosinone | 0 | 0 | 0 | 11 | 31010 | 6.5 |

Assessment:

- The workbook row on disk confirms **11 comuni / 31,010 residenti / 6.5%** for **depurazione**, not for water distribution.
- This is another mismatch between prompt wording and the actual workbook content.

## OSM drive graph - nodes

Source: `data/raw/osm/frosinone_nodes.geojson`

| Metric | Value |
|---|---:|
| `n_nodes_total` | 18843 |
| `n_tanks_osm` | 0 |
| `n_junctions` (`street_count >= 3`) | 14859 |
| bbox minx/miny/maxx/maxy | 13.0095988 / 41.309066 / 14.0224977 / 41.9137789 |

Assessment:

- This file is a **road graph node export**, not a water infrastructure node layer.
- There are no `man_made=*` tank attributes here, so `n_tanks_osm = 0` is expected.
- It is valid as a **network topology proxy**, but not as a direct water-node cadastre.

## OSM drive graph - edges

Source: `data/raw/osm/frosinone_edges.geojson`

| Metric | Value |
|---|---:|
| edge count | 45367 |
| total length (from OSM `length`) | 14265.27 km |

Top classes:

| Highway class | Count |
|---|---:|
| `['unclassified']` | 16680 |
| `['residential']` | 16566 |
| `['tertiary']` | 6381 |
| `['primary']` | 2343 |
| `['secondary']` | 2106 |

Why this is a valid proxy for the hackathon network:

- In Italian urban utilities, buried water mains often follow the street graph because roads are the cheapest/right-of-way corridor.
- The graph has enough density and continuity to support DMA clustering, EPANET synthetic topology and adjacency traversal.
- It is still a **proxy**, not a cadastral water network. Material, diameter and installation year must therefore be inferred or synthesized.

## OSM water features

Source: `data/raw/osm/frosinone_water_features.geojson`

| Feature type | Count |
|---|---:|
| `storage_tank` | 22 |
| `landuse:reservoir` | 16 |
| `water_tower` | 8 |
| `reservoir_covered` | 6 |
| `water_works` | 2 |

Other metrics:

| Metric | Value |
|---|---:|
| total features | 54 |
| bbox minx/miny/maxx/maxy | 13.0180913 / 41.3385927 / 13.8426389 / 41.8947696 |

Assessment:

- This is the correct source for real tank-like assets in the current repo, not `frosinone_nodes.geojson`.

## ERA5

Directory: `data/raw/era5/`

### `data_stream-oper_stepType-accum.nc`

| Property | Value |
|---|---|
| format | netCDF |
| size | 34678 bytes |
| dims | `valid_time=8`, `latitude=2`, `longitude=3` |
| variables | `tp`, `pev` |
| extent | lon 13.25..13.75, lat 41.5..41.75 |

### `data_stream-oper_stepType-instant.nc`

| Property | Value |
|---|---|
| format | netCDF |
| size | 34167 bytes |
| dims | `valid_time=8`, `latitude=2`, `longitude=3` |
| variables | `t2m`, `swvl1` |
| extent | lon 13.25..13.75, lat 41.5..41.75 |

Assessment:

- Minimal sample coverage only.
- Variables present are enough to seed a basic scarcity/weather layer.

## ECOSTRESS

Directory: `data/raw/ecostress/`

All files are GeoTIFFs covering the same tile envelope:

| File | Size | Raster size | dtype | Derived extent |
|---|---:|---|---|---|
| `..._cloud.tif` | 22755 B | 1568x1568 | `uint8` | 300000,4590280,409760,4700040 |
| `..._EmisWB.tif` | 1750567 B | 1568x1568 | `float32` | same |
| `..._height.tif` | 6063991 B | 1568x1568 | `float32` | same |
| `..._LST.tif` | 2882116 B | 1568x1568 | `float32` | same |
| `..._LST_err.tif` | 188201 B | 1568x1568 | `float32` | same |
| `..._QC.tif` | 324658 B | 1568x1568 | `uint16` | same |
| `..._view_zenith.tif` | 5668925 B | 1568x1568 | `float32` | same |
| `..._water.tif` | 7002 B | 1568x1568 | `uint8` | same |

Available variables inferred from filenames:

- `LST`
- `LST_err`
- `QC`
- `cloud`
- `water`
- `EmisWB`
- `height`
- `view_zenith`

## GSW

Source: `data/raw/gsw/GSW_occurrence_10E_50N.tif`

| Property | Value |
|---|---|
| format | GeoTIFF |
| size | 43113890 bytes |
| raster size | 40000x40000 |
| dtype | `uint8` |
| extent | 10,40,20,50 |

Assessment:

- This is a large regional tile, not a bbox-clipped derivative.
- It still covers the pilot area fully.

## EGMS

Directory: `data/raw/egms/`

- Directory exists but is currently **empty**.
- No local EGMS tiles are present yet, so there is no raster/vector extent or variable list to report from disk.

## GRACE

- No `data/raw/grace/` directory found.
- No local GRACE sample file is currently present in the repo.

## Net assessment

- Repo data already supports a first real bootstrap for OSM proxy network, OSM tanks, ERA5 and ECOSTRESS-backed overlays.
- The ISTAT workbook on disk does not fully match the prompt's requested sub-extractions.
- Qdrant embeddings and municipality KPI population still need to be bootstrapped from these sources.
