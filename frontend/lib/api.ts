import type {
  AuditResponse,
  AreraIndicator,
  CeccanoAdjustResult,
  CeccanoAnalysis,
  CeccanoDistrict,
  CeccanoForecast,
  CeccanoOverview,
  CeccanoPressureMetric,
  CeccanoReservoir,
  CeccanoValve,
  ChatAgentMode,
  ChatAttachment,
  ChatStreamChunk,
  CopernicusHistory,
  CopernicusIngestResult,
  CopernicusProduct,
  CopernicusStatus,
  ControlRecommendation,
  DMABalance,
  DMAFeature,
  ExplainStreamChunk,
  InvestmentCalculatorInput,
  InvestmentCalculatorResult,
  InvestmentOverlay,
  InvestmentStrategy,
  IncidentListResponse,
  NetworkArea,
  NetworkGraph,
  PageContext,
  ScarcityForecast,
  SegmentDetail,
  SegmentFeatureCollection,
  SourceAvailability,
  TankDetail,
  TankFeatureCollection
} from "@/types/domain"
import { streamSseJson } from "@/lib/sse"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://Alessandro0709-Droplet.hf.space"
export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "wss://Alessandro0709-Droplet.hf.space"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type QueryValue = string | number | boolean | null | undefined

export const defaultInvestmentInput: InvestmentCalculatorInput = {
  capital_cost_eur: 840000,
  line_length_m: 742,
  diameter_mm: 250,
  useful_life_years: 30,
  saved_consumption_m3_year: 56000,
  avoided_losses_m3_year: 112000,
  tariff_eur_m3: 1.72,
  water_value_eur_m3: 0.68,
  annual_maintenance_eur: 18000,
  indicator_delta_a1: 0.07,
  indicator_delta_a2: 0.09
}

const fallbackAreraIndicators: AreraIndicator[] = [
  {
    code: "A1",
    label: "Network yield",
    weight: 0.25,
    baseline: 0.58,
    target: 0.72,
    current: 0.61,
    impact_area: "technical losses and district metering gaps"
  },
  {
    code: "A2",
    label: "Water losses",
    weight: 0.3,
    baseline: 0.69,
    target: 0.52,
    current: 0.65,
    impact_area: "priority renewal and pressure stabilization"
  },
  {
    code: "A3",
    label: "Supply interruptions",
    weight: 0.15,
    baseline: 0.41,
    target: 0.3,
    current: 0.38,
    impact_area: "source redundancy near high-demand corridors"
  },
  {
    code: "A4",
    label: "Zone pressure",
    weight: 0.1,
    baseline: 0.46,
    target: 0.58,
    current: 0.51,
    impact_area: "DMA pressure rebalancing and valve control"
  },
  {
    code: "A5",
    label: "Water quality",
    weight: 0.2,
    baseline: 0.67,
    target: 0.78,
    current: 0.7,
    impact_area: "source protection and low-residence-time routing"
  }
]

const fallbackInvestmentOverlay: InvestmentOverlay = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [13.432, 41.668] },
      properties: {
        node_id: 1482,
        falde_id: "FALDA-LIRI-01",
        profondita_m: 34,
        tipo_acqua: "spring/well blend",
        consumo_storico: 920000,
        rendimento_attuale: 0.58,
        intervento_priorita: "critical",
        estimated_cost_eur: 840000,
        arera_roi_pct: 34.8,
        payback_years: 5.4,
        recommended_action: "New well tie-in plus 742 m pipe renewal in DMA-1"
      }
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [13.486, 41.596] },
      properties: {
        node_id: 1501,
        falde_id: "FALDA-SACCO-03",
        profondita_m: 22,
        tipo_acqua: "shallow aquifer",
        consumo_storico: 610000,
        rendimento_attuale: 0.64,
        intervento_priorita: "warning",
        estimated_cost_eur: 420000,
        arera_roi_pct: 28.1,
        payback_years: 6.1,
        recommended_action: "Source protection and pressure control on southern feeder"
      }
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [13.538, 41.684] },
      properties: {
        node_id: 1483,
        falde_id: "FALDA-ERNICI-02",
        profondita_m: 61,
        tipo_acqua: "deep aquifer",
        consumo_storico: 770000,
        rendimento_attuale: 0.55,
        intervento_priorita: "critical",
        estimated_cost_eur: 1180000,
        arera_roi_pct: 25.9,
        payback_years: 7.2,
        recommended_action: "Deep well feasibility, storage buffer and critical pipe replacement"
      }
    }
  ],
  metadata: {
    source: "frontend_fallback",
    layers: ["gis_network", "hydrogeology", "consumption_hotspots", "intervention_points"]
  }
}

