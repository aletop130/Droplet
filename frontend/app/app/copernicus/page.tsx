"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { CloudSun, Database, MapPinned, RefreshCw, Satellite, Thermometer, Waves } from "lucide-react"

import { getCopernicusHistory, getCopernicusStatus, triggerCopernicusIngest } from "@/lib/api"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { useDataStore } from "@/store/dataStore"
import type { CopernicusHistory, CopernicusProduct, CopernicusStatus, ScarcityForecast, SourceAvailability } from "@/types/domain"

function formatDate(value?: string | null) {
  if (!value) return "n/a"
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))
}

function metricValue(product: CopernicusProduct, key: string, suffix = "") {
  const value = product.metrics[key]
  if (typeof value !== "number") return "n/a"
  return `${value}${suffix}`
}

export default function CopernicusPage() {
  const availabilityData = useDataStore((state) => state.sourceAvailability)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const forecastCache = useDataStore((state) => state.scarcityForecastByDays)
  const fetchScarcityForecast = useDataStore((state) => state.fetchScarcityForecast)
  const [status, setStatus] = useState<CopernicusStatus | null>(null)
  const [history, setHistory] = useState<CopernicusHistory | null>(null)
  const [availability, setAvailability] = useState<SourceAvailability | null>(null)
  const [forecast, setForecast] = useState<ScarcityForecast | null>(null)
  const [days, setDays] = useState<30 | 60 | 90>(30)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [nextStatus, nextHistory] = await Promise.all([
      getCopernicusStatus(),
      getCopernicusHistory(24)
    ])
    setStatus(nextStatus)
    setHistory(nextHistory)
  }, [])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Copernicus API unavailable"))
  }, [load])

  useEffect(() => {
    void fetchCore()
  }, [fetchCore])

  useEffect(() => {
    if (availabilityData) setAvailability(availabilityData)
  }, [availabilityData])

  useEffect(() => {
    const cached = forecastCache[days]
    if (cached) {
      setForecast(cached)
      return
    }
    void fetchScarcityForecast(days).then(setForecast)
  }, [days, fetchScarcityForecast, forecastCache])

  async function refreshNow() {
    setRefreshing(true)
    setError(null)
    try {
      await triggerCopernicusIngest()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual ingest failed")
    } finally {
      setRefreshing(false)
    }
  }

  const latest = status?.latest ?? []
  const s2 = latest.find((item) => item.source === "s2")
  const s3 = latest.find((item) => item.source === "s3")

  const chartData = useMemo(() => {
    const byHour = new Map<string, { hour: string; ndvi?: number; ndwi?: number; lst?: number }>()
    for (const item of [...(history?.items ?? [])].reverse()) {
      const hour = formatDate(item.ts)
      const current = byHour.get(hour) ?? { hour }
      if (item.source === "s2") {
        current.ndvi = item.metrics.ndvi_mean
        current.ndwi = item.metrics.ndwi_mean
      }
      if (item.source === "s3") {
        current.lst = item.metrics.lst_c_mean
      }
      byHour.set(hour, current)
    }
    return Array.from(byHour.values()).slice(-24)
  }, [history])

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Copernicus Data</div>
          <h1 className="text-h1 mt-2">Sentinel signals for the Ciociaria pilot area.</h1>
          <div className="mt-2 text-sm text-[var(--text-md)]">
            Last update {formatDate(status?.last_fetch)} · {status?.coverage.area ?? "Frosinone / Ciociaria"}
          </div>
        </div>
        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[rgba(75,214,255,0.24)] bg-[rgba(75,214,255,0.08)] px-4 text-sm font-medium text-[var(--acea-cyan)] transition hover:bg-[rgba(75,214,255,0.13)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Now
        </button>
      </section>

      {error ? (
        <GlassCard className="rounded-[1.6rem] border border-[rgba(244,63,94,0.25)] p-4 text-sm text-[var(--phi-red)]">
          {error}
        </GlassCard>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {s2 ? <ProductCard product={s2} /> : null}
        {s3 ? <ProductCard product={s3} /> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.65fr_1.35fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-[var(--text-hi)]">Processing footprint</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">Pilot area used by Sentinel jobs</div>
            </div>
            <DataBadge label="mode" value={status?.openeo.enabled ? "openEO" : "dry-run"} tone={status?.openeo.enabled ? "teal" : "yellow"} />
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[rgba(75,214,255,0.18)] bg-[rgba(75,214,255,0.08)]">
                <MapPinned className="h-3.5 w-3.5 text-[var(--acea-cyan)]" />
              </span>
              <div>
                <div className="text-sm text-[var(--text-hi)]">{status?.coverage.area ?? "Frosinone / Ciociaria"}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">
                  {status?.bbox.west ?? 13.2}-{status?.bbox.east ?? 13.8} E, {status?.bbox.south ?? 41.4}-{status?.bbox.north ?? 41.9} N
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--text-hi)]">24h signals</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">NDVI, NDWI and LST aggregates over the pilot area</div>
            </div>
            <DataBadge label="samples" value={String(history?.items.length ?? 0)} tone="neutral" />
          </div>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#6983A3", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="ndvi" stroke="#44d7c0" fill="rgba(68,215,192,0.12)" />
                <Area type="monotone" dataKey="ndwi" stroke="#4bd6ff" fill="rgba(75,214,255,0.1)" />
                <Area type="monotone" dataKey="lst" stroke="#fbbf24" fill="rgba(251,191,36,0.1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <GlassCard className="rounded-[1.8rem] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--text-hi)]">ERA5 precip 30d</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">Copernicus C3S ERA5 reanalysis</div>
            </div>
            <DataBadge label="mission" value="ERA5" />
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
            <div>
              <div className="text-sm text-[var(--text-hi)]">Scarcity forecast</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">ERA5 + GRACE-FO water-storage signal</div>
            </div>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--text-hi)]">Source posture</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">Sentinel-1 EGMS + source registry aggregation</div>
            </div>
            <DataBadge label="pilot" value={availability?.pilot ?? "Ciociaria"} />
          </div>
          <div className="mt-4 grid gap-2">
            {availability?.sources.slice(0, 8).map((source, index) => (
              <div key={source.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[var(--text-hi)]">{source.name}</div>
                    <div className="mt-1 text-data text-[var(--text-lo)]">EGMS/Sentinel-1 reference</div>
                  </div>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--text-hi)]">Groundwater and baseline panel</div>
              <div className="mt-1 text-data text-[var(--text-lo)]">GRACE-FO + ISTAT Censimento Acque</div>
            </div>
            <DataBadge label="dataset" value="ISTAT" tone="neutral" />
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">GRACE-FO anomaly</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">
                {typeof availability?.grace_anomaly?.zscore === "number" ? availability.grace_anomaly.zscore.toFixed(2) : "n/a"}
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-data text-[var(--text-lo)]">NRW Frosinone</div>
              <div className="mt-1 text-[2rem] font-semibold text-[var(--acea-ice)]">69.5%</div>
            </div>
            <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-md)]">
              Source availability now sits in the Copernicus mission console with the satellite and dataset names attached to each aggregate.
            </div>
          </div>
        </GlassCard>
      </section>

      <GlassCard className="rounded-[1.8rem] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-[var(--text-hi)]">Fetch history</div>
          <DataBadge label="window" value="24h" tone="neutral" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-data text-[var(--text-lo)]">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2">Cloud</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(history?.items ?? []).slice(0, 14).map((item) => (
                <tr key={`${item.product_id}-${item.source}`} className="rounded-2xl bg-[rgba(255,255,255,0.03)] text-[var(--text-md)]">
                  <td className="rounded-l-2xl px-3 py-3 text-[var(--text-hi)]">{item.source_name}</td>
                  <td className="px-3 py-3 text-data">{item.product_id}</td>
                  <td className="px-3 py-3">{formatDate(item.ts)}</td>
                  <td className="px-3 py-3">{item.source === "s2" ? metricValue(item, "ndvi_mean") : metricValue(item, "lst_c_mean", " C")}</td>
                  <td className="px-3 py-3">{item.cloud_cover_pct === null ? "n/a" : `${item.cloud_cover_pct}%`}</td>
                  <td className="rounded-r-2xl px-3 py-3">
                    <span className={`rounded-full border px-3 py-1 text-data ${item.status === "ingested" ? "border-[rgba(68,215,192,0.28)] text-[var(--acea-teal)]" : "border-[rgba(244,63,94,0.3)] text-[var(--phi-red)]"}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

function ProductCard({ product }: { product: CopernicusProduct }) {
  const isS2 = product.source === "s2"
  const Icon = isS2 ? Satellite : Thermometer
  const SecondaryIcon = isS2 ? Waves : CloudSun

  return (
    <GlassCard className="rounded-[1.8rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.04)]">
            <Icon className="h-5 w-5 text-[var(--acea-cyan)]" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm text-[var(--text-hi)]">{product.source_name}</div>
            <div className="mt-1 truncate text-data text-[var(--text-lo)]">{product.collection}</div>
          </div>
        </div>
        <DataBadge label="res" value={isS2 ? "10 m" : "1 km"} tone={isS2 ? "teal" : "yellow"} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label={isS2 ? "NDVI mean" : "LST mean"} value={isS2 ? metricValue(product, "ndvi_mean") : metricValue(product, "lst_c_mean", " C")} />
        <Metric label={isS2 ? "NDWI mean" : "LST max"} value={isS2 ? metricValue(product, "ndwi_mean") : metricValue(product, "lst_c_max", " C")} />
        <Metric label="Cloud cover" value={product.cloud_cover_pct === null ? "n/a" : `${product.cloud_cover_pct}%`} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
        <div className="flex items-center gap-2 text-sm text-[var(--text-md)]">
          <SecondaryIcon className="h-4 w-4 text-[var(--acea-teal)]" />
          {formatDate(product.ts)}
        </div>
        <div className="flex items-center gap-2 text-data text-[var(--text-lo)]">
          <Database className="h-3.5 w-3.5" />
          {String(product.provenance.mode ?? "unknown")}
        </div>
      </div>
    </GlassCard>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
      <div className="text-data text-[var(--text-lo)]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[var(--acea-ice)]">{value}</div>
    </div>
  )
}
