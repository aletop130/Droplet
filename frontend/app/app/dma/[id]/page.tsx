"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
import type { DMABalance, SegmentFeature, TankFeature } from "@/types/domain"

const SERVICE_AREAS = [
  { id: 1, label: "SA 1", name: "Ceccano Corridor", population: 22100, operator: "Frosinone Ops" },
  { id: 2, label: "SA 2", name: "Frosinone North", population: 21500, operator: "Frosinone Ops" },
  { id: 3, label: "SA 3", name: "Veroli / Alatri East", population: 47000, operator: "Alatri Ops" },
  { id: 4, label: "SA 4", name: "Ceprano / Pontecorvo", population: 20100, operator: "South Valley Ops" },
  { id: 5, label: "SA 5", name: "Frosinone South", population: 21500, operator: "Frosinone Ops" },
  { id: 6, label: "SA 6", name: "Cassino Axis", population: 36100, operator: "Cassino Ops" }
]

const MOCK_BALANCES: Record<number, DMABalance> = {
  1: { dma_id: 1, dma_name: "SA 1", population: 22100, month: "2026-04", system_input_m3: 138400, authorised_m3: 40100, apparent_losses_m3: 7600, real_losses_m3: 90700, nrw_pct: 71, avg_phi: 0.71, segment_count: 18, network_length_m: 14800 },
  2: { dma_id: 2, dma_name: "SA 2", population: 21500, month: "2026-04", system_input_m3: 129900, authorised_m3: 41600, apparent_losses_m3: 6200, real_losses_m3: 82100, nrw_pct: 68, avg_phi: 0.67, segment_count: 16, network_length_m: 13200 },
  3: { dma_id: 3, dma_name: "SA 3", population: 47000, month: "2026-04", system_input_m3: 301600, authorised_m3: 87400, apparent_losses_m3: 14100, real_losses_m3: 200100, nrw_pct: 71, avg_phi: 0.82, segment_count: 31, network_length_m: 28600 },
  4: { dma_id: 4, dma_name: "SA 4", population: 20100, month: "2026-04", system_input_m3: 121700, authorised_m3: 38900, apparent_losses_m3: 5200, real_losses_m3: 77600, nrw_pct: 68, avg_phi: 0.76, segment_count: 14, network_length_m: 11900 },
  5: { dma_id: 5, dma_name: "SA 5", population: 21500, month: "2026-04", system_input_m3: 135500, authorised_m3: 40600, apparent_losses_m3: 6800, real_losses_m3: 88100, nrw_pct: 70, avg_phi: 0.79, segment_count: 17, network_length_m: 14100 },
  6: { dma_id: 6, dma_name: "SA 6", population: 36100, month: "2026-04", system_input_m3: 231400, authorised_m3: 74000, apparent_losses_m3: 9100, real_losses_m3: 148300, nrw_pct: 68, avg_phi: 0.73, segment_count: 24, network_length_m: 22600 }
}

const MOCK_TANKS: Record<number, Array<{ id: number; name: string; headroom: number }>> = {
  1: [{ id: 101, name: "Colle Antico Tank", headroom: 38 }, { id: 102, name: "Ceccano High Service", headroom: 24 }],
  2: [{ id: 201, name: "Frosinone North Tank", headroom: 42 }, { id: 202, name: "Madonna della Neve", headroom: 31 }],
  3: [{ id: 301, name: "Veroli Ridge Tank", headroom: 29 }, { id: 302, name: "Alatri East Tank", headroom: 34 }],
  4: [{ id: 401, name: "Ceprano Nodo Alto", headroom: 27 }, { id: 402, name: "Pontecorvo Reserve", headroom: 45 }],
  5: [{ id: 501, name: "Frosinone South Tank", headroom: 22 }, { id: 502, name: "Selva dei Muli", headroom: 36 }],
  6: [{ id: 601, name: "Cassino Axis Tank", headroom: 33 }, { id: 602, name: "Sant'Angelo Buffer", headroom: 28 }]
}

const MOCK_SEGMENTS: Record<number, Array<{ id: number; material: string; diameter: number; phi: number }>> = {
  1: [{ id: 1104, material: "Ductile iron", diameter: 250, phi: 0.78 }, { id: 1118, material: "PVC", diameter: 180, phi: 0.66 }, { id: 1131, material: "Steel", diameter: 300, phi: 0.82 }],
  2: [{ id: 2207, material: "Cast iron", diameter: 220, phi: 0.74 }, { id: 2220, material: "HDPE", diameter: 160, phi: 0.58 }, { id: 2235, material: "Ductile iron", diameter: 280, phi: 0.69 }],
  3: [{ id: 3308, material: "Steel", diameter: 320, phi: 0.88 }, { id: 3316, material: "Ductile iron", diameter: 260, phi: 0.81 }, { id: 3342, material: "PVC", diameter: 200, phi: 0.73 }],
  4: [{ id: 4402, material: "Cast iron", diameter: 240, phi: 0.84 }, { id: 4419, material: "Ductile iron", diameter: 300, phi: 0.77 }, { id: 4430, material: "HDPE", diameter: 180, phi: 0.61 }],
  5: [{ id: 5505, material: "Steel", diameter: 280, phi: 0.86 }, { id: 5524, material: "PVC", diameter: 200, phi: 0.71 }, { id: 5538, material: "Ductile iron", diameter: 250, phi: 0.79 }],
  6: [{ id: 6601, material: "Ductile iron", diameter: 350, phi: 0.8 }, { id: 6617, material: "Cast iron", diameter: 260, phi: 0.76 }, { id: 6644, material: "Steel", diameter: 320, phi: 0.83 }]
}

