"use client"

import { Activity, BarChart3, Coins, Waves } from "lucide-react"

import { cn } from "@/lib/utils"

type AgentMode = "operations" | "investments"

type LiquidGlassSliderProps = {
  value: AgentMode
  onChange: (value: AgentMode) => void
}

const modes: Array<{
  value: AgentMode
  label: string
  detail: string
  icon: typeof Activity
}> = [
  {
    value: "operations",
    label: "Operations",
    detail: "Districts, valves, pressure",
    icon: BarChart3
  },
  {
    value: "investments",
    label: "Investments",
    detail: "GIS, falde, ARERA, ROI",
    icon: Coins
  }
]

export function LiquidGlassSlider({ value, onChange }: LiquidGlassSliderProps) {
  const activeIndex = modes.findIndex((item) => item.value === value)

  return (
    <div className="relative rounded-[1.4rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.72)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_20px_70px_rgba(8,53,107,0.12)] backdrop-blur-[20px]">
      <div
        className="absolute bottom-1.5 top-1.5 w-[calc(50%-0.375rem)] rounded-[1.1rem] border border-[rgba(216,244,255,0.34)] bg-[linear-gradient(135deg,rgba(216,244,255,0.22),rgba(75,214,255,0.12),rgba(255,255,255,0.08))] shadow-[0_18px_42px_rgba(47,144,255,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      >
        <div className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[rgba(216,244,255,0.28)] bg-[rgba(216,244,255,0.14)]">
          <Waves className="h-4 w-4 text-[var(--acea-ice)]" />
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-1">
        {modes.map((mode) => {
          const Icon = mode.icon
          const active = mode.value === value
          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(mode.value)}
              className={cn(
                "grid min-h-16 grid-cols-[2.25rem_1fr] items-center gap-3 rounded-[1.1rem] px-3 text-left transition",
                active ? "text-[var(--acea-ice)]" : "text-[var(--text-md)] hover:text-[var(--text-hi)]"
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.72)]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{mode.label}</span>
                <span className="block truncate text-xs text-[var(--text-lo)]">{mode.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
