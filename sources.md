# Droplet — Data Sources Catalogue
**Pilot: Ciociaria (Frosinone, Lazio, IT) · Bounding box: `W 13.2 · S 41.4 · E 13.8 · N 41.9`**

Every source Droplet ingests, with official provider, dataset ID, cadence, what it's for, how we fetch it, where it lands in the stack, and the licence/citation. Grouped by type.

---

## 1. Space / satellite sources

### 1.1 ERA5 — ECMWF Reanalysis v5
| Field | Value |
|---|---|
| **Provider** | Copernicus Climate Change Service (C3S) @ ECMWF |
| **Portal** | https://cds.climate.copernicus.eu |
| **Dataset ID** | `reanalysis-era5-single-levels` |
| **ARCO-Zarr variant** | also available (optimised for long time-series at single points) |
| **Temporal coverage** | 1940 → present (ERA5-T near-real-time has ~5-day latency) |
| **Cadence we run** | Nightly GitHub Actions cron, pulling `today − 6d` |
| **Spatial resolution** | 0.25° × 0.25° regular grid |
| **Variables pulled** | `2m_temperature` (t2m), `total_precipitation` (tp), `volumetric_soil_water_layer_1` (swvl1), `potential_evaporation` (pev) |
| **Auth** | Personal Access Token → `~/.cdsapirc` |
| **Client** | `cdsapi` Python library |
| **Format** | NetCDF4 (Experimental) — returns a ZIP with `instant` + `accum` stream files |
| **Use in Droplet** | **Confounder detrend.** Regressed out of corridor NDVI and LST residuals so leak-signal isn't confounded by rainfall / temperature / soil-moisture fluctuations. Also a Module-1 input for spring-discharge and scarcity forecasts. |
| **Pipeline landing** | `observations(dma_id, ts, metric IN 'precip_mm' 'temp_c' 'soil_moist' 'pet', value, source='era5')` |
| **Licence** | Copernicus CC-BY — terms accepted per-dataset on first use |
| **Sample on disk** | `data/raw/era5/data_stream-oper_stepType-{instant,accum}.nc` (68 KB, 2026-04-17→18) |

### 1.2 Sentinel-2 L2A — optical surface reflectance
| Field | Value |
|---|---|
| **Provider** | ESA Copernicus · ground segment on Copernicus Data Space Ecosystem (CDSE) |
| **Portal** | https://dataspace.copernicus.eu · openEO at https://openeo.dataspace.copernicus.eu |
| **Dataset ID** | `SENTINEL2_L2A` |
| **Temporal coverage** | 2017-03 → present; Level-2A available ~24–72 h after sensing |
| **Cadence** | 5-day revisit per tile; we compute weekly cloud-free composites |
| **Spatial resolution** | 10 m (B02 B03 B04 B08), 20 m (B05 B06 B07 B8A B11 B12), 60 m (B01 B09) |
| **Bands we use** | B03 (green), B04 (red), B08 (NIR), **SCL** (scene classification — for cloud mask) |
| **Indices computed** | **NDVI** = (B08 − B04) / (B08 + B04) · **NDWI** = (B03 − B08) / (B03 + B08) |
| **Processing location** | Cloud-side on openEO (we never download raw bands) |
| **Auth** | CDSE OAuth2 client-credentials grant |
| **Client** | `openeo` Python library |
| **Use in Droplet** | **Corridor vegetation anomaly along pipe segments.** A subsurface leak irrigates overlying soil → grass greens earlier/stronger than the surrounding urban fabric → NDVI z-score spikes in the ±10 m corridor buffer relative to a 20–40 m control ring. After ERA5 detrend, residual z-score is one of four inputs to the PHI. Also NDWI for surface-water / reservoir extent tracking (Module 1). |
| **Pipeline landing** | `anomaly_scores(segment_id, ts, metric='ndvi_resid_z', value, source='s2')` + optionally `observations.metric='ndwi_frac'` at DMA level |
| **Licence** | Copernicus full-free-open-access |