function buildCopernicusProduct(source: "s2" | "s3", offsetHours = 0): CopernicusProduct {
  const ts = new Date(Date.now() - offsetHours * 3600000)
  ts.setMinutes(0, 0, 0)
  const seasonal = Math.sin(((offsetHours + 90) / 365) * Math.PI * 2)
  const isS2 = source === "s2"
  return {
    source,
    source_name: isS2 ? "Sentinel-2 L2A" : "Sentinel-3 SLSTR L2 LST",
    collection: isS2 ? "SENTINEL2_L2A" : "SENTINEL3_SLSTR_L2_LST",
    product_id: `${source.toUpperCase()}-CIOCIARIA-${ts.toISOString().slice(0, 13).replace(/[-T:]/g, "")}`,
    ts: ts.toISOString(),
    bbox: { west: 13.2, south: 41.4, east: 13.8, north: 41.9 },
    cloud_cover_pct: isS2 ? 12.4 + (offsetHours % 5) * 3.1 : null,
    status: "ingested",
    file_url: null,
    processed_at: ts.toISOString(),
    metrics: isS2
      ? {
          ndvi_mean: Number((0.48 + seasonal * 0.12).toFixed(3)),
          ndvi_min: Number((0.2 + seasonal * 0.04).toFixed(3)),
          ndvi_max: Number((0.78 + seasonal * 0.03).toFixed(3)),
          ndwi_mean: Number((0.09 + seasonal * 0.03).toFixed(3)),
          ndwi_min: Number((-0.14 + seasonal * 0.02).toFixed(3)),
          ndwi_max: Number((0.33 + seasonal * 0.02).toFixed(3))
        }
      : {
          lst_c_mean: Number((23.5 + seasonal * 7.5 + (offsetHours % 24) * 0.08).toFixed(2)),
          lst_c_min: Number((18.2 + seasonal * 6.7).toFixed(2)),
          lst_c_max: Number((30.1 + seasonal * 8.1).toFixed(2))
        },
    provenance: { mode: "frontend_fallback" }
  }
}

const fallbackCopernicusStatus: CopernicusStatus = {
  status: "ok",
  pilot: "Ciociaria",
  bbox: { west: 13.2, south: 41.4, east: 13.8, north: 41.9 },
  coverage: {
    area: "Frosinone / Ciociaria",
    crs: "EPSG:4326",
    sources: {
      s2: {
        name: "Sentinel-2 L2A",
        collection: "SENTINEL2_L2A",
        resolution_m: 10,
        metrics: ["ndvi", "ndwi"],
        refresh: "hourly"
      },
      s3: {
        name: "Sentinel-3 SLSTR L2 LST",
        collection: "SENTINEL3_SLSTR_L2_LST",
        resolution_m: 1000,
        metrics: ["lst_c"],
        refresh: "hourly"
      }
    }
  },
  openeo: {
    url: "https://openeo.dataspace.copernicus.eu",
    enabled: false,
    credentials_configured: false
  },
  last_fetch: new Date().toISOString(),
  latest: [buildCopernicusProduct("s2"), buildCopernicusProduct("s3")]
}

