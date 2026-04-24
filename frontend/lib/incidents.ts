import { API_BASE } from "@/lib/api"

export async function getIncidents(severity?: number, status?: string) {
  const params = new URLSearchParams()
  if (severity) params.set("severity", String(severity))
  if (status) params.set("status", status)

  const response = await fetch(`${API_BASE}/api/incidents?${params}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  })

  if (!response.ok) {
    throw new Error(`Incidents API returned ${response.status}`)
  }

  return response.json() as Promise<{ items: Incident[]; total: number }>
}

export type Incident = {
  id: number
  created_at: string
  updated_at: string
  entity_type: string
  entity_id: number
  severity: number
  detector_events: string[]
  tags: string[]
  title: string
  pre_explanation: string
  status: "open" | "investigating" | "resolved"
  assigned_to: string | null
  resolved_at: string | null
}