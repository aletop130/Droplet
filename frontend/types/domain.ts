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

export type TankStatePoint = {
  ts: string
  level_m: number
  volume_m3: number
  inflow_lps: number
  outflow_lps: number
  downstream_pressure_bar: number
}

export type TankBalanceRow = {
  ts: string
  inflow_lps: number
  outflow_lps: number
  estimated_demand_lps?: number
  delta_storage_lps?: number
  residual_lps?: number
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
  headroom_pct?: number
  resilience_hours?: number
  level_m?: number
  volume_m3?: number
  inflow_lps?: number
  outflow_lps?: number
  residual_pct?: number
}

export type TankDetail = {
  tank: TankFeature
  state_24h: TankStatePoint[]
  balance: TankBalanceRow[]
  anomalies: TankAnomaly[]
  downstream_segments: SegmentFeature[]
  kpis: TankKpis
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

export type SearchOmniResult = {
  type: "segment" | "tank" | "dma" | "incident" | "audit"
  id: number
  label: string
}

export type ChatCitation = {
  audit_log_id: number
  doc_ids?: number[]
}

export type ChatStreamChunk = {
  token?: string
  done?: boolean
  citations?: ChatCitation[]
  audit_log_id?: number
  suggested_actions?: ControlRecommendation[]
}

export type ExplainStreamChunk = {
  token?: string
  done?: boolean
  audit_log_id?: number
  citations?: ChatCitation[]
}

export type PageContext = {
  route?: string
  entity_type?: "segment" | "tank" | "dma" | "incident" | null
  entity_id?: number | null
}