### 1.3 Sentinel-3 SLSTR — Sea-and-Land Surface Temperature Radiometer
| Field | Value |
|---|---|
| **Provider** | ESA Copernicus via CDSE |
| **Portal** | https://openeo.dataspace.copernicus.eu |
| **Dataset ID** | `SENTINEL3_SLSTR_L2_LST` |
| **Temporal coverage** | 2016 → present; near-real-time (~3–6 h) |
| **Cadence** | Daily revisit; we pull nightly |
| **Spatial resolution** | 1 km LST |
| **Use in Droplet** | **Regional thermal pre-screen.** Too coarse to localise leaks but good for wide-area cold-spot detection; used as a **gate** — only run the more expensive ECOSTRESS processing on DMAs flagged with S3 anomaly z < −1.5. |
| **Auth** | CDSE OAuth2 (same as Sentinel-2) |
| **Client** | `openeo` |
| **Pipeline landing** | `observations(dma_id, ts, metric='lst_regional_z', source='s3')` |
| **Licence** | Copernicus full-free-open-access |

### 1.4 ECOSTRESS L2T LSTE — fine thermal on the ISS
| Field | Value |
|---|---|
| **Provider** | NASA JPL / LP DAAC — ECOSTRESS instrument on ISS |
| **Portal** | https://search.earthdata.nasa.gov · https://www.earthdata.nasa.gov/data/catalog/lpcloud-eco-l2t-lste-002 |
| **Primary dataset ID** | **`ECO_L2T_LSTE`** v3 (Tiled L2 LST & Emissivity, Global 70 m) |
| **Secondary (cross-check NDVI) dataset ID** | **`ECO_L2T_STARS`** v3 (Tiled Ancillary NDVI + Albedo, Global 70 m) |
| **Legacy — do NOT use** | `ECO2LSTE` v1 (Daily L2) — coverage ended 2025-01-06 |
| **Temporal coverage** | 2018-07-09 → present |
| **Cadence** | Irregular ISS orbit, ~2–3 revisits/week over Ciociaria; product latency ~24–48 h |
| **Spatial resolution** | 70 m, tiled in MGRS (Ciociaria sits on MGRS tile `33TUG`) |
| **Assets per granule** | `_LST.tif`, `_LST_err.tif`, `_QC.tif`, `_cloud.tif`, `_water.tif`, `_height.tif`, `_view_zenith.tif`, `_EmisWB.tif` (we keep the first 4 for production) |
| **Auth** | Earthdata Login (via `~/.netrc` / Windows `_netrc`) |
| **Client** | `earthaccess` Python library |
| **Use in Droplet** | **Fine thermal leak signal.** Groundwater leaks create a cool surface halo above the pipe. Per-segment zonal stats over corridor buffer, ERA5-detrended → residual LST z-score → one of four PHI inputs. 70 m resolution means a ~5-segment trunk main is resolvable. |
| **Pipeline landing** | `anomaly_scores(segment_id, ts, metric='lst_resid_z', source='ecostress')` |
| **Licence** | NASA open data |
| **Sample on disk** | `data/raw/ecostress/ECOv002_L2T_LSTE_43382_014_33TUG_20260301T050134_0713_01_*` (8 assets, 17 MB) |