export default function DmaPage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const segmentsData = useDataStore((state) => state.segments)
  const tanksData = useDataStore((state) => state.tanks)
  const dmaBalanceCache = useDataStore((state) => state.dmaBalancesById)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const fetchDmaBalance = useDataStore((state) => state.fetchDmaBalance)
  const [balance, setBalance] = useState<DMABalance | null>(null)
  const [segments, setSegments] = useState<SegmentFeature[]>([])
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const setActiveDMA = useSelectionStore((state) => state.setActiveDMA)
  const serviceArea = SERVICE_AREAS.find((item) => item.id === id) ?? SERVICE_AREAS[3]
  const effectiveBalance = MOCK_BALANCES[id] ?? balance ?? MOCK_BALANCES[4]
  const population = serviceArea.population

  useEffect(() => {
    if (!Number.isFinite(id)) return
    setActiveDMA(id)
    void fetchCore()
    setBalance(MOCK_BALANCES[id] ?? MOCK_BALANCES[4])
    void fetchDmaBalance(id).then(setBalance).catch(() => {
      setBalance(MOCK_BALANCES[id] ?? MOCK_BALANCES[4])
    })
  }, [fetchCore, fetchDmaBalance, id, setActiveDMA])

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
    return [
      { label: "System input", value: effectiveBalance.system_input_m3 },
      { label: "Authorised", value: effectiveBalance.authorised_m3 },
      { label: "Apparent losses", value: effectiveBalance.apparent_losses_m3 },
      { label: "Real losses", value: effectiveBalance.real_losses_m3 }
    ]
  }, [effectiveBalance])

  const tankRows = tanks.length
    ? tanks.map((tank) => ({ id: tank.properties.id, name: tank.properties.name, headroom: tank.properties.headroom_pct }))
    : MOCK_TANKS[id] ?? MOCK_TANKS[4]
  const segmentRows = segments.length
    ? segments.map((segment) => ({
        id: segment.properties.id,
        material: segment.properties.material,
        diameter: segment.properties.diameter_mm,
        phi: segment.properties.phi
      }))
    : MOCK_SEGMENTS[id] ?? MOCK_SEGMENTS[4]

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">{serviceArea.label}</div>
          <h1 className="mt-2 text-[clamp(2rem,4vw,4.2rem)] font-semibold tracking-[-0.02em] text-[var(--text-hi)]">
            {serviceArea.name}
          </h1>
          <div className="mt-2 text-sm text-[var(--text-lo)]">{serviceArea.operator}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-full border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.04)] p-1">
            {SERVICE_AREAS.map((area) => (
              <Link
                key={area.id}
                href={`/app/dma/${area.id}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  area.id === id
                    ? "bg-[var(--acea-cyan)] text-[var(--panel)]"
                    : "text-[var(--text-md)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-hi)]"
                }`}
              >
                {area.label}
              </Link>
            ))}
          </div>
          <DataBadge label="population" value={population.toLocaleString()} />
          <DataBadge label="segments" value={String(effectiveBalance.segment_count)} tone="neutral" />
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
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">{effectiveBalance.nrw_pct}</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">Avg PHI</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">{effectiveBalance.avg_phi}</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">Network km</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">{(effectiveBalance.network_length_m / 1000).toFixed(1)}</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">Real losses</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">{effectiveBalance.real_losses_m3.toLocaleString()}</div>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Tank ensemble</div>
          <div className="grid gap-2">
            {tankRows.map((tank) => (
              <div key={tank.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-[var(--text-hi)]">{tank.name}</div>
                  <DataBadge label="headroom" value={`${tank.headroom}%`} tone="cyan" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-4 text-sm text-[var(--text-hi)]">Segments table</div>
          <div className="grid gap-2">
            {segmentRows.slice(0, 12).map((segment) => (
              <div key={segment.id} className="grid grid-cols-[90px_1fr_120px_120px] items-center gap-3 rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[var(--text-md)]">
                <div className="text-[var(--text-hi)]">#{segment.id}</div>
                <div>{segment.material}</div>
                <div>{segment.diameter} mm</div>
                <div>PHI {segment.phi}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
