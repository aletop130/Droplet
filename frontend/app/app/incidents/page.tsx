"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Clock, Search, User, XCircle } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { getIncidents, type Incident } from "@/lib/incidents"

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "open" | "investigating" | "resolved">("all")
  const [severity, setSeverity] = useState<number | null>(null)
  const [selected, setSelected] = useState<Incident | null>(null)

  useEffect(() => {
    setLoading(true)
    getIncidents(severity ?? undefined, filter === "all" ? undefined : filter)
      .then((data) => setIncidents(data.items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [filter, severity])

  const severityLabels = { 1: "low", 2: "medium", 3: "high", 4: "critical" }
  const statusColors = {
    open: "var(--phi-red)",
    investigating: "var(--phi-yellow)",
    resolved: "var(--phi-green)"
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Incidents
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal">
            Anomaly detection events
          </h1>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "open", "investigating", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-3 py-1.5 text-xs font-[var(--font-jetbrains)] uppercase transition ${
              filter === f
                ? "border-[var(--acea-cyan)] bg-[var(--acea-cyan)]/10 text-[var(--acea-cyan)]"
                : "border-[var(--glass-stroke)] text-[var(--text-lo)] hover:border-[var(--text-md)]"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="number"
            placeholder="Severity ≥"
            className="w-24"
            value={severity ?? ""}
            onChange={(e) => setSeverity(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--text-lo)]">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-lo)]">No incidents found</div>
      ) : (
        <div className="grid gap-3">
          {incidents.map((incident) => (
            <GlassCard
              key={incident.id}
              className="cursor-pointer p-4 transition hover:border-[var(--acea-cyan)]"
              onClick={() => setSelected(incident)}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="h-4 w-4"
                    style={{ color: severityLabels[incident.severity as keyof typeof severityLabels] === "critical" ? "var(--phi-red)" : severityLabels[incident.severity as keyof typeof severityLabels] === "high" ? "var(--phi-orange)" : "var(--phi-yellow)" }}
                  />
                  <span className="font-[var(--font-jetbrains)] text-xs text-[var(--text-lo)]">
                    #{incident.id}
                  </span>
                </div>
                <span
                  className="font-[var(--font-unbounded)] text-xs uppercase"
                  style={{ color: statusColors[incident.status] }}
                >
                  {incident.status}
                </span>
              </div>
              <h3 className="mb-2 font-[var(--font-unbounded)] text-sm">{incident.title}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-lo)]">
                <span className="font-[var(--font-jetbrains)]">
                  {incident.entity_type} #{incident.entity_id}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(incident.updated_at).toLocaleString()}
                </span>
                {incident.assigned_to && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {incident.assigned_to}
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <GlassCard className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[var(--phi-red)]" />
                <span className="font-[var(--font-jetbrains)] text-xs text-[var(--text-lo)]">
                  Incident #{selected.id}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded p-1 text-[var(--text-lo)] hover:bg-[var(--bg-2)]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <h2 className="mb-4 font-[var(--font-unbounded)] text-xl">{selected.title}</h2>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-[var(--text-lo)]">Status</div>
                <div
                  className="font-[var(--font-unbounded)]"
                  style={{ color: statusColors[selected.status] }}
                >
                  {selected.status.toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Severity</div>
                <div className="font-[var(--font-jetbrains)]">
                  {severityLabels[selected.severity as keyof typeof severityLabels]} ({selected.severity})
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Entity</div>
                <div className="font-[var(--font-jetbrains)]">
                  {selected.entity_type} #{selected.entity_id}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Updated</div>
                <div className="font-[var(--font-jetbrains)]">
                  {new Date(selected.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
            {selected.pre_explanation && (
              <div className="mb-4">
                <div className="mb-1 text-xs text-[var(--text-lo)]">AI Pre-explanation</div>
                <div className="rounded border border-[var(--glass-stroke)] p-3 text-sm text-[var(--text-md)]">
                  {selected.pre_explanation}
                </div>
              </div>
            )}
            {selected.detector_events && selected.detector_events.length > 0 && (
              <div className="mb-4">
                <div className="mb-1 text-xs text-[var(--text-lo)]">Detector Events</div>
                <div className="flex flex-wrap gap-2">
                  {selected.detector_events.map((event, i) => (
                    <span
                      key={i}
                      className="rounded bg-[var(--bg-2)] px-2 py-1 text-xs font-[var(--font-jetbrains)]"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selected.tags && selected.tags.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-[var(--text-lo)]">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="rounded border border-[var(--glass-stroke)] px-2 py-1 text-xs font-[var(--font-jetbrains)] text-[var(--acea-cyan)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}