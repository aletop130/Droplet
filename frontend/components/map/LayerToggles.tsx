"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type MapLayerKey = "pipes" | "tanks" | "incidents" | "dmas" | "sources"

const labels: Array<{ key: MapLayerKey; label: string; shortcut: string }> = [
  { key: "pipes", label: "Pipes", shortcut: "1" },
  { key: "tanks", label: "Tanks", shortcut: "2" },
  { key: "incidents", label: "Incidents", shortcut: "3" },
  { key: "dmas", label: "Service areas", shortcut: "4" },
  { key: "sources", label: "Sources", shortcut: "5" }
]

type LayerTogglesProps = {
  enabled: Record<MapLayerKey, boolean>
  onToggle: (key: MapLayerKey) => void
}

export function LayerToggles({ enabled, onToggle }: LayerTogglesProps) {
  return (
    <div className="grid gap-2.5">
      {labels.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onToggle(item.key)}
          className={cn(
            "group flex items-center justify-between rounded-[1.35rem] border px-3 py-3 text-left transition",
            enabled[item.key]
              ? "border-[rgba(75,214,255,0.28)] bg-[linear-gradient(135deg,rgba(75,214,255,0.16),rgba(68,215,192,0.08))] text-[var(--acea-blue)] shadow-[0_12px_28px_rgba(8,53,107,0.12)]"
              : "border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)] hover:border-[rgba(173,218,255,0.18)] hover:bg-[rgba(255,255,255,0.05)]"
          )}
        >
          <span className="flex items-center gap-3">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-xl border transition",
                enabled[item.key]
                  ? "border-[rgba(216,244,255,0.22)] bg-[rgba(216,244,255,0.12)] text-[var(--acea-cyan)]"
                  : "border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.7)] text-[var(--text-lo)] group-hover:text-[var(--text-md)]"
              )}
            >
              {enabled[item.key] ? <Check className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-current/80" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-data text-[var(--text-lo)]">
                {enabled[item.key] ? "Visible on map" : "Hidden from map"}
              </span>
            </span>
          </span>
          <span className="rounded-full border border-current/15 bg-[rgba(255,255,255,0.72)] px-2.5 py-1 text-data">{item.shortcut}</span>
        </button>
      ))}
    </div>
  )
}
