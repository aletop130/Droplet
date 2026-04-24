"use client"

import { cn } from "@/lib/utils"

export type MapLayerKey = "phi" | "tanks" | "incidents" | "dmas" | "sources" | "subsidence" | "ndvi" | "thermal" | "tdoa"

const labels: { key: MapLayerKey; label: string }[] = [
  { key: "phi", label: "PHI" },
  { key: "tanks", label: "Tanks" },
  { key: "incidents", label: "Incidents" },
  { key: "dmas", label: "DMAs" },
  { key: "sources", label: "Sources" },
  { key: "subsidence", label: "Subsidence" },
  { key: "ndvi", label: "NDVI resid" },
  { key: "thermal", label: "Thermal resid" },
  { key: "tdoa", label: "TDOA" }
]

type LayerTogglesProps = {
  enabled: Record<MapLayerKey, boolean>
  onToggle: (key: MapLayerKey) => void
}

export function LayerToggles({ enabled, onToggle }: LayerTogglesProps) {
  return (
    <div className="grid gap-2">
      {labels.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onToggle(item.key)}
          className={cn(
            "flex h-8 items-center justify-between rounded-md border px-3 text-xs transition",
            enabled[item.key]
              ? "border-[rgba(34,207,255,0.42)] bg-[rgba(34,207,255,0.1)] text-[var(--acea-cyan)]"
              : "border-white/10 bg-white/[0.03] text-[var(--text-md)] hover:border-[var(--glass-stroke)]"
          )}
        >
          <span>{item.label}</span>
          <span className="h-2 w-2 rounded-full bg-current" />
        </button>
      ))}
    </div>
  )
}
