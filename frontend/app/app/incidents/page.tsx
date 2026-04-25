"use client"

import { useEffect, useMemo, useState } from "react"

import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { useAlertsStore } from "@/store/alertsStore"
import { useDataStore } from "@/store/dataStore"
import type { ControlRecommendation, Incident } from "@/types/domain"

function incidentExplanation(incident: Incident) {
  const templates = [
    `Pressure and flow signals point to ${incident.entity_type} ${incident.entity_id}; verify the closest valve state before dispatch.`,
    `Night-flow drift is stronger than the recent baseline around ${incident.entity_type} ${incident.entity_id}; prioritize field acoustic checks.`,
    `The event combines hydraulic stress with a recent sensor deviation on ${incident.entity_type} ${incident.entity_id}; inspect telemetry quality first.`,
    `Repeated alarms are clustered near ${incident.entity_type} ${incident.entity_id}; isolate the service branch and compare upstream pressure.`,
    `Severity ${incident.severity} suggests a localized operating issue on ${incident.entity_type} ${incident.entity_id}; schedule a targeted crew check.`
  ]

  if (incident.tags?.some((tag) => tag.toLowerCase().includes("tank"))) {
    return `Storage behavior is unstable around tank ${incident.entity_id}; check headroom, inflow continuity and downstream demand before changing controls.`
  }

  if (incident.title.toLowerCase().includes("perdita")) {
    return `Leak likelihood is elevated around ${incident.entity_type} ${incident.entity_id}; combine pressure drop, night flow and nearby work orders.`
  }

  return templates[Math.abs(incident.id) % templates.length]
}

export default function IncidentsPage() {
  const incidentsData = useDataStore((state) => state.incidents)
  const controlRecs = useDataStore((state) => state.controlRecs)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const fetchControlRecs = useDataStore((state) => state.fetchControlRecs)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState<Incident | null>(null)
  const [recs, setRecs] = useState<ControlRecommendation[]>([])
  const [tab, setTab] = useState<"all" | "open" | "resolved">("all")
  const [search, setSearch] = useState("")
  const liveEvents = useAlertsStore((state) => state.events)

  useEffect(() => {
    void fetchCore()
    void fetchControlRecs()
  }, [fetchControlRecs, fetchCore])

  useEffect(() => {
    if (incidentsData) setIncidents(incidentsData)
  }, [incidentsData])

  useEffect(() => {
    if (controlRecs) setRecs(controlRecs)
  }, [controlRecs])

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      if (tab !== "all" && incident.status !== tab) return false
      if (search && !`${incident.title} ${incident.entity_type} ${incident.entity_id}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [incidents, search, tab])

  const selectedExplanation = selected ? incidentExplanation(selected) : null

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-4xl">
          <div className="text-data text-[var(--acea-cyan)]">Incidents</div>
          <h1 className="text-page-title mt-2">Triage queue with explanations and traceable control recommendations.</h1>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "resolved"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-3 py-1 text-data ${tab === item ? "border-[rgba(75,214,255,0.24)] text-[var(--acea-cyan)]" : "border-[rgba(173,218,255,0.12)] text-[var(--text-lo)]"}`}
          >
            {item === "open" ? "investigating" : item}
          </button>
        ))}
        <div className="ml-auto w-full max-w-xs">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by entity or title" />
        </div>
      </div>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-2">
          {filtered.map((incident, index) => (
            <button
              key={incident.id}
              type="button"
              onClick={() => setSelected(incident)}
              className={`rounded-[1.6rem] border p-4 text-left transition ${
                index === 0 && liveEvents[0]?.entity_id === incident.entity_id
                  ? "border-[rgba(75,214,255,0.28)] bg-[rgba(75,214,255,0.08)]"
                  : "border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-[var(--text-hi)]">{incident.title}</div>
                <div className="text-data text-[var(--text-lo)]">{incident.status === "open" ? "investigating" : incident.status}</div>
              </div>
              <div className="mt-1 text-sm text-[var(--text-md)]">{incidentExplanation(incident)}</div>
            </button>
          ))}
        </div>

        <GlassCard className="sticky top-24 rounded-[1.8rem] p-4">
          {selected ? (
            <div className="grid gap-3">
              <div>
                <div className="text-sm text-[var(--text-hi)]">{selected.title}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">{selected.entity_type} {selected.entity_id}</div>
              </div>
              <div className="rounded-[1.2rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm leading-6 text-[var(--text-md)]">
                {selectedExplanation}
              </div>
              <div className="grid gap-2">
                {recs.filter((rec) => rec.entity_id === selected.entity_id).slice(0, 3).map((rec) => (
                  <div key={rec.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                    <div className="text-sm text-[var(--text-hi)]">{rec.parameter}</div>
                    <div className="mt-1 text-sm text-[var(--text-md)]">{rec.rationale}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[var(--text-lo)]">Select an incident to open the side panel.</div>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
