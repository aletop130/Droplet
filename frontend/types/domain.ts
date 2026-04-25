export type PhiValue = 0 | 1 | 2 | 3

export type GeoPoint = {
  type: "Point"
  coordinates: [number, number]
}

export type GeoLine = {
  type: "LineString"
  coordinates: [number, number][]
}

export type GeoPolygon = {
  type: "Polygon"
  coordinates: [number, number][][]
}

export type SegmentFeature = {
  type: "Feature"
  geometry: GeoLine
  properties: {
    id: number
    dma_id: number
    dma_name?: string | null
    phi: PhiValue
    phi_confidence?: number
    subsidence: number
    ndvi: number
    thermal: number
    hydraulic: number
    tank_signal: number
    material: string
    diameter_mm: number
    install_year?: number | null
    length_m?: number | null
    latest_ts?: string | null
    explanation?: string | null
    attrs?: Record<string, unknown>
  }
}

export type SegmentFeatureCollection = {
  type: "FeatureCollection"
  features: SegmentFeature[]
}

export type SegmentHistoryPoint = {
  ts: string
  subsidence: number
  ndvi: number
  thermal: number
  hydraulic: number
  tank_signal: number
  phi: number
}

export type SegmentIncident = {
  id: number
  severity: number
  title: string
  status: string
  updated_at: string
  entity_type: string
  entity_id: number
  pre_explanation?: string | null
  tags?: string[]
}

export type SegmentDetail = {
  segment: SegmentFeature
  scores: Record<"subsidence" | "ndvi" | "thermal" | "hydraulic" | "tank_signal" | "phi", number>
  history: SegmentHistoryPoint[]
  incidents: SegmentIncident[]
}

export type TankFeature = {
  type: "Feature"
  geometry: GeoPoint
  properties: {
    id: number
    name: string
    headroom_pct: number
    phi_signal?: PhiValue
    severity?: PhiValue
    capacity_m3?: number | null
    max_level_m?: number | null
    min_level_m?: number | null
    elevation_m?: number | null
    dma_id?: number | null
    dma_name?: string | null
    data_source?: string | null
    latest_ts?: string | null
    level_m?: number | null
    volume_m3?: number | null
    inflow_lps?: number | null
    outflow_lps?: number | null
    downstream_pressure_bar?: number | null
    residual_pct?: number | null
    balance_flag?: string | null
    anomaly_score?: number | null
    anomaly_detector?: string | null
    resilience_hours?: number | null
  }
}

export type TankFeatureCollection = {
  type: "FeatureCollection"
  features: TankFeature[]
}

export type TankNode = {
  id: number
  name: string
  type: "tank"
  x: number
  y: number
  lon?: number
  lat?: number
  fillLevel: number
  level_m: number
  max_level_m: number
  capacity_m3: number
  inflow_lps: number
  outflow_lps: number
  headroom_pct: number
  resilience_hours: number
  dma_id?: number | null
  dma_name?: string | null
  elevation_m?: number | null
  data_source?: string | null
  phi: PhiValue
  connectedPipes: number[]
}

export type PipeNode = {
  id: number
  type: "pipe"
  x: number
  y: number
  path?: [number, number][]
  flowRate: number
  maxFlow: number
  fillPercent: number
  material: string
  diameter_mm: number
  length_m: number
  phi: PhiValue
  subsidence: number
  ndvi: number
  thermal: number
  hydraulic: number
  tank_signal: number
  install_year?: number | null
  dma_id?: number | null
  dma_name?: string | null
  fromTank: number | null
  toTank: number | null
  fromNode?: number | null
  toNode?: number | null
}

export type NetworkEdge = {
  id: string
  from: string
  to: string
  pipe_id: number
}

export type NetworkArea = {
  id: number
  name: string
  pipe_count: number
  tank_count: number
  bounds?: GeoPolygon | null
}

export type NetworkGraph = {
  tanks: TankNode[]
  pipes: PipeNode[]
  edges: NetworkEdge[]
  area?: Pick<NetworkArea, "id" | "name"> | null
  totals?: {
    tanks: number
    pipes: number
    edges: number
  }
  generated_at?: string
}

export type TankStatePoint = {
  ts: string
  level_m: number
  volume_m3: number
  inflow_lps: number
  outflow_lps: number
  downstream_pressure_bar: number
}

export type TankBalanceRow = {
  day: string
  inflow_m3: number
  outflow_m3: number
  demand_m3?: number
  delta_volume_m3?: number
  residual_m3?: number
  residual_pct?: number
  flag?: string | null
}

export type TankAnomaly = {
  ts?: string
  severity?: number
  level?: string
  detector?: string
  reason?: string
  message?: string
}

export type TankKpis = {
  tank_id?: number
  headroom_pct?: number
  resilience_hours?: number
  turnover_h?: number
  residence_time_h?: number
  residual_pct?: number
  z_score?: number
  days_to_empty?: number
  days_to_full?: number
  spill_events_month?: number
}