const fallbackCeccanoDistricts: CeccanoDistrict[] = Array.from({ length: 15 }, (_, index) => {
  const n = index + 1
  const id = `CED-${String(n).padStart(2, "0")}`
  const critical: Partial<CeccanoDistrict> =
    id === "CED-04"
      ? { loss_pct: 68, pressure_actual_bar: 1.8, loss_day_pct: 45, status: "critical", issue: "High leakage and corrosion across 1500 m of network" }
      : id === "CED-07"
        ? { loss_pct: 52, pressure_actual_bar: 2.1, loss_day_pct: 38, status: "emergency", issue: "Broken pipes across roughly 200 m" }
        : id === "CED-12"
          ? { loss_pct: 74, pressure_actual_bar: 1.2, loss_day_pct: 52, status: "critical", issue: "Pipe break with pressure outside threshold" }
          : id === "CED-15"
            ? { loss_pct: 89, pressure_actual_bar: 0.8, loss_day_pct: 28, status: "emergency", issue: "East zone with widespread leaks and weak geological stability" }
            : {}
  const zone = n <= 5 ? "HIGH" : n <= 10 ? "CENTER" : n <= 13 ? "LOW" : "PLAIN"
  const target = zone === "HIGH" ? 3 : zone === "CENTER" ? 3.5 : zone === "LOW" ? 4.5 : 5
  const lon = 13.5647 + Math.cos((index / 15) * Math.PI * 2) * 0.03
  const lat = 41.4925 + Math.sin((index / 15) * Math.PI * 2) * 0.02
  return {
    id,
    name: `Ceccano District ${String(n).padStart(2, "0")}`,
    zone,
    altitude_min_m: zone === "HIGH" ? 420 : zone === "CENTER" ? 350 : zone === "LOW" ? 280 : 250,
    altitude_max_m: zone === "HIGH" ? 520 : zone === "CENTER" ? 450 : zone === "LOW" ? 360 : 290,
    territory_km2: 1.2 + n * 0.18,
    users: 520 + n * 95,
    consumption_m3_day: 430 + n * 38,
    pressure_target_bar: target,
    pressure_actual_bar: critical.pressure_actual_bar ?? Number((target + ((n % 3) - 1) * 0.22).toFixed(2)),
    loss_pct: critical.loss_pct ?? (8 + (n * 3) % 11),
    loss_day_pct: critical.loss_day_pct ?? 9,
    status: critical.status ?? "normal",
    issue: critical.issue ?? "Stable pressure and losses inside control band",
    quality_rating: 8.1,
    water_efficacy_pct: 100 - (critical.loss_pct ?? (8 + (n * 3) % 11)),
    moisture_percentage: 28,
    humidity_avg: 55,
    araise_rank: n,
    violations: critical.status ? 1 : 0,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lon - 0.008, lat - 0.006],
        [lon + 0.008, lat - 0.006],
        [lon + 0.008, lat + 0.006],
        [lon - 0.008, lat + 0.006],
        [lon - 0.008, lat - 0.006]
      ]]
    }
  }
})

const fallbackCeccanoValves: CeccanoValve[] = fallbackCeccanoDistricts.map((district, index) => {
  const n = index + 1
  return {
    valve_id: `CEV-${String(n).padStart(2, "0")}`,
    district_id: district.id,
    zone: district.zone,
    altitude_m: Math.round((district.altitude_min_m + district.altitude_max_m) / 2),
    type: n <= 10 ? "day" : "night",
    name: `Valve ${district.id}`,
    loc_pos_x: district.geometry.coordinates[0][0][0],
    loc_pos_y: district.geometry.coordinates[0][0][1],
    posxx: 0.2 + n * 0.07,
    posyy: 0.4 + n * 0.05,
    target_curve: `${district.zone.toLowerCase()}-day`,
    target_night: `${district.zone.toLowerCase()}-night`,
    stat_today_pct: district.status === "normal" ? 80 : 55,
    stat_night_pct: district.status === "normal" ? 40 : 34,
    flow_today_m3h: district.status === "normal" ? 1500 - n * 18 : 980,
    flow_night_m3h: district.status === "normal" ? 300 + n * 3 : 260,
    recommended_open_pct: district.id === "CED-12" ? 45 : district.status === "normal" ? 80 : 68
  }
})

