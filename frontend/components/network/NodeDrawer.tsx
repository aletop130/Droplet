"use client"

import { Gauge, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PipeNode, TankNode } from "@/types/domain"

type SelectedNetworkNode =
  | { kind: "tank"; item: TankNode }
  | { kind: "pipe"; item: PipeNode }
  | null

type NodeDrawerProps = {
  selected: SelectedNetworkNode
  onClose: () => void
}

function metricRows(rows: Array<[string, string | number | null | undefined]>) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
          <span className="text-data text-[var(--text-lo)]">{label}</span>
          <span className="text-right text-sm text-[var(--text-hi)]">{value ?? "n/a"}</span>
        </div>
      ))}
    </div>
  )
}

function TankLevel({ tank }: { tank: TankNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(75,214,255,0.16)] bg-[rgba(75,214,255,0.05)] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-data text-[var(--text-lo)]">LEVEL</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-hi)]">{Math.round(tank.fillLevel)}%</div>
        </div>
        <div className="text-right text-sm text-[var(--text-md)]">
          {tank.level_m.toFixed(1)}m / {tank.max_level_m.toFixed(1)}m
        </div>
      </div>
      <div className="h-6 overflow-hidden rounded-full border border-[var(--glass-stroke)] bg-[rgba(239,247,255,0.86)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--water-blue),var(--acea-teal))]"
          style={{ width: `${tank.fillLevel}%` }}
        />
      </div>
    </div>
  )
}

function PipeFlow({ pipe }: { pipe: PipeNode }) {
  return (
    <div className="rounded-2xl border border-[rgba(75,214,255,0.16)] bg-[rgba(75,214,255,0.05)] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-data text-[var(--text-lo)]">FLOW</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-hi)]">{Math.round(pipe.fillPercent)}%</div>
        </div>
        <div className="text-right text-sm text-[var(--text-md)]">
          {pipe.flowRate.toFixed(1)} / {pipe.maxFlow.toFixed(1)} l/s
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-[var(--glass-stroke)] bg-[rgba(239,247,255,0.86)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--acea-cyan),var(--phi-yellow))]"
          style={{ width: `${pipe.fillPercent}%` }}
        />
      </div>
    </div>
  )
}

export function NodeDrawer({ selected, onClose }: NodeDrawerProps) {
  if (!selected) {
    return (
      <aside className="min-h-[30rem] rounded-[1.6rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.025)] p-5">
        <div className="grid h-full place-items-center text-center">
          <div>
            <Gauge className="mx-auto mb-3 h-8 w-8 text-[var(--text-lo)]" />
            <div className="text-sm text-[var(--text-md)]">Select a tank or segment</div>
          </div>
        </div>
      </aside>
    )
  }

  const isTank = selected.kind === "tank"
  const item = selected.item
  const title = selected.kind === "tank" ? selected.item.name : `Segment ${selected.item.id}`

  return (
    <aside className="rounded-[1.6rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_24px_70px_rgba(8,53,107,0.12)] backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-data", isTank ? "text-[var(--acea-cyan)]" : "text-[var(--phi-yellow)]")}>
            {isTank ? `Tank ${item.id}` : "Pipe segment"}
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold text-[var(--text-hi)]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)] transition hover:text-[var(--text-hi)]"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5">
        {selected.kind === "tank" ? (
          <>
            <TankLevel tank={selected.item} />
            {metricRows([
              ["Capacity", `${Math.round(selected.item.capacity_m3)} m3`],
              ["Inflow", `${selected.item.inflow_lps.toFixed(1)} l/s`],
              ["Outflow", `${selected.item.outflow_lps.toFixed(1)} l/s`],
              ["Net", `${(selected.item.inflow_lps - selected.item.outflow_lps).toFixed(1)} l/s`],
              ["Headroom", `${selected.item.headroom_pct.toFixed(1)}%`],
              ["Resilience", `${selected.item.resilience_hours.toFixed(1)} h`]
            ])}
            {metricRows([
              ["DMA", selected.item.dma_name],
              ["Elevation", selected.item.elevation_m != null ? `${Math.round(selected.item.elevation_m)} m` : null],
              ["Source", selected.item.data_source],
              ["Connected pipes", selected.item.connectedPipes.length]
            ])}
          </>
        ) : (
          <>
            <PipeFlow pipe={selected.item} />
            {metricRows([
              ["Length", `${Math.round(selected.item.length_m)} m`],
              ["Diameter", `${selected.item.diameter_mm} mm`],
              ["Material", selected.item.material],
              ["Flow", `${selected.item.flowRate.toFixed(1)} l/s`],
              ["Max flow", `${selected.item.maxFlow.toFixed(1)} l/s`]
            ])}
            {metricRows([
              ["PHI", selected.item.phi],
              ["Subsidence", selected.item.subsidence.toFixed(2)],
              ["NDVI", selected.item.ndvi.toFixed(2)],
              ["Thermal", selected.item.thermal.toFixed(2)],
              ["Hydraulic", selected.item.hydraulic.toFixed(2)],
              ["Tank signal", selected.item.tank_signal.toFixed(2)]
            ])}
            {metricRows([
              ["Installed", selected.item.install_year],
              ["DMA", selected.item.dma_name],
              ["From tank", selected.item.fromTank],
              ["To tank", selected.item.toTank]
            ])}
          </>
        )}

      </div>
    </aside>
  )
}
