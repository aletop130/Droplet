"use client"

import dynamic from "next/dynamic"

const DeckMap = dynamic(() => import("@/components/map/DeckMap").then((module) => module.DeckMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[calc(100vh-7.5rem)] min-h-[620px] place-items-center rounded-lg border border-[var(--glass-stroke)] bg-[var(--bg-1)] text-sm text-[var(--text-md)]">
      Loading operational map...
    </div>
  )
})

export function MapClient() {
  return <DeckMap />
}
