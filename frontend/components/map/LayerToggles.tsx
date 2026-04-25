"use client"

import { cn } from "@/lib/utils"

export type MapLayerKey = "pipes" | "tanks" | "incidents" | "dmas" | "sources"

const labels: Array<{ key: MapLayerKey; label: string; shortcut: string }> = [
  { key: "pipes", label: "Condotte", shortcut: "1" },
  { key: "tanks", label: "Serbatoi", shortcut: "2" },
  { key: "incidents", label: "Incidenti", shortcut: "3" },
  { key: "dmas", label: "DMAs", shortcut: "4" },
  { key: "sources", label: "Sorgenti", shortcut: "5" }
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
            "flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition",
            enabled[item.key]
              ? "border-[rgba(75,214,255,0.24)] bg-[rgba(75,214,255,0.08)] text-[var(--acea-ice)]"
              : "border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)]"
          )}
        >
          <span>{item.label}</span>
          <span className="rounded-full border border-current/20 px-2 py-0.5 text-data">{item.shortcut}</span>
        </button>
      ))}
    </div>
  )
}
