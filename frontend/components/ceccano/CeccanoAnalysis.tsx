"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Droplet,
  Gauge,
  Layers,
  Moon,
  Radio,
  SlidersHorizontal,
  Sun,
  Waves
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/Button"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { adjustCeccanoValve, getCeccanoAnalysis } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { CeccanoAdjustResult, CeccanoAnalysis as CeccanoAnalysisData, CeccanoDistrict, CeccanoValve } from "@/types/domain"

type LayerKey = "districts" | "reservoirs" | "conduits" | "valves" | "sensors" | "users"

const defaultLayers: Record<LayerKey, boolean> = {
  districts: true,
  reservoirs: true,
  conduits: true,
  valves: true,
  sensors: true,
  users: false
}

const layerLabels: Array<{ key: LayerKey; label: string; icon: typeof Layers }> = [
  { key: "districts", label: "Distretti", icon: Layers },
  { key: "reservoirs", label: "Serbatoi", icon: Droplet },
  { key: "conduits", label: "Condotte", icon: Waves },
  { key: "valves", label: "Valvole", icon: SlidersHorizontal },
  { key: "sensors", label: "Sensori", icon: Radio },
  { key: "users", label: "Utenze", icon: CheckCircle2 }
]

const statusStyle: Record<CeccanoDistrict["status"], string> = {
  normal: "border-[rgba(68,215,192,0.26)] bg-[rgba(68,215,192,0.12)] text-[var(--acea-teal)]",
  critical: "border-[rgba(244,63,94,0.34)] bg-[rgba(244,63,94,0.14)] text-[var(--phi-red)]",
  emergency: "border-[rgba(244,63,94,0.34)] bg-[rgba(244,63,94,0.14)] text-[var(--phi-red)]"
}

function pointForIndex(index: number, total: number, radiusX: number, radiusY: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: 50 + Math.cos(angle) * radiusX,
    y: 50 + Math.sin(angle) * radiusY
  }
}

function zoneColor(zone: string) {
  if (zone === "ALTO") return "rgba(75,214,255,0.72)"
  if (zone === "CENTRO") return "rgba(68,215,192,0.72)"
  if (zone === "BASSA") return "rgba(251,191,36,0.72)"
  return "rgba(216,244,255,0.7)"
}

function toneForStatus(status: CeccanoDistrict["status"]) {
  if (status === "critical") return "red"
  if (status === "emergency") return "red"
  return "teal"
}

