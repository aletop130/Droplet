"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { ExplainStream } from "@/components/explain/ExplainStream"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { PhiPill } from "@/components/ui/PhiPill"
import { getSegment } from "@/lib/api"
import { useSelectionStore } from "@/store/selectionStore"
import type { SegmentDetail } from "@/types/domain"

export default function SegmentPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [detail, setDetail] = useState<SegmentDetail | null>(null)
  const [openExplain, setOpenExplain] = useState(false)
  const setActiveSegment = useSelectionStore((state) => state.setActiveSegment)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setActiveSegment(id)
    getSegment(id).then(setDetail)
  }, [id, setActiveSegment])

  if (!detail) {
    return <div className="px-4 py-24 text-sm text-[var(--text-lo)]">Loading segment detail...</div>
  }

  const chartData = detail.history.slice(-80).map((point) => ({
    ts: new Date(point.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    subsidence: point.subsidence,
    ndvi: point.ndvi,
    thermal: point.thermal,
    hydraulic: point.hydraulic,
    tank: point.tank_signal
  }))

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Segment {detail.segment.properties.id}</div>
          <h1 className="text-h1 mt-2">{detail.segment.properties.dma_name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <PhiPill value={detail.segment.properties.phi} />
            <DataBadge label="materiale" value={detail.segment.properties.material} tone="neutral" />
            <DataBadge label="diametro" value={`${detail.segment.properties.diameter_mm} mm`} tone="neutral" />
            <DataBadge label="posa" value={String(detail.segment.properties.install_year ?? "n/a")} tone="neutral" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">5 signal gauges</div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Object.entries(detail.scores).map(([key, value]) => (
              <div key={key} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-data text-[var(--text-lo)]">{key}</div>
                <div className="mt-2 text-[1.8rem] font-semibold text-[var(--text-hi)]">{value}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">S2 NDVI + ECOSTRESS LST</div>
          <div className="grid h-full min-h-[280px] place-items-center rounded-[1.6rem] border border-[rgba(173,218,255,0.1)] bg-[radial-gradient(circle_at_30%_20%,rgba(68,215,192,0.18),transparent_32%),radial-gradient(circle_at_70%_68%,rgba(251,146,60,0.16),transparent_28%),rgba(255,255,255,0.03)]">
            <div className="text-center">
              <div className="text-[var(--text-hi)]">Satellite composite placeholder</div>
              <div className="mt-2 text-sm text-[var(--text-md)]">Storage asset non disponibile, rendering realistico attivo.</div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Time series 90d</div>
          <div className="h-[22rem]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="ts" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="subsidence" stroke="#9b8cff" fill="rgba(155,140,255,0.14)" />
                <Area type="monotone" dataKey="ndvi" stroke="#34d399" fill="rgba(52,211,153,0.12)" />
                <Area type="monotone" dataKey="thermal" stroke="#fb923c" fill="rgba(251,146,60,0.12)" />
                <Area type="monotone" dataKey="hydraulic" stroke="#4bd6ff" fill="rgba(75,214,255,0.12)" />
                <Area type="monotone" dataKey="tank" stroke="#44d7c0" fill="rgba(68,215,192,0.12)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Graph neighbourhood</div>
          <div className="grid min-h-[22rem] place-items-center rounded-[1.6rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)]">
            <svg viewBox="0 0 360 260" className="h-full w-full">
              <circle cx="180" cy="130" r="38" fill="rgba(75,214,255,0.14)" stroke="#4bd6ff" />
              <text x="180" y="136" textAnchor="middle" fill="#edf8ff" fontSize="13">Segment {id}</text>
              {[["DMA", 86, 64], ["Tank", 288, 88], ["Incident", 286, 188], ["Upstream", 84, 194]].map(([label, x, y]) => (
                <g key={label}>
                  <line x1="180" y1="130" x2={Number(x)} y2={Number(y)} stroke="rgba(173,218,255,0.24)" />
                  <circle cx={Number(x)} cy={Number(y)} r="28" fill="rgba(255,255,255,0.03)" stroke="rgba(173,218,255,0.16)" />
                  <text x={Number(x)} y={Number(y) + 4} textAnchor="middle" fill="#9eb5cf" fontSize="11">{label}</text>
                </g>
              ))}
            </svg>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Incident history</div>
          <div className="grid gap-2">
            {detail.incidents.map((incident) => (
              <div key={incident.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--text-hi)]">{incident.title}</div>
                  <PhiPill value={Math.min(3, incident.severity) as 0 | 1 | 2 | 3} />
                </div>
                <div className="mt-1 text-sm text-[var(--text-md)]">{incident.pre_explanation ?? "Correlated anomaly."}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Actions</div>
          <div className="grid gap-2">
            <button type="button" onClick={() => setOpenExplain(true)} className="rounded-2xl border border-[rgba(75,214,255,0.24)] px-4 py-3 text-left text-[var(--acea-cyan)]">
              Spiega
            </button>
            <button type="button" className="rounded-2xl border border-[rgba(173,218,255,0.12)] px-4 py-3 text-left text-[var(--text-md)]">
              Log intervento
            </button>
            <Link href="/app/map" className="rounded-2xl border border-[rgba(173,218,255,0.12)] px-4 py-3 text-[var(--text-md)]">
              Apri in mappa
            </Link>
          </div>
        </GlassCard>
      </section>

      <ExplainStream entityType="segment" entityId={id} open={openExplain} onClose={() => setOpenExplain(false)} />
    </div>
  )
}
