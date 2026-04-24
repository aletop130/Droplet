"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, BarChart3, Droplets, Gauge, Info, Network, TrendingDown, TrendingUp } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { API_BASE } from "@/lib/api"
import { ExplainStream } from "@/components/explain/ExplainStream"

type TankDetail = {
  tank: {
    type: "Feature"
    geometry: { type: "Point"; coordinates: [number, number] }
    properties: {
      id: number
      name: string
      headroom_pct: number
      severity: 0 | 1 | 2 | 3
    }
  }
  balance: {
    inflow_m3h: number
    outflow_m3h: number
    net_balance_m3h: number
    fill_rate_pcth: number
  }
  kpi: {
    turnover_h: number
    residence_time_h: number
    z_score: number
    days_to_empty: number | null
    days_to_full: number | null
  }
  anomalies: Array<{ detector: string; severity: number }>
  related_segments: number[]
}

function GaugeCard({
  label,
  value,
  maxValue,
  color
}: {
  label: string
  value: number
  maxValue?: number
  color: string
}) {
  const max = maxValue ?? 100
  const pct = Math.min((value / max) * 100, 100)

  return (
    <div className="rounded-lg border border-[var(--glass-stroke)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-[var(--text-lo)]">{label}</span>
        <span className="font-[var(--font-jetbrains)] text-sm" style={{ color }}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function SeverityPill({ severity }: { severity: 0 | 1 | 2 | 3 }) {
  const colors = ["var(--phi-green)", "var(--phi-yellow)", "var(--phi-orange)", "var(--phi-red)"]
  const labels = ["Normal", "Warning", "Critical", "Critical"]
  const color = colors[severity] ?? "var(--text-lo)"
  const label = labels[severity] ?? "Unknown"

  return (
    <span
      className="rounded px-2 py-1 font-[var(--font-unbounded)] text-xs uppercase"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {label}
    </span>
  )
}

export default function TankDetailPage() {
  const params = useParams()
  const tankId = Number(params.id)
  const [data, setData] = useState<TankDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    if (!tankId) return
    setLoading(true)
    fetch(`${API_BASE}/api/tanks/${tankId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Tank ${tankId} not found`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [tankId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--text-lo)]">Loading tank #{tankId}...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--phi-red)]">{error || "Tank not found"}</span>
      </div>
    )
  }

  const { tank, balance, kpi, anomalies } = data

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center gap-4">
        <a
          href="/app/map"
          className="flex h-8 w-8 items-center justify-center rounded border border-[var(--glass-stroke)] text-[var(--text-lo)] hover:border-[var(--acea-cyan)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Tank Detail
          </p>
          <h1 className="font-[var(--font-unbounded)] text-2xl font-semibold">
            {tank.properties.name} <SeverityPill severity={tank.properties.severity} />
          </h1>
        </div>
        <button
          onClick={() => setExplainOpen(true)}
          className="ml-auto rounded border border-[var(--glass-stroke)] px-3 py-1.5 text-xs text-[var(--acea-cyan)] hover:border-[var(--acea-cyan)]"
        >
          <Info className="mr-1 inline h-3 w-3" />
          AI Explain
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <Droplets className="h-4 w-4 text-[var(--acea-cyan)]" />
            Real-time Balance
          </h2>
          <div className="space-y-3">
            <GaugeCard label="Inflow" value={balance.inflow_m3h} maxValue={200} color="var(--acea-cyan)" />
            <GaugeCard label="Outflow" value={balance.outflow_m3h} maxValue={200} color="var(--acea-teal)" />
            <GaugeCard label="Net Balance" value={balance.net_balance_m3h} maxValue={50} color="var(--phi-green)" />
            <GaugeCard label="Fill Rate /h" value={balance.fill_rate_pcth} maxValue={10} color="var(--signal-tank)" />
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <Gauge className="h-4 w-4 text-[var(--acea-cyan)]" />
            KPIs & Projections
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Turnover</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {kpi.turnover_h.toFixed(1)} h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Residence Time</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {kpi.residence_time_h.toFixed(1)} h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Z-Score</span>
              <span
                className="font-[var(--font-jetbrains)]"
                style={{
                  color:
                    Math.abs(kpi.z_score) > 2
                      ? "var(--phi-red)"
                      : Math.abs(kpi.z_score) > 1
                        ? "var(--phi-yellow)"
                        : "var(--text-md)"
                }}
              >
                {kpi.z_score.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Days to Empty</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--phi-red)]">
                {kpi.days_to_empty ?? ">30"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Days to Full</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--phi-green)]">
                {kpi.days_to_full ?? ">30"}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {anomalies.length > 0 && (
        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <TrendingDown className="h-4 w-4 text-[var(--phi-red)]" />
            Active Anomalies
          </h2>
          <div className="space-y-2">
            {anomalies.map((anomaly, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border border-[var(--phi-yellow)]/30 bg-[var(--phi-yellow)]/5 px-3 py-2"
              >
                <span className="font-[var(--font-jetbrains)] text-sm">{anomaly.detector}</span>
                <span className="font-[var(--font-jetbrains)] text-xs text-[var(--phi-yellow)]">
                  Severity {anomaly.severity}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
          <Network className="h-4 w-4 text-[var(--acea-cyan)]" />
          Connected Segments
        </h2>
        <div className="flex flex-wrap gap-2">
          {data.related_segments.map((segId) => (
            <a
              key={segId}
              href={`/app/segment/${segId}`}
              className="rounded border border-[var(--glass-stroke)] px-2 py-1 text-xs font-[var(--font-jetbrains)] text-[var(--acea-cyan)] hover:border-[var(--acea-cyan)]"
            >
              SEG-{segId}
            </a>
          ))}
        </div>
      </GlassCard>

      <ExplainStream
        entityType="tank"
        entityId={tankId}
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
      />
    </div>
  )
}