const fallbackCeccanoReservoirs: CeccanoReservoir[] = fallbackCeccanoDistricts.map((district, index) => ({
  id: `CER-${String(index + 1).padStart(2, "0")}`,
  name: `Ceccano Reservoir ${String(index + 1).padStart(2, "0")}`,
  district_id: district.id,
  capacity_m3: 900 + (index + 1) * 140,
  level_pct: 84 - ((index + 1) * 3) % 31,
  elevation_m: district.altitude_max_m,
  age_years: 8 + ((index + 1) * 2) % 34,
  maintenance_due: district.status === "normal" ? "2026-10-01" : "2026-05-15",
  coordinates: [district.geometry.coordinates[0][1][0], district.geometry.coordinates[0][1][1]]
}))

const fallbackCeccanoOverview: CeccanoOverview = {
  network: "Ceccano Water Network",
  center: { lat: 41.4925, lon: 13.5647 },
  counts: { districts: 15, valves: 15, reservoirs: 15, conduits: 25, sensors: 40, users: 120 },
  status: { critical: 2, emergency: 2, normal: 11, avg_pressure_bar: 3.08, avg_loss_pct: 29.1, db_load_pct: 63, night_mode: true },
  targets: { HIGH: 3, CENTER: 3.5, LOW: 4.5, PLAIN: 5 },
  ai_summary: "4 districts exceed the 50% loss threshold. Prioritize CED-12 and CED-15, then rebalance CED-04 through partial valve closure.",
  updated_at: new Date().toISOString()
}

const fallbackCeccanoForecast: CeccanoForecast = {
  horizon_hours: 24,
  points: Array.from({ length: 24 }, (_, hour) => ({
    ts: new Date(Date.now() + hour * 3600000).toISOString(),
    expected_flow_m3h: 700 + hour * 18,
    expected_pressure_bar: Number((2.2 + Math.sin(hour / 24 * Math.PI) * 2.1).toFixed(2)),
    risk_score: Number((0.28 + Math.sin(hour / 24 * Math.PI) * 0.5).toFixed(2))
  })),
  bottlenecks: [
    { district_id: "CED-12", hour_window: "07:00-10:00", risk: "critical" },
    { district_id: "CED-15", hour_window: "20:00-23:00", risk: "high" }
  ]
}

