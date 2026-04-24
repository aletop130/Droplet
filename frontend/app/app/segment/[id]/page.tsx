"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, BarChart3, Gauge, Info, Network, Thermometer, TreePine, Waves } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { API_BASE } from "@/lib/api"
import { ExplainStream } from "@/components/explain/ExplainStream"

type SegmentDetail = {
  segment: {
    type: "Feature"
    geometry: { type: "LineString"; coordinates: [number, number][] }
    properties: {
      id: number
      dma_id: number
      phi: 0 | 1 | 2 | 3
      subsidence: number
      ndvi: number
      thermal: number
      hydraulic: number
      tank_signal: number
      material: string
      diameter_mm: number
    }
  }
  scores: {
    subsidence: number
    ndvi: number
    thermal: number
    hydraulic: number
    tank_signal: number
    phi: number
  }
  history_summary: { window: string; points: number }
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
          {value.toFixed(1)}
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

function PHIPill({ phi }: { phi: 0 | 1 | 2 | 3 }) {
  const colors = ["var(--phi-green)", "var(--phi-yellow)", "var(--phi-orange)", "var(--phi-red)"]
  const labels = ["Excellent", "Good", "Warning", "Critical"]
  const color = colors[phi] ?? "var(--text-lo)"
  const label = labels[phi] ?? "Unknown"

  return (
    <span
      className="rounded px-2 py-1 font-[var(--font-unbounded)] text-xs uppercase"
      style={{ backgroundColor: `${color}20`, color }}
    >
      PHI {phi}: {label}
    </span>
  )
}

export default function SegmentDetailPage() {
  const params = useParams()
  const segmentId = Number(params.id)
  const [data, setData] = useState<SegmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    if (!segmentId) return
    setLoading(true)
    fetch(`${API_BASE}/api/segments/${segmentId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Segment ${segmentId} not found`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [segmentId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--text-lo)]">Loading segment #{segmentId}...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--phi-red)]">{error || "Segment not found"}</span>
      </div>
    )
  }

  const { segment, scores } = data

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
            Segment Detail
          </p>
          <h1 className="font-[var(--font-unbounded)] text-2xl font-semibold">
            #{segment.properties.id} <span className="text-sm text-[var(--text-lo)]">PHI {segment.properties.phi}</span>
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
            <Gauge className="h-4 w-4 text-[var(--acea-cyan)]" />
            Pipe Health Index Signals
          </h2>
          <div className="space-y-3">
            <GaugeCard label="EGMS Subsidence" value={scores.subsidence} maxValue={50} color="var(--signal-subs)" />
            <GaugeCard label="S2 NDVI Residual" value={scores.ndvi} maxValue={100} color="var(--signal-ndvi)" />
            <GaugeCard label="ECOSTRESS LST" value={scores.thermal} maxValue={100} color="var(--signal-therm)" />
            <GaugeCard label="Hydraulic MNF" value={scores.hydraulic} maxValue={100} color="var(--signal-hydr)" />
            <GaugeCard label="Tank State Signal" value={scores.tank_signal} maxValue={100} color="var(--signal-tank)" />
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <Info className="h-4 w-4 text-[var(--acea-cyan)]" />
            Physical Attributes
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Material</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {segment.properties.material}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Diameter</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {segment.properties.diameter_mm} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">DMA</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                #{segment.properties.dma_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-lo)]">Overall PHI</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {scores.phi}/3
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
          <BarChart3 className="h-4 w-4 text-[var(--acea-cyan)]" />
          PHI History ({data.history_summary.window})
        </h2>
        <div className="flex h-32 items-center justify-center border border-dashed border-[var(--glass-stroke)] text-sm text-[var(--text-lo)]">
          Time-series chart placeholder ({data.history_summary.points} data points)
        </div>
      </GlassCard>

      <ExplainStream
        entityType="segment"
        entityId={segmentId}
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
      />
    </div>
  )
}