### 1.5 EGMS — European Ground Motion Service
| Field | Value |
|---|---|
| **Provider** | Copernicus Land Monitoring Service (CLMS), derived from Sentinel-1 InSAR |
| **Portal** | https://egms.land.copernicus.eu (EGMS Explorer web UI) · API on Copernicus Land (https://land.copernicus.eu/api) |
| **Dataset used** | **`egms-ortho`** — Ortho (East + Vertical components), vector (point CSVs) |
| **Product level** | L3, **Vertical component** (U) — differential vertical motion is what breaks pipes |
| **Temporal coverage** | 2016 → latest annual release (new release ~each November/December) |
| **Cadence** | Yearly (we re-download once per release) |
| **Spatial resolution** | Point-based — Persistent Scatterers (PS) with ~100 m typical density in built-up areas |
| **Tiles for Ciociaria** | `E40N22` and `E40N23` (100 × 100 km EPSG:3035 tiles) |
| **Format** | CSV — columns: `pid`, `easting`, `northing`, `lon`, `lat`, `height`, `velocity` (mm/yr), plus 6-monthly displacement time series |
| **Auth** | Copernicus Land OAuth2 JWT bearer grant (RS256 service account); private key out-of-project in `C:\Users\aleal\.droplet-secrets\egms_token.json` |
| **Client** | `requests` + `pyjwt[crypto]` for JWT signing; data download is a request/email flow via the EGMS Explorer |
| **Use in Droplet** | **Differential subsidence per segment — a high-signal predictor for operational risk triage.** For each pipe segment we interpolate PS velocities along the centerline and compute the velocity gradient along length + the variance within the ±5 m corridor. Uniform subsidence is benign; differential motion (mm/yr gradient over 50–100 m) correlates strongly with joint failure, longitudinal cracks, and bursts. |
| **Pipeline landing** | `pipe_segments.subsidence_score` (one float per segment, updated yearly) + raw PS points optionally kept as PostGIS points for Neo4j `affects` relations |
| **Licence** | Copernicus full-free-open-access · access controlled by Copernicus Land EULA (accepted at registration) |

### 1.6 GRACE-FO — Gravity Recovery and Climate Experiment Follow-On
| Field | Value |
|---|---|
| **Provider** | NASA / GFZ · served via LP DAAC |
| **Portal** | https://urs.earthdata.nasa.gov |
| **Dataset ID** | `GRAC_L3_JPL_RL06_LND_v04` (JPL mascon solution, land only) |
| **Temporal coverage** | 2018-06 → present (GRACE-FO; GRACE original 2002–2017 available under separate ID) |
| **Cadence** | Monthly, ~2-month product latency |
| **Spatial resolution** | 0.5° mascon grid — effective ~300 km |
| **Use in Droplet** | **Module 1 scarcity forecast only.** Regional aquifer storage anomaly for the Lazio mascon cell, fed as feature into 30/60/90-day scarcity forecast alongside ERA5. Too coarse for any pipe-level reasoning. |
| **Auth** | Earthdata Login (same `_netrc` as ECOSTRESS) |
| **Client** | `earthaccess` |
| **Pipeline landing** | `observations(metric='aquifer_mass_anomaly', source='grace')` at regional aggregation |
| **Licence** | NASA open data |

### 1.7 JRC Global Surface Water Explorer (GSW)
| Field | Value |
|---|---|
| **Provider** | EC Joint Research Centre (JRC) — derived from Landsat 1984–present |
| **Portal** | https://global-surface-water.appspot.com/download |
| **Product variants** | `occurrence`, `seasonality`, `change`, `recurrence`, `transitions`, `extent` |
| **Tile** | `10E_50N` (10° × 10° tile covering all of Ciociaria + surrounding Lazio) |
| **Spatial resolution** | 30 m |
| **Temporal coverage** | 1984 → 2021 (current v1.4 release) |
| **Cadence** | Yearly release, essentially static |
| **Format** | GeoTIFF (direct HTTP download, no auth) |
| **Use in Droplet** | **Module 1 surface-water baseline.** Characterises seasonality of surface intakes (rivers, reservoirs) that feed the water system; one numeric monthly water-presence fraction per intake location. Important for source-diversification logic because Lazio pulls only 0.3 % from surface sources. |
| **Pipeline landing** | `observations(metric='surface_water_fraction', source='gsw')` per intake-point × month |
| **Licence** | CC-BY-4.0 |
| **Sample on disk** | `data/raw/gsw/GSW_occurrence_10E_50N.tif` (35 MB) |