function buildCeccanoFallback(): CeccanoAnalysis {
  const pressure: CeccanoPressureMetric[] = fallbackCeccanoDistricts.map((district) => ({
    district_id: district.id,
    zone: district.zone,
    target_bar: district.pressure_target_bar,
    actual_bar: district.pressure_actual_bar,
    calculated_bar: district.pressure_actual_bar,
    delta_bar: Number((district.pressure_actual_bar - district.pressure_target_bar).toFixed(2)),
    status: district.pressure_actual_bar < district.pressure_target_bar - 0.6 ? "low" : "ok"
  }))
  return {
    overview: fallbackCeccanoOverview,
    districts: fallbackCeccanoDistricts,
    valves: fallbackCeccanoValves,
    reservoirs: fallbackCeccanoReservoirs,
    pressure,
    forecast: fallbackCeccanoForecast
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(path, API_BASE)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

async function fetchJson<T>(path: string, init?: RequestInit, query?: Record<string, QueryValue>): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers: {
      Accept: "application/json, application/geo+json",
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(`${path} returned ${response.status}${message ? `: ${message}` : ""}`)
  }

  return response.json() as Promise<T>
}

export function getSegments(bbox?: string, dma?: number) {
  return fetchJson<SegmentFeatureCollection>("/api/segments", undefined, { bbox, dma })
}

export function getSegment(id: number, init?: RequestInit) {
  return fetchJson<SegmentDetail>(`/api/segments/${id}`, init)
}

export function getTanks(dma?: number) {
  return fetchJson<TankFeatureCollection>("/api/tanks", undefined, { dma })
}

export function getNetworkGraph(areaId?: number) {
  return fetchJson<NetworkGraph>("/api/network/graph", undefined, { area_id: areaId })
}

export async function getNetworkAreas() {
  const payload = await fetchJson<{ items: NetworkArea[] }>("/api/network/areas")
  return payload.items
}

export function getTank(id: number, init?: RequestInit) {
  return fetchJson<TankDetail>(`/api/tanks/${id}`, init)
}

export async function getDMAs() {
  const dmas = await fetchJson<DMAFeature[]>("/api/dmas")
  return dmas
}

export async function getDMA(id: number) {
  const dmas = await getDMAs()
  const dma = dmas.find((item) => item.id === id)
  if (!dma) {
    throw new Error(`DMA ${id} not found`)
  }
  return dma
}

export function getDMABalance(id: number, month?: string) {
  return fetchJson<DMABalance>(`/api/dmas/${id}/balance`, undefined, { month })
}

export function getIncidents(filters?: Record<string, QueryValue>) {
  return fetchJson<IncidentListResponse>("/api/incidents", undefined, filters)
}

export function getAudit(filters?: Record<string, QueryValue>) {
  return fetchJson<AuditResponse>("/api/audit", undefined, filters)
}

export function getSourceAvailability() {
  return fetchJson<SourceAvailability>("/api/source/availability")
}

export function getScarcityForecast(days: 30 | 60 | 90) {
  return fetchJson<ScarcityForecast>("/api/source/scarcity-forecast", undefined, {
    horizon_days: days
  })
}

export async function getDailyDigest() {
  return fetchJson<{
    day: string
    trend_summary: string
    top_incidents: Array<{ incident_id: number; severity: number }>
    intervention_recs: Array<{ id: number; text: string }>
  }>("/api/daily-digest/today")
}

export async function getControlRecs() {
  const payload = await fetchJson<{ items: ControlRecommendation[] }>("/api/control-recommendations")
  return payload.items
}

export async function approveControlRec(id: number) {
  return fetchJson(`/api/control-recommendations/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operator_id: "operator" satisfies JsonValue })
  })
}

export async function rejectControlRec(id: number, reason = "Rejected by operator") {
  return fetchJson(`/api/control-recommendations/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operator_id: "operator", reason } satisfies JsonValue)
  })
}

export async function postChat(
  message: string,
  pageContext: PageContext,
  sessionId: string,
  agentMode: ChatAgentMode = "operations",
  attachments: ChatAttachment[] = []
) {
  return streamSseJson<ChatStreamChunk>(buildUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      page_context: pageContext,
      session_id: sessionId,
      agent_mode: agentMode,
      attachments: attachments as unknown as JsonValue
    } satisfies JsonValue)
  })
}

export async function getExplainStream(entityType: "segment" | "tank", entityId: number) {
  return streamSseJson<ExplainStreamChunk>(buildUrl(`/api/explain/${entityType}/${entityId}`))
}

export async function getLiveSeries(entityType: "segment" | "tank", id: number) {
  return entityType === "tank" ? (await getTank(id)).state_24h : (await getSegment(id)).history
}

export async function getHistoricSeries(entityType: "segment" | "tank", id: number) {
  return getLiveSeries(entityType, id)
}

export async function getAreraIndicators() {
  return fetchJson<{ items: AreraIndicator[] }>("/api/investments/arera-indicators")
    .then((payload) => payload.items)
    .catch(() => fallbackAreraIndicators)
}

export async function getInvestmentOverlay() {
  return fetchJson<InvestmentOverlay>("/api/gis/overlay").catch(() => fallbackInvestmentOverlay)
}