export function CeccanoAnalysis() {
  const [data, setData] = useState<CeccanoAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [layers, setLayers] = useState(defaultLayers)
  const [selectedDistrictId, setSelectedDistrictId] = useState("CED-12")
  const [selectedValveId, setSelectedValveId] = useState("CEV-12")
  const [targetOpenPct, setTargetOpenPct] = useState(45)
  const [adjustment, setAdjustment] = useState<CeccanoAdjustResult | null>(null)
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getCeccanoAnalysis()
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        const priority = payload.districts.find((district) => district.status === "critical") ?? payload.districts[0]
        const valve = payload.valves.find((item) => item.district_id === priority.id) ?? payload.valves[0]
        setSelectedDistrictId(priority.id)
        setSelectedValveId(valve.valve_id)
        setTargetOpenPct(valve.recommended_open_pct)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedDistrict = useMemo(
    () => data?.districts.find((district) => district.id === selectedDistrictId) ?? data?.districts[0] ?? null,
    [data, selectedDistrictId]
  )

  const selectedValve = useMemo(
    () => data?.valves.find((valve) => valve.valve_id === selectedValveId) ?? data?.valves.find((valve) => valve.district_id === selectedDistrict?.id) ?? null,
    [data, selectedDistrict, selectedValveId]
  )

  const chartData = useMemo(() => {
    return data?.forecast.points.map((point) => ({
      time: new Date(point.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      flow: point.expected_flow_m3h,
      pressure: point.expected_pressure_bar,
      risk: point.risk_score
    })) ?? []
  }, [data])

  const criticalDistricts = useMemo(() => data?.districts.filter((district) => district.status !== "normal") ?? [], [data])

  function selectDistrict(district: CeccanoDistrict) {
    const valve = data?.valves.find((item) => item.district_id === district.id)
    setSelectedDistrictId(district.id)
    if (valve) {
      setSelectedValveId(valve.valve_id)
      setTargetOpenPct(valve.recommended_open_pct)
    }
    setAdjustment(null)
  }

  function selectValve(valve: CeccanoValve) {
    setSelectedValveId(valve.valve_id)
    setSelectedDistrictId(valve.district_id)
    setTargetOpenPct(valve.recommended_open_pct)
    setAdjustment(null)
  }

  async function applyAdjustment() {
    if (!selectedValve) return
    setAdjusting(true)
    try {
      const result = await adjustCeccanoValve(selectedValve.valve_id, targetOpenPct)
      setAdjustment(result)
    } finally {
      setAdjusting(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center">
        <GlassCard className="rounded-[1.6rem] p-6">
          <div className="flex items-center gap-3 text-sm text-[var(--text-md)]">
            <Radio className="h-4 w-4 animate-pulse text-[var(--acea-cyan)]" />
            Caricamento rete idrica Ceccano
          </div>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <DataBadge label="pilot" value="Ceccano" />
            <DataBadge label="updated" value={new Date(data.overview.updated_at).toLocaleTimeString("it-IT")} tone="neutral" />
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--text-hi)]">Ceccano Water Network Analysis</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-md)]">
            15 distretti, 15 serbatoi, 15 valvole giorno/notte. Grafica centrale, controlli fuori dalla mappa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[520px]">
          <Metric label="critical" value={String(data.overview.status.critical)} tone="red" />
          <Metric label="avg loss" value={`${data.overview.status.avg_loss_pct}%`} tone="yellow" />
          <Metric label="avg bar" value={`${data.overview.status.avg_pressure_bar}`} tone="cyan" />
          <Metric label="valves" value={String(data.valves.length)} tone="neutral" />
        </div>
      </header>

      <div className="grid gap-5 2xl:grid-cols-[minmax(780px,1fr)_440px]">
        <section className="min-w-0 space-y-4">
          <GlassCard className="rounded-[1.6rem] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-hi)]">Grafica rete Ceccano</div>
                <div className="text-data text-[var(--text-lo)]">Distretti, valvole, serbatoi, sensori</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {layerLabels.map((item) => {
                  const Icon = item.icon
                  const active = layers[item.key]
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setLayers((current) => ({ ...current, [item.key]: !current[item.key] }))}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs transition",
                        active
                          ? "border-[rgba(47,185,232,0.38)] bg-[rgba(47,185,232,0.13)] text-[var(--water-blue)]"
                          : "border-[rgba(78,111,145,0.18)] bg-white text-[var(--text-md)]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative min-h-[740px] overflow-hidden rounded-[1.35rem] border border-[rgba(78,111,145,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(231,244,255,0.98)_50%,rgba(248,252,255,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(47,185,232,0.16),transparent_36%),linear-gradient(rgba(24,120,216,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(24,120,216,0.055)_1px,transparent_1px)] bg-[length:auto,64px_64px,64px_64px]" />
              <div className="absolute inset-6">
              {layers.conduits ? (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {data.valves.map((valve, index) => {
                    const a = pointForIndex(index, data.valves.length, 34, 27)
                    const b = pointForIndex((index + 1) % data.valves.length, data.valves.length, 34, 27)
                    return (
                      <line
                        key={valve.valve_id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="rgba(75,214,255,0.34)"
                        strokeWidth="0.42"
                        strokeDasharray="1.6 1"
                      />
                    )
                  })}
                  <line x1="50" y1="50" x2="50" y2="18" stroke="rgba(68,215,192,0.34)" strokeWidth="0.44" />
                  <line x1="50" y1="50" x2="78" y2="61" stroke="rgba(68,215,192,0.34)" strokeWidth="0.44" />
                  <line x1="50" y1="50" x2="25" y2="65" stroke="rgba(68,215,192,0.34)" strokeWidth="0.44" />
                </svg>
              ) : null}

              {layers.districts ? (
                <div className="absolute inset-0">
                  {data.districts.map((district, index) => {
                    const point = pointForIndex(index, data.districts.length, 34, 27)
                    const active = district.id === selectedDistrict?.id
                    return (
                      <button
                        key={district.id}
                        type="button"
                        onClick={() => selectDistrict(district)}
                        className={cn(
                          "absolute h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 text-left shadow-[0_18px_38px_rgba(8,53,107,0.12)] backdrop-blur-md transition",
                          statusStyle[district.status],
                          active && "ring-2 ring-[var(--acea-cyan)]"
                        )}
                        style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      >
                        <span className="block text-xs font-semibold">{district.id}</span>
                        <span className="block truncate text-[10px] opacity-85">{district.zone}</span>
                        <span className="block text-[10px] opacity-85">{district.loss_pct}% loss</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {layers.reservoirs ? (
                <div className="absolute inset-0">
                  {data.reservoirs.map((reservoir, index) => {
                    const point = pointForIndex(index, data.reservoirs.length, 22, 17)
                    return (
                      <button
                        key={reservoir.id}
                        type="button"
                        onClick={() => setSelectedDistrictId(reservoir.district_id)}
                        title={reservoir.name}
                        className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(216,244,255,0.36)] bg-[rgba(75,214,255,0.18)] text-[var(--acea-ice)] shadow-[0_0_24px_rgba(75,214,255,0.18)]"
                        style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      >
                        <Droplet className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {layers.valves ? (
                <div className="absolute inset-0">
                  {data.valves.map((valve, index) => {
                    const point = pointForIndex(index, data.valves.length, 40, 31)
                    const active = valve.valve_id === selectedValve?.valve_id
                    return (
                      <button
                        key={valve.valve_id}
                        type="button"
                        title={valve.name}
                        onClick={() => selectValve(valve)}
                        className={cn(
                          "absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border bg-[rgba(255,255,255,0.82)] backdrop-blur-md transition",
                          valve.type === "day" ? "border-[rgba(251,191,36,0.45)] text-[var(--phi-yellow)]" : "border-[rgba(75,214,255,0.45)] text-[var(--acea-cyan)]",
                          active && "scale-110 ring-2 ring-[var(--acea-ice)]"
                        )}
                        style={{ left: `${point.x}%`, top: `${point.y}%` }}
                      >
                        {valve.type === "day" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {layers.sensors ? <SensorDots /> : null}
              {layers.users ? <UserClusters /> : null}

              </div>
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="rounded-[1.2rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-data text-[var(--text-lo)]">Operational summary</div>
                  <div className="mt-1 text-sm text-[var(--text-hi)]">{data.overview.ai_summary}</div>
                </div>
                <Bot className="h-5 w-5 shrink-0 text-[var(--acea-cyan)]" />
              </div>
            </GlassCard>
            <GlassCard className="rounded-[1.2rem] p-4">
              <div className="text-data text-[var(--text-lo)]">Night mode</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-hi)]">
                <Moon className="h-4 w-4 text-[var(--acea-cyan)]" />
                22:00-06:00, target 2.0 bar, flow 300 m3/h
              </div>
            </GlassCard>
          </div>
        </section>

        <aside className="grid min-w-0 content-start gap-4 2xl:sticky 2xl:top-24 2xl:self-start">

        {selectedDistrict ? (
          <GlassCard className="rounded-[1.6rem] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-data text-[var(--text-lo)]">{selectedDistrict.zone}</div>
                <h2 className="mt-1 text-xl font-semibold text-[var(--text-hi)]">{selectedDistrict.id}</h2>
                <div className="mt-1 text-sm text-[var(--text-md)]">{selectedDistrict.name}</div>
              </div>
              <DataBadge label="status" value={selectedDistrict.status} tone={toneForStatus(selectedDistrict.status)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric label="loss" value={`${selectedDistrict.loss_pct}%`} tone={selectedDistrict.status === "normal" ? "teal" : "red"} />
              <Metric label="pressure" value={`${selectedDistrict.pressure_actual_bar} bar`} tone={selectedDistrict.pressure_actual_bar < selectedDistrict.pressure_target_bar ? "yellow" : "cyan"} />
              <Metric label="target" value={`${selectedDistrict.pressure_target_bar} bar`} tone="neutral" />
              <Metric label="users" value={selectedDistrict.users.toLocaleString("it-IT")} tone="neutral" />
            </div>
            <div className="mt-4 rounded-lg border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-3 text-sm leading-6 text-[var(--text-md)]">
              {selectedDistrict.issue}
            </div>
          </GlassCard>
        ) : null}

        {selectedValve ? (
          <GlassCard className="rounded-[1.6rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-data text-[var(--text-lo)]">Valve impact estimate</div>
                <div className="mt-1 text-lg font-semibold text-[var(--text-hi)]">{selectedValve.valve_id}</div>
              </div>
              <DataBadge label="mode" value={selectedValve.type} tone={selectedValve.type === "day" ? "yellow" : "cyan"} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Metric label="now" value={`${selectedValve.stat_today_pct}%`} tone="neutral" />
              <Metric label="night" value={`${selectedValve.stat_night_pct}%`} tone="cyan" />
              <Metric label="suggest" value={`${selectedValve.recommended_open_pct}%`} tone="yellow" />
            </div>
            <label className="mt-4 block">
              <div className="mb-2 flex items-center justify-between text-data text-[var(--text-lo)]">
                <span>Target apertura</span>
                <span className="text-[var(--text-hi)]">{targetOpenPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={targetOpenPct}
                onChange={(event) => setTargetOpenPct(Number(event.target.value))}
                className="w-full accent-cyan-300"
              />
            </label>
            <Button className="mt-4 w-full" onClick={applyAdjustment} disabled={adjusting}>
              <SlidersHorizontal className="h-4 w-4" />
              {adjusting ? "Estimating impact" : "Estimate valve adjustment impact"}
            </Button>
            {adjustment ? (
              <div className="mt-3 rounded-lg border border-[rgba(68,215,192,0.26)] bg-[rgba(68,215,192,0.1)] p-3 text-sm leading-6 text-[var(--text-md)]">
                Dopo l'aggiustamento: pressione stimata {adjustment.expected_pressure_bar} bar, flusso {adjustment.expected_flow_m3h} m3/h.
              </div>
            ) : null}
          </GlassCard>
        ) : null}
        </aside>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <GlassCard className="rounded-[1.6rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-hi)]">24h pressure forecast</div>
              <div className="text-data text-[var(--text-lo)]">Flow, bar, risk</div>
            </div>
            <Gauge className="h-5 w-5 text-[var(--acea-cyan)]" />
          </div>
          <div className="h-48 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#6983A3", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6983A3", fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="pressure" stroke="#4bd6ff" fill="rgba(75,214,255,0.16)" />
                <Area type="monotone" dataKey="risk" stroke="#fbbf24" fill="rgba(251,191,36,0.12)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="rounded-[1.6rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-hi)]">Distretti critici</div>
              <div className="text-data text-[var(--text-lo)]">{criticalDistricts.length} su 15</div>
            </div>
            <AlertTriangle className="h-5 w-5 text-[var(--phi-yellow)]" />
          </div>
          <div className="grid gap-2">
            {criticalDistricts.map((district) => (
              <button
                key={district.id}
                type="button"
                onClick={() => selectDistrict(district)}
                className="flex items-center justify-between gap-3 rounded-lg border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-left"
              >
                <div>
                  <div className="text-sm text-[var(--text-hi)]">{district.id}</div>
                  <div className="text-data text-[var(--text-lo)]">{district.issue}</div>
                </div>
                <DataBadge label="loss" value={`${district.loss_pct}%`} tone={toneForStatus(district.status)} />
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "cyan" | "teal" | "red" | "yellow" | "neutral" }) {
  const color =
    tone === "red"
      ? "text-[var(--phi-red)]"
      : tone === "yellow"
        ? "text-[var(--phi-yellow)]"
        : tone === "teal"
          ? "text-[var(--acea-teal)]"
          : tone === "cyan"
            ? "text-[var(--acea-cyan)]"
            : "text-[var(--text-hi)]"
  return (
    <div className="rounded-lg border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
      <div className="text-data text-[var(--text-lo)]">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold", color)}>{value}</div>
    </div>
  )
}

function SensorDots() {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 40 }, (_, index) => {
        const point = pointForIndex(index, 40, 43, 34)
        const status = index % 13 === 0 ? "critical" : index % 7 === 0 ? "warning" : "ok"
        const color = status === "critical" ? "bg-[var(--phi-red)]" : status === "warning" ? "bg-[var(--phi-yellow)]" : "bg-[var(--acea-teal)]"
        return (
          <span
            key={index}
            className={cn("absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_16px_currentColor]", color)}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        )
      })}
    </div>
  )
}

function UserClusters() {
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 12 }, (_, index) => {
        const point = pointForIndex(index, 12, 27, 21)
        return (
          <span
            key={index}
            className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[rgba(216,244,255,0.18)] bg-[rgba(216,244,255,0.08)] text-[10px] text-[var(--acea-ice)]"
            style={{ left: `${point.x}%`, top: `${point.y}%`, boxShadow: `0 0 20px ${zoneColor(index < 4 ? "ALTO" : index < 8 ? "CENTRO" : "BASSA")}` }}
          >
            {8 + index}
          </span>
        )
      })}
    </div>
  )
}
