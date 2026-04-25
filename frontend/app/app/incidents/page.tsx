"use client"

import { useEffect, useMemo, useState } from "react"

import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { getControlRecs, getIncidents } from "@/lib/api"
import { useAlertsStore } from "@/store/alertsStore"
import type { ControlRecommendation, Incident } from "@/types/domain"

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selected, setSelected] = useState<Incident | null>(null)
  const [recs, setRecs] = useState<ControlRecommendation[]>([])
  const [tab, setTab] = useState<"all" | "open" | "investigating" | "resolved">("all")
  const [search, setSearch] = useState("")
  const liveEvents = useAlertsStore((state) => state.events)

  useEffect(() => {
    getIncidents().then((payload) => setIncidents(payload.items))
    getControlRecs().then(setRecs)
  }, [])

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      if (tab !== "all" && incident.status !== tab) return false
      if (search && !`${incident.title} ${incident.entity_type} ${incident.entity_id}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [incidents, search, tab])

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Incidenti</div>
          <h1 className="text-h1 mt-2">Triage queue con spiegazioni e control rec tracciate.</h1>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "investigating", "resolved"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-3 py-1 text-data ${tab === item ? "border-[rgba(75,214,255,0.24)] text-[var(--acea-cyan)]" : "border-[rgba(173,218,255,0.12)] text-[var(--text-lo)]"}`}
          >
            {item}
          </button>
        ))}
        <div className="ml-auto w-full max-w-xs">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtra per entity o titolo" />
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
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
                <div className="text-data text-[var(--text-lo)]">{incident.status}</div>
              </div>
              <div className="mt-1 text-sm text-[var(--text-md)]">{incident.pre_explanation}</div>
            </button>
          ))}
        </div>

        <GlassCard className="rounded-[1.8rem] p-5">
          {selected ? (
            <div className="grid gap-4">
              <div>
                <div className="text-sm text-[var(--text-hi)]">{selected.title}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">{selected.entity_type} {selected.entity_id}</div>
              </div>
              <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-md)]">
                {selected.pre_explanation}
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
            <div className="text-sm text-[var(--text-lo)]">Seleziona un incidente per aprire il pannello laterale.</div>
          )}
        </GlassCard>
      </section>
    </div>
  )
}