export async function calculateInvestment(input: InvestmentCalculatorInput): Promise<InvestmentCalculatorResult> {
  return fetchJson<InvestmentCalculatorResult>("/api/investments/calculator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input as unknown as JsonValue)
  }).catch(() => calculateInvestmentFallback(input))
}

export async function getInvestmentStrategy(roiTargetPct = 25) {
  return fetchJson<InvestmentStrategy>("/api/investments/strategy", {
    method: "POST"
  }, { roi_target_pct: roiTargetPct }).catch(() => ({
    summary: "Prioritize high-consumption nodes where hydrogeology and network losses improve ARERA quality indicators.",
    roi_target_pct: roiTargetPct,
    opportunities: fallbackInvestmentOverlay.features.filter(
      (feature) => feature.properties.arera_roi_pct >= roiTargetPct
    ),
    indicators: fallbackAreraIndicators,
    disclaimer: "Hackathon mode: estimates use public or simulated data and require validation before production decisions."
  }))
}

export async function getCopernicusStatus() {
  return fetchJson<CopernicusStatus>("/api/copernicus/status").catch(() => fallbackCopernicusStatus)
}

export async function getCopernicusHistory(hours = 24) {
  return fetchJson<CopernicusHistory>("/api/copernicus/history", undefined, { hours }).catch(() => ({
    hours,
    items: Array.from({ length: Math.min(hours, 24) }, (_, index) => [
      buildCopernicusProduct("s2", index),
      buildCopernicusProduct("s3", index)
    ]).flat()
  }))
}

export async function triggerCopernicusIngest() {
  return fetchJson<CopernicusIngestResult>("/api/copernicus/ingest", { method: "POST" }).catch(() => ({
    accepted: true,
    manual: true,
    mode: "dry_run" as const,
    errors: [],
    items: [buildCopernicusProduct("s2"), buildCopernicusProduct("s3")],
    processed_at: new Date().toISOString()
  }))
}

export async function getCeccanoAnalysis(): Promise<CeccanoAnalysis> {
  return Promise.all([
    fetchJson<CeccanoOverview>("/api/ceccano/overview"),
    fetchJson<{ items: CeccanoDistrict[] }>("/api/ceccano/distretti"),
    fetchJson<{ items: CeccanoValve[] }>("/api/ceccano/valves"),
    fetchJson<{ items: CeccanoReservoir[] }>("/api/ceccano/reservoirs"),
    fetchJson<{ items: CeccanoPressureMetric[] }>("/api/ceccano/bar"),
    fetchJson<CeccanoForecast>("/api/ceccano/forecast")
  ])
    .then(([overview, districts, valves, reservoirs, pressure, forecast]) => ({
      overview: normalizeCeccanoOverview(overview),
      districts: districts.items.map(normalizeCeccanoDistrict),
      valves: valves.items.map(normalizeCeccanoValve),
      reservoirs: reservoirs.items.map(normalizeCeccanoReservoir),
      pressure: pressure.items,
      forecast
    }))
    .catch(() => buildCeccanoFallback())
}

function normalizeCeccanoZone(zone: string): CeccanoDistrict["zone"] {
  if (zone === "ALTO") return "HIGH"
  if (zone === "CENTRO") return "CENTER"
  if (zone === "BASSA") return "LOW"
  if (zone === "PIANO") return "PLAIN"
  return zone as CeccanoDistrict["zone"]
}

function normalizeCeccanoText(value: string) {
  return value
    .replaceAll("Perdite elevate e corrosione su 1500 m di rete", "High leakage and corrosion across 1500 m of network")
    .replaceAll("Condotte rotte per circa 200 m", "Broken pipes across roughly 200 m")
    .replaceAll("Rottura pipe con pressione fuori soglia", "Pipe break with pressure outside threshold")
    .replaceAll("Zona est con perdite diffuse e stabilita geologica debole", "East zone with widespread leaks and weak geological stability")
    .replaceAll("Serbatoio Ceccano", "Ceccano Reservoir")
    .replaceAll("Valvola", "Valve")
    .replaceAll("Distretto Ceccano", "Ceccano District")
}

