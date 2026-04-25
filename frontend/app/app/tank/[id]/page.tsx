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

import { ControlRecCard } from "@/components/control/ControlRecCard"
import { ExplainStream } from "@/components/explain/ExplainStream"
import { DataBadge } from "@/components/ui/DataBadge"
import { Gauge } from "@/components/ui/Gauge"
import { GlassCard } from "@/components/ui/GlassCard"
import { useDataStore } from "@/store/dataStore"
import { useSelectionStore } from "@/store/selectionStore"
import type { ControlRecommendation, TankDetail } from "@/types/domain"

export default function TankDetailPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const cachedDetail = useDataStore((state) => state.tankDetailsById[id])
  const controlRecs = useDataStore((state) => state.controlRecs)
  const fetchTankDetail = useDataStore((state) => state.fetchTankDetail)
  const fetchControlRecs = useDataStore((state) => state.fetchControlRecs)
  const [detail, setDetail] = useState<TankDetail | null>(null)
  const [recs, setRecs] = useState<ControlRecommendation[]>([])
  const [openExplain, setOpenExplain] = useState(false)
  const setActiveTank = useSelectionStore((state) => state.setActiveTank)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setActiveTank(id)
    if (cachedDetail) {
      setDetail(cachedDetail)
    } else {
      void fetchTankDetail(id).then(setDetail)
    }
    void fetchControlRecs()
  }, [cachedDetail, fetchControlRecs, fetchTankDetail, id, setActiveTank])

  useEffect(() => {
    if (!controlRecs) return
    setRecs(controlRecs.filter((item) => item.entity_type === "tank" && item.entity_id === id))
  }, [controlRecs, id])

  if (!detail) {
    return <div className="px-4 py-24 text-sm text-[var(--text-lo)]">Loading tank detail...</div>
  }

  const liveData = detail.state_24h.slice(-80).map((point) => ({
    ts: new Date(point.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    level: point.level_m,
    volume: point.volume_m3
  }))
  const balance = detail.balance
  const latestBalanceRow = detail.balance_series[0]
  const kpis = detail.kpis ?? detail.kpi

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Tank {detail.tank.properties.id}</div>
          <h1 className="text-h1 mt-2">{detail.tank.properties.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <DataBadge label="source" value={detail.tank.properties.data_source ?? "osm"} />
            <DataBadge label="capacity" value={`${Math.round(detail.tank.properties.capacity_m3 ?? 0)} m3`} tone="neutral" />
            <DataBadge label="quota" value={`${Math.round(detail.tank.properties.elevation_m ?? 0)} m`} tone="neutral" />
            <DataBadge label="dma" value={detail.tank.properties.dma_name ?? "n/a"} tone="neutral" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Live level chart 24h</div>
          <div className="h-[22rem] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveData}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="ts" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="level" stroke="#4bd6ff" fill="rgba(75,214,255,0.18)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Resilience</div>
          <Gauge value={kpis.resilience_hours ?? 0} max={96} unit="h" label="Resilience hours" color="var(--phi-yellow)" />
          <div className="mt-4 grid gap-2">
            <DataBadge label="headroom" value={`${Math.round(kpis.headroom_pct ?? detail.tank.properties.headroom_pct ?? 0)}%`} />
            <DataBadge label="residual" value={`${Math.round(balance.residual_pct ?? kpis.residual_pct ?? 0)}%`} tone="yellow" />
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Mass balance</div>
          <div className="grid gap-3">
            {[
              ["inflow m3/h", balance.inflow_m3h],
              ["outflow m3/h", balance.outflow_m3h],
              ["demand m3/h", balance.demand_m3h],
              ["delta volume m3", balance.delta_volume_m3],
              ["latest residual %", latestBalanceRow?.residual_pct ?? balance.residual_pct]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="text-data text-[var(--text-lo)]">{label}</div>
                <div className="mt-1 text-lg text-[var(--text-hi)]">{value ?? "n/a"}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Downstream segments PHI &gt;= 2</div>
          <div className="grid gap-2">
            {detail.downstream_segments.slice(0, 8).map((segment) => (
              <Link
                key={segment.properties.id}
                href={`/app/segment/${segment.properties.id}`}
                className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--text-hi)]">Segment {segment.properties.id}</div>
                  <DataBadge label="phi" value={String(segment.properties.phi)} tone="yellow" />
                </div>
                <div className="mt-1 text-sm text-[var(--text-md)]">{segment.properties.material}</div>
              </Link>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Tank anomalies log</div>
          <div className="grid gap-2">
            {detail.anomalies.map((anomaly, index) => (
              <div key={index} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="text-sm text-[var(--text-hi)]">{anomaly.message ?? anomaly.reason ?? anomaly.detector ?? "anomaly"}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">{anomaly.level ?? "L1"} · {anomaly.ts ?? "latest"}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <ControlRecCard recommendations={recs} onUpdate={() => fetchControlRecs({ force: true }).then((items) => setRecs(items.filter((item) => item.entity_id === id)))} />
      </section>

      <GlassCard className="rounded-[1.8rem] p-5">
        <div className="mb-4 text-sm text-[var(--text-hi)]">Actions</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpenExplain(true)} className="rounded-2xl border border-[rgba(75,214,255,0.24)] px-4 py-3 text-[var(--acea-cyan)]">
            Explain state
          </button>
          <Link href="/app/map" className="rounded-2xl border border-[rgba(173,218,255,0.12)] px-4 py-3 text-[var(--text-md)]">
            Map
          </Link>
        </div>
      </GlassCard>

      <ExplainStream entityType="tank" entityId={id} open={openExplain} onClose={() => setOpenExplain(false)} />
    </div>
  )
}
