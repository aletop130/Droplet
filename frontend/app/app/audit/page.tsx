"use client"

import { useEffect, useState } from "react"
import { Bot, Clock, Search, Shield, Zap } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { API_BASE } from "@/lib/api"

type AuditEntry = {
  id: number
  ts: string
  model: string
  purpose: string
  entity_type: string | null
  entity_id: number | null
  response_text: string
  confidence: number
  operator_action: string | null
  latency_ms: number
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [purpose, setPurpose] = useState<string>("")
  const [entityType, setEntityType] = useState<string>("")
  const [selected, setSelected] = useState<AuditEntry | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (purpose) params.set("purpose", purpose)
    if (entityType) params.set("entity_type", entityType)

    fetch(`${API_BASE}/api/audit?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then((res) => res.json())
      .then((data) => setEntries(data.items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [purpose, entityType])

  const purposeColors: Record<string, string> = {
    explain: "var(--acea-cyan)",
    chat: "var(--acea-teal)",
    control_rec: "var(--phi-yellow)",
    search: "var(--phi-green)",
    lookup: "var(--phi-green)"
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            AI Act Compliance
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal">
            Audit trail
          </h1>
        </div>
        <Shield className="h-8 w-8 text-[var(--phi-green)]" />
      </section>

      <div className="flex flex-wrap gap-2">
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="rounded border border-[var(--glass-stroke)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text-md)]"
        >
          <option value="">All purposes</option>
          <option value="explain">Explain</option>
          <option value="chat">Chat</option>
          <option value="control_rec">Control Rec</option>
          <option value="search">Search</option>
        </select>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded border border-[var(--glass-stroke)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--text-md)]"
        >
          <option value="">All entities</option>
          <option value="segment">Segment</option>
          <option value="tank">Tank</option>
          <option value="dma">DMA</option>
          <option value="incident">Incident</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--text-lo)]">Loading audit...</div>
      ) : entries.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-lo)]">No audit entries found</div>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <GlassCard
              key={entry.id}
              className="cursor-pointer p-3 transition hover:border-[var(--acea-cyan)]"
              onClick={() => setSelected(entry)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-3 w-3 text-[var(--text-lo)]" />
                  <span className="font-[var(--font-jetbrains)] text-xs text-[var(--text-lo)]">
                    #{entry.id} · {entry.model}
                  </span>
                </div>
                <span
                  className="font-[var(--font-unbounded)] text-xs"
                  style={{ color: purposeColors[entry.purpose] || "var(--text-lo)" }}
                >
                  {entry.purpose}
                </span>
              </div>
              <div className="mt-1 truncate text-sm text-[var(--text-md)]">
                {entry.response_text.slice(0, 120)}...
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-lo)]">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.ts).toLocaleString()}
                </span>
                {entry.entity_type && (
                  <span className="font-[var(--font-jetbrains)]">
                    {entry.entity_type} #{entry.entity_id}
                  </span>
                )}
                <span className="font-[var(--font-jetbrains)]">
                  {(entry.latency_ms / 1000).toFixed(2)}s
                </span>
                <span className="font-[var(--font-jetbrains)]">
                  {(entry.confidence * 100).toFixed(0)}%
                </span>
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
                <Bot className="h-5 w-5 text-[var(--acea-cyan)]" />
                <span className="font-[var(--font-jetbrains)] text-xs text-[var(--text-lo)]">
                  Audit #{selected.id}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded p-1 text-[var(--text-lo)] hover:bg-[var(--bg-2)]"
              >
                ×
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-[var(--text-lo)]">Timestamp</div>
                <div className="font-[var(--font-jetbrains)]">
                  {new Date(selected.ts).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Model</div>
                <div className="font-[var(--font-jetbrains)]">{selected.model}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Purpose</div>
                <div
                  className="font-[var(--font-unbounded)]"
                  style={{ color: purposeColors[selected.purpose] || "var(--text-md)" }}
                >
                  {selected.purpose}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-lo)]">Confidence</div>
                <div className="font-[var(--font-jetbrains)]">
                  {(selected.confidence * 100).toFixed(0)}%
                </div>
              </div>
              {selected.entity_type && (
                <div>
                  <div className="text-xs text-[var(--text-lo)]">Entity</div>
                  <div className="font-[var(--font-jetbrains)]">
                    {selected.entity_type} #{selected.entity_id}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-[var(--text-lo)]">Latency</div>
                <div className="font-[var(--font-jetbrains)]">
                  {(selected.latency_ms / 1000).toFixed(2)}s
                </div>
              </div>
              {selected.operator_action && (
                <div>
                  <div className="text-xs text-[var(--text-lo)]">Operator Action</div>
                  <div className="font-[var(--font-jetbrains)]">{selected.operator_action}</div>
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--text-lo)]">Response</div>
              <div className="rounded border border-[var(--glass-stroke)] p-3 text-sm text-[var(--text-md)] whitespace-pre-wrap">
                {selected.response_text}
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}