export type TankBalanceSummary = {
  tank_id: number
  window_hours: number
  inflow_m3h: number
  outflow_m3h: number
  demand_m3h: number
  net_balance_m3h: number
  fill_rate_pcth: number
  delta_volume_m3: number
  residual_m3: number
  residual_pct: number
  flag?: string | null
}

export type TankDetail = {
  tank: TankFeature
  state_24h: TankStatePoint[]
  balance: TankBalanceSummary
  balance_series: TankBalanceRow[]
  anomalies: TankAnomaly[]
  downstream_segments: SegmentFeature[]
  related_segments?: number[]
  kpi: TankKpis
  kpis?: TankKpis
}

export type DMAFeature = {
  id: number
  name: string
  population: number
  operator: string
  geometry: GeoPolygon
}

export type DMABalance = {
  dma_id: number
  dma_name: string
  population: number
  month: string
  system_input_m3: number
  authorised_m3: number
  apparent_losses_m3: number
  real_losses_m3: number
  nrw_pct: number
  avg_phi: number
  segment_count: number
  network_length_m: number
}

export type SourceNode = {
  id: number
  name: string
  kind: string
  elevation_m: number
  attrs?: Record<string, unknown>
  geometry: GeoPoint
}

export type SourceAvailability = {
  pilot: string
  sources: SourceNode[]
  era5_precip_30d: Array<{ day_index: number; precip_mm: number }>
  grace_anomaly?: {
    value_mm_eq_water?: number
    zscore?: number
    narrative?: string
  }
  istat_panel?: Record<string, unknown>
}

export type ScarcityBand = {
  day: number
  expected: number
  lower: number
  upper: number
}

export type ScarcityForecast = {
  horizon_days: number
  bands: ScarcityBand[]
}

export type Incident = {
  id: number
  created_at: string
  updated_at: string
  entity_type: string
  entity_id: number
  severity: number
  detector_events: Array<Record<string, unknown>>
  tags: string[]
  title: string
  pre_explanation: string
  status: "open" | "investigating" | "resolved"
  assigned_to: string | null
  resolved_at: string | null
}

export type IncidentListResponse = {
  items: Incident[]
  total: number
}

export type AuditEntry = {
  id: number
  ts: string
  model: string
  purpose: string
  entity_type: string | null
  entity_id: number | null
  request_payload?: Record<string, unknown> | null
  response_text: string
  tool_calls?: unknown
  confidence: number
  operator_action: string | null
  latency_ms: number
  token_usage?: Record<string, unknown>
  citations?: Array<{ doc_id?: number; title?: string }>
}

export type AuditResponse = {
  items: AuditEntry[]
  total: number
}

export type ControlRecommendation = {
  id: number
  incident_id?: number | null
  entity_type: string
  entity_id: number
  parameter: string
  current_value?: number | null
  proposed_value?: number | null
  rationale: string
  expected_impact?: Record<string, number | string>
  confidence: number
  risk_flags?: string[]
  status: string
  approved_by?: string | null
  approved_at?: string | null
  created_at: string
}

export type ChatCitation = {
  audit_log_id: number
  doc_ids?: number[]
}

export type ChatStreamChunk = {
  token?: string
  done?: boolean
  error?: string
  error_type?: string
  citations?: ChatCitation[]
  audit_log_id?: number
  suggested_actions?: ControlRecommendation[]
}

export type ChatAgentMode = "operations" | "investments"

export type ChatAttachmentKind = "image" | "audio" | "document"

export type ChatAttachment = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  kind: ChatAttachmentKind
  data_url?: string
}

export type ExplainStreamChunk = {
  token?: string
  done?: boolean
  audit_log_id?: number
  citations?: ChatCitation[]
}

export type AreraIndicator = {
  code: "A1" | "A2" | "A3" | "A4" | "A5"
  label: string
  weight: number
  baseline: number
  target: number
  current: number
  impact_area: string
}

export type InvestmentOpportunityFeature = {
  type: "Feature"
  geometry: GeoPoint
  properties: {
    node_id: number
    falde_id: string
    profondita_m: number
    tipo_acqua: string
    consumo_storico: number
    rendimento_attuale: number
    intervento_priorita: "critical" | "warning" | "ok"
    estimated_cost_eur: number
    arera_roi_pct: number
    payback_years: number
    recommended_action: string
  }
}

export type InvestmentOverlay = {
  type: "FeatureCollection"
  features: InvestmentOpportunityFeature[]
  metadata?: {
    source?: string
    layers?: string[]
  }
}

export type InvestmentCalculatorInput = {
  capital_cost_eur: number
  line_length_m: number
  diameter_mm: number
  useful_life_years: number
  saved_consumption_m3_year: number
  avoided_losses_m3_year: number
  tariff_eur_m3: number
  water_value_eur_m3: number
  annual_maintenance_eur: number
  indicator_delta_a1: number
  indicator_delta_a2: number
}