function normalizeCeccanoOverview(overview: CeccanoOverview): CeccanoOverview {
  return {
    ...overview,
    targets: Object.fromEntries(Object.entries(overview.targets).map(([zone, target]) => [normalizeCeccanoZone(zone), target])),
    ai_summary: normalizeCeccanoText(overview.ai_summary)
  }
}

function normalizeCeccanoDistrict(district: CeccanoDistrict): CeccanoDistrict {
  return {
    ...district,
    name: normalizeCeccanoText(district.name),
    zone: normalizeCeccanoZone(district.zone),
    issue: normalizeCeccanoText(district.issue)
  }
}

function normalizeCeccanoValve(valve: CeccanoValve): CeccanoValve {
  const zone = normalizeCeccanoZone(valve.zone)
  return {
    ...valve,
    zone,
    name: normalizeCeccanoText(valve.name),
    target_curve: `${zone.toLowerCase()}-day`,
    target_night: `${zone.toLowerCase()}-night`
  }
}

function normalizeCeccanoReservoir(reservoir: CeccanoReservoir): CeccanoReservoir {
  return {
    ...reservoir,
    name: normalizeCeccanoText(reservoir.name)
  }
}

export async function adjustCeccanoValve(valveId: string, targetOpenPct: number): Promise<CeccanoAdjustResult> {
  return fetchJson<CeccanoAdjustResult>("/api/ceccano/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valve_id: valveId,
      target_open_pct: targetOpenPct,
      operator_id: "operator",
      reason: "Ceccano analysis UI adjustment"
    } satisfies JsonValue)
  }).catch(() => {
    const valve = fallbackCeccanoValves.find((item) => item.valve_id === valveId) ?? fallbackCeccanoValves[0]
    return {
      accepted: true,
      valve_id: valve.valve_id,
      district_id: valve.district_id,
      previous_open_pct: valve.stat_today_pct,
      target_open_pct: targetOpenPct,
      expected_pressure_bar: Number((3 + (targetOpenPct - valve.stat_today_pct) / 100).toFixed(2)),
      expected_flow_m3h: Number((valve.flow_today_m3h * targetOpenPct / Math.max(1, valve.stat_today_pct)).toFixed(1)),
      rationale: `Adjusting ${valve.valve_id} toward ${targetOpenPct}% in fallback demo mode.`,
      audit: { operator_id: "operator", mode: valve.type, created_at: new Date().toISOString() }
    }
  })
}

function calculateInvestmentFallback(input: InvestmentCalculatorInput): InvestmentCalculatorResult {
  const annualSaving =
    input.saved_consumption_m3_year * input.tariff_eur_m3 +
    input.avoided_losses_m3_year * input.water_value_eur_m3
  const totalSpend = input.capital_cost_eur + input.annual_maintenance_eur * input.useful_life_years
  const indicatorBenefit = input.indicator_delta_a1 * 0.25 + input.indicator_delta_a2 * 0.3
  const estimatedAreraBonus = indicatorBenefit * input.capital_cost_eur
  const lifetimeBenefit = annualSaving * input.useful_life_years + estimatedAreraBonus
  const roiPct = totalSpend ? (lifetimeBenefit / totalSpend) * 100 : 0
  const paybackYears = annualSaving ? totalSpend / annualSaving : null

  return {
    annual_saving_eur: Math.round(annualSaving),
    total_spend_eur: Math.round(totalSpend),
    indicator_benefit_score: Number(indicatorBenefit.toFixed(4)),
    estimated_arera_bonus_eur: Math.round(estimatedAreraBonus),
    lifetime_benefit_eur: Math.round(lifetimeBenefit),
    roi_pct: Number(roiPct.toFixed(2)),
    payback_years: paybackYears === null ? null : Number(paybackYears.toFixed(2)),
    recommendation: roiPct >= 25 ? "invest" : "review"
  }
}
