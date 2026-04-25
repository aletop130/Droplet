"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { getScarcityForecast, getSourceAvailability } from "@/lib/api"
import type { ScarcityForecast, SourceAvailability } from "@/types/domain"

export default function SourcePage() {
  const [availability, setAvailability] = useState<SourceAvailability | null>(null)
  const [forecast, setForecast] = useState<ScarcityForecast | null>(null)
  const [days, setDays] = useState<30 | 60 | 90>(30)

  useEffect(() => {
    getSourceAvailability().then(setAvailability)
  }, [])

  useEffect(() => {
    getScarcityForecast(days).then(setForecast)
  }, [days])

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5">
      <section className="flex items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Sorgenti</div>
          <h1 className="text-h1 mt-2">Groundwater stress, source posture and scarcity confidence bands.</h1>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-hi)]">ERA5 precip 30d</div>
            <DataBadge label="pilot" value={availability?.pilot ?? "Ciociaria"} />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={availability?.era5_precip_30d ?? []}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="day_index" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="precip_mm" stroke="#44d7c0" fill="rgba(68,215,192,0.16)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-hi)]">Scarcity forecast</div>
            <div className="flex gap-2">
              {[30, 60, 90].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value as 30 | 60 | 90)}
                  className={`rounded-full border px-3 py-1 text-data ${days === value ? "border-[rgba(75,214,255,0.24)] text-[var(--acea-cyan)]" : "border-[rgba(173,218,255,0.12)] text-[var(--text-lo)]"}`}
                >
                  {value}d
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast?.bands ?? []}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="upper" stroke="#4bd6ff" fill="rgba(75,214,255,0.08)" />
                <Area type="monotone" dataKey="expected" stroke="#d8f4ff" fill="rgba(216,244,255,0.14)" />
                <Area type="monotone" dataKey="lower" stroke="#44d7c0" fill="rgba(68,215,192,0.08)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="text-sm text-[var(--text-hi)]">Concession headroom</div>
          <div className="mt-4 grid gap-2">
            {availability?.sources.slice(0, 8).map((source, index) => (
              <div key={source.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--text-hi)]">{source.name}</div>
                  <div className="text-data text-[var(--text-lo)]">{source.kind}</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.06)]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--acea-cyan),var(--acea-teal))]" style={{ width: `${78 - index * 6}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="text-sm text-[var(--text-hi)]">ISTAT panel</div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">NRW Frosinone</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">69.5%</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-md)]">
              Alcuni comuni risultano ancora con servizio discontinuo e stress idrico strutturale. Fonte citata nel piano gara e nel contesto pilot.
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
