import type {
  AuditResponse,
  ChatStreamChunk,
  ControlRecommendation,
  DMABalance,
  DMAFeature,
  ExplainStreamChunk,
  IncidentListResponse,
  PageContext,
  ScarcityForecast,
  SearchOmniResult,
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
    cache: "no-store",
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

export function getSegment(id: number) {
  return fetchJson<SegmentDetail>(`/api/segments/${id}`)
}

export function getTanks(dma?: number) {
  return fetchJson<TankFeatureCollection>("/api/tanks", undefined, { dma })
}

export function getTank(id: number) {
  return fetchJson<TankDetail>(`/api/tanks/${id}`)
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

export async function postChat(message: string, pageContext: PageContext, sessionId: string) {
  return streamSseJson<ChatStreamChunk>(buildUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      page_context: pageContext,
      session_id: sessionId
    } satisfies JsonValue)
  })
}

export async function postSearchOmni(query: string) {
  const payload = await fetchJson<{ query: string; results: SearchOmniResult[] }>("/api/search-omni", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query } satisfies JsonValue)
  })
  return payload.results
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
