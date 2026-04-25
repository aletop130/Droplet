"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import Link from "next/link"

import { DataBadge } from "@/components/ui/DataBadge"
import { Gauge } from "@/components/ui/Gauge"
import { GlassCard } from "@/components/ui/GlassCard"
import { PhiPill } from "@/components/ui/PhiPill"
import { getDailyDigest } from "@/lib/api"
import { useDataStore } from "@/store/dataStore"
import type { Incident, SourceAvailability, TankFeature } from "@/types/domain"

const phiPalette = ["#10B981", "#FBBF24", "#FB923C", "#F43F5E"]

export default function MissionControlPage() {
  const segments = useDataStore((state) => state.segments)
  const incidentsData = useDataStore((state) => state.incidents)
  const tanksData = useDataStore((state) => state.tanks)
  const availabilityData = useDataStore((state) => state.sourceAvailability)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const [segmentsCount, setSegmentsCount] = useState([0, 0, 0, 0])
  const [sparkline, setSparkline] = useState<Array<{ ts: string; phi: number }>>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const [availability, setAvailability] = useState<SourceAvailability | null>(null)
  const [digest, setDigest] = useState<Awaited<ReturnType<typeof getDailyDigest>> | null>(null)

  useEffect(() => {
    void fetchCore()
    getDailyDigest().catch(() => null).then(setDigest)
  }, [fetchCore])

  useEffect(() => {
    if (!segments || !incidentsData || !tanksData || !availabilityData) return
    const counts = [0, 0, 0, 0]
    segments.forEach((feature) => {
        counts[feature.properties.phi] += 1
    })
    setSegmentsCount(counts)

    const sampled = segments.slice(0, 28).map((feature, index) => ({
      ts: `${index + 1}`,
      phi: feature.properties.phi + (feature.properties.phi_confidence ?? 0.6)
    }))
    setSparkline(sampled)
    setIncidents(incidentsData.filter((incident) => incident.status === "open").slice(0, 5))
    setTanks(tanksData)
    setAvailability(availabilityData)
  }, [availabilityData, incidentsData, segments, tanksData])

  const donutData = useMemo(
    () =>
      segmentsCount.map((value, index) => ({
        name: `PHI ${index}`,
        value
      })),
    [segmentsCount]
  )

  const avgHeadroom = useMemo(() => {
    if (!tanks.length) return 0
    return tanks.reduce((sum, tank) => sum + (tank.properties.headroom_pct ?? 0), 0) / tanks.length
  }, [tanks])

  const riskTanks = useMemo(() => {
    return [...tanks]
      .sort((a, b) => (a.properties.resilience_hours ?? 999) - (b.properties.resilience_hours ?? 999))
      .slice(0, 3)
  }, [tanks])

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Mission Control</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataBadge label="backend" value="HF green" />
          <DataBadge label="frontend" value="Lumio-style" tone="teal" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--text-hi)]">Network Health</div>
              <div className="text-sm text-[var(--text-md)]">PHI distribution + recent delta</div>
            </div>
            <DataBadge label="segments" value={String(segmentsCount.reduce((sum, value) => sum + value, 0))} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={3}>
                    {donutData.map((entry, index) => (
                      <Cell key={entry.name} fill={phiPalette[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <XAxis dataKey="ts" tick={{ fill: "#6983A3", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="phi" stroke="#4bd6ff" fill="rgba(75,214,255,0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="grid h-full gap-4 sm:grid-cols-[0.85fr_1.15fr] sm:items-center">
            <div>
              <div className="text-sm text-[var(--text-hi)]">Water Availability</div>
              <div className="mt-4 text-[2rem] font-semibold text-[var(--acea-ice)]">
                {availability?.grace_anomaly?.value_mm_eq_water ?? -12} mm
              </div>
              <div className="mt-2 text-sm text-[var(--text-md)]">
                {availability?.grace_anomaly?.narrative ?? "Groundwater anomaly in watch range with seasonal precipitation lag."}
              </div>
            </div>
            <div className="h-40 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={availability?.era5_precip_30d ?? []}>
                  <XAxis dataKey="day_index" tick={{ fill: "#6983A3", fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Area type="monotone" dataKey="precip_mm" stroke="#44d7c0" fill="rgba(68,215,192,0.16)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_0.8fr_1.55fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="text-sm text-[var(--text-hi)]">Active Incidents</div>
          <div className="mt-4 grid gap-3">
            {incidents.map((incident) => (
              <Link key={incident.id} href="/app/incidents" className="rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-[var(--text-hi)]">{incident.title}</div>
                  <PhiPill value={Math.min(3, incident.severity) as 0 | 1 | 2 | 3} />
                </div>
                <div className="mt-1 text-sm text-[var(--text-md)]">{incident.entity_type} {incident.entity_id}</div>
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="text-sm text-[var(--text-hi)]">Tank Fleet</div>
          <Gauge value={avgHeadroom} label="Avg headroom" />
          <div className="mt-4 grid gap-2">
            {riskTanks.map((tank) => (
              <Link key={tank.properties.id} href={`/app/tank/${tank.properties.id}`} className="rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="text-sm text-[var(--text-hi)]">{tank.properties.name}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">
                  resilience {Math.round(tank.properties.resilience_hours ?? 0)}h
                </div>
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="grid h-full gap-4 lg:grid-cols-[150px_1fr_1fr]">
            <div className="flex flex-col justify-between gap-3">
              <div>
                <div className="text-sm text-[var(--text-hi)]">Daily Ingest</div>
                <div className="mt-1 text-sm text-[var(--text-md)]">Traceable summary.</div>
              </div>
              <DataBadge label="today" value={digest?.day ?? "stub"} tone="neutral" />
            </div>
            <div className="rounded-[1.6rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4 text-body">
              {digest?.trend_summary ??
                "The operational twin remains globally stable, with clusters to watch in the Cassino corridor and tanks showing unstable mass-balance signals."}
            </div>
            <div className="grid content-start gap-2">
              {(digest?.intervention_recs ?? [
                { id: 1, text: "Check pressure and nighttime demand in the Cassino Axis corridor." },
                { id: 2, text: "Monitor tanks with anomalous mass-balance residuals." }
              ]).map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[var(--text-md)]">
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