### 1.8 Galileo HAS — High Accuracy Service
| Field | Value |
|---|---|
| **Provider** | European GNSS Service Centre (EU-GSA / EUSPA) |
| **Portal** | https://www.gsc-europa.eu/galileo-services/galileo-has |
| **What it is** | Real-time Precise Point Positioning + timing correction stream on the Galileo E6-B signal |
| **Accuracy** | < 20 cm position · < 10 ns timing |
| **Cadence** | Live |
| **Access path** | Requires a **HAS-capable GNSS receiver** in physical deployment (hardware, not an HTTP API) |
| **Use in Droplet** | **Acute leak localisation via pressure-wave TDOA.** When a burst fires a pressure transient (~1 000 m/s in steel pipes), three HAS-timed sensors can triangulate the source to ~3–5 m by time-difference-of-arrival. For the hackathon demo we **simulate** this — EPANET injects the transient, we add sub-µs timestamp jitter consistent with HAS, and the TDOA solver returns the probable-leak location. The plan documents the path to real-HAS deployment (receiver procurement + RINEX ingestion). |
| **Pipeline landing** | Timing used live during TDOA; simulated timestamps stored in `observations.metric='pressure_transient_ts'` |
| **Licence** | EU public service — free |

### 1.9 Sentinel-1 SAR — optional extension
| Field | Value |
|---|---|
| **Provider** | ESA Copernicus via CDSE |
| **Dataset ID** | `SENTINEL1_GRD` |
| **Use in Droplet** | **Open-reservoir surface tracking, cloud-independent.** Water-surface area change over open basins (Valle del Sacco alluvial plain) regardless of cloud cover. Not used in the core PHI — optional Module-1 extension. |
| **Auth / client** | Same CDSE OAuth + `openeo` |
| **Licence** | Copernicus full-free-open-access |

---

## 2. Ground / hydraulic data

### 2.1 EPANET 2.2 synthetic hydraulic simulation
| Field | Value |
|---|---|
| **Nature** | Derived, not fetched. Synthetic hydraulic network model. |
| **Engine** | EPANET 2.2 via `wntr` Python wrapper |
| **Build source** | OSMnx Frosinone drive graph (see §4.1) + pipe-attribute distributions from ISTAT (see §3.1) following Italian UNI 9182 / UNI EN 805 norms for diameter / pressure class by service area |
| **Attributes assigned per segment** | `diameter_mm`, `material` (PEAD, AC, ghisa, acciaio...), `install_year` (distribution skewed 1960–2010 based on ISTAT age priors), `roughness_mm`, `minor_loss_coeff` |
| **Nodes** | Junctions + Tanks + Reservoirs (tanks seeded from OSM water features §4.2 + gap-filled synthetically at high-elevation junctions ~1 per 5 000 pop per UNI 9182) |
| **Use in Droplet** | Live extended-period hydraulic simulation (5-second tick during demo); generates labeled leak scenarios to train supervised ML anomaly models; powers MNF (Minimum Night Flow) and IWA water-balance calculations; feeds the TDOA pressure-wave solver; sources all "SCADA-like" telemetry for the pilot (we have no real operator data). |
| **Pipeline landing** | Results stream into `observations(segment_id|sensor_id, ts, metric IN 'pressure_bar' 'flow_lps' 'tank_level_m', source='epanet_sim')` |
| **Licence** | EPANET is US EPA public domain · `wntr` is a permissive US Sandia Labs library |

### 2.2 SCADA / real operator telemetry
Not ingested in the hackathon pilot (privacy-protected, no operator contract). The data model already has room for it: the `source='scada'` tag on `observations` and `sensors.kind` lets real telemetry drop in next to synthetic readings once an operator agreement is signed.

---

## 3. Regulatory / statistical / census

