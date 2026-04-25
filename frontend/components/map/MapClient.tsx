"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { GitBranch, Map as MapIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { NetworkGraph } from "@/components/network/NetworkGraph"

const DeckMap = dynamic(() => import("@/components/map/DeckMap").then((module) => module.DeckMap), {
  ssr: false
})

type MapMode = "geo" | "network"

const modes: Array<{ key: MapMode; label: string; icon: typeof MapIcon }> = [
  { key: "geo", label: "Geo", icon: MapIcon },
  { key: "network", label: "Network", icon: GitBranch }
]

export function MapClient() {
  const [mode, setMode] = useState<MapMode>("geo")

  return (
    <>
      <div className="fixed right-4 top-[5.75rem] z-40 rounded-[1.25rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.88)] p-1 shadow-[0_18px_46px_rgba(8,53,107,0.14)] backdrop-blur-xl">
        <div className="flex items-center gap-1">
          {modes.map((item) => {
            const Icon = item.icon
            const active = mode === item.key
            return (
              <button
                key={item.key}
                type="button"
                title={item.label}
                aria-pressed={active}
                onClick={() => setMode(item.key)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-[1rem] px-3 text-sm font-medium transition",
                  active
                    ? "bg-[rgba(75,214,255,0.16)] text-[var(--acea-blue)]"
                    : "text-[var(--text-md)] hover:bg-[rgba(8,53,107,0.05)] hover:text-[var(--text-hi)]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {mode === "geo" ? (
        <DeckMap />
      ) : (
        <div className="fixed inset-0 z-0 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.98))] px-4 pb-8 pt-28 lg:pl-[17.5rem] lg:pr-6">
          <NetworkGraph embedded />
        </div>
      )}
    </>
  )
}
