"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Database, Droplets } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { DataBadge } from "@/components/ui/DataBadge"
import { getTanks } from "@/lib/api"
import type { TankFeature } from "@/types/domain"

const SEVERITY_LABELS = ["Normal", "Warning", "High", "Critical"]
const SEVERITY_COLORS = ["var(--phi-green)", "var(--phi-yellow)", "var(--phi-orange)", "var(--phi-red)"]

export default function TankListPage() {
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTanks()
      .then((fc) => setTanks(fc.features))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const criticalCount = tanks.filter((t) => t.properties.severity >= 2).length

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Tank Fleet
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal text-[var(--text-hi)]">
            Serbatoi — Ciociaria
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? (
            <DataBadge label="tanks" value="loading" />
          ) : (
            <>
              <DataBadge label="total" value={String(tanks.length)} tone="cyan" />
              {criticalCount > 0 && (
                <DataBadge label="critical" value={String(criticalCount)} tone="red" />
              )}
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-[var(--phi-red)]/30 bg-[var(--phi-red)]/5 px-4 py-3 text-sm text-[var(--phi-red)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tanks.map((tank) => {
            const { id, name, headroom_pct, severity, capacity_m3, data_source } = tank.properties
            const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[0]
            const label = SEVERITY_LABELS[severity] ?? "Unknown"
            return (
              <Link key={id} href={`/app/tank/${id}`}>
                <GlassCard className="group cursor-pointer p-4 transition-colors hover:border-[var(--acea-cyan)]/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="grid h-8 w-8 place-items-center rounded-md border"
                        style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
                      >
                        <Database className="h-4 w-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="font-[var(--font-jetbrains)] text-sm font-medium text-[var(--text-hi)]">
                          {name}
                        </div>
                        <div className="text-xs text-[var(--text-lo)]">ID {id}</div>
                      </div>
                    </div>
                    <span
                      className="rounded px-2 py-0.5 font-[var(--font-unbounded)] text-[10px] uppercase"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-md)]">
                    <div className="flex items-center gap-1.5">
                      <Droplets className="h-3 w-3 text-[var(--acea-teal)]" />
                      <span>Headroom: <span className="font-[var(--font-jetbrains)] text-[var(--text-hi)]">{headroom_pct}%</span></span>
                    </div>
                    {capacity_m3 != null && (
                      <div className="text-right text-[var(--text-lo)]">
                        {capacity_m3.toLocaleString()} m³
                      </div>
                    )}
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${Math.min(headroom_pct, 100)}%`, backgroundColor: color }}
                    />
                  </div>

                  {data_source && (
                    <div className="mt-2 text-[10px] text-[var(--text-lo)]">
                      src: {data_source}
                    </div>
                  )}
                </GlassCard>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