### 3.1 ISTAT — Censimento delle acque per uso civile 2020
| Field | Value |
|---|---|
| **Provider** | Istituto Nazionale di Statistica (ISTAT) |
| **Portal** | https://www.istat.it — public XLSX + glossary + index PDFs |
| **Release** | 2020 census, published 2022-12-21 (`Istat_Tavole_Censimento_acque_2020-21122022.xlsx`) |
| **Cadence** | Once (next release ~2025 data) |
| **Format** | XLSX with 40 tables (Tav 4 → Tav 43) |
| **Tables we extract** | Tav 17 (**per-province water-balance + total losses %** — our main calibration), Tav 23 (**per-province + operator-type water-balance**), Tav 3 (**Lazio region source mix by fonte — springs vs wells vs surface**), Tav 20 (per demographic-class distributions — priors on pipe age/diameter), Tav 29 (comuni without public service — equity angle), Tav 35 (sewerage coverage per province), Tav 38 (depuration plants per province) |
| **Use in Droplet** | **Calibration baseline** (Frosinone NRW target) + **pipe-attribute prior distributions** for the synthetic EPANET network + **Module-1 source prior** (Lazio 74 % springs / 26 % wells / 0.3 % surface, driving the multi-source optimisation) |
| **Pipeline landing** | `municipality_kpis(comune, year, nrw_pct, volume_input_m3, volume_distributed_m3, losses_m3)` + stats tables seeded into config |
| **Licence** | ISTAT open data — CC-BY-3.0 IT |
| **Sample on disk** | `data/raw/istat/Istat_Tavole_Censimento_acque_2020-21122022.xlsx` (421 KB) + `Istat_CensAcque2020_Indice-delle-tavole-statistiche.pdf` + `Istat_CensAcque2020_Glossario.pdf` |

#### Hard numbers extracted for Droplet
| Metric | Value | Source | Meaning |
|---|---|---|---|
| Frosinone NRW total losses | **69.5 %** | Tav 17 | ~74 Mm³/yr lost in the province — the demo-day headline |
| Frosinone water injected | 106 262 k m³/yr | Tav 17 | Baseline for water balance |
| Frosinone water delivered (authorised) | 32 442 k m³/yr | Tav 17 | |
| Frosinone per-capita injection | 611 L/inhab/day | Tav 17 | ≈ 2× national median |
| Frosinone per-capita delivery | 187 L/inhab/day | Tav 17 | |
| Frosinone operator concentration | 99.6 % on specialised operator | Tav 23 | Single stakeholder to convince |
| Frosinone comuni without public water | 11 comuni / 31 010 people (6.5 %) | Tav 29 | Module-1 equity angle |
| **Lazio source mix** | Springs 846.6 Mm³ (74 %) · Wells 298.2 (26 %) · Surface 3.4 (0.3 %) | Tav 3 | Karst-dominated regime (Monti Ernici / Lepini) |

### 3.2 ARERA — Autorità di Regolazione per Energia Reti e Ambiente
| Field | Value |
|---|---|
| **Provider** | ARERA — Italian regulator |
| **Portal** | https://www.arera.it |
| **Products** | Annual reports (PDF) · regulatory tariff documents · quality-of-service obligations · service-quality indicator targets (IRAM / M1a / M1b / M2 / M3 indicators) |
| **Cadence** | Yearly (plus periodic tariff determinations) |
| **Format** | PDF + occasional XLSX |
| **Auth** | None — public |
| **Use in Droplet** | **Dual use.** (a) Regulatory fact extraction: pressure-zone definitions, DMA structure where published, service-quality obligations → seeded into Supabase config tables. (b) Document corpus for GraphRAG: PDFs chunked + embedded → Qdrant collection `regulations`, consumed by the agent's `search_docs` tool to back AI-explanation citations. |
| **Pipeline landing** | Structured facts → `regulations` table in Supabase · chunked PDFs → Qdrant `regulations` collection |
| **Licence** | Italian public-sector open data |

### 3.3 ISPRA Annuario dei Dati Ambientali
| Field | Value |
|---|---|
| **Provider** | Istituto Superiore per la Protezione e la Ricerca Ambientale |
| **Portal** | https://annuario.isprambiente.it |
| **Cadence** | Yearly |
| **Format** | PDF + Excel sheets |
| **Auth** | None |
| **Use in Droplet** | **Module-1 historical intake volumes + aquifer-state records for Frosinone province.** Calibration baseline for source-availability modelling (springs, wells, surface intakes). |
| **Pipeline landing** | `historical_intake(source_id, year, volume_m3)` |
| **Licence** | Italian public-sector open data |

