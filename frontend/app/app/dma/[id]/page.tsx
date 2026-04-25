"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { useDataStore } from "@/store/dataStore"
import { useSelectionStore } from "@/store/selectionStore"
import type { DMABalance, DMAFeature, SegmentFeature, TankFeature } from "@/types/domain"

export default function DmaPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const dmas = useDataStore((state) => state.dmas)
  const segmentsData = useDataStore((state) => state.segments)
  const tanksData = useDataStore((state) => state.tanks)
  const dmaBalanceCache = useDataStore((state) => state.dmaBalancesById)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const fetchDmaBalance = useDataStore((state) => state.fetchDmaBalance)
  const [dma, setDma] = useState<DMAFeature | null>(null)
  const [balance, setBalance] = useState<DMABalance | null>(null)
  const [segments, setSegments] = useState<SegmentFeature[]>([])
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const setActiveDMA = useSelectionStore((state) => state.setActiveDMA)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setActiveDMA(id)
    void fetchCore()
    void fetchDmaBalance(id).then(setBalance)
  }, [fetchCore, fetchDmaBalance, id, setActiveDMA])

  useEffect(() => {
    if (dmas) {
      setDma(dmas.find((item) => item.id === id) ?? null)
    }
  }, [dmas, id])

  useEffect(() => {
    if (dmaBalanceCache[id]) {
      setBalance(dmaBalanceCache[id])
    }
  }, [dmaBalanceCache, id])

  useEffect(() => {
    if (segmentsData) {
      setSegments(segmentsData.filter((segment) => segment.properties.dma_id === id))
    }
  }, [id, segmentsData])

  useEffect(() => {
    if (tanksData) {
      setTanks(tanksData.filter((tank) => tank.properties.dma_id === id))
    }
  }, [id, tanksData])

  const waterfall = useMemo(() => {
    if (!balance) return []
    return [
      { label: "System input", value: balance.system_input_m3 },
      { label: "Authorised", value: balance.authorised_m3 },
      { label: "Apparent losses", value: balance.apparent_losses_m3 },
      { label: "Real losses", value: balance.real_losses_m3 }
    ]
  }, [balance])

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Service area {id}</div>
          <h1 className="text-h1 mt-2">{dma?.name ?? "Loading..."}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataBadge label="population" value={dma?.population?.toLocaleString() ?? "n/a"} />
          <DataBadge label="segments" value={String(segments.length)} tone="neutral" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Water balance</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4bd6ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Performance indicators</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">NRW%</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">{balance?.nrw_pct ?? "n/a"}</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">ILI</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">2.8</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">UARL</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">1.9</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">CARL</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">5.4</div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Tank ensemble</div>
          <div className="grid gap-2">
            {tanks.map((tank) => (
              <div key={tank.properties.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--text-hi)]">{tank.properties.name}</div>
                  <DataBadge label="headroom" value={`${tank.properties.headroom_pct}%`} tone="cyan" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Segments table</div>
          <div className="grid gap-2">
            {segments.slice(0, 12).map((segment) => (
              <div key={segment.properties.id} className="grid grid-cols-[90px_1fr_120px_120px] items-center gap-3 rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[var(--text-md)]">
                <div className="text-[var(--text-hi)]">#{segment.properties.id}</div>
                <div>{segment.properties.material}</div>
                <div>{segment.properties.diameter_mm} mm</div>
                <div>PHI {segment.properties.phi}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