export type InvestmentCalculatorResult = {
  annual_saving_eur: number
  total_spend_eur: number
  indicator_benefit_score: number
  estimated_arera_bonus_eur: number
  lifetime_benefit_eur: number
  roi_pct: number
  payback_years: number | null
  recommendation: "invest" | "review"
}

export type InvestmentStrategy = {
  summary: string
  roi_target_pct: number
  opportunities: InvestmentOpportunityFeature[]
  indicators: AreraIndicator[]
  disclaimer: string
}

export type CopernicusSource = "s2" | "s3"

export type CopernicusBbox = {
  west: number
  south: number
  east: number
  north: number
}

export type CopernicusProduct = {
  source: CopernicusSource
  source_name: string
  collection: string
  product_id: string
  ts: string
  bbox: CopernicusBbox
  cloud_cover_pct: number | null
  status: "pending" | "ingested" | "failed"
  file_url: string | null
  metrics: Record<string, number>
  provenance: Record<string, unknown>
  processed_at: string | null
}

export type CopernicusStatus = {
  status: string
  pilot: string
  bbox: CopernicusBbox
  coverage: {
    area: string
    crs: string
    sources: Record<CopernicusSource, {
      name: string
      collection: string
      resolution_m: number
      metrics: string[]
      refresh: string
    }>
  }
  openeo: {
    url: string
    enabled: boolean
    credentials_configured: boolean
  }
  last_fetch: string
  latest: CopernicusProduct[]
}

export type CopernicusHistory = {
  hours: number
  items: CopernicusProduct[]
}

export type CopernicusIngestResult = {
  accepted: boolean
  manual: boolean
  mode: "openeo" | "dry_run"
  errors: Array<{ source: string; message: string }>
  items: CopernicusProduct[]
  processed_at: string
}

export type PageContext = {
  route?: string
  entity_type?: "segment" | "tank" | "dma" | "incident" | null
  entity_id?: number | null
}

export type CeccanoStatus = "normal" | "critical" | "emergency"

export type CeccanoOverview = {
  network: string
  center: { lat: number; lon: number }
  counts: {
    districts: number
    valves: number
    reservoirs: number
    conduits: number
    sensors: number
    users: number
  }
  status: {
    critical: number
    emergency: number
    normal: number
    avg_pressure_bar: number
    avg_loss_pct: number
    db_load_pct: number
    night_mode: boolean
  }
  targets: Record<string, number>
  ai_summary: string
  updated_at: string
}

export type CeccanoDistrict = {
  id: string
  name: string
  zone: "ALTO" | "CENTRO" | "BASSA" | "PIANO"
  altitude_min_m: number
  altitude_max_m: number
  territory_km2: number
  users: number
  consumption_m3_day: number
  pressure_target_bar: number
  pressure_actual_bar: number
  loss_pct: number
  loss_day_pct: number
  status: CeccanoStatus
  issue: string
  quality_rating: number
  water_efficacy_pct: number
  moisture_percentage: number
  humidity_avg: number
  araise_rank: number
  violations: number
  geometry: GeoPolygon
}

export type CeccanoValve = {
  valve_id: string
  district_id: string
  zone: string
  altitude_m: number
  type: "day" | "night"
  name: string
  loc_pos_x: number
  loc_pos_y: number
  posxx: number
  posyy: number
  target_curve: string
  target_night: string
  stat_today_pct: number
  stat_night_pct: number
  flow_today_m3h: number
  flow_night_m3h: number
  recommended_open_pct: number
}

export type CeccanoReservoir = {
  id: string
  name: string
  district_id: string
  capacity_m3: number
  level_pct: number
  elevation_m: number
  age_years: number
  maintenance_due: string
  coordinates: [number, number]
}

export type CeccanoPressureMetric = {
  district_id: string
  zone: string
  target_bar: number
  actual_bar: number
  calculated_bar: number
  delta_bar: number
  status: "low" | "ok"
}

export type CeccanoForecastPoint = {
  ts: string
  expected_flow_m3h: number
  expected_pressure_bar: number
  risk_score: number
}

export type CeccanoForecast = {
  horizon_hours: number
  points: CeccanoForecastPoint[]
  bottlenecks: Array<{ district_id: string; hour_window: string; risk: string }>
}

export type CeccanoAdjustResult = {
  accepted: boolean
  valve_id: string
  district_id: string
  previous_open_pct: number
  target_open_pct: number
  expected_pressure_bar: number
  expected_flow_m3h: number
  rationale: string
  audit: { operator_id: string; mode?: string | null; created_at: string }
}

export type CeccanoAnalysis = {
  overview: CeccanoOverview
  districts: CeccanoDistrict[]
  valves: CeccanoValve[]
  reservoirs: CeccanoReservoir[]
  pressure: CeccanoPressureMetric[]
  forecast: CeccanoForecast
}