### 3.4 IWA Water Loss Task Force framework (reference, not a dataset)
| Field | Value |
|---|---|
| **Provider** | International Water Association |
| **Use in Droplet** | **Terminology + calculation conventions.** All KPIs Droplet exposes follow IWA: **CARL** (Current Annual Real Losses), **UARL** (Unavoidable Annual Real Losses), **ILI** (Infrastructure Leakage Index = CARL/UARL), **NRW** (Non-Revenue Water), **MNF** (Minimum Night Flow). Dashboards label metrics with IWA names; reports auto-generated by `Qwen3.6-27B` use IWA phrasing. |
| **Citation** | Lambert, A. O. et al., "A review of performance indicators for real losses from water supply systems", IWA Journal of Water Supply: Research and Technology-AQUA, 2000 |

---

## 4. Topology sources

### 4.1 OpenStreetMap — road network as pipe topology proxy
| Field | Value |
|---|---|
| **Provider** | OpenStreetMap contributors |
| **Portal** | https://www.openstreetmap.org (queried via Overpass API) |
| **Client** | `osmnx` Python library |
| **Query** | `ox.graph_from_place("Frosinone, Italy", network_type='drive', simplify=True)` |
| **Cadence** | One-shot; re-pulled only on major road-network change |
| **Size for Frosinone comune** | 18 843 nodes · 45 367 edges |
| **Use in Droplet** | We have **no operator pipe-topology data** (privacy-protected). OSM roads are a near-perfect proxy for buried trunk mains in Italian towns because water mains follow road layout. The graph becomes the EPANET pipe network after attribute assignment (§2.1). For the demo we'll further simplify to ~5 k trunk edges. |
| **Pipeline landing** | `pipe_nodes(geom POINT, elevation_m, node_type)`, `pipe_segments(geom LINESTRING, length_m, diameter_mm, material, install_year, attrs)` |
| **Licence** | ODbL 1.0 (Open Database Licence) — must attribute "© OpenStreetMap contributors" |
| **Sample on disk** | `data/raw/osm/frosinone_drive.graphml` (29 MB) + `frosinone_{nodes,edges}.geojson` (40 MB) |

### 4.2 OpenStreetMap — water infrastructure features
| Field | Value |
|---|---|
| **Query** | `ox.features_from_place("Frosinone, Italy", tags={'man_made':['water_tower','reservoir_covered','water_works','storage_tank'], 'landuse':'reservoir'})` |
| **Count for Frosinone** | **54 features**: 22 storage_tank · 16 reservoir (landuse) · 8 water_tower · 6 reservoir_covered · 2 water_works |
| **Use in Droplet** | **Real serbatoi locations.** Seeded into `pipe_nodes` with `node_type IN 'tank'|'reservoir'|'source_*'`, then gap-filled synthetically where OSM under-represents buried tanks (following UNI 9182 sizing norms). |
| **Pipeline landing** | `pipe_nodes` with `attrs JSONB` containing `{capacity_m3, max_level_m, elevation_m, data_source:'osm'}` |
| **Licence** | ODbL 1.0 |
| **Sample on disk** | `data/raw/osm/frosinone_water_features.geojson` (34 KB) |

---

## 5. Document corpus for GraphRAG

Chunked PDFs/XLSX/HTML → embedded with `Qwen3-Embedding-8B` → Qdrant collection `regulations`. Queried at runtime by the Regolo agent's `search_docs` tool and reranked by `Qwen3-Reranker-4B`.

| Document | Why |
|---|---|
| ARERA annual reports (§3.2) | Regulatory obligations and quality-of-service thresholds cited in explanations |
| ISTAT Glossario (Censimento Acque 2020) | Definitions of KPIs that the agent must use correctly |
| ISPRA Annuario (§3.3) | Historical context for source-level reasoning |
| IWA Water Loss framework (§3.4) | Standard terminology for every AI-generated explanation and auto-report |
| EU AI Act — Annex III + Art. 13 | The explainability requirements themselves; agent must cite these when rationalising high-risk operational recommendations |
| UNI 9182 / UNI EN 805 (Italian water-system design norms) | Engineering priors used when synthesising the network and justifying design choices |

---

## 6. What is explicitly NOT used

| Source | Why not |
|---|---|
| Copernicus Contributing Missions (CCM — WorldView, Pleiades, TerraSAR-X, …) | Commercial data, per-collection approval required, no operational need given Sentinel coverage |
| Proprietary SCADA data from any named operator | No operator agreement; plan is operator-agnostic by design |
| Commercial InSAR (TRE-Altamira, NHAZCA, TerraMotion) | EGMS covers Europe for free; commercial InSAR is only a fallback if EGMS coverage degrades |
| Google Maps / Mapbox as map base | Paid, non-EU; we use MapLibre + OSM tiles |
| `brick-v1-beta` (Regolo multimodal router) on **operational paths** | Opaque dispatch routing violates EU AI Act Art. 13 traceability. Reserved exclusively for a future public chatbot surface gated by explicit user approval. |

---

## 7. Credentials & storage locations — quick ops reference

| Credential | Where it lives |
|---|---|
| CDS API key | `~/.cdsapirc` (local) + HF Space secret `CDS_API_KEY` |
| Earthdata user / password | `~/.netrc` + `~/_netrc` (Windows dual form) + HF Space secrets `EARTHDATA_USER` / `EARTHDATA_PASSWORD` |
| CDSE OAuth client | `.env` `CDSE_CLIENT_ID` / `CDSE_CLIENT_SECRET` + HF Space secrets |
| EGMS service-account JWT key | `C:\Users\aleal\.droplet-secrets\egms_token.json` — **out-of-project, never committed** |
| Regolo API key | `.env` `REGOLO_API_KEY` + HF Space secret |
| Supabase keys | `.env` (publishable + secret + DB pooler URL) + HF Space secrets |
| Qdrant API key | `.env` `QDRANT_API_KEY` + HF Space secret |
| Neo4j AuraDB | `.env` `NEO4J_URI` / `NEO4J_PASSWORD` + HF Space secrets |

Secrets management principle: the project repository (on GitHub + Hugging Face Space git) contains only `.env.example` — real keys live only in (a) local `.env` (gitignored), (b) HF Space Settings → Variables and secrets, (c) GitHub Actions Secrets for nightly cron.

---

## 8. Citation block (use in hackathon submission)

> Copernicus Climate Change Service (C3S), 2023: ERA5 hourly data on single levels from 1940 to present. Copernicus Climate Change Service (C3S) Climate Data Store.
>
> European Space Agency, Copernicus Sentinel-2 L2A and Sentinel-3 SLSTR products. Accessed via Copernicus Data Space Ecosystem, 2026.
>
> NASA / JPL, ECOSTRESS Level 2 Tiled LST & Emissivity (ECO_L2T_LSTE.002) and Tiled Ancillary NDVI (ECO_L2T_STARS.002), NASA LP DAAC, 2026.
>
> European Environment Agency, European Ground Motion Service (EGMS), Copernicus Land Monitoring Service, Ortho product (vertical component), 2024/2025 release.
>
> Landerer, F. W. and S. V. Swenson, 2012. GRACE and GRACE-FO RL06 Mascon CRI Filtered Version 2, NASA JPL.
>
> Pekel, J.-F., Cottam, A., Gorelick, N., Belward, A. S., High-resolution mapping of global surface water and its long-term changes. Nature 540, 418–422, 2016 (JRC Global Surface Water).
>
> ISTAT — Censimento delle acque per uso civile 2020, Istituto Nazionale di Statistica, published 21 December 2022.
>
> ARERA — Relazione annuale sullo stato dei servizi e sull'attività svolta (multiple years).
>
> ISPRA — Annuario dei Dati Ambientali (multiple years).
>
> OpenStreetMap contributors, geometry data extracted via OSMnx, © ODbL.
>
> Lambert, A. O., et al. (2000). Accounting for real losses: IWA Water Loss Task Force framework.
>
> EPANET 2.2 hydraulic engine, US EPA, public domain.
